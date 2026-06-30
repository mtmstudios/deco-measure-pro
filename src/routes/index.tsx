import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate({ to: data.session ? "/projekte" : "/auth", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-sm text-muted-foreground">Lädt…</div>
    </div>
  );
}
