import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projekt/$id")({
  head: () => ({ meta: [{ title: "Projekt – Aufmaß-App" }] }),
  component: ProjektDetail,
});

function ProjektDetail() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["projekt", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projekt" as never)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        kunde: string;
        adresse: string | null;
        objekt_bezeichnung: string;
        auftrag_nr: string | null;
        verkaeufer: string | null;
        sachbearbeiter: string | null;
        gewerk: string | null;
        status: string;
      } | null;
    },
  });

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link
            to="/projekte"
            aria-label="Zurück"
            className="size-12 rounded-lg flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {data?.objekt_bezeichnung ?? "Projekt"}
          </h1>
        </div>
      </header>

      <div className="px-5 py-5 space-y-4">
        {isLoading && <p className="text-base text-muted-foreground">Lade…</p>}
        {error && <p className="text-base text-destructive">{(error as Error).message}</p>}
        {data && (
          <dl className="space-y-3 text-base">
            <Row label="Kunde" value={data.kunde} />
            <Row label="Adresse" value={data.adresse} />
            <Row label="Auftrags-Nr." value={data.auftrag_nr} />
            <Row label="Gewerk" value={data.gewerk} />
            <Row label="Verkäufer" value={data.verkaeufer} />
            <Row label="Sachbearbeiter" value={data.sachbearbeiter} />
            <Row label="Status" value={data.status} />
          </dl>
        )}
        <p className="text-sm text-muted-foreground pt-4">
          Räume und Aufmaß folgen im nächsten Schritt.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-border pb-2">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-base">{value || "—"}</dd>
    </div>
  );
}
