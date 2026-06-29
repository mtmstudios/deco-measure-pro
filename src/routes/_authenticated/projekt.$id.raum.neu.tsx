import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projekt/$id/raum/neu")({
  head: () => ({ meta: [{ title: "Raum hinzufügen" }] }),
  component: RaumNeu,
});

function RaumNeu() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const { count } = await supabase
        .from("raum")
        .select("id", { count: "exact", head: true })
        .eq("projekt_id", id);
      const { data, error } = await supabase
        .from("raum")
        .insert({ projekt_id: id, name: `Zimmer ${(count ?? 0) + 1}`, reihenfolge: (count ?? 0) + 1 })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Raum konnte nicht angelegt werden");
        navigate({ to: "/projekt/$id", params: { id } });
        return;
      }
      navigate({ to: "/projekt/$id/raum/$raumId", params: { id, raumId: data.id }, replace: true });
    })();
  }, [id, navigate]);

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link to="/projekt/$id" params={{ id }} aria-label="Zurück" className="size-12 rounded-lg flex items-center justify-center active:bg-accent">
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Raum anlegen…</h1>
        </div>
      </header>
      <div className="px-5 py-10 text-center text-base text-muted-foreground">Bitte warten…</div>
    </div>
  );
}
