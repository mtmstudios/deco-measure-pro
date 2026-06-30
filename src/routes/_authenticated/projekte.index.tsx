import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, ChevronRight, Home, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { AppLogo } from "@/components/app-logo";
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

export const Route = createFileRoute("/_authenticated/projekte/")({
  head: () => ({ meta: [{ title: "Projekte · Aufmaß-App" }] }),
  component: ProjekteListe,
});

type ProjektStatus = "erfassung" | "geprueft" | "uebergeben" | "fehler";

type ProjektRow = {
  id: string;
  kunde: string;
  objekt_bezeichnung: string;
  auftrag_nr: string | null;
  gewerk: string | null;
  status: ProjektStatus;
  uebergeben_at: string | null;
  raum: { count: number }[];
};

const STATUS_LABEL: Record<ProjektStatus, string> = {
  erfassung: "Erfassung",
  geprueft: "Geprüft",
  uebergeben: "Übergeben",
  fehler: "Fehler",
};

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const UNDO_MS = 5000;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ProjekteListe() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProjektRow | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const { data: projekte, isLoading, error } = useQuery({
    queryKey: ["projekte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projekt" as never)
        .select(
          "id, kunde, objekt_bezeichnung, auftrag_nr, gewerk, status, uebergeben_at, raum(count)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjektRow[];
    },
  });

  const deleteProjekt = useMutation({
    mutationFn: async (projektId: string) => {
      const { error } = await supabase.from("projekt" as never).delete().eq("id", projektId);
      if (error) throw error;
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["projekte"] }),
  });

  function scheduleDelete(p: ProjektRow) {
    setHidden((prev) => new Set(prev).add(p.id));
    const t = setTimeout(() => {
      timersRef.current.delete(p.id);
      deleteProjekt.mutate(p.id);
    }, UNDO_MS);
    timersRef.current.set(p.id, t);

    toast(`Projekt „${p.objekt_bezeichnung}" gelöscht`, {
      duration: UNDO_MS,
      action: {
        label: "Rückgängig",
        onClick: () => {
          const handle = timersRef.current.get(p.id);
          if (handle) clearTimeout(handle);
          timersRef.current.delete(p.id);
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
          toast.success("Projekt wiederhergestellt");
        },
      },
    });
  }

  const filtered = useMemo(() => {
    if (!projekte) return [];
    const needle = q.trim().toLowerCase();
    const base = projekte.filter((p) => !hidden.has(p.id));
    if (!needle) return base;
    return base.filter((p) =>
      [p.objekt_bezeichnung, p.kunde, p.auftrag_nr ?? "", p.gewerk ?? ""].some((s) =>
        s.toLowerCase().includes(needle),
      ),
    );
  }, [projekte, q, hidden]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
  }

  const hasProjects =
    !!projekte && projekte.filter((p) => !hidden.has(p.id)).length > 0;

  return (
    <>
      <div className="myr-rise">
        <ScreenHeader
          right={
            <button
              onClick={handleLogout}
              aria-label="Abmelden"
              className="size-11 flex items-center justify-center text-[var(--color-stone-muted)] hover:text-[var(--color-ink)]"
            >
              <LogOut className="size-5" strokeWidth={1.5} />
            </button>
          }
        />

        <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 pt-4 pb-24 md:pb-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-5">
            <div className="min-w-0">
              {email && (
                <p className="text-[13px] text-[var(--color-stone-muted)] truncate normal-case">
                  {email}
                </p>
              )}
              <h1 className="font-serif text-[28px] md:text-[32px] leading-tight font-medium text-[var(--color-ink)]">
                Projekte
              </h1>
            </div>
            <Link
              to="/projekte/neu"
              className="hidden md:inline-flex items-center gap-2 min-h-[52px] px-6 bg-[var(--color-brand)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium hover:bg-[var(--color-brand-hover)] transition-colors duration-300"
              style={{ borderRadius: 2, transitionTimingFunction: EASE }}
            >
              <Plus className="size-4" strokeWidth={1.75} />
              Neuer Auftrag
            </Link>
          </div>

          <div className="relative mb-6">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-stone-muted)]"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Projekt oder Kunde suchen"
              className="w-full min-h-[48px] pl-10 pr-4 bg-[var(--color-paper)] border border-[var(--color-hairline)] text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-stone-muted)] focus:border-[var(--color-brand)] focus:outline-none transition-colors duration-300"
              style={{ borderRadius: 2, transitionTimingFunction: EASE }}
            />
          </div>

          {isLoading && <p className="text-[var(--color-stone-muted)]">Lade…</p>}
          {error && (
            <p className="text-[var(--color-danger)]">Fehler beim Laden: {(error as Error).message}</p>
          )}

          {!isLoading && !hasProjects && <EmptyState />}
          {!isLoading && hasProjects && filtered.length === 0 && <NoMatches query={q} />}

          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch pb-24 md:pb-0">
              {filtered.map((p) => (
                <ProjektSwipeCard
                  key={p.id}
                  p={p}
                  onDeleteRequest={() => setPendingDelete(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/projekte/neu" })}
        aria-label="Neuer Auftrag"
        className="md:hidden fixed right-5 z-10 size-14 bg-[var(--color-brand)] text-[var(--color-paper)] flex items-center justify-center active:bg-[var(--color-brand-hover)] border border-[#DDD7CB] rounded-full motion-safe:transition-colors motion-safe:duration-300"
        style={{
          bottom: "calc(72px + env(safe-area-inset-bottom))",
          transitionTimingFunction: EASE,
        }}
      >
        <Plus className="size-6" strokeWidth={1.75} />
      </button>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-none border-[var(--color-hairline)] bg-[var(--color-sand,var(--color-paper))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[20px] font-medium">
              Projekt wirklich löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] text-[var(--color-stone-muted)]">
              {pendingDelete
                ? `„${pendingDelete.objekt_bezeichnung}" wird mit allen Räumen und Daten entfernt. Das kann nicht rückgängig gemacht werden.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-[48px] rounded-none border border-[var(--color-hairline)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-sand-deep)] uppercase tracking-[0.14em] text-[12px] mt-0">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[48px] rounded-none bg-[var(--color-danger)] hover:bg-[#86493F] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[12px]"
              onClick={() => {
                if (pendingDelete) scheduleDelete(pendingDelete);
                setPendingDelete(null);
              }}
            >
              <Trash2 className="size-4 mr-2" strokeWidth={1.75} /> Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProjektSwipeCard({
  p,
  onDeleteRequest,
}: {
  p: ProjektRow;
  onDeleteRequest: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"x" | "y" | null>(null);
  const ACTION_W = 92;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    locked.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }
    if (locked.current === "x") {
      // only left-swipe reveals the action
      const next = Math.min(0, Math.max(-ACTION_W - 20, offsetBase() + dx));
      setOffset(next);
    }
  }
  function offsetBase() {
    return offset === -ACTION_W ? -ACTION_W : 0;
  }
  function onTouchEnd() {
    if (locked.current === "x") {
      setOffset(offset < -ACTION_W / 2 ? -ACTION_W : 0);
    }
    startX.current = null;
    startY.current = null;
    locked.current = null;
  }

  return (
    <div className="relative overflow-hidden">
      {/* delete action under the card (mobile swipe target) */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOffset(0);
          onDeleteRequest();
        }}
        aria-label={`Projekt „${p.objekt_bezeichnung}" löschen`}
        className="md:hidden absolute right-0 top-0 bottom-0 flex items-center justify-center gap-2 text-[var(--color-paper)] text-[12px] uppercase tracking-[0.14em] font-medium"
        style={{
          width: ACTION_W,
          background: "var(--color-danger)",
          borderRadius: 0,
        }}
        tabIndex={offset <= -ACTION_W / 2 ? 0 : -1}
      >
        <Trash2 className="size-5" strokeWidth={1.75} />
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: locked.current === "x" ? "none" : `transform 300ms ${EASE}`,
        }}
        className="relative"
      >
        <ProjektCard p={p} />
      </div>
    </div>
  );
}

function ProjektCard({ p }: { p: ProjektRow }) {
  const raumCount = p.raum?.[0]?.count ?? 0;
  const isUebergeben = p.status === "uebergeben";
  const uebergebenDate = formatDate(p.uebergeben_at);

  return (
    <Link
      to="/projekt/$id"
      params={{ id: p.id }}
      className="myr-card group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 h-full hover:bg-[var(--color-sand-deep)] active:bg-[var(--color-sand-deep)] transition-colors duration-300"
      style={{ transitionTimingFunction: EASE }}
    >
      {isUebergeben && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 3, background: "var(--color-brand)" }}
        />
      )}

      <div className="min-w-0 flex flex-col h-full">
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span
            className={`inline-flex items-center min-h-[22px] px-2 py-0.5 bg-[var(--color-sand-deep)] text-[11px] tracking-[0.08em] ${
              isUebergeben
                ? "border border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border border-[var(--color-hairline)] text-[var(--color-stone-muted)]"
            }`}
            style={{ borderRadius: 2 }}
          >
            {STATUS_LABEL[p.status]}
          </span>
          {p.gewerk && <span className="eyebrow">{p.gewerk}</span>}
        </div>

        <h2 className="font-serif text-[20px] leading-tight text-[var(--color-ink)] truncate">
          {p.objekt_bezeichnung}
        </h2>
        <p className="mt-1 text-[15px] text-[var(--color-stone-muted)] truncate">{p.kunde}</p>

        <div className="mt-auto pt-4 flex items-center gap-4 text-[13px] text-[var(--color-stone-muted)]">
          {p.auftrag_nr && <span className="truncate">Auftrag {p.auftrag_nr}</span>}
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <Home className="size-3.5" strokeWidth={1.5} />
            {raumCount} {raumCount === 1 ? "Raum" : "Räume"}
          </span>
        </div>

        {isUebergeben && uebergebenDate && (
          <p className="mt-2 text-[12px] text-[var(--color-stone-muted)]">
            Daten an Raumlevel übergeben am: <span className="num-serif">{uebergebenDate}</span>
          </p>
        )}
      </div>
      <ChevronRight
        className="size-5 text-[var(--color-stone-muted)] shrink-0 self-center"
        strokeWidth={1.5}
      />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-16 max-w-md mx-auto">
      <AppLogo height={40} className="mb-6 opacity-80" />
      <h2 className="font-serif text-[22px] mb-2">Noch nichts erfasst</h2>
      <p className="text-[15px] text-[var(--color-stone-muted)] mb-8">
        Lege ein neues Projekt an, um mit dem Aufmaß zu beginnen.
      </p>
      <Link
        to="/projekte/neu"
        className="inline-flex items-center gap-2 min-h-[52px] px-6 bg-[var(--color-brand)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium hover:bg-[var(--color-brand-hover)]"
        style={{ borderRadius: 2 }}
      >
        <Plus className="size-4" strokeWidth={1.75} />
        Neuer Auftrag
      </Link>
    </div>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12 max-w-md mx-auto">
      <AppLogo height={36} className="mb-5 opacity-70" />
      <p className="text-[15px] text-[var(--color-stone-muted)]">
        Keine Treffer für „{query}".
      </p>
    </div>
  );
}
