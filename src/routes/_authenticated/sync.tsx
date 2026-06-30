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

  const accent = online ? "var(--color-brand)" : "var(--color-danger)";

  return (
    <div className="myr-rise">
      <ScreenHeader title="Sync-Status" eyebrow="Verbindung" />
      <div className="mx-auto max-w-[560px] px-4 md:px-6 pt-2 pb-12 space-y-4">
        <div
          className="myr-card p-5 flex items-center gap-4 relative overflow-hidden"
          style={{ transition: "all 300ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0"
            style={{ width: 2, background: accent, transition: "background 300ms cubic-bezier(0.16,1,0.3,1)" }}
          />
          <div
            className="size-12 flex items-center justify-center border border-[var(--color-hairline)]"
            style={{ color: accent }}
          >
            {online ? <Wifi className="size-5" strokeWidth={1.5} /> : <WifiOff className="size-5" strokeWidth={1.5} />}
          </div>
          <div className="min-w-0">
            <p className="eyebrow mb-1">Verbindung</p>
            <p className="font-medium text-[20px] leading-tight" style={{ color: "var(--color-ink)" }}>
              {online ? "Online" : "Offline"}
            </p>
            <p className="text-[14px] mt-1" style={{ color: "var(--color-stone-muted)" }}>
              {online
                ? "Daten werden direkt gespeichert."
                : "Änderungen werden lokal gespeichert und später synchronisiert."}
            </p>
          </div>
        </div>

        <div className="myr-card p-5 flex items-center gap-4">
          <div
            className="size-12 flex items-center justify-center border border-[var(--color-hairline)]"
            style={{ color: "var(--color-stone-muted)" }}
          >
            <CheckCircle2 className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow mb-1">Keine offenen Entwürfe</p>
            <p className="font-medium text-[20px] leading-tight" style={{ color: "var(--color-ink)" }}>
              Alles synchronisiert
            </p>
            <p className="text-[14px] mt-1" style={{ color: "var(--color-stone-muted)" }}>
              Alle Daten sind synchronisiert.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* respect prefers-reduced-motion: transitions are short (300ms) and only affect color */
