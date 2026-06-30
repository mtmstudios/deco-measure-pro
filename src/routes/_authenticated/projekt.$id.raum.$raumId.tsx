import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, AlertTriangle, AlertOctagon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/number-input";
import { cn } from "@/lib/utils";
import { setRaumLeistung, type RaumLeistungRow } from "@/lib/raum-leistung";
import { RaumGrundrissCard } from "@/components/raum-grundriss";
import { GeometrieEditor } from "@/components/geometrie-editor";

export const Route = createFileRoute("/_authenticated/projekt/$id/raum/$raumId")({
  head: () => ({ meta: [{ title: "Raum erfassen" }] }),
  component: RaumWizard,
});

const RAUMNAMEN = ["Zimmer 1", "Zimmer 2", "Zimmer 3", "Flur", "Bad", "WC", "Küche", "Essen"];
const DECKENTYPEN = [
  { v: "standard", l: "Standard" },
  { v: "GK", l: "Gipskarton" },
  { v: "holz", l: "Holz" },
  { v: "sonst", l: "Sonstige" },
];
const OEFFNUNG_TYPEN = [
  { v: "fenster", l: "Fenster" },
  { v: "balkontuer", l: "Balkontür" },
  { v: "tuer", l: "Tür" },
  { v: "tuerelement", l: "Türelement" },
];
const STEP3_CODES = [
  ["VSPACHTEL_Q3", "Q3 Spachtelung"],
  ["GK_DECKE", "GK-Decke"],
  ["TAPETE_ENTF", "Tapete entf."],
  ["RAUHFASER", "Raufaser"],
  ["TIEFGRUND", "Tiefgrund"],
  ["DISP_KL3", "Dispersion Kl.3"],
  ["SILIKAT", "Silikat"],
  ["ABDECKVLIES", "Abdeckvlies"],
  ["MALERFOLIE", "Malerfolie"],
];
const STEP5_CODES = [
  ["TUEREN_LACK", "Türen lackieren"],
  ["TUERRAHMEN_LACK", "Türrahmen lack."],
  ["SCHIENEN_DEMO", "Schienen demont."],
  ["HOLZDECKE_DEMO", "Holzdecke demont."],
  ["PUTZFLAECHE", "Putzflächen"],
];

type Catalog = { id: string; code: string; bezeichnung: string; einheit: string };

