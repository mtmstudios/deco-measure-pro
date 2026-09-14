import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Blinds,
  Check,
  ChevronDown,
  Columns3,
  PanelTop,
  Rows3,
  Search,
  SquareStack,
  type LucideIcon,
} from "lucide-react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader } from "@/components/screen-header";
import { NumberInput } from "@/components/number-input";
import {
  berechnePreis,
  berechneDachfenster,
  istDachfenster,
  type PreisErgebnis,
} from "@/lib/preis-engine";
import { MHZ_PRODUKTE } from "@/lib/preis-data";
import { MONTAGE_OPTIONEN, type KostenOption } from "@/lib/montage-fahrt";
import {
  fehlendePflicht,
  gruppiereOptionen,
  kurzGruppe,
  maxMasse,
  modellInfo,
  optionVerfuegbar,
  toggleOption,
} from "@/lib/konfigurator-meta";
import type { Zuschlag } from "@/lib/preis-engine";

export const Route = createFileRoute("/_authenticated/konfigurator")({
  // Optional ?projekt=<id>: vorausgewähltes Projekt (Absprung von der Projektseite).
  validateSearch: (search: Record<string, unknown>): { projekt?: string } => ({
    projekt: typeof search.projekt === "string" ? search.projekt : undefined,
  }),
  head: () => ({ meta: [{ title: "Sonnenschutz-Konfigurator · Aufmaß-App" }] }),
  component: KonfiguratorPage,
});

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Standard-Schienenfarben MHZ (im Preis enthalten) mit Farbmuster. */
const SCHIENENFARBEN = [
  { name: "Weiß", hex: "#F3F2EC" },
  { name: "Silber", hex: "#C6C8C4" },
  { name: "Anthrazit", hex: "#4A4E4D" },
  { name: "Schwarz", hex: "#1F2020" },
  { name: "Bronze", hex: "#7B5F44" },
];

const PRODUKT_ANZEIGE: Record<string, { label: string; icon: LucideIcon }> = {
  Plissee: { label: "Plissee", icon: Rows3 },
  "Duette Wabenplissee": { label: "Duette", icon: SquareStack },
  "Dachfenster-Plissee": { label: "Dachfenster", icon: PanelTop },
  Rollo: { label: "Rollo", icon: Blinds },
  Lamellenvorhang: { label: "Lamellen", icon: Columns3 },
};

/** Maß-Eingabe als cm parsen — akzeptiert Komma und Punkt (z. B. "94,4"). */
const parseCm = (s: string): number => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const KATEGORIEN = [...new Set(MHZ_PRODUKTE.map((p) => p.produkt))];

type ProjektRow = { id: string; kunde: string; objekt_bezeichnung: string | null };

function zuschlagPreis(z: Zuschlag): string {
  if (z.typ === "fix") return eur.format(z.wert);
  if (z.typ === "prozent") return `+ ${z.wert} %`;
  if (z.typ === "hoehe_tabelle" || z.typ === "breite_tabelle") return `ab ${eur.format(z.wert)}`;
  return `${eur.format(z.wert)}/m²`;
}

