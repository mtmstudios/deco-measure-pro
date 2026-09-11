import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { NumberInput } from "@/components/number-input";
import { berechnePreis, berechneDachfenster, istDachfenster } from "@/lib/preis-engine";
import { MHZ_PRODUKTE } from "@/lib/preis-data";

export const Route = createFileRoute("/_authenticated/konfigurator")({
  head: () => ({ meta: [{ title: "Sonnenschutz-Konfigurator · Aufmaß-App" }] }),
  component: KonfiguratorPage,
});

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Standard-Schienenfarben MHZ (im Preis enthalten). */
const SCHIENENFARBEN = ["Weiß", "Silber", "Anthrazit", "Schwarz", "Bronze"];

/** Maß-Eingabe als cm parsen — akzeptiert Komma und Punkt (z. B. "94,4"). */
const parseCm = (s: string): number => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Produkt-Kategorien (Plissee, Duette …) für die zweistufige Auswahl. */
const KATEGORIEN = [...new Set(MHZ_PRODUKTE.map((p) => p.produkt))];

function KonfiguratorPage() {
  // Ablauf: erst Produkt (Plissee/Duette), dann Modell.
  const [kategorie, setKategorie] = useState(KATEGORIEN[0]);
  const modelle = useMemo(() => MHZ_PRODUKTE.filter((p) => p.produkt === kategorie), [kategorie]);
  const [modellIdx, setModellIdx] = useState(0);
  const produkt = modelle[modellIdx] ?? modelle[0];
  const dach = istDachfenster(produkt) ? produkt : null;
  const raster = istDachfenster(produkt) ? null : produkt;
  const [preisgruppe, setPreisgruppe] = useState(
    istDachfenster(MHZ_PRODUKTE[0]) ? "" : MHZ_PRODUKTE[0].preisgruppen[0].code,
  );
  const [fensterCode, setFensterCode] = useState(
    istDachfenster(MHZ_PRODUKTE[0]) ? MHZ_PRODUKTE[0].fenster[0].code : "",
  );
  const [gruppeIdx, setGruppeIdx] = useState(0);
  // Maße als Rohstring halten, sonst wird beim Tippen von "94," sofort zu 94 geparst
  // und das Komma verschwindet (→ "944" statt "94,4"). Start LEER, damit man nicht
  // erst einen vorbelegten Wert löschen muss (sonst wird aus 100 + Tippen "1000").
  const [breite, setBreite] = useState("");
  const [hoehe, setHoehe] = useState("");
  const [anzahl, setAnzahl] = useState("1");
  const [schienenfarbe, setSchienenfarbe] = useState(SCHIENENFARBEN[0]);
  const [zuschlaege, setZuschlaege] = useState<string[]>([]);

  // Beim Produkt-/Modellwechsel Preisgruppe + Zuschläge zurücksetzen
  // (Codes wie "PGA" gibt es bei anderen Produkten nicht).
  const applyProdukt = (p: (typeof MHZ_PRODUKTE)[number]) => {
    if (istDachfenster(p)) {
      setFensterCode(p.fenster[0].code);
      setGruppeIdx(0);
    } else {
      setPreisgruppe(p.preisgruppen[0].code);
    }
    setZuschlaege([]);
  };
  const wechsleKategorie = (k: string) => {
    setKategorie(k);
    setModellIdx(0);
    applyProdukt(MHZ_PRODUKTE.filter((p) => p.produkt === k)[0]);
  };
  const wechsleModell = (i: number) => {
    setModellIdx(i);
    applyProdukt(modelle[i]);
  };

  const ergebnis = useMemo(() => {
    try {
      if (istDachfenster(produkt)) {
        return berechneDachfenster(produkt, fensterCode, gruppeIdx);
      }
      const b = parseCm(breite);
      const h = parseCm(hoehe);
      if (b <= 0 || h <= 0) return null; // noch keine Maße → kein Preis
      return berechnePreis(produkt, { preisgruppe, breite_cm: b, hoehe_cm: h, zuschlaege });
    } catch {
      return null;
    }
  }, [produkt, preisgruppe, breite, hoehe, zuschlaege, fensterCode, gruppeIdx]);

  const zuruecksetzen = () => {
    setBreite("");
    setHoehe("");
    setAnzahl("1");
    setZuschlaege([]);
  };

  const menge = Math.max(1, Math.round(parseCm(anzahl)) || 1);
  const gesamtMenge = ergebnis?.lieferbar ? ergebnis.gesamt * menge : 0;

  const toggleZuschlag = (code: string) => {
    setZuschlaege((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  return (
    <>
      <ScreenHeader
        backTo="/projekte"
        eyebrow="Preis-Engine"
        title="Sonnenschutz-Konfigurator"
      />
      <div className="myr-page mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-6 space-y-5 pb-28">
        <section className="myr-card p-5 space-y-4">
          <div className="space-y-1">
            <p className="eyebrow">Auswahl</p>
            <p className="text-[13px] text-[var(--color-stone-muted)]">
              {produkt.hersteller} {produkt.produkt} {produkt.modell} · {produkt.preisbasis}
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Produkt
            </span>
            <select
              value={kategorie}
              onChange={(e) => wechsleKategorie(e.target.value)}
              className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
            >
              {KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Modell
            </span>
            <select
              value={modellIdx}
              onChange={(e) => wechsleModell(Number(e.target.value))}
              className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
            >
              {modelle.map((p, i) => (
                <option key={i} value={i}>
                  {p.modell}
                </option>
              ))}
            </select>
          </label>

          {dach && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Fenstertyp (VELUX / Roto)
                </span>
                <select
                  value={fensterCode}
                  onChange={(e) => setFensterCode(e.target.value)}
                  className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
                >
                  {dach.fenster.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.code}
                      {z.masse ? ` · ${z.masse}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {dach.gruppen_label ?? "Stoffgruppe"}
                </span>
                <select
                  value={gruppeIdx}
                  onChange={(e) => setGruppeIdx(Number(e.target.value))}
                  className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
                >
                  {dach.gruppen.map((g, i) => (
                    <option key={g} value={i}>
                      Stoffgruppe {g}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {raster && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {raster.gruppen_label ?? "Preisgruppe"}
                </span>
                <select
                  value={preisgruppe}
                  onChange={(e) => setPreisgruppe(e.target.value)}
                  className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
                >
                  {raster.preisgruppen.map((pg) => (
                    <option key={pg.code} value={pg.code}>
                      {pg.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Schienenfarbe
                </span>
                <select
                  value={schienenfarbe}
                  onChange={(e) => setSchienenfarbe(e.target.value)}
                  className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] focus:border-[var(--color-brand)] focus:border-[1.5px] outline-none"
                >
                  {SCHIENENFARBEN.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </section>

        <section className="myr-card p-5 space-y-4">
          <p className="eyebrow">{dach ? "Menge" : "Maße"}</p>
          {!dach && (
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Breite"
                suffix="cm"
                value={breite}
                onChange={(e) => setBreite(e.target.value)}
              />
              <NumberInput
                label="Höhe"
                suffix="cm"
                value={hoehe}
                onChange={(e) => setHoehe(e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Anzahl"
              step={1}
              integer
              min={1}
              value={anzahl}
              onChange={(e) => setAnzahl(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={zuruecksetzen}
            className="text-[13px] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] underline underline-offset-2"
          >
            Zurücksetzen
          </button>
          {!dach && ergebnis && (
            <p className="text-[13px] text-[var(--color-stone-muted)]">
              Verwendetes Raster{" "}
              <span className="num-serif text-[var(--color-ink)]">
                {ergebnis.raster.breite_cm} × {ergebnis.raster.hoehe_cm} cm
              </span>
            </p>
          )}
        </section>

        {produkt.zuschlaege && produkt.zuschlaege.length > 0 && (
          <section className="myr-card p-5 space-y-3">
            <p className="eyebrow">Zuschläge</p>
            <div className="divide-y divide-[var(--color-hairline)] border-y border-[var(--color-hairline)]">
              {produkt.zuschlaege.map((z) => {
                const checked = zuschlaege.includes(z.code);
                return (
                  <label
                    key={z.code}
                    className="flex items-center gap-3 min-h-[52px] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-brand)]"
                      checked={checked}
                      onChange={() => toggleZuschlag(z.code)}
                    />
                    <span className="flex-1 text-[15px]">{z.name}</span>
                    <span className="text-[13px] tabular-nums text-[var(--color-stone-muted)]">
                      {z.typ === "fix"
                        ? eur.format(z.wert)
                        : z.typ === "prozent"
                          ? `${z.wert} %`
                          : z.typ === "hoehe_tabelle"
                            ? `ab ${eur.format(z.wert)}`
                            : `${eur.format(z.wert)}/m²`}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {ergebnis && (
          <section className="myr-card p-5 space-y-3 bg-[var(--color-sand)]">
            <p className="eyebrow">Preis</p>

            {ergebnis.lieferbar ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[15px]">Grundpreis</span>
                    <span className="text-[17px] font-serif tabular-nums">
                      {eur.format(ergebnis.grundpreis)}
                    </span>
                  </div>

                  {ergebnis.zuschlaege.map((z, i) => (
                    <div key={i} className="flex justify-between items-baseline">
                      <span className="text-[15px] text-[var(--color-stone-muted)]">
                        {z.name}
                      </span>
                      <span className="text-[15px] tabular-nums text-[var(--color-stone-muted)]">
                        + {eur.format(z.betrag)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[var(--color-hairline)] space-y-2">
                  {menge > 1 && (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[15px]">Einzelpreis</span>
                        <span className="text-[15px] font-serif tabular-nums">
                          {eur.format(ergebnis.gesamt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[15px] text-[var(--color-stone-muted)]">Anzahl</span>
                        <span className="text-[15px] tabular-nums text-[var(--color-stone-muted)]">
                          × {menge}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-[17px] font-bold">Gesamt</span>
                    <span className="text-[26px] font-serif font-bold tabular-nums text-[var(--color-brand)]">
                      {eur.format(gesamtMenge)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 p-4 border border-[var(--color-hairline)] bg-[var(--color-paper)]">
                <AlertTriangle
                  className="size-5 shrink-0 text-[var(--color-ink)] mt-0.5"
                  strokeWidth={1.75}
                />
                <div>
                  <div className="text-[17px] font-bold">Nicht lieferbar</div>
                  {ergebnis.hinweise.length > 0 && (
                    <div className="text-[13px] text-[var(--color-stone-muted)] mt-1">
                      {ergebnis.hinweise.join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {ergebnis.lieferbar && ergebnis.hinweise.length > 0 && (
              <div className="flex items-start gap-2 pt-2 text-[13px] text-[var(--color-stone-muted)]">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>{ergebnis.hinweise.join(" · ")}</div>
              </div>
            )}
          </section>
        )}
      </div>

    </>
  );
}
