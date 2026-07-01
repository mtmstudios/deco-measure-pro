import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Info,
  Loader2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NumberInput } from "@/components/number-input";
import { cn } from "@/lib/utils";
import { setRaumLeistung, type RaumLeistungRow } from "@/lib/raum-leistung";
import { RaumGrundrissCard } from "@/components/raum-grundriss";
import { GeometrieEditor } from "@/components/geometrie-editor";
import { ScreenHeader } from "@/components/screen-header";

const WIZARD_SAVE_EVENT = "wizard:save-step";
function emitWizardSave() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(WIZARD_SAVE_EVENT));
}

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
const STEP3_CODES: [string, string][] = [
  ["VSPACHTEL_Q3", "Q3 Spachtelung"],
  ["GK_DECKE", "GK-Decke"],
  ["TAPETE_ENTF", "Tapete entfernen"],
  ["RAUHFASER", "Raufaser"],
  ["TIEFGRUND", "Tiefgrund"],
  ["DISP_KL3", "Dispersion Kl. 3"],
  ["SILIKAT", "Silikat"],
  ["ABDECKVLIES", "Abdeckvlies"],
  ["MALERFOLIE", "Malerfolie"],
];
const STEP5_CODES: [string, string][] = [
  ["TUEREN_LACK", "Türen lackieren"],
  ["TUERRAHMEN_LACK", "Türrahmen lackieren"],
  ["SCHIENEN_DEMO", "Schienen demontieren"],
  ["HOLZDECKE_DEMO", "Holzdecke demontieren"],
  ["PUTZFLAECHE", "Putzflächen"],
];

type Catalog = { id: string; code: string; bezeichnung: string; einheit: string };

/* =====================================================================
 * Gemeinsame MYR-Primitives — einmal definiert, in allen Schritten genutzt.
 * ===================================================================== */

function SectionTitle({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <h3 className="font-serif text-[20px] md:text-[22px] font-medium text-[var(--color-ink)] tracking-[-0.005em]">
      {children}
      {optional && (
        <span className="ml-2 align-middle text-[12px] font-sans tracking-[0.08em] uppercase text-[var(--color-stone-muted)]">
          (optional)
        </span>
      )}
    </h3>
  );
}

/** Eyebrow für Mess-/Wert-Labels (UPPERCASE, gesperrt, gedämpft). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-sans uppercase tracking-[0.12em] text-[var(--color-stone-muted)] font-medium">
      {children}
    </span>
  );
}

/** Single-Select-Pill (genau eine aktiv). */
function SelectPill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-[52px] px-4 inline-flex items-center justify-center text-[14px] font-sans font-medium",
        "transition-colors duration-300",
        "border",
        active
          ? "bg-[var(--color-brand)] text-[var(--color-paper)] border-[var(--color-brand)]"
          : "bg-[var(--color-sand)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:bg-[var(--color-sand-deep)]",
        className,
      )}
      style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      {children}
    </button>
  );
}

/** Multi-Select-Leistungs-Karte. */
function LeistungCard({
  active,
  onClick,
  label,
  code,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  code?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative min-h-[88px] p-4 text-left transition-colors duration-300",
        "border",
        active
          ? "border-[1.5px] border-[var(--color-brand)] bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)]"
          : "border-[var(--color-hairline)] bg-[var(--color-sand)] hover:bg-[var(--color-sand-deep)]",
      )}
      style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-2 right-2 inline-flex items-center justify-center size-5 text-[var(--color-brand)]"
        >
          <Check className="size-4" strokeWidth={2.25} />
        </span>
      )}
      <span className="block font-sans font-medium text-[15px] leading-snug text-[var(--color-ink)] pr-6">
        {label}
      </span>
      {code && (
        <span className="block mt-1.5 font-mono text-[11px] tracking-wide text-[var(--color-stone-muted)]">
          {code}
        </span>
      )}
    </button>
  );
}

/** Outline-Button für „+ … hinzufügen". */
function AddRowButton({
  onClick,
  children,
}: {
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        "w-full min-h-[52px] inline-flex items-center justify-center gap-2",
        "border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent",
        "text-[12px] font-sans font-medium uppercase tracking-[0.14em]",
        "hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] transition-colors duration-300",
      )}
      style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      <Plus className="size-4" strokeWidth={1.75} />
      {children}
    </button>
  );
}