function KonfiguratorPage() {
  const navigate = useNavigate();
  const { projekt: projektParam } = Route.useSearch();

  // ——— Auswahl ———————————————————————————————————————————————
  const [kategorie, setKategorie] = useState(KATEGORIEN[0]);
  const modelle = useMemo(() => MHZ_PRODUKTE.filter((p) => p.produkt === kategorie), [kategorie]);
  const [modellIdx, setModellIdx] = useState(0);
  const produkt = modelle[modellIdx] ?? modelle[0];
  const dach = istDachfenster(produkt) ? produkt : null;
  const raster = istDachfenster(produkt) ? null : produkt;

  const [preisgruppe, setPreisgruppe] = useState(
    istDachfenster(MHZ_PRODUKTE[0]) ? "" : MHZ_PRODUKTE[0].preisgruppen[0].code,
  );
  const [fensterCode, setFensterCode] = useState("");
  const [gruppeIdx, setGruppeIdx] = useState(0);
  // Maße als Rohstring (sonst verschwindet beim Tippen von "94," das Komma).
  const [breite, setBreite] = useState("");
  const [hoehe, setHoehe] = useState("");
  const [anzahl, setAnzahl] = useState("1");
  const [schienenfarbe, setSchienenfarbe] = useState(SCHIENENFARBEN[0].name);
  const [zuschlaege, setZuschlaege] = useState<string[]>([]);
  // Montage ist Pflichtwahl — keine stille Vorbelegung (außer Dachfenster).
  const [montageCode, setMontageCode] = useState("");

  const applyProdukt = (p: (typeof MHZ_PRODUKTE)[number]) => {
    if (istDachfenster(p)) {
      setFensterCode(p.fenster[0].code);
      setGruppeIdx(0);
      setMontageCode("dachfenster");
    } else {
      setPreisgruppe(p.preisgruppen[0].code);
      setMontageCode((c) => (c === "dachfenster" ? "" : c));
    }
    setZuschlaege([]);
  };
  const wechsleKategorie = (k: string) => {
    if (k === kategorie) return;
    setKategorie(k);
    setModellIdx(0);
    applyProdukt(MHZ_PRODUKTE.filter((p) => p.produkt === k)[0]);
  };
  const wechsleModell = (i: number) => {
    if (i === modellIdx) return;
    setModellIdx(i);
    applyProdukt(modelle[i]);
  };

  const b = parseCm(breite);
  const h = parseCm(hoehe);
  const masseDa = b > 0 && h > 0;
  const max = raster ? maxMasse(raster) : null;
  const ueberMax = !!(max && ((b > 0 && b > max.breite_cm) || (h > 0 && h > max.hoehe_cm)));

  // Optionen, die bei der aktuellen Breite nicht (mehr) gehen, automatisch abwählen.
  useEffect(() => {
    if (!raster) return;
    setZuschlaege((prev) => {
      const next = prev.filter((code) => {
        const z = raster.zuschlaege?.find((x) => x.code === code);
        return z ? optionVerfuegbar(raster, z, b) : false;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [raster, b]);

  const ergebnis: PreisErgebnis | null = useMemo(() => {
    try {
      if (istDachfenster(produkt)) {
        return berechneDachfenster(produkt, fensterCode || produkt.fenster[0].code, gruppeIdx);
      }
      if (!masseDa) return null;
      return berechnePreis(produkt, { preisgruppe, breite_cm: b, hoehe_cm: h, zuschlaege });
    } catch {
      return null;
    }
  }, [produkt, preisgruppe, b, h, masseDa, zuschlaege, fensterCode, gruppeIdx]);

  const montage = MONTAGE_OPTIONEN.find((o) => o.code === montageCode) ?? null;
  const menge = Math.max(1, Math.round(parseCm(anzahl)) || 1);
  const fehlend = fehlendePflicht(produkt, zuschlaege);
  const info = modellInfo(produkt);

  // Was fehlt noch bis „Zum Angebot"? (erste offene Aufgabe gewinnt)
  const offen: string | null = !dach && !masseDa
    ? "Maße eingeben"
    : ergebnis && !ergebnis.lieferbar
      ? "Nicht lieferbar"
      : fehlend.length > 0
        ? `${fehlend[0]} wählen`
        : !montage
          ? "Montage wählen"
          : null;
  const bereit = !!ergebnis?.lieferbar && offen === null;

  const produktSumme = ergebnis?.lieferbar ? ergebnis.gesamt * menge : 0;
  const montageSumme = ergebnis?.lieferbar && montage ? montage.brutto * menge : 0;
  const gesamt = produktSumme + montageSumme;

  // ——— Kunde / Projekt ————————————————————————————————————————
  const { data: projekte = [] } = useQuery({
    queryKey: ["projekte-konfigurator"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projekt")
        .select("id, kunde, objekt_bezeichnung")
        .order("created_at", { ascending: false });
      return (data ?? []) as ProjektRow[];
    },
  });
  const [projektId, setProjektId] = useState(projektParam ?? "");
  const projekt = projekte.find((p) => p.id === projektId) ?? null;
  const [sheetOffen, setSheetOffen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hinzugefuegt, setHinzugefuegt] = useState(0);

  const zuruecksetzen = () => {
    setBreite("");
    setHoehe("");
    setAnzahl("1");
    setZuschlaege([]);
  };

  async function speichern(zielProjektId: string) {
    if (!ergebnis?.lieferbar || !bereit || !montage) return;
    setSaving(true);
    const { error } = await supabase.from("sonnenschutz_position" as never).insert({
      projekt_id: zielProjektId,
      produkt: produkt.produkt,
      modell: produkt.modell ?? null,
      gruppe: dach
        ? `Stoffgruppe ${dach.gruppen[gruppeIdx]}`
        : (raster?.preisgruppen.find((g) => g.code === preisgruppe)?.name ?? null),
      breite_cm: dach ? null : b,
      hoehe_cm: dach ? null : h,
      anzahl: menge,
      schienenfarbe: dach ? null : schienenfarbe,
      fenstertyp: dach ? fensterCode || dach.fenster[0].code : null,
      zuschlaege: ergebnis.zuschlaege,
      einzelpreis: ergebnis.gesamt,
      gesamtpreis: produktSumme,
      montage_typ: montage.code === "keine" ? null : montage.label,
      montage_kosten: montage.brutto || null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(
        /sonnenschutz_position|montage_|relation|does not exist|column|schema cache/i.test(
          error.message,
        )
          ? "Tabelle/Spalten fehlen noch — bitte Migration anwenden."
          : error.message,
      );
      return;
    }
    const n = hinzugefuegt + 1;
    setHinzugefuegt(n);
    toast.success("Zum Angebot hinzugefügt", {
      description: `${produkt.produkt} ${produkt.modell ?? ""} · ${eur.format(gesamt)}`,
      action: {
        label: "Zum Projekt",
        onClick: () => navigate({ to: "/projekt/$id", params: { id: zielProjektId } }),
      },
    });
    // Maße/Anzahl/Optionen für die nächste Position leeren — Produkt & Modell bleiben.
    zuruecksetzen();
  }

  const zumAngebot = () => {
    if (!bereit) return;
    if (!projektId) {
      setSheetOffen(true);
      return;
    }
    void speichern(projektId);
  };

  const optionsGruppen = useMemo(() => gruppiereOptionen(produkt), [produkt]);

  return (
    <>
      <ScreenHeader
        backTo={projektParam ? "/projekt/$id" : "/projekte"}
        backParams={projektParam ? { id: projektParam } : undefined}
        eyebrow="Sonnenschutz"
        title="Konfigurator"
      />

      <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 pt-4 pb-48 md:pb-32 lg:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          {/* Kontext: für welchen Kunden */}
          <KundenLeiste
            projekt={projekt}
            hinzugefuegt={hinzugefuegt}
            onWaehlen={() => setSheetOffen(true)}
            onZumProjekt={
              projektId ? () => navigate({ to: "/projekt/$id", params: { id: projektId } }) : undefined
            }
          />

          <Schritt nr={1} titel="Produkt">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {KATEGORIEN.map((k) => {
                const a = PRODUKT_ANZEIGE[k] ?? { label: k, icon: Rows3 };
                const aktiv = k === kategorie;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => wechsleKategorie(k)}
                    aria-pressed={aktiv}
                    className={auswahlKachel(aktiv, "min-h-[84px] flex flex-col items-center justify-center gap-2 px-2")}
                  >
                    <a.icon className="size-6" strokeWidth={1.4} />
                    <span className="text-[13px] font-medium leading-tight text-center">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </Schritt>

          <Schritt nr={2} titel="Modell">
            <div className="grid gap-2">
              {modelle.map((p, i) => {
                const mi = modellInfo(p);
                const aktiv = i === modellIdx;
                const mm = istDachfenster(p) ? null : maxMasse(p);
                return (
                  <button
                    key={`${p.produkt}-${p.modell}`}
                    type="button"
                    role="radio"
                    aria-checked={aktiv}
                    aria-label={`${mi.titel}, Modell ${p.modell}`}
                    onClick={() => wechsleModell(i)}
                    className={auswahlKachel(aktiv, "w-full text-left px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3")}
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-[17px] leading-snug text-[var(--color-ink)]">
                        {mi.titel}
                      </span>
                      <span className="block text-[13px] text-[var(--color-stone-muted)] mt-0.5">
                        {p.modell}
                        {mm ? ` · bis ${mm.breite_cm} × ${mm.hoehe_cm} cm` : ""}
                        {mi.hinweis ? ` · ${mi.hinweis}` : ""}
                      </span>
                    </span>
                    <AuswahlPunkt aktiv={aktiv} />
                  </button>
                );
              })}
            </div>
          </Schritt>

          {dach ? (
            <Schritt nr={3} titel="Fenster">
              <label className="flex flex-col gap-1.5">
                <FeldLabel>Fenstertyp (VELUX)</FeldLabel>
                <div className="relative">
                  <select
                    value={fensterCode || dach.fenster[0].code}
                    onChange={(e) => setFensterCode(e.target.value)}
                    className="appearance-none min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] pl-4 pr-10 text-[17px] font-serif focus:border-[var(--color-brand)] outline-none"
                  >
                    {dach.fenster.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.code}
                        {z.masse ? ` · ${z.masse}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-stone-muted)]" />
                </div>
              </label>
            </Schritt>
          ) : (
            <Schritt nr={3} titel="Maße" aside={max ? `bis ${max.breite_cm} × ${max.hoehe_cm} cm` : undefined}>
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Breite"
                  suffix="cm"
                  value={breite}
                  onChange={(e) => setBreite(e.target.value)}
                  className={max && b > max.breite_cm ? "!border-[var(--color-danger)]" : undefined}
                />
                <NumberInput
                  label="Höhe"
                  suffix="cm"
                  value={hoehe}
                  onChange={(e) => setHoehe(e.target.value)}
                  className={max && h > max.hoehe_cm ? "!border-[var(--color-danger)]" : undefined}
                />
              </div>
              <MassHinweis ergebnis={ergebnis} ueberMax={ueberMax} max={max} />
            </Schritt>
          )}

          <Schritt nr={4} titel={dach ? "Stoff" : "Stoff & Farbe"}>
            <div className="space-y-4">
              <div className="space-y-2">
                <FeldLabel>{(dach ?? raster)?.gruppen_label ?? "Preisgruppe"}</FeldLabel>
                <div className="flex flex-wrap gap-1.5" role="radiogroup">
                  {dach
                    ? dach.gruppen.map((g, i) => (
                        <SegmentButton key={g} label={`Stoffgruppe ${g}`} aktiv={i === gruppeIdx} onClick={() => setGruppeIdx(i)}>
                          {g}
                        </SegmentButton>
                      ))
                    : raster?.preisgruppen.map((g) => (
                        <SegmentButton
                          key={g.code}
                          label={g.name}
                          aktiv={g.code === preisgruppe}
                          onClick={() => setPreisgruppe(g.code)}
                        >
                          {kurzGruppe(g.name)}
                        </SegmentButton>
                      ))}
                </div>
              </div>
              {!dach && (
                <div className="space-y-2">
                  <FeldLabel>Schienenfarbe</FeldLabel>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {SCHIENENFARBEN.map((f) => {
                      const aktiv = f.name === schienenfarbe;
                      return (
                        <button
                          key={f.name}
                          type="button"
                          role="radio"
                          aria-checked={aktiv}
                          aria-label={`Schienenfarbe ${f.name}`}
                          onClick={() => setSchienenfarbe(f.name)}
                          className={auswahlKachel(aktiv, "min-h-[48px] pl-2.5 pr-4 inline-flex items-center gap-2.5")}
                        >
                          <span
                            aria-hidden
                            className="size-6 rounded-full border border-[rgba(38,44,38,0.18)]"
                            style={{ background: f.hex }}
                          />
                          <span className="text-[15px]">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Schritt>

          {optionsGruppen.length > 0 && (
            <Schritt nr={5} titel="Optionen">
              <div className="space-y-5">
                {optionsGruppen.map(({ gruppe, optionen }) => (
                  <OptionsGruppeBlock
                    key={gruppe.code}
                    label={gruppe.label}
                    exklusiv={gruppe.exklusiv}
                    pflicht={!!info.pflicht?.includes(gruppe.code)}
                    optionen={optionen}
                    gewaehlt={zuschlaege}
                    verfuegbar={(z) => (raster ? optionVerfuegbar(raster, z, b) : true)}
                    onToggle={(code) => setZuschlaege((prev) => toggleOption(prev, code))}
                  />
                ))}
              </div>
            </Schritt>
          )}

          <Schritt nr={optionsGruppen.length > 0 ? 6 : 5} titel="Menge & Montage">
            <div className="space-y-4">
              <div className="max-w-[180px]">
                <NumberInput
                  label="Anzahl"
                  step={1}
                  integer
                  min={1}
                  value={anzahl}
                  onChange={(e) => setAnzahl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FeldLabel>
                  Montage <span className="normal-case tracking-normal font-normal">· je Stück</span>
                </FeldLabel>
                <div className="grid sm:grid-cols-2 gap-2" role="radiogroup">
                  {MONTAGE_OPTIONEN.map((o) => {
                    const aktiv = o.code === montageCode;
                    return (
                      <button
                        key={o.code}
                        type="button"
                        role="radio"
                        aria-checked={aktiv}
                        aria-label={`Montage ${o.label}${o.brutto > 0 ? ", " + eur.format(o.brutto) : ""}`}
                        onClick={() => setMontageCode(o.code)}
                        className={auswahlKachel(aktiv, "min-h-[52px] px-4 flex items-center justify-between gap-3 text-left")}
                      >
                        <span className="text-[15px]">{o.label}</span>
                        <span className="text-[14px] tabular-nums text-[var(--color-stone-muted)]">
                          {o.brutto > 0 ? eur.format(o.brutto) : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Schritt>
        </div>

        {/* Tablet/Desktop: Zusammenfassung rechts, mitlaufend */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(9rem+env(safe-area-inset-top))] myr-card bg-[var(--color-paper)] p-5 space-y-4">
            <div>
              <p className="eyebrow">Position</p>
              <p className="font-serif text-[19px] leading-snug mt-1">
                {PRODUKT_ANZEIGE[produkt.produkt]?.label ?? produkt.produkt} · {info.titel}
              </p>
              <p className="text-[13px] text-[var(--color-stone-muted)]">
                {produkt.modell}
                {!dach && masseDa ? ` · ${breite} × ${hoehe} cm` : ""}
                {menge > 1 ? ` · ${menge} Stück` : ""}
              </p>
            </div>
            <PreisAufstellung ergebnis={ergebnis} menge={menge} montage={montage} />
            <GesamtZeile betrag={gesamt} offen={offen} ergebnis={ergebnis} />
            <AngebotButton bereit={bereit} saving={saving} offen={offen} projekt={projekt} onClick={zumAngebot} />
            {(masseDa || zuschlaege.length > 0) && (
              <button
                type="button"
                onClick={zuruecksetzen}
                className="w-full text-[13px] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)]"
              >
                Eingaben leeren
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Handy: Preisleiste über der Navigation */}
      <MobilePreisleiste
        ergebnis={ergebnis}
        menge={menge}
        montage={montage}
        gesamt={gesamt}
        offen={offen}
        bereit={bereit}
        saving={saving}
        projekt={projekt}
        onAngebot={zumAngebot}
      />

      <ProjektSheet
        offen={sheetOffen}
        onOffen={setSheetOffen}
        projekte={projekte}
        aktivId={projektId}
        bereit={bereit}
        onWahl={(id) => {
          setProjektId(id);
          setSheetOffen(false);
          if (bereit) void speichern(id);
        }}
      />
    </>
  );
}

/* ——— Bausteine ——————————————————————————————————————————————— */

function auswahlKachel(aktiv: boolean, extra: string): string {
  return [
    "border bg-[var(--color-paper)] text-[var(--color-ink)] transition-colors",
    aktiv
      ? "border-[var(--color-brand)] shadow-[inset_0_0_0_1px_var(--color-brand)] bg-[color-mix(in_oklab,var(--color-sand)_55%,var(--color-paper))]"
      : "border-[var(--color-hairline)] hover:border-[var(--color-sage-mid)]",
    extra,
  ].join(" ");
}

function FeldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-stone-muted)]">
      {children}
    </span>
  );
}

function Schritt({
  nr,
  titel,
  aside,
  children,
}: {
  nr: number;
  titel: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-5 border-b border-[var(--color-hairline)] last:border-b-0">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="flex items-baseline gap-2.5 font-serif text-[21px] font-medium leading-none">
          <span className="font-sans text-[12px] font-semibold tabular-nums text-[var(--color-stone-muted)]">
            {String(nr).padStart(2, "0")}
          </span>
          {titel}
        </h2>
        {aside && <span className="text-[13px] text-[var(--color-stone-muted)]">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function AuswahlPunkt({ aktiv, eckig }: { aktiv: boolean; eckig?: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "size-5 shrink-0 flex items-center justify-center border transition-colors",
        eckig ? "rounded-[3px]" : "rounded-full",
        aktiv
          ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-[var(--color-paper)]"
          : "border-[var(--color-sage-mid)] bg-[var(--color-paper)]",
      ].join(" ")}
    >
      {aktiv && <Check className="size-3.5" strokeWidth={2.5} />}
    </span>
  );
}

function SegmentButton({
  aktiv,
  onClick,
  children,
  label,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={aktiv}
      aria-label={label}
      onClick={onClick}
      className={[
        "min-h-[48px] min-w-[46px] px-3 border font-serif text-[17px] tabular-nums transition-colors",
        aktiv
          ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-[var(--color-paper)]"
          : "bg-[var(--color-paper)] border-[var(--color-hairline)] text-[var(--color-ink)] hover:border-[var(--color-sage-mid)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MassHinweis({
  ergebnis,
  ueberMax,
  max,
}: {
  ergebnis: PreisErgebnis | null;
  ueberMax: boolean;
  max: { breite_cm: number; hoehe_cm: number } | null;
}) {
  if (ueberMax && max) {
    return (
      <p role="alert" className="mt-3 flex items-start gap-2 text-[14px] text-[var(--color-danger)]">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.75} />
        Über dem Maximum — lieferbar bis {max.breite_cm} × {max.hoehe_cm} cm.
      </p>
    );
  }
  if (ergebnis && !ergebnis.lieferbar) {
    return (
      <p role="alert" className="mt-3 flex items-start gap-2 text-[14px] text-[var(--color-danger)]">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.75} />
        Diese Größe ist nicht lieferbar (für diese Breite ist die Höhe begrenzt).
      </p>
    );
  }
  if (ergebnis?.lieferbar) {
    const extra = ergebnis.hinweise.filter((x) => !x.includes("nicht lieferbar"));
    return (
      <p className="mt-3 text-[13px] text-[var(--color-stone-muted)]">
        Preis nach Raster{" "}
        <span className="num-serif text-[var(--color-ink)]">
          {ergebnis.raster.breite_cm} × {ergebnis.raster.hoehe_cm} cm
        </span>
        {extra.length > 0 ? ` · ${extra.join(" · ")}` : ""}
      </p>
    );
  }
  return null;
}

function OptionsGruppeBlock({
  label,
  exklusiv,
  pflicht,
  optionen,
  gewaehlt,
  verfuegbar,
  onToggle,
}: {
  label: string;
  exklusiv: boolean;
  pflicht: boolean;
  optionen: Zuschlag[];
  gewaehlt: string[];
  verfuegbar: (z: Zuschlag) => boolean;
  onToggle: (code: string) => void;
}) {
  const [alle, setAlle] = useState(false);
  const GRENZE = 4;
  const gewaehltHier = optionen.filter((z) => gewaehlt.includes(z.code));
  const sichtbar =
    alle || optionen.length <= GRENZE + 1
      ? optionen
      : [
          ...optionen.slice(0, GRENZE),
          ...gewaehltHier.filter((z) => optionen.indexOf(z) >= GRENZE),
        ];
  const verborgen = optionen.length - sichtbar.length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <FeldLabel>{label}</FeldLabel>
        <span
          className={[
            "text-[12px]",
            pflicht && gewaehltHier.length === 0
              ? "text-[var(--color-danger)] font-semibold"
              : "text-[var(--color-stone-muted)]",
          ].join(" ")}
        >
          {pflicht ? "Pflicht · eine wählen" : exklusiv ? "eine wählen" : "mehrere möglich"}
        </span>
      </div>
      <div
        role={exklusiv ? "radiogroup" : "group"}
        aria-label={label}
        className="border-y border-[var(--color-hairline)] divide-y divide-[var(--color-hairline)]"
      >
        {sichtbar.map((z) => {
          const aktiv = gewaehlt.includes(z.code);
          const ok = verfuegbar(z);
          return (
            <button
              key={z.code}
              type="button"
              role={exklusiv ? "radio" : "checkbox"}
              aria-checked={aktiv}
              aria-label={`${z.name}, ${zuschlagPreis(z)}${ok ? "" : ", bei dieser Breite nicht möglich"}`}
              disabled={!ok}
              onClick={() => onToggle(z.code)}
              className="w-full min-h-[52px] py-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-left disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <AuswahlPunkt aktiv={aktiv} eckig={!exklusiv} />
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug">{z.name}</span>
                {!ok && (
                  <span className="block text-[12px] text-[var(--color-stone-muted)]">
                    bei dieser Breite nicht möglich
                  </span>
                )}
              </span>
              <span className="text-[14px] tabular-nums text-[var(--color-stone-muted)] whitespace-nowrap">
                {zuschlagPreis(z)}
              </span>
            </button>
          );
        })}
      </div>
      {(verborgen > 0 || alle) && optionen.length > GRENZE + 1 && (
        <button
          type="button"
          onClick={() => setAlle((v) => !v)}
          className="mt-1 min-h-[44px] inline-flex items-center gap-1.5 text-[14px] text-[var(--color-brand)]"
        >
          <ChevronDown className={`size-4 transition-transform ${alle ? "rotate-180" : ""}`} />
          {alle ? "Weniger anzeigen" : `Alle ${optionen.length} anzeigen`}
        </button>
      )}
    </div>
  );
}

function PreisAufstellung({
  ergebnis,
  menge,
  montage,
}: {
  ergebnis: PreisErgebnis | null;
  menge: number;
  montage: KostenOption | null;
}) {
  if (!ergebnis?.lieferbar) return null;
  const zeile = (label: string, betrag: string, leise = false) => (
    <div className="flex justify-between items-baseline gap-3">
      <span className={`text-[14px] ${leise ? "text-[var(--color-stone-muted)]" : ""}`}>{label}</span>
      <span className={`text-[14px] tabular-nums ${leise ? "text-[var(--color-stone-muted)]" : ""}`}>
        {betrag}
      </span>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {zeile("Grundpreis", eur.format(ergebnis.grundpreis))}
      {ergebnis.zuschlaege.map((z, i) => (
        <div key={i}>{zeile(z.name, `+ ${eur.format(z.betrag)}`, true)}</div>
      ))}
      {menge > 1 && zeile(`× ${menge} Stück`, eur.format(ergebnis.gesamt * menge), true)}
      {montage && montage.brutto > 0 && zeile(`Montage · ${montage.label}`, `+ ${eur.format(montage.brutto * menge)}`, true)}
    </div>
  );
}

function GesamtZeile({
  betrag,
  offen,
  ergebnis,
}: {
  betrag: number;
  offen: string | null;
  ergebnis: PreisErgebnis | null;
}) {
  const lieferbar = !!ergebnis?.lieferbar;
  return (
    <div className="pt-3 border-t border-[var(--color-hairline)] flex items-baseline justify-between gap-3">
      <span className="text-[15px] font-semibold">Gesamt</span>
      {lieferbar ? (
        <span key={betrag} className="myr-rise font-serif text-[28px] font-semibold tabular-nums text-[var(--color-ink)]">
          {eur.format(betrag)}
        </span>
      ) : (
        <span className={`text-[14px] ${offen === "Nicht lieferbar" ? "text-[var(--color-danger)]" : "text-[var(--color-stone-muted)]"}`}>
          {offen ?? "—"}
        </span>
      )}
    </div>
  );
}

function AngebotButton({
  bereit,
  saving,
  offen,
  projekt,
  onClick,
  kompakt,
}: {
  bereit: boolean;
  saving: boolean;
  offen: string | null;
  projekt: ProjektRow | null;
  onClick: () => void;
  kompakt?: boolean;
}) {
  const text = saving ? "Speichert…" : bereit ? (kompakt ? "Zum Angebot" : "Zum Angebot hinzufügen") : (offen ?? "Zum Angebot");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!bereit || saving}
      aria-describedby={projekt ? undefined : "angebot-hinweis"}
      className={[
        "min-h-[52px] inline-flex items-center justify-center gap-2 px-5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors",
        kompakt ? "" : "w-full",
        bereit
          ? "bg-[var(--color-brand)] text-[var(--color-paper)] hover:bg-[var(--color-brand-hover)]"
          : "bg-transparent border border-dashed border-[var(--color-sage-mid)] text-[var(--color-stone-muted)] normal-case tracking-normal font-medium text-[14px]",
      ].join(" ")}
    >
      {bereit && <Check className="size-4" strokeWidth={2} />}
      {text}
    </button>
  );
}

function MobilePreisleiste({
  ergebnis,
  menge,
  montage,
  gesamt,
  offen,
  bereit,
  saving,
  projekt,
  onAngebot,
}: {
  ergebnis: PreisErgebnis | null;
  menge: number;
  montage: KostenOption | null;
  gesamt: number;
  offen: string | null;
  bereit: boolean;
  saving: boolean;
  projekt: ProjektRow | null;
  onAngebot: () => void;
}) {
  const [details, setDetails] = useState(false);
  const lieferbar = !!ergebnis?.lieferbar;
  return (
    <div
      className="lg:hidden fixed inset-x-0 md:left-[var(--side-nav-width,0px)] z-20 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[env(safe-area-inset-bottom)] bg-[var(--color-paper)]/97 backdrop-blur-[6px] border-t border-[var(--color-hairline)] shadow-[0_-12px_28px_-24px_rgba(38,44,38,0.9)]"
    >
      {details && lieferbar && (
        <div className="px-4 pt-3 pb-1 max-h-[40vh] overflow-y-auto">
          <PreisAufstellung ergebnis={ergebnis} menge={menge} montage={montage} />
        </div>
      )}
      <div className="px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <button
          type="button"
          onClick={() => lieferbar && setDetails((d) => !d)}
          aria-expanded={details}
          className="min-w-0 text-left min-h-[48px] flex flex-col justify-center"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-stone-muted)] flex items-center gap-1">
            Gesamt{projekt ? ` · ${projekt.kunde}` : ""}
            {lieferbar && <ChevronDown className={`size-3.5 transition-transform ${details ? "" : "rotate-180"}`} />}
          </span>
          {lieferbar ? (
            <span key={gesamt} className="myr-rise font-serif text-[24px] leading-tight font-semibold tabular-nums truncate">
              {eur.format(gesamt)}
            </span>
          ) : (
            <span className={`text-[15px] leading-tight ${offen === "Nicht lieferbar" ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"}`}>
              {offen ?? "—"}
            </span>
          )}
        </button>
        <AngebotButton
          kompakt
          bereit={bereit}
          saving={saving}
          offen={lieferbar ? offen : null}
          projekt={projekt}
          onClick={onAngebot}
        />
      </div>
    </div>
  );
}

function KundenLeiste({
  projekt,
  hinzugefuegt,
  onWaehlen,
  onZumProjekt,
}: {
  projekt: ProjektRow | null;
  hinzugefuegt: number;
  onWaehlen: () => void;
  onZumProjekt?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--color-hairline)]">
      <div className="min-w-0">
        <p className="eyebrow">Für</p>
        {projekt ? (
          <p className="font-serif text-[17px] leading-snug truncate">
            {projekt.kunde}
            {projekt.objekt_bezeichnung && (
              <span className="text-[var(--color-stone-muted)]"> · {projekt.objekt_bezeichnung}</span>
            )}
          </p>
        ) : (
          <p className="text-[15px] text-[var(--color-stone-muted)]">Kunde wählst du beim Hinzufügen</p>
        )}
        {hinzugefuegt > 0 && onZumProjekt && (
          <button type="button" onClick={onZumProjekt} className="link-quiet text-[13px] mt-0.5">
            {hinzugefuegt} {hinzugefuegt === 1 ? "Position" : "Positionen"} hinzugefügt · zum Projekt
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onWaehlen}
        className="shrink-0 min-h-[44px] px-3 text-[14px] text-[var(--color-brand)] underline underline-offset-4"
      >
        {projekt ? "Ändern" : "Kunde wählen"}
      </button>
    </div>
  );
}

function ProjektSheet({
  offen,
  onOffen,
  projekte,
  aktivId,
  bereit,
  onWahl,
}: {
  offen: boolean;
  onOffen: (o: boolean) => void;
  projekte: ProjektRow[];
  aktivId: string;
  bereit: boolean;
  onWahl: (id: string) => void;
}) {
  const [suche, setSuche] = useState("");
  const treffer = projekte.filter((p) =>
    `${p.kunde} ${p.objekt_bezeichnung ?? ""}`.toLowerCase().includes(suche.trim().toLowerCase()),
  );
  return (
    <Drawer.Root open={offen} onOpenChange={onOffen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-[rgba(38,44,38,0.35)]" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] max-h-[85vh] flex flex-col bg-[var(--color-paper)] border-t border-[var(--color-hairline)] rounded-t-[14px] outline-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--color-hairline)]" />
          <div className="px-5 pt-4 pb-3 space-y-3">
            <Drawer.Title className="font-serif text-[22px] font-medium">Für welchen Kunden?</Drawer.Title>
            <Drawer.Description className="text-[14px] text-[var(--color-stone-muted)]">
              {bereit ? "Die Position wird direkt diesem Projekt hinzugefügt." : "Projekt für diese Konfiguration wählen."}
            </Drawer.Description>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-stone-muted)]" />
              <input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Kunde oder Objekt suchen"
                className="min-h-[48px] w-full pl-9 pr-3 bg-[var(--color-paper)] border border-[var(--color-hairline)] text-[16px] outline-none focus:border-[var(--color-brand)]"
              />
            </label>
          </div>
          <div className="overflow-y-auto px-5 pb-5 divide-y divide-[var(--color-hairline)] border-t border-[var(--color-hairline)]">
            {treffer.length === 0 && (
              <p className="py-6 text-[15px] text-[var(--color-stone-muted)]">Kein Projekt gefunden.</p>
            )}
            {treffer.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onWahl(p.id)}
                aria-label={`${p.kunde}${p.objekt_bezeichnung ? ", " + p.objekt_bezeichnung : ""}`}
                className="w-full min-h-[56px] py-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-serif text-[17px] truncate">{p.kunde}</span>
                  {p.objekt_bezeichnung && (
                    <span className="block text-[13px] text-[var(--color-stone-muted)] truncate">
                      {p.objekt_bezeichnung}
                    </span>
                  )}
                </span>
                <AuswahlPunkt aktiv={p.id === aktivId} />
              </button>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
