import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projekt/$id/raum/$raumId")({
  head: () => ({ meta: [{ title: "Raum" }] }),
  component: RaumDetail,
});

function RaumDetail() {
  const { id, raumId } = Route.useParams();
  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link
            to="/projekt/$id"
            params={{ id }}
            aria-label="Zurück"
            className="size-12 rounded-lg flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="size-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Raum bearbeiten</h1>
        </div>
      </header>
      <div className="px-5 py-8 text-center text-base text-muted-foreground">
        Raum-Bearbeitung folgt im nächsten Schritt. ({raumId})
      </div>
    </div>
  );
}
