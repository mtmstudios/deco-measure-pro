import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, LogOut, ChevronRight, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projekte")({
  head: () => ({ meta: [{ title: "Projekte – Aufmaß-App" }] }),
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

const STATUS_CLASS: Record<ProjektStatus, string> = {
  erfassung: "bg-muted text-foreground",
  geprueft: "bg-primary text-primary-foreground",
  uebergeben: "bg-success text-success-foreground",
  fehler: "bg-destructive text-destructive-foreground",
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
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Projekte</h1>
            {email && <p className="text-sm text-muted-foreground truncate">{email}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Abmelden"
            className="size-12 shrink-0"
          >
            <LogOut className="size-6" />
          </Button>
        </div>
      </header>

      <div className="px-5 py-5 space-y-3">
        {isLoading && <p className="text-base text-muted-foreground">Lade…</p>}
        {error && (
          <p className="text-base text-destructive">Fehler beim Laden: {(error as Error).message}</p>
        )}
        {!isLoading && projekte && projekte.length === 0 && <EmptyState />}
        {projekte?.map((p) => {
          const raumCount = p.raum?.[0]?.count ?? 0;
          return (
            <Link
              key={p.id}
              to="/projekt/$id"
              params={{ id: p.id }}
              className="block bg-card border-2 border-border rounded-2xl px-4 py-4 active:bg-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${STATUS_CLASS[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                    {p.gewerk && (
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {p.gewerk}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold leading-tight truncate">
                    {p.objekt_bezeichnung}
                  </h2>
                  <p className="text-base text-foreground truncate">{p.kunde}</p>
                  <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                    {p.auftrag_nr && <span>Auftrag {p.auftrag_nr}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Home className="size-4" />
                      {raumCount} {raumCount === 1 ? "Raum" : "Räume"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-6 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate({ to: "/projekte/neu" })}
        className="fixed right-5 bottom-24 h-14 pl-5 pr-6 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 font-bold text-base active:scale-95 transition-transform"
        aria-label="Neuer Auftrag"
      >
        <Plus className="size-6" strokeWidth={2.75} />
        Neuer Auftrag
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl px-6 py-14 text-center">
      <div className="size-16 rounded-2xl bg-accent text-accent-foreground mx-auto flex items-center justify-center mb-4">
        <FolderOpen className="size-9" strokeWidth={2.5} />
      </div>
      <h2 className="text-xl font-bold mb-2">Noch keine Projekte</h2>
      <p className="text-base text-muted-foreground max-w-xs mx-auto">
        Lege ein neues Projekt an, um mit dem Aufmaß zu beginnen.
      </p>
    </div>
  );
}
