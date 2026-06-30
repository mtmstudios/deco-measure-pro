import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({ meta: [{ title: "Sync-Status · Aufmaß-App" }] }),
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
    <div className="myr-rise">
      <ScreenHeader title="Sync-Status" eyebrow="Verbindung" />
      <div className="mx-auto max-w-[720px] px-4 md:px-6 pt-2 pb-12 space-y-4">
        <div className="myr-card p-5 flex items-center gap-4">
          <div
            className="size-12 flex items-center justify-center border border-[var(--color-hairline)]"
            style={{ color: online ? "var(--color-brand)" : "var(--color-stone-muted)" }}
          >
            {online ? <Wifi className="size-5" strokeWidth={1.5} /> : <WifiOff className="size-5" strokeWidth={1.5} />}
          </div>
          <div>
            <p className="eyebrow mb-1">{online ? "Online" : "Offline"}</p>
            <p className="font-serif text-[18px]">
              {online ? "Daten werden direkt gespeichert." : "Eingaben werden lokal zwischengespeichert."}
            </p>
          </div>
        </div>

        <div className="myr-card p-5 flex items-center gap-4">
          <div className="size-12 flex items-center justify-center text-[var(--color-brand)] border border-[var(--color-hairline)]">
            <CheckCircle2 className="size-5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="eyebrow mb-1">Keine offenen Entwürfe</p>
            <p className="font-serif text-[18px]">Alle Daten sind synchronisiert.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
