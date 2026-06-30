import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Plus, Check, Pencil, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/projekt/$id/")({
  head: () => ({ meta: [{ title: "Projekt – Aufmaß-App" }] }),
  component: ProjektDetail,
});

type Projekt = {
  id: string;
  kunde: string;
  adresse: string | null;
  objekt_bezeichnung: string;
  auftrag_nr: string | null;
  verkaeufer: string | null;
  sachbearbeiter: string | null;
  gewerk: string | null;
  status: string;
};

type Raum = {
  id: string;
  name: string;
  etage: string | null;
  laenge_cm: number | null;
  breite_cm: number | null;
  raumhoehe_cm: number | null;
  reihenfolge: number | null;
  raum_leistung: { count: number }[];
};

function ProjektDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const projektQ = useQuery({
    queryKey: ["projekt", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projekt" as never)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Projekt | null;
    },
  });

  const raeumeQ = useQuery({
    queryKey: ["raeume", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raum" as never)
        .select(
          "id, name, etage, laenge_cm, breite_cm, raumhoehe_cm, reihenfolge, raum_leistung(count)",
        )
        .eq("projekt_id", id)
        .order("reihenfolge", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Raum[];
    },
  });

  const duplicate = useMutation({
    mutationFn: async (raumId: string) => {
      const { data, error } = await supabase.rpc("duplicate_raum" as never, {
        p_raum_id: raumId,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raeume", id] });
      toast.success("Raum dupliziert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const projekt = projektQ.data;
  const raeume = raeumeQ.data ?? [];
  const total = raeume.length;
  const erfasst = raeume.filter(
    (r) => r.laenge_cm && r.breite_cm && r.raumhoehe_cm,
  ).length;
  const progressPct = total === 0 ? 0 : Math.round((erfasst / total) * 100);

  return (
    <div className="pb-28 myr-rise">
      <ScreenHeader
        backTo="/projekte"
        eyebrow={projekt?.kunde ? "Projekt" : undefined}
        title={projekt?.objekt_bezeichnung ?? "Projekt"}
      />
      <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 pt-2 pb-6 space-y-6">

        {projektQ.isLoading && <p className="text-base text-muted-foreground">Lade…</p>}
        {projektQ.error && (
          <p className="text-base text-destructive">{(projektQ.error as Error).message}</p>
        )}

        {projekt && <KopfDaten projekt={projekt} />}

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-serif text-[22px] font-medium">Räume</h2>
            <p className="text-[13px] text-[var(--color-stone-muted)]">
              <span className="num-serif">{erfasst}</span> von <span className="num-serif">{total}</span> erfasst
            </p>
          </div>
          <div className="h-[5px] bg-[var(--color-sand-deep)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-brand)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </section>

        <div className="space-y-3">
          {raeumeQ.isLoading && <p className="text-base text-muted-foreground">Lade Räume…</p>}
          {!raeumeQ.isLoading && raeume.length === 0 && (
            <p className="text-base text-muted-foreground py-4 text-center">
              Noch keine Räume erfasst.
            </p>
          )}
          {raeume.map((r) => (
            <RaumKarte
              key={r.id}
              raum={r}
              onOpen={() =>
                navigate({ to: "/projekt/$id/raum/$raumId", params: { id, raumId: r.id } })
              }
              onDuplicate={() => duplicate.mutate(r.id)}
              duplicating={duplicate.isPending}
            />
          ))}
        </div>

        <Button
          onClick={() => navigate({ to: "/projekt/$id/raum/neu", params: { id } })}
          className="w-full h-14 text-base font-bold"
        >
          <Plus className="size-5 mr-1" strokeWidth={2.75} />
          Raum hinzufügen
        </Button>
      </div>

      <div
        className="fixed left-0 right-0 bottom-16 md:bottom-0 md:left-[220px] px-4 md:px-8 py-3 bg-[var(--color-paper)] border-t border-[var(--color-hairline)] flex gap-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <Button
          variant="outline"
          className="flex-1 min-h-[52px] text-[13px] uppercase tracking-[0.14em] font-medium border border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] rounded-none"
          onClick={() => navigate({ to: "/projekt/$id/vorschau", params: { id } })}
        >
          <Eye className="size-4 mr-2" strokeWidth={1.5} />
          Vorschau
        </Button>
        <Button
          className="flex-1 min-h-[52px] text-[13px] uppercase tracking-[0.14em] font-medium bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] rounded-none"
          onClick={() => navigate({ to: "/projekt/$id/vorschau", params: { id } })}
        >
          Übergabe →
        </Button>
      </div>
    </div>
  );
}

function KopfDaten({ projekt }: { projekt: Projekt }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    kunde: projekt.kunde,
    adresse: projekt.adresse ?? "",
    auftrag_nr: projekt.auftrag_nr ?? "",
    gewerk: projekt.gewerk ?? "",
  });

  useEffect(() => {
    setForm({
      kunde: projekt.kunde,
      adresse: projekt.adresse ?? "",
      auftrag_nr: projekt.auftrag_nr ?? "",
      gewerk: projekt.gewerk ?? "",
    });
  }, [projekt]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projekt" as never)
        .update({
          kunde: form.kunde.trim(),
          adresse: form.adresse.trim() || null,
          auftrag_nr: form.auftrag_nr.trim() || null,
          gewerk: form.gewerk.trim() || null,
        } as never)
        .eq("id", projekt.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projekt", projekt.id] });
      qc.invalidateQueries({ queryKey: ["projekte"] });
      toast.success("Gespeichert");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!editing) {
    return (
      <section className="bg-card border-2 border-border rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-lg font-bold leading-tight">{projekt.kunde}</p>
            {projekt.adresse && <p className="text-base">{projekt.adresse}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
              {projekt.auftrag_nr && <span>Auftrag {projekt.auftrag_nr}</span>}
              {projekt.gewerk && <span className="font-semibold">{projekt.gewerk}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Bearbeiten"
            className="size-12 rounded-lg flex items-center justify-center active:bg-accent border border-border shrink-0"
          >
            <Pencil className="size-5" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border-2 border-primary rounded-2xl p-4 space-y-3">
      <EditField id="kunde" label="Kunde" value={form.kunde} onChange={(v) => setForm((f) => ({ ...f, kunde: v }))} />
      <EditField id="adresse" label="Adresse" value={form.adresse} onChange={(v) => setForm((f) => ({ ...f, adresse: v }))} />
      <EditField id="auftrag_nr" label="Auftrags-Nr." value={form.auftrag_nr} onChange={(v) => setForm((f) => ({ ...f, auftrag_nr: v }))} />
      <EditField id="gewerk" label="Gewerk" value={form.gewerk} onChange={(v) => setForm((f) => ({ ...f, gewerk: v }))} />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 h-12 border-2" onClick={() => setEditing(false)}>
          <X className="size-5 mr-1" /> Abbrechen
        </Button>
        <Button className="flex-1 h-12" onClick={() => save.mutate()} disabled={save.isPending}>
          <Check className="size-5 mr-1" /> {save.isPending ? "…" : "Speichern"}
        </Button>
      </div>
    </section>
  );
}

function EditField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 text-base"
      />
    </div>
  );
}

function RaumKarte({
  raum,
  onOpen,
  onDuplicate,
  duplicating,
}: {
  raum: Raum;
  onOpen: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
}) {
  const hasLeistung = (raum.raum_leistung?.[0]?.count ?? 0) > 0;
  const maße = [raum.laenge_cm, raum.breite_cm, raum.raumhoehe_cm];
  const maßeText = maße.every((v) => v != null)
    ? `${maße[0]} × ${maße[1]} × ${maße[2]} cm`
    : "Maße fehlen";

  return (
    <div className="bg-card border-2 border-border rounded-2xl p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold truncate">{raum.name}</h3>
          {hasLeistung && (
            <span
              aria-label="Leistung erfasst"
              className="size-6 rounded-full bg-success text-success-foreground flex items-center justify-center shrink-0"
            >
              <Check className="size-4" strokeWidth={3} />
            </span>
          )}
        </div>
        {raum.etage && (
          <p className="text-sm text-muted-foreground">{raum.etage}</p>
        )}
        <p
          className={`text-base font-semibold ${
            maße.every((v) => v != null) ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {maßeText}
        </p>
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        disabled={duplicating}
        aria-label="Raum duplizieren"
        className="size-12 rounded-xl border-2 border-border flex items-center justify-center active:bg-accent shrink-0 disabled:opacity-50"
      >
        <Copy className="size-5" />
      </button>
    </div>
  );
}
