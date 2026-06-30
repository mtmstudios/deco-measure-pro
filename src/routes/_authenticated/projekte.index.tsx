import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, ChevronRight, Home } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";

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

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
  }

  return (
    <div className="myr-rise">
      <ScreenHeader
        eyebrow={email ?? undefined}
        title="Projekte"
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

      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 pt-2 pb-10">
        {isLoading && <p className="text-[var(--color-stone-muted)]">Lade…</p>}
        {error && (
          <p className="text-[var(--color-danger)]">Fehler beim Laden: {(error as Error).message}</p>
        )}
        {!isLoading && projekte && projekte.length === 0 && <EmptyState />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {projekte?.map((p) => {
            const raumCount = p.raum?.[0]?.count ?? 0;
            return (
              <Link
                key={p.id}
                to="/projekt/$id"
                params={{ id: p.id }}
                className="myr-card block p-5 hover:border-[var(--color-brand)] transition-colors"
              >
                <div className="eyebrow mb-3">
                  <span>{STATUS_LABEL[p.status]}</span>
                  {p.gewerk && <span> · {p.gewerk}</span>}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-[20px] leading-tight text-[var(--color-ink)] truncate">
                      {p.objekt_bezeichnung}
                    </h2>
                    <p className="mt-1 text-[15px] text-[var(--color-ink)] truncate">{p.kunde}</p>
                    <div className="mt-3 flex items-center gap-4 text-[13px] text-[var(--color-stone-muted)]">
                      {p.auftrag_nr && <span>Auftrag {p.auftrag_nr}</span>}
                      <span className="inline-flex items-center gap-1.5">
                        <Home className="size-3.5" strokeWidth={1.5} />
                        {raumCount} {raumCount === 1 ? "Raum" : "Räume"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-[var(--color-stone-muted)] shrink-0 mt-1" strokeWidth={1.5} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/projekte/neu" })}
        className="md:hidden fixed right-5 bottom-24 h-[52px] pl-5 pr-6 bg-[var(--color-brand)] text-[var(--color-paper)] flex items-center gap-2 uppercase tracking-[0.14em] text-[13px] font-medium active:bg-[var(--color-brand-hover)]"
        aria-label="Neuer Auftrag"
      >
        <Plus className="size-5" strokeWidth={1.75} />
        Neuer Auftrag
      </button>

      <div className="hidden md:flex justify-center pb-12">
        <Link
          to="/projekte/neu"
          className="inline-flex items-center gap-3 min-h-[52px] px-7 bg-[var(--color-brand)] text-[var(--color-paper)] uppercase tracking-[0.14em] text-[13px] font-medium hover:bg-[var(--color-brand-hover)]"
        >
          <Plus className="size-4" strokeWidth={1.75} />
          Neuer Auftrag
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="myr-card px-6 py-14 text-center max-w-md mx-auto">
      <p className="eyebrow mb-3">Keine Projekte</p>
      <h2 className="font-serif text-[22px] mb-2">Noch nichts erfasst</h2>
      <p className="text-[15px] text-[var(--color-stone-muted)]">
        Lege ein neues Projekt an, um mit dem Aufmaß zu beginnen.
      </p>
    </div>
  );
}