function RaumWizard() {
  const { id, raumId } = Route.useParams();
  const [step, setStep] = useState(1);

  const { data: raum, isLoading } = useQuery({
    queryKey: ["raum", raumId],
    queryFn: async () => {
      const { data, error } = await supabase.from("raum").select("*").eq("id", raumId).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: katalog = [] } = useQuery<Catalog[]>({
    queryKey: ["katalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leistung_katalog").select("id, code, bezeichnung, einheit");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading || !raum) {
    return (
      <div className="px-5 py-10 text-center">
        <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link to="/projekt/$id" params={{ id }} aria-label="Zurück" className="size-12 rounded-lg flex items-center justify-center active:bg-accent">
            <ArrowLeft className="size-6" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{raum.name}</h1>
            <p className="text-xs text-muted-foreground">Schritt {step} von 6</p>
          </div>
          <Button
            size="lg"
            className="h-12 px-4 text-sm font-semibold"
            disabled={step === 6}
            onClick={() => setStep((s) => Math.min(6, s + 1))}
          >
            Weiter
            <ArrowRight className="size-5 ml-1" />
          </Button>
        </div>
        <StepIndicator step={step} onJump={setStep} />
      </header>

      <div className="px-4 py-5">
        {step === 1 && <Step1 raum={raum} />}
        {step === 2 && <Step2 raumId={raumId} />}
        {step === 3 && <Step3 raumId={raumId} katalog={katalog} />}
        {step === 4 && <Step4 raumId={raumId} katalog={katalog} />}
        {step === 5 && <Step5 raumId={raumId} katalog={katalog} />}
        {step === 6 && <Step6 raumId={raumId} projektId={id} />}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-2 gap-2 px-3 py-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 text-base"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Zurück
          </Button>
          <Button
            size="lg"
            className="h-14 text-base"
            disabled={step === 6}
            onClick={() => setStep((s) => Math.min(6, s + 1))}
          >
            Weiter
          </Button>
        </div>
      </nav>
    </div>
  );
}

function StepIndicator({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="flex gap-1 px-3 pb-3">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          onClick={() => onJump(n)}
          className={cn(
            "flex-1 h-2 rounded-full transition-colors",
            n < step ? "bg-success" : n === step ? "bg-primary" : "bg-muted",
          )}
          aria-label={`Schritt ${n}`}
        />
      ))}
    </div>
  );
}

/* ---------- STEP 1: Raumdaten + Sonderflächen ---------- */
function Step1({ raum }: { raum: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState(raum.name ?? "");
  const [laenge, setLaenge] = useState(raum.laenge_cm?.toString() ?? "");
  const [breite, setBreite] = useState(raum.breite_cm?.toString() ?? "");
  const [hoehe, setHoehe] = useState(raum.raumhoehe_cm?.toString() ?? "");
  const [deckentyp, setDeckentyp] = useState<string>(raum.deckentyp ?? "standard");
  const [etage, setEtage] = useState(raum.etage ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("raum")
      .update({
        name,
        laenge_cm: laenge ? Number(laenge) : null,
        breite_cm: breite ? Number(breite) : null,
        raumhoehe_cm: hoehe ? Number(hoehe) : null,
        deckentyp,
        etage: etage || null,
      })
      .eq("id", raum.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["raum", raum.id] });
      qc.invalidateQueries({ queryKey: ["raeume", raum.projekt_id] });
    }
  }

  const { data: tfs = [], refetch } = useQuery({
    queryKey: ["raum_teilflaeche", raum.id],
    queryFn: async () => {
      const { data } = await supabase.from("raum_teilflaeche").select("*").eq("raum_id", raum.id).order("created_at");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <SectionTitle>Raumdaten</SectionTitle>

      <div>
        <label className="text-sm font-medium text-foreground/80">Raumname</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-14 w-full rounded-lg border-2 border-input bg-background px-4 text-lg font-semibold focus:border-primary focus:outline-none"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {RAUMNAMEN.map((n) => (
            <button key={n} onClick={() => setName(n)} className="px-3 h-10 rounded-full border-2 border-input text-sm font-medium active:bg-accent">
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Länge" suffix="cm" value={laenge} onChange={(e) => setLaenge(e.target.value)} />
        <NumberInput label="Breite" suffix="cm" value={breite} onChange={(e) => setBreite(e.target.value)} />
        <NumberInput label="Raumhöhe" suffix="cm" value={hoehe} onChange={(e) => setHoehe(e.target.value)} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground/80">Etage</span>
          <input
            value={etage}
            onChange={(e) => setEtage(e.target.value)}
            className="h-14 w-full rounded-lg border-2 border-input bg-background px-4 text-lg font-semibold focus:border-primary focus:outline-none"
            placeholder="z.B. EG, 1. OG"
          />
        </label>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground/80">Deckentyp</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {DECKENTYPEN.map((d) => (
            <button
              key={d.v}
              onClick={() => setDeckentyp(d.v)}
              className={cn(
                "h-14 rounded-lg border-2 font-semibold text-base",
                deckentyp === d.v ? "border-primary bg-primary/10 text-primary" : "border-input bg-background",
              )}
            >
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving} size="lg" className="h-14 w-full text-base">
        {saving ? <Loader2 className="size-5 animate-spin" /> : "Raumdaten speichern"}
      </Button>

      <GeometrieEditor raumId={raum.id} initial={(raum as any).geometrie ?? null} />

      <SectionTitle>Sonderflächen (optional)</SectionTitle>
      <div className="space-y-3">
        {tfs.map((t) => (
          <TeilflaecheRow key={t.id} row={t} onChange={refetch} />
        ))}
        <Button
          variant="outline"
          size="lg"
          className="h-14 w-full text-base"
          onClick={async () => {
            await supabase.from("raum_teilflaeche").insert({ raum_id: raum.id, typ: "zusatz", daten: { wirkt_auf: "wand" } });
            refetch();
          }}
        >
          <Plus className="size-5 mr-1" /> Sonderfläche hinzufügen
        </Button>
      </div>
    </div>
  );
}

function TeilflaecheRow({ row, onChange }: { row: any; onChange: () => void }) {
  const [typ, setTyp] = useState<"zusatz" | "abzug">(row.typ);
  const [l, setL] = useState(row.laenge_cm?.toString() ?? "");
  const [b, setB] = useState(row.breite_cm?.toString() ?? "");
  const [wirkt, setWirkt] = useState<string>((row.daten?.wirkt_auf as string) ?? "wand");

  async function save() {
    await supabase
      .from("raum_teilflaeche")
      .update({
        typ,
        laenge_cm: l ? Number(l) : null,
        breite_cm: b ? Number(b) : null,
        daten: { ...(row.daten ?? {}), wirkt_auf: wirkt },
      })
      .eq("id", row.id);
    onChange();
  }
  async function del() {
    await supabase.from("raum_teilflaeche").delete().eq("id", row.id);
    onChange();
  }
  return (
    <div className="rounded-lg border-2 border-input p-3 space-y-2 bg-background">
      <div className="flex gap-2">
        {(["zusatz", "abzug"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTyp(t)}
            className={cn(
              "flex-1 h-11 rounded-md border-2 font-semibold text-sm",
              typ === t ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {t === "zusatz" ? "+ Zusatz" : "− Abzug"}
          </button>
        ))}
        <button onClick={del} aria-label="Löschen" className="size-11 rounded-md border-2 border-input text-destructive flex items-center justify-center">
          <Trash2 className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Länge" suffix="cm" value={l} onChange={(e) => setL(e.target.value)} onBlur={save} />
        <NumberInput label="Breite" suffix="cm" value={b} onChange={(e) => setB(e.target.value)} onBlur={save} />
      </div>
      <div className="flex gap-2">
        {(["boden", "decke", "wand"] as const).map((w) => (
          <button
            key={w}
            onClick={() => {
              setWirkt(w);
              setTimeout(save, 0);
            }}
            className={cn(
              "flex-1 h-11 rounded-md border-2 text-sm font-semibold capitalize",
              wirkt === w ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- STEP 2: Öffnungen ---------- */
function Step2({ raumId }: { raumId: string }) {
  const { data: oeff = [], refetch } = useQuery({
    queryKey: ["oeffnung", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("oeffnung").select("*").eq("raum_id", raumId).order("created_at");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <SectionTitle>Öffnungen</SectionTitle>
      {oeff.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Öffnungen erfasst.</p>}
      {oeff.map((o) => (
        <OeffnungRow key={o.id} row={o} onChange={refetch} />
      ))}
      <Button
        variant="outline"
        size="lg"
        className="h-14 w-full text-base"
        onClick={async () => {
          await supabase.from("oeffnung").insert({
            raum_id: raumId,
            typ: "fenster",
            daten: {
              anzahl: 1,
              von_wandflaeche_abziehen: true,
              abdecken: false,
              silikon_entfernen: false,
              leibung_vorhanden: false,
              leibung_seiten: { links: true, oben: true, unten: true, rechts: false },
            },
          });
          refetch();
        }}
      >
        <Plus className="size-5 mr-1" /> Öffnung hinzufügen
      </Button>
    </div>
  );
}

function OeffnungRow({ row, onChange }: { row: any; onChange: () => void }) {
  const [typ, setTyp] = useState<string>(row.typ);
  const [b, setB] = useState(row.breite_cm?.toString() ?? "");
  const [h, setH] = useState(row.hoehe_cm?.toString() ?? "");
  const d0 = (row.daten ?? {}) as any;
  const [anzahl, setAnzahl] = useState<string>(d0.anzahl?.toString() ?? "1");
  const [abz, setAbz] = useState<boolean>(d0.von_wandflaeche_abziehen !== false);
  const [abdecken, setAbdecken] = useState<boolean>(!!d0.abdecken);
  const [silikon, setSilikon] = useState<boolean>(!!d0.silikon_entfernen);
  const [leibung, setLeibung] = useState<boolean>(!!d0.leibung_vorhanden);
  const [leibungTiefe, setLeibungTiefe] = useState<string>(d0.leibung_tiefe_cm?.toString() ?? "");
  const seiten0 = d0.leibung_seiten ?? { links: true, oben: true, unten: true, rechts: false };
  const [seiten, setSeiten] = useState<{ links: boolean; rechts: boolean; oben: boolean; unten: boolean }>(seiten0);

  async function save() {
    await supabase
      .from("oeffnung")
      .update({
        typ,
        breite_cm: b ? Number(b) : null,
        hoehe_cm: h ? Number(h) : null,
        daten: {
          anzahl: Number(anzahl) || 1,
          von_wandflaeche_abziehen: abz,
          abdecken,
          silikon_entfernen: silikon,
          leibung_vorhanden: leibung,
          leibung_tiefe_cm: leibungTiefe ? Number(leibungTiefe) : null,
          leibung_seiten: seiten,
        },
      })
      .eq("id", row.id);
    onChange();
  }
  async function del() {
    await supabase.from("oeffnung").delete().eq("id", row.id);
    onChange();
  }

  return (
    <div className="rounded-lg border-2 border-input p-3 space-y-3 bg-background">
      <div className="flex flex-wrap gap-2">
        {OEFFNUNG_TYPEN.map((o) => (
          <button
            key={o.v}
            onClick={() => {
              setTyp(o.v);
              setTimeout(save, 0);
            }}
            className={cn(
              "h-11 px-3 rounded-md border-2 text-sm font-semibold",
              typ === o.v ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {o.l}
          </button>
        ))}
        <button onClick={del} aria-label="Löschen" className="size-11 ml-auto rounded-md border-2 border-input text-destructive flex items-center justify-center">
          <Trash2 className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput label="Breite" suffix="cm" value={b} onChange={(e) => setB(e.target.value)} onBlur={save} />
        <NumberInput label="Höhe" suffix="cm" value={h} onChange={(e) => setH(e.target.value)} onBlur={save} />
        <NumberInput label="Anzahl" value={anzahl} onChange={(e) => setAnzahl(e.target.value)} onBlur={save} />
      </div>
      <ToggleRow label="Von Wandfläche abziehen" checked={abz} onChange={(v) => { setAbz(v); setTimeout(save, 0); }} />
      <ToggleRow label="Abdecken" checked={abdecken} onChange={(v) => { setAbdecken(v); setTimeout(save, 0); }} />
      <ToggleRow label="Silikon entfernen" checked={silikon} onChange={(v) => { setSilikon(v); setTimeout(save, 0); }} />
      <ToggleRow label="Leibung vorhanden" checked={leibung} onChange={(v) => { setLeibung(v); setTimeout(save, 0); }} />
      {leibung && (
        <div className="space-y-2 pl-2 border-l-4 border-primary/40">
          <NumberInput label="Leibungstiefe" suffix="cm" value={leibungTiefe} onChange={(e) => setLeibungTiefe(e.target.value)} onBlur={save} />
          <div className="grid grid-cols-2 gap-2">
            {(["links", "rechts", "oben", "unten"] as const).map((s) => (
              <label key={s} className={cn(
                "flex items-center gap-2 h-12 rounded-md border-2 px-3 font-medium capitalize",
                seiten[s] ? "border-primary bg-primary/10 text-primary" : "border-input",
              )}>
                <input
                  type="checkbox"
                  className="size-5"
                  checked={seiten[s]}
                  onChange={(e) => {
                    const ns = { ...seiten, [s]: e.target.checked };
                    setSeiten(ns);
                    setTimeout(save, 0);
                  }}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 h-12">
      <span className="text-base font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/* ---------- STEP 3: Decke/Wände/Boden Toggles ---------- */
function Step3({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: rl = [], refetch } = useQuery<RaumLeistungRow[]>({
    queryKey: ["raum_leistung", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("raum_leistung").select("*").eq("raum_id", raumId);
      return (data ?? []) as RaumLeistungRow[];
    },
  });
  return (
    <div className="space-y-3">
      <SectionTitle>Decke / Wände / Boden</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {STEP3_CODES.map(([code, label]) => {
          const k = katalog.find((c) => c.code === code);
          const aktiv = !!k && rl.some((r) => r.leistung_id === k.id);
          return (
            <button
              key={code}
              onClick={async () => {
                if (!k) return toast.error(`Katalog-Code ${code} fehlt`);
                await setRaumLeistung(raumId, code, !aktiv, katalog);
                refetch();
              }}
              className={cn(
                "min-h-20 rounded-xl border-2 p-3 text-left font-semibold relative",
                aktiv ? "border-primary bg-primary/10 text-primary" : "border-input bg-background",
              )}
            >
              {aktiv && <Check className="size-5 absolute top-2 right-2" />}
              <span className="text-base leading-tight">{label}</span>
              <span className="block text-xs text-muted-foreground mt-1">{code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- STEP 4: Heizkörper ---------- */
function Step4({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: hks = [], refetch } = useQuery({
    queryKey: ["heizkoerper", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("heizkoerper").select("*").eq("raum_id", raumId).order("created_at");
      return data ?? [];
    },
  });

  async function syncLeistungen(list: any[]) {
    const hasRippe = list.some((h) => (h.daten as any)?.typ === "rippe" && (h.daten as any)?.lackieren !== false);
    const hasRohr = list.some((h) => (h.daten as any)?.typ === "rohr" && (h.daten as any)?.lackieren !== false);
    await setRaumLeistung(raumId, "HK_RIPPE_LACK", hasRippe, katalog);
    await setRaumLeistung(raumId, "HK_ROHRE_LACK", hasRohr, katalog);
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Heizkörper</SectionTitle>
      {hks.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Heizkörper erfasst.</p>}
      {hks.map((h) => (
        <HeizkoerperRow key={h.id} row={h} onChange={async () => { const { data } = await supabase.from("heizkoerper").select("*").eq("raum_id", raumId); await syncLeistungen(data ?? []); refetch(); }} />
      ))}
      <Button
        variant="outline"
        size="lg"
        className="h-14 w-full text-base"
        onClick={async () => {
          await supabase.from("heizkoerper").insert({ raum_id: raumId, daten: { typ: "rippe", lackieren: true, rohr_laengen_cm: [] } });
          refetch();
        }}
      >
        <Plus className="size-5 mr-1" /> Heizkörper hinzufügen
      </Button>
    </div>
  );
}

function HeizkoerperRow({ row, onChange }: { row: any; onChange: () => void }) {
  const d0 = (row.daten ?? {}) as any;
  const [typ, setTyp] = useState<"rippe" | "platte" | "rohr">(d0.typ ?? "rippe");
  const [hoehe, setHoehe] = useState(row.hoehe_cm?.toString() ?? "");
  const [breite, setBreite] = useState(row.breite_cm?.toString() ?? "");
  const [tiefe, setTiefe] = useState(row.tiefe_cm?.toString() ?? "");
  const [rippen, setRippen] = useState(d0.rippenanzahl?.toString() ?? "");
  const [rohre, setRohre] = useState<string[]>((d0.rohr_laengen_cm ?? []).map((x: number) => x.toString()));
  const [lackieren, setLackieren] = useState<boolean>(d0.lackieren !== false);

  async function save(next?: Partial<{ typ: string; lackieren: boolean; rohre: string[] }>) {
    const t = next?.typ ?? typ;
    const lk = next?.lackieren ?? lackieren;
    const r = next?.rohre ?? rohre;
    await supabase
      .from("heizkoerper")
      .update({
        hoehe_cm: hoehe ? Number(hoehe) : null,
        breite_cm: breite ? Number(breite) : null,
        tiefe_cm: tiefe ? Number(tiefe) : null,
        daten: {
          typ: t,
          lackieren: lk,
          rippenanzahl: rippen ? Number(rippen) : null,
          rohr_laengen_cm: r.map((s) => Number(s) || 0).filter((n) => n > 0),
        },
      })
      .eq("id", row.id);
    onChange();
  }
  async function del() {
    await supabase.from("heizkoerper").delete().eq("id", row.id);
    onChange();
  }

  return (
    <div className="rounded-lg border-2 border-input p-3 space-y-3 bg-background">
      <div className="flex gap-2">
        {(["rippe", "platte", "rohr"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTyp(t); save({ typ: t }); }}
            className={cn(
              "flex-1 h-11 rounded-md border-2 font-semibold text-sm capitalize",
              typ === t ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {t}
          </button>
        ))}
        <button onClick={del} aria-label="Löschen" className="size-11 rounded-md border-2 border-input text-destructive flex items-center justify-center">
          <Trash2 className="size-5" />
        </button>
      </div>

      {typ === "rippe" && (
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label="Höhe" suffix="cm" value={hoehe} onChange={(e) => setHoehe(e.target.value)} onBlur={() => save()} />
          <NumberInput label="Tiefe" suffix="cm" value={tiefe} onChange={(e) => setTiefe(e.target.value)} onBlur={() => save()} />
          <NumberInput label="Rippen" value={rippen} onChange={(e) => setRippen(e.target.value)} onBlur={() => save()} />
        </div>
      )}
      {typ === "platte" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="Höhe" suffix="cm" value={hoehe} onChange={(e) => setHoehe(e.target.value)} onBlur={() => save()} />
          <NumberInput label="Breite" suffix="cm" value={breite} onChange={(e) => setBreite(e.target.value)} onBlur={() => save()} />
        </div>
      )}
      {typ === "rohr" && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Rohrlängen</span>
          {rohre.map((r, i) => (
            <div key={i} className="flex gap-2">
              <NumberInput
                suffix="cm"
                value={r}
                onChange={(e) => {
                  const nr = [...rohre]; nr[i] = e.target.value; setRohre(nr);
                }}
                onBlur={() => save({ rohre })}
                className="flex-1"
              />
              <button
                onClick={() => { const nr = rohre.filter((_, j) => j !== i); setRohre(nr); save({ rohre: nr }); }}
                className="size-14 rounded-lg border-2 border-input text-destructive flex items-center justify-center"
              >
                <Trash2 className="size-5" />
              </button>
            </div>
          ))}
          <Button variant="outline" className="h-12 w-full" onClick={() => setRohre([...rohre, ""])}>
            <Plus className="size-4 mr-1" /> Länge hinzufügen
          </Button>
        </div>
      )}

      <ToggleRow label="Lackieren" checked={lackieren} onChange={(v) => { setLackieren(v); save({ lackieren: v }); }} />
    </div>
  );
}

/* ---------- STEP 5: Acryl + Sonderleistungen + Foto ---------- */
function Step5({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: acryl = [], refetch: refetchA } = useQuery({
    queryKey: ["acryl", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("acryl_position").select("*").eq("raum_id", raumId).order("created_at");
      return data ?? [];
    },
  });
  const { data: rl = [], refetch: refetchRL } = useQuery<RaumLeistungRow[]>({
    queryKey: ["raum_leistung", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("raum_leistung").select("*").eq("raum_id", raumId);
      return (data ?? []) as RaumLeistungRow[];
    },
  });
  const { data: raum } = useQuery({
    queryKey: ["raum", raumId],
    queryFn: async () => (await supabase.from("raum").select("*").eq("id", raumId).single()).data,
  });

  const [bemerkung, setBemerkung] = useState(raum?.bemerkung ?? "");
  useEffect(() => { if (raum?.bemerkung != null) setBemerkung(raum.bemerkung); }, [raum?.bemerkung]);

  // sync ACRYL aktiv if list non-empty
  useEffect(() => {
    const k = katalog.find((c) => c.code === "ACRYL");
    if (!k) return;
    const aktiv = rl.some((r) => r.leistung_id === k.id);
    const sollAktiv = acryl.length > 0;
    if (aktiv !== sollAktiv) {
      setRaumLeistung(raumId, "ACRYL", sollAktiv, katalog).then(() => refetchRL());
    }
  }, [acryl.length, rl, katalog, raumId, refetchRL]);

  async function uploadFoto(file: File) {
    const { data: b } = await supabase.from("benutzer").select("betrieb_id").maybeSingle();
    if (!b?.betrieb_id) return toast.error("Betrieb nicht gefunden");
    const path = `${b.betrieb_id}/${raumId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("raum-fotos").upload(path, file);
    if (error) toast.error(error.message);
    else toast.success("Foto hochgeladen");
  }

  return (
    <div className="space-y-5">
      <SectionTitle>Acryl-Fugen</SectionTitle>
      <div className="space-y-2">
        {acryl.map((a) => (
          <AcrylRow key={a.id} row={a} onChange={refetchA} />
        ))}
        <Button
          variant="outline"
          className="h-14 w-full text-base"
          onClick={async () => {
            await supabase.from("acryl_position").insert({ raum_id: raumId, laenge_m: null });
            refetchA();
          }}
        >
          <Plus className="size-5 mr-1" /> Acryl-Länge hinzufügen
        </Button>
      </div>

      <SectionTitle>Sonderleistungen</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {STEP5_CODES.map(([code, label]) => {
          const k = katalog.find((c) => c.code === code);
          const aktiv = !!k && rl.some((r) => r.leistung_id === k.id);
          return (
            <button
              key={code}
              onClick={async () => {
                if (!k) return toast.error(`Katalog-Code ${code} fehlt`);
                await setRaumLeistung(raumId, code, !aktiv, katalog);
                refetchRL();
              }}
              className={cn(
                "min-h-20 rounded-xl border-2 p-3 text-left font-semibold",
                aktiv ? "border-primary bg-primary/10 text-primary" : "border-input bg-background",
              )}
            >
              {aktiv && <Check className="size-5 float-right" />}
              <span className="text-base leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      <SectionTitle>Notiz</SectionTitle>
      <Textarea
        rows={4}
        value={bemerkung ?? ""}
        onChange={(e) => setBemerkung(e.target.value)}
        onBlur={async () => { await supabase.from("raum").update({ bemerkung }).eq("id", raumId); }}
        placeholder="Freitext-Notiz zum Raum"
        className="text-base"
      />

      <SectionTitle>Foto</SectionTitle>
      <label className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-input text-base font-semibold active:bg-accent">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.currentTarget.value = ""; }}
        />
        Foto aufnehmen / hochladen
      </label>
    </div>
  );
}

function AcrylRow({ row, onChange }: { row: any; onChange: () => void }) {
  const [v, setV] = useState(row.laenge_m?.toString() ?? "");
  return (
    <div className="flex gap-2">
      <NumberInput
        suffix="m"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={async () => {
          await supabase.from("acryl_position").update({ laenge_m: v ? Number(v) : null }).eq("id", row.id);
          onChange();
        }}
        className="flex-1"
      />
      <button
        onClick={async () => { await supabase.from("acryl_position").delete().eq("id", row.id); onChange(); }}
        className="size-14 rounded-lg border-2 border-input text-destructive flex items-center justify-center"
      >
        <Trash2 className="size-5" />
      </button>
    </div>
  );
}

/* ---------- STEP 6: Prüfung ---------- */
type EngineAntwort = {
  uebergabe: {
    schema_version: string;
    positionen: {
      leistungs_code: string;
      name: string;
      einheit: string;
      zeilen: { raum: string; formel: string; ergebnis: number }[];
      endsumme: number;
    }[];
    kennzahlen?: { raum: string; L: number; B: number; H: number; boden_m2: number; decke_m2: number; wand_m2: number }[];
  };
  befunde: { schwere: "block" | "warnung"; code: string; raum?: string; message: string }[];
  blocker: boolean;
};

function Step6({ raumId, projektId }: { raumId: string; projektId: string }) {
  const navigate = useNavigate();
  const { data, isFetching, refetch, error } = useQuery<EngineAntwort>({
    queryKey: ["pruefung", raumId],
    queryFn: async () => {
      const { buildEngineProjektFromRaum } = await import("@/lib/build-engine-projekt");
      const engine = await buildEngineProjektFromRaum(raumId);
      const { data, error } = await supabase.functions.invoke("generate-positionen", {
        body: { projekt: engine },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as EngineAntwort;
    },
  });

  const blockers = data?.befunde.filter((b) => b.schwere === "block") ?? [];
  const warnungen = data?.befunde.filter((b) => b.schwere === "warnung") ?? [];
  const kz = data?.uebergabe.kennzahlen?.[0];

  return (
    <div className="space-y-4">
      <SectionTitle>Prüfung & Abschluss</SectionTitle>
      <RaumGrundrissCard raumId={raumId} />
      <Button variant="outline" className="h-12 w-full" onClick={() => refetch()}>
        Neu berechnen
      </Button>

      {isFetching && <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />}
      {error && <p className="text-destructive text-sm">{(error as Error).message}</p>}

      {data && (
        <>
          {kz && (
            <div className="rounded-lg border-2 border-input p-3 bg-muted/30 text-sm">
              <div className="flex justify-between"><span>Boden</span><b>{kz.boden_m2.toFixed(2)} m²</b></div>
              <div className="flex justify-between"><span>Decke</span><b>{kz.decke_m2.toFixed(2)} m²</b></div>
              <div className="flex justify-between"><span>Wand (netto)</span><b>{kz.wand_m2.toFixed(2)} m²</b></div>
            </div>
          )}

          {blockers.map((b, i) => (
            <div key={i} className="flex gap-2 p-3 rounded-lg bg-destructive/10 border-2 border-destructive text-destructive">
              <AlertOctagon className="size-5 shrink-0 mt-0.5" />
              <span className="text-sm font-semibold">{b.message}</span>
            </div>
          ))}
          {warnungen.map((b, i) => (
            <div key={i} className="flex gap-2 p-3 rounded-lg bg-warning/10 border-2 border-warning text-warning-foreground">
              <AlertTriangle className="size-5 shrink-0 mt-0.5 text-warning" />
              <span className="text-sm font-semibold">{b.message}</span>
            </div>
          ))}

          <div className="space-y-2">
            {data.uebergabe.positionen.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Positionen.</p>
            )}
            {data.uebergabe.positionen.map((p) => {
              const zeile = p.zeilen[0];
              return (
                <div key={p.leistungs_code} className="rounded-lg border-2 border-input p-3 bg-background">
                  <div className="flex justify-between gap-2">
                    <b className="text-base">{p.name}</b>
                    <span className="text-base font-bold tabular-nums">
                      {(zeile?.ergebnis ?? 0).toFixed(2)} {p.einheit}
                    </span>
                  </div>
                  {zeile && <p className="text-xs text-muted-foreground mt-1">{zeile.formel}</p>}
                </div>
              );
            })}
          </div>

          <Button
            size="lg"
            disabled={blockers.length > 0}
            className="h-14 w-full text-base"
            onClick={() => {
              toast.success("Raum abgeschlossen");
              navigate({ to: "/projekt/$id", params: { id: projektId } });
            }}
          >
            Raum abschließen
          </Button>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold tracking-tight">{children}</h2>;
}


