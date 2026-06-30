import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, ChevronRight, Home, Search } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { AppLogo } from "@/components/app-logo";

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
  raum: { count: number }[];
};

const STATUS_LABEL: Record<ProjektStatus, string> = {
  erfassung: "Erfassung",
  geprueft: "Geprüft",
  uebergeben: "Übergeben",
  fehler: "Fehler",
};

function ProjekteListe() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const { data: projekte, isLoading, error } = useQuery({
    queryKey: ["projekte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projekt" as never)
        .select("id, kunde, objekt_bezeichnung, auftrag_nr, gewerk, status, raum(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjektRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!projekte) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return projekte;
    return projekte.filter((p) =>
      [p.objekt_bezeichnung, p.kunde, p.auftrag_nr ?? "", p.gewerk ?? ""]
        .some((s) => s.toLowerCase().includes(needle)),
    );
  }, [projekte, q]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
  }

  const hasProjects = !!projekte && projekte.length > 0;

  return (
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
        {/* Titelblock */}
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
            style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Neuer Auftrag
          </Link>
        </div>

        {/* Suche */}
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
            style={{ borderRadius: 2, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
          />
        </div>

        {isLoading && <p className="text-[var(--color-stone-muted)]">Lade…</p>}
        {error && (
          <p className="text-[var(--color-danger)]">Fehler beim Laden: {(error as Error).message}</p>
        )}

        {!isLoading && !hasProjects && <EmptyState />}
        {!isLoading && hasProjects && filtered.length === 0 && (
          <NoMatches query={q} />
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch">
            {filtered.map((p) => (
              <ProjektCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => navigate({ to: "/projekte/neu" })}
        aria-label="Neuer Auftrag"
        className="md:hidden fixed right-5 z-30 size-14 bg-[var(--color-brand)] text-[var(--color-paper)] flex items-center justify-center active:bg-[var(--color-brand-hover)] border border-[#DDD7CB] rounded-full motion-safe:transition-colors motion-safe:duration-300"
        style={{
          bottom: "calc(72px + env(safe-area-inset-bottom))",
          transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <Plus className="size-6" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function ProjektCard({ p }: { p: ProjektRow }) {
  const raumCount = p.raum?.[0]?.count ?? 0;
  return (
    <Link
      to="/projekt/$id"
      params={{ id: p.id }}
      className="myr-card group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 h-full hover:bg-[var(--color-sand-deep)] active:bg-[var(--color-sand-deep)] transition-colors duration-300"
      style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      <div className="min-w-0 flex flex-col h-full">
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span
            className="inline-flex items-center min-h-[22px] px-2 py-0.5 bg-[var(--color-sand-deep)] border border-[var(--color-hairline)] text-[11px] tracking-[0.08em] text-[var(--color-brand)]"
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
