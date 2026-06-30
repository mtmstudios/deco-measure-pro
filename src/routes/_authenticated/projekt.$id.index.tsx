import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Check,
  Pencil,
  X,
  Eye,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
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

function isErfasst(r: Raum) {
  return r.laenge_cm != null && r.breite_cm != null && r.raumhoehe_cm != null;
}

function nextZimmerName(raeume: Raum[]) {
  const used = new Set<number>();
  for (const r of raeume) {
    const m = /^Zimmer\s+(\d+)\s*$/i.exec(r.name?.trim() ?? "");
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `Zimmer ${n}`;
}

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

  const raeume = raeumeQ.data ?? [];

  const duplicate = useMutation({
    mutationFn: async (raumId: string) => {
      const { data, error } = await supabase.rpc("duplicate_raum" as never, {
        p_raum_id: raumId,
      } as never);
      if (error) throw error;
      const newId = data as unknown as string;
      const neuerName = nextZimmerName(raeume);
      if (newId) {
        await supabase
          .from("raum" as never)
          .update({ name: neuerName } as never)
          .eq("id", newId);
      }
      return newId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raeume", id] });
      toast.success("Raum dupliziert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ raumId, name }: { raumId: string; name: string }) => {
      const { error } = await supabase
        .from("raum" as never)
        .update({ name } as never)
        .eq("id", raumId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raeume", id] });
      toast.success("Umbenannt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (raumId: string) => {
      const { error } = await supabase.from("raum" as never).delete().eq("id", raumId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raeume", id] });
      toast.success("Raum gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [renameTarget, setRenameTarget] = useState<Raum | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function openRename(r: Raum) {
    setRenameTarget(r);
    setRenameValue(r.name);
  }
  function confirmRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    rename.mutate({ raumId: renameTarget.id, name });
    setRenameTarget(null);
  }

  const projekt = projektQ.data;
  const total = raeume.length;
  const erfasst = raeume.filter(isErfasst).length;
  const progressPct = total === 0 ? 0 : Math.round((erfasst / total) * 100);

  return (
    <div className="pb-32 myr-rise">
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
              <span className="num-serif">{erfasst}</span> von{" "}
              <span className="num-serif">{total}</span> erfasst
            </p>
          </div>
          <div
            className="h-[3px] bg-[var(--color-sand-deep)] overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
          >
            <div
              className="h-full bg-[var(--color-brand)] transition-[width] duration-300"
              style={{ width: `${progressPct}%`, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {raeumeQ.isLoading && (
            <p className="text-base text-muted-foreground">Lade Räume…</p>
          )}
          {!raeumeQ.isLoading && raeume.length === 0 && (
            <p className="text-base text-muted-foreground py-4 text-center md:col-span-2">
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
              onRename={() => openRename(r)}
              onDelete={() => {
                if (window.confirm(`Raum „${r.name}" wirklich löschen?`)) {
                  remove.mutate(r.id);
                }
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate({ to: "/projekt/$id/raum/neu", params: { id } })}
          className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 border-[1.5px] border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent hover:bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] uppercase tracking-[0.14em] text-[13px] font-medium transition-colors duration-300"
          style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Raum hinzufügen
        </button>
      </div>

      {/* End-Aktionen sticky */}
      <div
        className="fixed left-0 right-0 bottom-16 md:bottom-0 md:left-[220px] px-4 md:px-8 py-3 bg-[var(--color-paper)] border-t border-[var(--color-hairline)] flex gap-3 z-20"
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

      {/* Umbenennen-Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="rounded-none border-[var(--color-hairline)] bg-[var(--color-paper)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[20px] font-medium">
              Raum umbenennen
            </DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-12 text-base"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
            }}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="min-h-[44px] rounded-none border border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent uppercase tracking-[0.14em] text-[12px]"
              onClick={() => setRenameTarget(null)}
            >
              Abbrechen
            </Button>
            <Button
              className="min-h-[44px] rounded-none bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[12px]"
              onClick={confirmRename}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <section className="myr-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0 space-y-2">
            {projekt.gewerk && <p className="eyebrow">{projekt.gewerk}</p>}
            <p className="font-serif text-[20px] leading-tight text-[var(--color-ink)] truncate">
              {projekt.kunde}
            </p>
            {projekt.adresse && (
              <p className="text-[15px] text-[var(--color-stone-muted)] truncate">
                {projekt.adresse}
              </p>
            )}
            {projekt.auftrag_nr && (
              <p className="text-[13px] text-[var(--color-stone-muted)]">
                Auftrag {projekt.auftrag_nr}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Bearbeiten"
            className="size-11 flex items-center justify-center text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            <Pencil className="size-5" strokeWidth={1.5} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="myr-card p-5 space-y-3 border-[var(--color-brand)]">
      <EditField id="kunde" label="Kunde" value={form.kunde} onChange={(v) => setForm((f) => ({ ...f, kunde: v }))} />
      <EditField id="adresse" label="Adresse" value={form.adresse} onChange={(v) => setForm((f) => ({ ...f, adresse: v }))} />
      <EditField id="auftrag_nr" label="Auftrags-Nr." value={form.auftrag_nr} onChange={(v) => setForm((f) => ({ ...f, auftrag_nr: v }))} />
      <EditField id="gewerk" label="Gewerk" value={form.gewerk} onChange={(v) => setForm((f) => ({ ...f, gewerk: v }))} />
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1 min-h-[48px] rounded-none border border-[var(--color-brand)] text-[var(--color-brand)] bg-transparent uppercase tracking-[0.14em] text-[12px]"
          onClick={() => setEditing(false)}
        >
          <X className="size-4 mr-1" /> Abbrechen
        </Button>
        <Button
          className="flex-1 min-h-[48px] rounded-none bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[12px]"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          <Check className="size-4 mr-1" /> {save.isPending ? "…" : "Speichern"}
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
  onRename,
  onDelete,
}: {
  raum: Raum;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const erfasst = isErfasst(raum);
  const maße = [raum.laenge_cm, raum.breite_cm, raum.raumhoehe_cm];
  const maßeText = erfasst ? `${maße[0]} × ${maße[1]} × ${maße[2]} cm` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="myr-card group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 cursor-pointer hover:bg-[var(--color-sand-deep)] active:bg-[var(--color-sand-deep)] transition-colors duration-300"
      style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {erfasst ? (
            <span
              aria-label="Erfasst"
              className="size-5 rounded-full bg-[var(--color-brand)] text-[var(--color-paper)] flex items-center justify-center shrink-0"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
          ) : (
            <span
              aria-label="Offen"
              className="size-5 rounded-full border-[1.5px] border-[var(--color-hairline)] shrink-0"
            />
          )}
          <h3 className="font-serif text-[19px] leading-tight text-[var(--color-ink)] truncate">
            {raum.name}
          </h3>
        </div>

        {raum.etage && (
          <p className="text-[13px] text-[var(--color-stone-muted)] truncate">{raum.etage}</p>
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {erfasst ? (
            <>
              <p className="text-[14px] num-serif text-[var(--color-ink)]">{maßeText}</p>
              <span className="text-[12px] tracking-[0.08em] text-[var(--color-brand)]">
                Erfasst
              </span>
            </>
          ) : (
            <span
              className="inline-flex items-center min-h-[22px] px-2 py-0.5 bg-[var(--color-sand-deep)] border border-[var(--color-hairline)] text-[11px] tracking-[0.08em] text-[var(--color-stone-muted)]"
              style={{ borderRadius: 2 }}
            >
              Maße fehlen
            </span>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Aktionen"
              className="size-11 flex items-center justify-center text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-5" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-none border border-[var(--color-hairline)] bg-[var(--color-sand)] shadow-none min-w-[180px]"
          >
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDuplicate();
              }}
              className="text-[14px] cursor-pointer rounded-none focus:bg-[var(--color-sand-deep)]"
            >
              Duplizieren
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onRename();
              }}
              className="text-[14px] cursor-pointer rounded-none focus:bg-[var(--color-sand-deep)]"
            >
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="text-[14px] cursor-pointer rounded-none text-[var(--color-danger)] focus:bg-[var(--color-sand-deep)] focus:text-[var(--color-danger)]"
            >
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="size-5 text-[var(--color-stone-muted)]" strokeWidth={1.5} />
      </div>
    </div>
  );
}