/** Löschen-Icon mit Bestätigungs-Dialog. */
function DeleteIconButton({
  onConfirm,
  label = "Löschen",
  description = "Diese Zeile wird entfernt.",
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          "size-11 inline-flex items-center justify-center shrink-0",
          "text-[var(--color-stone-muted)] hover:text-[var(--color-danger)]",
          "focus-visible:text-[var(--color-danger)] transition-colors duration-200",
        )}
      >
        <Trash2 className="size-5" strokeWidth={1.5} />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onConfirm();
                setOpen(false);
              }}
              className="bg-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_88%,black)] text-[var(--color-paper)]"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Toggle-Zeile (Stein-Grün im An-Zustand via shadcn Switch + Tokens). */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 min-h-[52px] py-2",
        "border-b border-[var(--color-hairline)] last:border-b-0",
      )}
    >
      <span className="font-sans text-[15px] font-medium text-[var(--color-ink)]">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[var(--color-brand)] data-[state=unchecked]:bg-[var(--color-sand-deep)]"
      />
    </label>
  );
}

/** Quiet Validierungs-Pills. */
function BlockerLine({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 bg-[var(--color-sand)] border border-[var(--color-danger)]"
      style={{ borderRadius: 2 }}
    >
      <AlertCircle className="size-4 mt-0.5 text-[var(--color-danger)] shrink-0" strokeWidth={1.75} />
      <span className="font-sans text-[14px] text-[var(--color-danger)] leading-snug">{children}</span>
    </div>
  );
}
function WarningLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 text-[var(--color-stone-muted)]">
      <Info className="size-4 mt-0.5 shrink-0" strokeWidth={1.5} />
      <span className="font-sans text-[13px] leading-snug">{children}</span>
    </div>
  );
}

/** Field-Wrapper (Etage etc.). */
function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[15px] font-sans text-[var(--color-ink)] placeholder:text-[var(--color-stone-muted)] focus:border-[1.5px] focus:border-[var(--color-brand)] outline-none transition-colors duration-200"
        style={{ borderRadius: 2 }}
      />
    </label>
  );
}

/* =====================================================================
 * Wizard-Shell
 * ===================================================================== */

