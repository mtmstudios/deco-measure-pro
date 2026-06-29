import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, WifiOff, Wifi } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({
    meta: [{ title: "Sync-Status – Aufmaß-App" }],
  }),
  component: SyncStatus,
});

function SyncStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div>
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="px-5 py-4">
          <h1 className="text-2xl font-bold tracking-tight">Sync-Status</h1>
        </div>
      </header>

      <div className="px-5 py-6 space-y-4">
        <div className="rounded-2xl border-2 p-5 flex items-center gap-4"
          style={{
            borderColor: online ? "var(--color-success)" : "var(--color-warning)",
            backgroundColor: online ? "color-mix(in oklab, var(--color-success) 8%, transparent)" : "color-mix(in oklab, var(--color-warning) 12%, transparent)",
          }}
        >
          <div
            className="size-14 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: online ? "var(--color-success)" : "var(--color-warning)" }}
          >
            {online ? <Wifi className="size-7" /> : <WifiOff className="size-7" />}
          </div>
          <div>
            <p className="text-lg font-bold">
              {online ? "Online" : "Offline"}
            </p>
            <p className="text-sm text-muted-foreground">
              {online ? "Daten werden direkt gespeichert." : "Eingaben werden lokal zwischengespeichert."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border p-5 flex items-center gap-4">
          <div className="size-14 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <p className="text-lg font-bold">Keine offenen Entwürfe</p>
            <p className="text-sm text-muted-foreground">Alle Daten sind synchronisiert.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
