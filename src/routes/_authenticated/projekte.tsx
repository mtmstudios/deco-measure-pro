import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projekte")({
  head: () => ({
    meta: [{ title: "Projekte – Aufmaß-App" }],
  }),
  component: ProjekteListe,
});

function ProjekteListe() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
  }

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projekte</h1>
            {email && <p className="text-sm text-muted-foreground truncate">{email}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Abmelden"
            className="size-12"
          >
            <LogOut className="size-6" />
          </Button>
        </div>
      </header>

      <div className="px-5 py-6">
        <EmptyState />
      </div>

      <button
        type="button"
        disabled
        className="fixed right-5 bottom-24 size-16 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-60"
        aria-label="Neues Projekt"
      >
        <Plus className="size-8" strokeWidth={2.5} />
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