function RaumWizard() {
  const { id, raumId } = Route.useParams();
  const [step, setStep] = useState(1);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  const { data: raum, isLoading } = useQuery({
    queryKey: ["raum", raumId],
    queryFn: async () => {
      const { data, error } = await supabase.from("raum").select("*").eq("id", raumId).single();
      if (error) throw error;
      return data;
    },
  });

  // Snapshot des Raums lokal cachen — damit Offline-Abschließen und Offline-Öffnen funktionieren.
  useEffect(() => {
    if (!raum) return;
    (async () => {
      try {
        const { buildRaumSnapshot, cacheRaumSnapshotLocal } = await import("@/lib/raum-snapshot");
        const snap = await buildRaumSnapshot(raumId);
        await cacheRaumSnapshotLocal(snap);
      } catch { /* offline oder Netzfehler — ok, letzter Cache bleibt gültig */ }
    })();
  }, [raum, raumId]);

  const { data: katalog = [] } = useQuery<Catalog[]>({
    queryKey: ["katalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leistung_katalog")
        .select("id, code, bezeichnung, einheit");
      if (error) throw error;
      return data ?? [];
    },
  });

  const navigate = useNavigate();

  if (isLoading || !raum) {
    return (
      <div className="px-5 py-10 text-center">
        <Loader2 className="size-8 animate-spin mx-auto text-[var(--color-stone-muted)]" />
      </div>
    );
  }

  const isLast = step === 6;

  function handleWeiter() {
    emitWizardSave();
    if (isLast) {
      navigate({ to: "/projekt/$id", params: { id } });
    } else {
      setStep((s) => Math.min(6, s + 1));
    }
  }

  return (
    <div className="pb-32 myr-rise">
      <ScreenHeader
        backTo="/projekt/$id"
        backParams={{ id }}
        title={raum.name}
        below={
          <Stepper
            step={step}
            onJump={(n) => {
              emitWizardSave();
              setStep(n);
            }}
          />
        }
      />

      <div className="mx-auto max-w-[760px] px-4 md:px-6 py-6 space-y-7">
        {step === 1 && <Step1 raum={raum} />}
        {step === 2 && <Step2 raumId={raumId} />}
        {step === 3 && <Step3 raumId={raumId} katalog={katalog} />}
        {step === 4 && <Step4 raumId={raumId} katalog={katalog} />}
        {step === 5 && <Step5 raumId={raumId} katalog={katalog} />}
        {step === 6 && <Step6 raumId={raumId} projektId={id} />}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--color-hairline)] bg-[var(--color-paper)] md:left-[220px]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[760px] grid grid-cols-2 gap-3 px-4 py-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => {
              emitWizardSave();
              setStep((s) => Math.max(1, s - 1));
            }}
            className={cn(
              "min-h-[52px] inline-flex items-center justify-center",
              "border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent",
              "text-[12px] font-sans font-medium uppercase tracking-[0.14em]",
              "hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] transition-colors duration-300",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
            )}
            style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={handleWeiter}
            className={cn(
              "min-h-[52px] inline-flex items-center justify-center gap-2",
              "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)]",
              "text-[12px] font-sans font-medium uppercase tracking-[0.14em]",
              "transition-colors duration-300",
            )}
            style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
          >
            {isLast ? "Abschliessen" : "Weiter"}
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </nav>
    </div>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  const steps = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex items-center w-full" role="list" aria-label="Wizard-Schritte">
      {steps.map((n, i) => {
        const isCurrent = n === step;
        const isDone = n < step;
        const isUpcoming = n > step;
        const clickable = !isUpcoming;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Schritt ${n} von 6`}
              disabled={!clickable}
              onClick={() => clickable && onJump(n)}
              className={cn(
                "relative shrink-0 inline-flex items-center justify-center",
                "size-9 md:size-12 rounded-full transition-colors duration-300",
                "font-sans text-[12px] md:text-[14px] tracking-[0.08em] tabular-nums",
                isCurrent &&
                  "bg-[var(--color-brand)] text-[var(--color-paper)] ring-1 ring-offset-2 ring-offset-[var(--color-paper)] ring-[var(--color-brand)]",
                isDone && "bg-[var(--color-brand)] text-[var(--color-paper)] cursor-pointer",
                isUpcoming &&
                  "bg-[var(--color-paper)] text-[var(--color-stone-muted)] border-[1.5px] border-[var(--color-hairline)] cursor-not-allowed",
              )}
            >
              {isDone ? (
                <Check className="size-4 md:size-5" strokeWidth={2} />
              ) : (
                String(n).padStart(2, "0")
              )}
            </button>
            {i < steps.length - 1 && (
              <div
                aria-hidden
                className={cn(
                  "flex-1 h-px mx-1 md:mx-2 transition-colors duration-300",
                  n < step ? "bg-[var(--color-brand)]" : "bg-[var(--color-hairline)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
 * STEP 1 — Raumdaten + Sonderflächen
 * ===================================================================== */
function Step1({ raum }: { raum: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState(raum.name ?? "");
  const [laenge, setLaenge] = useState(raum.laenge_cm?.toString() ?? "");
  const [breite, setBreite] = useState(raum.breite_cm?.toString() ?? "");
  const [hoehe, setHoehe] = useState(raum.raumhoehe_cm?.toString() ?? "");
  const [deckentyp, setDeckentyp] = useState<string>(raum.deckentyp ?? "standard");
  const [etage, setEtage] = useState(raum.etage ?? "");
  const [saving, setSaving] = useState(false);

  async function save(opts: { silent?: boolean } = {}) {
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
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!opts.silent) toast.success("Gespeichert");
    qc.invalidateQueries({ queryKey: ["raum", raum.id] });
    qc.invalidateQueries({ queryKey: ["raeume", raum.projekt_id] });
  }

  useEffect(() => {
    const handler = () => {
      void save({ silent: true });
    };
    window.addEventListener(WIZARD_SAVE_EVENT, handler);
    return () => window.removeEventListener(WIZARD_SAVE_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, laenge, breite, hoehe, deckentyp, etage]);

  const { data: tfs = [], refetch } = useQuery({
    queryKey: ["raum_teilflaeche", raum.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("raum_teilflaeche")
        .select("*")
        .eq("raum_id", raum.id)
        .order("created_at");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <SectionTitle>Raumdaten</SectionTitle>

        <div className="space-y-2">
          <FieldLabel>Raumname</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[52px] w-full bg-[var(--color-paper)] border border-[var(--color-hairline)] px-4 text-[17px] font-sans text-[var(--color-ink)] focus:border-[1.5px] focus:border-[var(--color-brand)] outline-none transition-colors duration-200"
            style={{ borderRadius: 2 }}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {RAUMNAMEN.map((n) => (
              <SelectPill key={n} active={name === n} onClick={() => setName(n)} className="px-4">
                {n}
              </SelectPill>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Länge" suffix="cm" value={laenge} onChange={(e) => setLaenge(e.target.value)} />
          <NumberInput label="Breite" suffix="cm" value={breite} onChange={(e) => setBreite(e.target.value)} />
          <NumberInput label="Raumhöhe" suffix="cm" value={hoehe} onChange={(e) => setHoehe(e.target.value)} />
          <TextField label="Etage" value={etage} onChange={setEtage} placeholder="z. B. EG, 1. OG" />
        </div>

        <div className="space-y-2">
          <FieldLabel>Deckentyp</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {DECKENTYPEN.map((d) => (
              <SelectPill key={d.v} active={deckentyp === d.v} onClick={() => setDeckentyp(d.v)}>
                {d.l}
              </SelectPill>
            ))}
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="link-quiet text-[13px] disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Jetzt zwischenspeichern"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle optional>Geometrie für Raumlevel</SectionTitle>
        <GeometrieEditor raumId={raum.id} initial={(raum as any).geometrie ?? null} />
      </section>

      <section className="space-y-3">
        <SectionTitle optional>Sonderflächen</SectionTitle>
        <div className="space-y-3">
          {tfs.map((t) => (
            <TeilflaecheRow key={t.id} row={t} onChange={refetch} />
          ))}
          <AddRowButton
            onClick={async () => {
              await supabase
                .from("raum_teilflaeche")
                .insert({ raum_id: raum.id, typ: "zusatz", daten: { wirkt_auf: "wand" } });
              refetch();
            }}
          >
            Sonderfläche hinzufügen
          </AddRowButton>
        </div>
      </section>
    </div>
  );
}

function TeilflaecheRow({ row, onChange }: { row: any; onChange: () => void }) {
  const [typ, setTyp] = useState<"zusatz" | "abzug">(row.typ);
  const [l, setL] = useState(row.laenge_cm?.toString() ?? "");
  const [b, setB] = useState(row.breite_cm?.toString() ?? "");
  const [wirkt, setWirkt] = useState<string>((row.daten?.wirkt_auf as string) ?? "wand");

  async function save(next?: Partial<{ typ: "zusatz" | "abzug"; wirkt: string }>) {
    await supabase
      .from("raum_teilflaeche")
      .update({
        typ: next?.typ ?? typ,
        laenge_cm: l ? Number(l) : null,
        breite_cm: b ? Number(b) : null,
        daten: { ...(row.daten ?? {}), wirkt_auf: next?.wirkt ?? wirkt },
      })
      .eq("id", row.id);
    onChange();
  }
  async function del() {
    await supabase.from("raum_teilflaeche").delete().eq("id", row.id);
    onChange();
  }
  return (
    <div
      className="bg-[var(--color-sand)] border border-[var(--color-hairline)] p-3 space-y-3"
      style={{ borderRadius: 2 }}
    >
      <div className="flex gap-2 items-center">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <SelectPill
            active={typ === "zusatz"}
            onClick={() => {
              setTyp("zusatz");
              void save({ typ: "zusatz" });
            }}
          >
            + Zusatz
          </SelectPill>
          <SelectPill
            active={typ === "abzug"}
            onClick={() => {
              setTyp("abzug");
              void save({ typ: "abzug" });
            }}
          >
            − Abzug
          </SelectPill>
        </div>
        <DeleteIconButton onConfirm={del} label="Sonderfläche löschen" description="Diese Sonderfläche wird entfernt." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Länge" suffix="cm" value={l} onChange={(e) => setL(e.target.value)} onBlur={() => save()} />
        <NumberInput label="Breite" suffix="cm" value={b} onChange={(e) => setB(e.target.value)} onBlur={() => save()} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Wirkt auf</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {(["boden", "decke", "wand"] as const).map((w) => (
            <SelectPill
              key={w}
              active={wirkt === w}
              onClick={() => {
                setWirkt(w);
                void save({ wirkt: w });
              }}
            >
              <span className="capitalize">{w}</span>
            </SelectPill>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * STEP 2 — Öffnungen
 * ===================================================================== */
function Step2({ raumId }: { raumId: string }) {
  const { data: oeff = [], refetch } = useQuery({
    queryKey: ["oeffnung", raumId],
    queryFn: async () => {
      const { data } = await supabase
        .from("oeffnung")
        .select("*")
        .eq("raum_id", raumId)
        .order("created_at");
      return data ?? [];
    },
  });

  return (
    <section className="space-y-4">
      <SectionTitle>Öffnungen</SectionTitle>
      {oeff.length === 0 && (
        <p className="text-[14px] text-[var(--color-stone-muted)]">Noch keine Öffnungen erfasst.</p>
      )}
      <div className="space-y-3">
        {oeff.map((o) => (
          <OeffnungRow key={o.id} row={o} onChange={refetch} />
        ))}
        <AddRowButton
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
          Öffnung hinzufügen
        </AddRowButton>
      </div>
    </section>
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
  const [seiten, setSeiten] = useState<{
    links: boolean;
    rechts: boolean;
    oben: boolean;
    unten: boolean;
  }>(seiten0);

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
    <div
      className="bg-[var(--color-sand)] border border-[var(--color-hairline)] p-3 space-y-3"
      style={{ borderRadius: 2 }}
    >
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-2 flex-1">
          {OEFFNUNG_TYPEN.map((o) => (
            <SelectPill
              key={o.v}
              active={typ === o.v}
              onClick={() => {
                setTyp(o.v);
                setTimeout(save, 0);
              }}
            >
              {o.l}
            </SelectPill>
          ))}
        </div>
        <DeleteIconButton onConfirm={del} label="Öffnung löschen" description="Diese Öffnung wird entfernt." />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput label="Breite" suffix="cm" value={b} onChange={(e) => setB(e.target.value)} onBlur={save} />
        <NumberInput label="Höhe" suffix="cm" value={h} onChange={(e) => setH(e.target.value)} onBlur={save} />
        <NumberInput label="Anzahl" value={anzahl} onChange={(e) => setAnzahl(e.target.value)} onBlur={save} />
      </div>
      <div>
        <ToggleRow
          label="Von Wandfläche abziehen"
          checked={abz}
          onChange={(v) => {
            setAbz(v);
            setTimeout(save, 0);
          }}
        />
        <ToggleRow
          label="Abdecken"
          checked={abdecken}
          onChange={(v) => {
            setAbdecken(v);
            setTimeout(save, 0);
          }}
        />
        <ToggleRow
          label="Silikon entfernen"
          checked={silikon}
          onChange={(v) => {
            setSilikon(v);
            setTimeout(save, 0);
          }}
        />
        <ToggleRow
          label="Leibung vorhanden"
          checked={leibung}
          onChange={(v) => {
            setLeibung(v);
            setTimeout(save, 0);
          }}
        />
      </div>
      {leibung && (
        <div className="space-y-2 pl-3 border-l-2 border-[var(--color-brand)]">
          <NumberInput
            label="Leibungstiefe"
            suffix="cm"
            value={leibungTiefe}
            onChange={(e) => setLeibungTiefe(e.target.value)}
            onBlur={save}
          />
          <div className="space-y-1">
            <FieldLabel>Leibungs-Seiten</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {(["links", "rechts", "oben", "unten"] as const).map((s) => (
                <SelectPill
                  key={s}
                  active={seiten[s]}
                  onClick={() => {
                    const ns = { ...seiten, [s]: !seiten[s] };
                    setSeiten(ns);
                    setTimeout(save, 0);
                  }}
                >
                  <span className="capitalize">{s}</span>
                </SelectPill>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
 * STEP 3 — Decke / Wände / Boden
 * ===================================================================== */
function Step3({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: rl = [], refetch } = useQuery<RaumLeistungRow[]>({
    queryKey: ["raum_leistung", raumId],
    queryFn: async () => {
      const { data } = await supabase.from("raum_leistung").select("*").eq("raum_id", raumId);
      return (data ?? []) as RaumLeistungRow[];
    },
  });
  return (
    <section className="space-y-4">
      <SectionTitle>Decke / Wände / Boden</SectionTitle>
      <p className="text-[14px] text-[var(--color-stone-muted)]">
        Mehrfachauswahl. Tippe, um eine Leistung zu aktivieren.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {STEP3_CODES.map(([code, label]) => {
          const k = katalog.find((c) => c.code === code);
          const aktiv = !!k && rl.some((r) => r.leistung_id === k.id);
          return (
            <LeistungCard
              key={code}
              active={aktiv}
              label={label}
              onClick={async () => {
                if (!k) return toast.error(`Katalog-Code ${code} fehlt`);
                await setRaumLeistung(raumId, code, !aktiv, katalog);
                refetch();
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

/* =====================================================================
 * STEP 4 — Heizkörper
 * ===================================================================== */
function Step4({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: hks = [], refetch } = useQuery({
    queryKey: ["heizkoerper", raumId],
    queryFn: async () => {
      const { data } = await supabase
        .from("heizkoerper")
        .select("*")
        .eq("raum_id", raumId)
        .order("created_at");
      return data ?? [];
    },
  });

  async function syncLeistungen(list: any[]) {
    const hasRippe = list.some(
      (h) => (h.daten as any)?.typ === "rippe" && (h.daten as any)?.lackieren !== false,
    );
    const hasRohr = list.some(
      (h) => (h.daten as any)?.typ === "rohr" && (h.daten as any)?.lackieren !== false,
    );
    await setRaumLeistung(raumId, "HK_RIPPE_LACK", hasRippe, katalog);
    await setRaumLeistung(raumId, "HK_ROHRE_LACK", hasRohr, katalog);
  }

  return (
    <section className="space-y-4">
      <SectionTitle>Heizkörper</SectionTitle>
      {hks.length === 0 && (
        <p className="text-[14px] text-[var(--color-stone-muted)]">Noch keine Heizkörper erfasst.</p>
      )}
      <div className="space-y-3">
        {hks.map((h) => (
          <HeizkoerperRow
            key={h.id}
            row={h}
            onChange={async () => {
              const { data } = await supabase.from("heizkoerper").select("*").eq("raum_id", raumId);
              await syncLeistungen(data ?? []);
              refetch();
            }}
          />
        ))}
        <AddRowButton
          onClick={async () => {
            await supabase
              .from("heizkoerper")
              .insert({ raum_id: raumId, daten: { typ: "rippe", lackieren: true, rohr_laengen_cm: [] } });
            refetch();
          }}
        >
          Heizkörper hinzufügen
        </AddRowButton>
      </div>
    </section>
  );
}

function HeizkoerperRow({ row, onChange }: { row: any; onChange: () => void }) {
  const d0 = (row.daten ?? {}) as any;
  const [typ, setTyp] = useState<"rippe" | "platte" | "rohr">(d0.typ ?? "rippe");
  const [hoehe, setHoehe] = useState(row.hoehe_cm?.toString() ?? "");
  const [breite, setBreite] = useState(row.breite_cm?.toString() ?? "");
  const [tiefe, setTiefe] = useState(row.tiefe_cm?.toString() ?? "");
  const [rippen, setRippen] = useState(d0.rippenanzahl?.toString() ?? "");
  const [rohre, setRohre] = useState<string[]>(
    (d0.rohr_laengen_cm ?? []).map((x: number) => x.toString()),
  );
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
    <div
      className="bg-[var(--color-sand)] border border-[var(--color-hairline)] p-3 space-y-3"
      style={{ borderRadius: 2 }}
    >
      <div className="flex gap-2 items-center">
        <div className="grid grid-cols-3 gap-2 flex-1">
          {(["rippe", "platte", "rohr"] as const).map((t) => (
            <SelectPill
              key={t}
              active={typ === t}
              onClick={() => {
                setTyp(t);
                save({ typ: t });
              }}
            >
              <span className="capitalize">{t}</span>
            </SelectPill>
          ))}
        </div>
        <DeleteIconButton onConfirm={del} label="Heizkörper löschen" description="Dieser Heizkörper wird entfernt." />
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
          <FieldLabel>Rohrlängen</FieldLabel>
          {rohre.map((r, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <NumberInput
                  suffix="cm"
                  value={r}
                  onChange={(e) => {
                    const nr = [...rohre];
                    nr[i] = e.target.value;
                    setRohre(nr);
                  }}
                  onBlur={() => save({ rohre })}
                />
              </div>
              <DeleteIconButton
                onConfirm={() => {
                  const nr = rohre.filter((_, j) => j !== i);
                  setRohre(nr);
                  save({ rohre: nr });
                }}
                label="Rohrlänge entfernen"
                description="Diese Rohrlänge wird entfernt."
              />
            </div>
          ))}
          <AddRowButton onClick={() => setRohre([...rohre, ""])}>Länge hinzufügen</AddRowButton>
        </div>
      )}

      <ToggleRow
        label="Lackieren"
        checked={lackieren}
        onChange={(v) => {
          setLackieren(v);
          save({ lackieren: v });
        }}
      />
    </div>
  );
}

/* =====================================================================
 * STEP 5 — Acryl + Sonderleistungen + Notiz + Foto
 * ===================================================================== */
function Step5({ raumId, katalog }: { raumId: string; katalog: Catalog[] }) {
  const { data: acryl = [], refetch: refetchA } = useQuery({
    queryKey: ["acryl", raumId],
    queryFn: async () => {
      const { data } = await supabase
        .from("acryl_position")
        .select("*")
        .eq("raum_id", raumId)
        .order("created_at");
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
  useEffect(() => {
    if (raum?.bemerkung != null) setBemerkung(raum.bemerkung);
  }, [raum?.bemerkung]);

  // ACRYL automatisch (de)aktivieren, wenn Liste leer/voll
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
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionTitle>Acryl-Fugen</SectionTitle>
        <div className="space-y-2">
          {acryl.map((a) => (
            <AcrylRow key={a.id} row={a} onChange={refetchA} />
          ))}
          <AddRowButton
            onClick={async () => {
              await supabase.from("acryl_position").insert({ raum_id: raumId, laenge_m: null });
              refetchA();
            }}
          >
            Acryl-Länge hinzufügen
          </AddRowButton>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle optional>Sonderleistungen</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {STEP5_CODES.map(([code, label]) => {
            const k = katalog.find((c) => c.code === code);
            const aktiv = !!k && rl.some((r) => r.leistung_id === k.id);
            return (
              <LeistungCard
                key={code}
                active={aktiv}
                label={label}
                onClick={async () => {
                  if (!k) return toast.error(`Katalog-Code ${code} fehlt`);
                  await setRaumLeistung(raumId, code, !aktiv, katalog);
                  refetchRL();
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle optional>Notiz</SectionTitle>
        <Textarea
          rows={4}
          value={bemerkung ?? ""}
          onChange={(e) => setBemerkung(e.target.value)}
          onBlur={async () => {
            await supabase.from("raum").update({ bemerkung }).eq("id", raumId);
          }}
          placeholder="Freitext-Notiz zum Raum"
          className="text-[15px] font-sans bg-[var(--color-paper)] border-[var(--color-hairline)] focus:border-[var(--color-brand)] placeholder:text-[var(--color-stone-muted)]"
          style={{ borderRadius: 2 }}
        />
      </section>

      <section className="space-y-2">
        <SectionTitle optional>Foto</SectionTitle>
        <label
          className="flex flex-col items-center justify-center gap-2 min-h-[96px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-sand)] text-[var(--color-stone-muted)] hover:bg-[var(--color-sand-deep)] transition-colors duration-300 cursor-pointer"
          style={{ borderRadius: 2 }}
        >
          <Camera className="size-5" strokeWidth={1.5} />
          <span className="font-sans text-[13px] uppercase tracking-[0.14em]">
            Foto aufnehmen / hochladen
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFoto(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </section>
    </div>
  );
}

function AcrylRow({ row, onChange }: { row: any; onChange: () => void }) {
  const [v, setV] = useState(row.laenge_m?.toString() ?? "");
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <NumberInput
          label="Länge"
          suffix="m"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={async () => {
            await supabase
              .from("acryl_position")
              .update({ laenge_m: v ? Number(v) : null })
              .eq("id", row.id);
            onChange();
          }}
        />
      </div>
      <DeleteIconButton
        onConfirm={async () => {
          await supabase.from("acryl_position").delete().eq("id", row.id);
          onChange();
        }}
        label="Acryl-Länge entfernen"
        description="Diese Acryl-Länge wird entfernt."
      />
    </div>
  );
}

/* =====================================================================
 * STEP 6 — Prüfung & Abschluss
 * ===================================================================== */
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
    kennzahlen?: {
      raum: string;
      L: number;
      B: number;
      H: number;
      boden_m2: number;
      decke_m2: number;
      wand_m2: number;
    }[];
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
  const hasBlockers = blockers.length > 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Prüfung & Abschluss</SectionTitle>
        <RaumGrundrissCard raumId={raumId} />
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            "w-full min-h-[48px] inline-flex items-center justify-center gap-2",
            "border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent",
            "text-[12px] font-sans font-medium uppercase tracking-[0.14em]",
            "hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] transition-colors duration-300",
          )}
          style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
        >
          {isFetching && <Loader2 className="size-4 animate-spin" />}
          Neu berechnen
        </button>
      </section>

      {error && (
        <BlockerLine>{(error as Error).message}</BlockerLine>
      )}

      {data && (
        <>
          {kz && (
            <section className="space-y-2">
              <FieldLabel>Ergebnis</FieldLabel>
              <div
                className="border border-[var(--color-hairline)] divide-y divide-[var(--color-hairline)] bg-[var(--color-paper)]"
                style={{ borderRadius: 2 }}
              >
                {[
                  ["Boden", kz.boden_m2],
                  ["Decke", kz.decke_m2],
                  ["Wand (netto)", kz.wand_m2],
                ].map(([label, val]) => (
                  <div
                    key={label as string}
                    className="flex items-center justify-between min-h-[48px] px-4"
                  >
                    <span className="font-sans text-[14px] text-[var(--color-ink)]">{label}</span>
                    <span className="font-serif text-[20px] tabular-nums text-[var(--color-ink)]">
                      {(val as number).toFixed(2)}
                      <span className="ml-1 text-[12px] font-sans text-[var(--color-stone-muted)]">
                        m²
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(blockers.length > 0 || warnungen.length > 0) && (
            <section className="space-y-2">
              {blockers.map((b, i) => (
                <BlockerLine key={`b-${i}`}>{b.message}</BlockerLine>
              ))}
              {warnungen.map((b, i) => (
                <WarningLine key={`w-${i}`}>{b.message}</WarningLine>
              ))}
            </section>
          )}

          {data.uebergabe.positionen.length > 0 && (
            <section className="space-y-2">
              <FieldLabel>Positionen</FieldLabel>
              <div
                className="border border-[var(--color-hairline)] divide-y divide-[var(--color-hairline)] bg-[var(--color-paper)]"
                style={{ borderRadius: 2 }}
              >
                {data.uebergabe.positionen.map((p) => {
                  const zeile = p.zeilen[0];
                  return (
                    <div key={p.leistungs_code} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-sans text-[14px] font-medium text-[var(--color-ink)]">
                          {p.name}
                        </span>
                        <span className="font-serif text-[18px] tabular-nums text-[var(--color-ink)]">
                          {(zeile?.ergebnis ?? 0).toFixed(2)}
                          <span className="ml-1 text-[11px] font-sans text-[var(--color-stone-muted)]">
                            {p.einheit}
                          </span>
                        </span>
                      </div>
                      {zeile && (
                        <p className="mt-1 font-mono text-[11px] text-[var(--color-stone-muted)] leading-snug">
                          {zeile.formel}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <button
              type="button"
              disabled={hasBlockers}
              onClick={async () => {
                try {
                  const [{ buildRaumSnapshot, cacheRaumSnapshotLocal }, { enqueueJob }, { drain }] =
                    await Promise.all([
                      import("@/lib/raum-snapshot"),
                      import("@/lib/offline-db"),
                      import("@/lib/offline-sync"),
                    ]);
                  if (navigator.onLine) {
                    // Online: aktuellen Server-Zustand snapshotten und lokal cachen
                    const snap = await buildRaumSnapshot(raumId);
                    await cacheRaumSnapshotLocal(snap);
                    // Sync-Fallback: ausstehende Änderungen anderer Räume mitnehmen
                    void drain();
                    toast.success("Raum abgeschlossen");
                  } else {
                    // Offline: letzte bekannte Version aus dem Draft-Cache in die Queue legen
                    const { getDraft } = await import("@/lib/offline-db");
                    const draft = await getDraft(raumId);
                    if (draft) {
                      await enqueueJob({
                        kind: "raum_upsert",
                        payload: draft.data,
                        raumId,
                        projektId,
                      });
                      toast.success("Wird synchronisiert, sobald wieder online.");
                    } else {
                      toast.error("Kein lokaler Stand vorhanden — bitte online abschließen.");
                      return;
                    }
                  }
                  navigate({ to: "/projekt/$id", params: { id: projektId } });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Fehler beim Abschließen";
                  toast.error(msg);
                }
              }}
              className={cn(
                "w-full min-h-[52px] inline-flex items-center justify-center gap-2",
                "bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)]",
                "text-[12px] font-sans font-medium uppercase tracking-[0.14em]",
                "transition-colors duration-300",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-brand)]",
              )}
              style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
            >
              Raum abschliessen
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </button>
            {hasBlockers && (
              <p className="text-[12px] text-[var(--color-stone-muted)] text-center">
                Bitte zuerst alle Blocker beheben.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
