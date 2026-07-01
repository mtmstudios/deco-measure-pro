import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Wifi, WifiOff, LifeBuoy, Upload, Trash2, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader } from "@/components/screen-header";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({ meta: [{ title: "Einstellungen · Aufmaß-App" }] }),
  component: EinstellungenPage,
});

const AUTO_SYNC_KEY = "myr.autoSync";
const LAST_SYNC_KEY = "myr.lastSyncAt";

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EinstellungenPage() {
  const navigate = useNavigate();
  const [online, setOnline] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error("Keine Verbindung – wird nachgeholt, sobald online.");
      return;
    }
    setSyncing(true);
    try {
      // Platzhalter: Datenabgleich passiert online-first via Supabase-Requests.
      await new Promise((r) => setTimeout(r, 600));
      const iso = new Date().toISOString();
      try { localStorage.setItem(LAST_SYNC_KEY, iso); } catch { /* ignore */ }
      setLastSync(iso);
      toast.success("Synchronisiert");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const onOnline = () => {
      setOnline(true);
      try {
        if (localStorage.getItem(AUTO_SYNC_KEY) !== "0") void runSync();
      } catch { /* ignore */ }
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    try {
      const v = localStorage.getItem(AUTO_SYNC_KEY);
      if (v !== null) setAutoSync(v === "1");
      setLastSync(localStorage.getItem(LAST_SYNC_KEY));
    } catch { /* ignore */ }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [runSync]);

  function toggleAutoSync(v: boolean) {
    setAutoSync(v);
    try { localStorage.setItem(AUTO_SYNC_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    navigate({ to: "/auth" });
  }

  const relative = formatRelative(lastSync);
  const accent = online ? "var(--color-brand)" : "var(--color-danger)";

  return (
    <div className="myr-rise">
      <ScreenHeader />

      <div className="mx-auto max-w-[560px] px-4 md:px-6 pt-4 pb-16">
        <div className="text-center mb-8">
          <div className="eyebrow mb-2">Konfiguration</div>
          <h1 className="text-[28px] md:text-[32px] leading-tight font-serif font-medium text-[var(--color-ink)]">
            Einstellungen
          </h1>
        </div>

        <div className="space-y-8">
        {/* SYNCHRONISATION */}
        <section aria-labelledby="grp-sync" className="space-y-3">
          <h2 id="grp-sync" className="eyebrow text-center">Synchronisation</h2>
          <div
            className="myr-card p-5 relative overflow-hidden"
            style={{ background: "var(--color-sand)", transition: "all 300ms cubic-bezier(0.16,1,0.3,1)" }}
          >
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0"
              style={{ width: 3, background: accent }}
            />
            <div className="flex items-start gap-4">
              <div
                className="size-11 shrink-0 flex items-center justify-center border border-[var(--color-hairline)] bg-[var(--color-paper)]"
                style={{ color: accent }}
              >
                {online ? <Wifi className="size-5" strokeWidth={1.5} /> : <WifiOff className="size-5" strokeWidth={1.5} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[18px] leading-tight text-[var(--color-ink)]">
                  {online ? "Online" : "Offline"}
                </p>
                <p className="text-[13px] mt-1 text-[var(--color-stone-muted)]">
                  {relative ? `Zuletzt synchronisiert ${relative}` : "Noch nicht synchronisiert"}
                </p>
                {!online && (
                  <p className="text-[13px] mt-1 text-[var(--color-stone-muted)]">
                    Änderungen werden lokal gespeichert und automatisch übertragen, sobald wieder eine Verbindung besteht.
                  </p>
                )}
              </div>
              <div className="pt-1">
                <Switch checked={autoSync} onCheckedChange={toggleAutoSync} aria-label="Auto-Sync" />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--color-hairline)] flex items-center justify-between gap-3">
              <span className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)]">Auto-Sync</span>
              <span className="text-[13px] text-[var(--color-ink)]">{autoSync ? "An" : "Aus"}</span>
            </div>

            <button
              type="button"
              onClick={runSync}
              disabled={syncing || !online}
              className="mt-4 w-full h-11 border border-[var(--color-hairline)] bg-[var(--color-paper)] flex items-center justify-center gap-2 text-[13px] uppercase tracking-[0.14em] text-[var(--color-ink)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {syncing ? "Synchronisiere …" : "Jetzt synchronisieren"}
            </button>
          </div>
        </section>

        {/* SUPPORT */}
        <section aria-labelledby="grp-support" className="space-y-3">
          <h2 id="grp-support" className="eyebrow text-center">Support</h2>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="w-full myr-card p-4 flex items-center gap-4 text-left hover:bg-[var(--color-sand-deep)] transition-colors"
            style={{ background: "var(--color-sand)" }}
          >
            <div className="size-11 shrink-0 flex items-center justify-center border border-[var(--color-hairline)] bg-[var(--color-paper)] text-[var(--color-ink)]">
              <LifeBuoy className="size-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[16px] leading-tight text-[var(--color-ink)]">
                Fehler melden
              </p>
              <p className="text-[13px] mt-1 text-[var(--color-stone-muted)]">
                Notiz + Screenshot senden
              </p>
            </div>
            <ChevronRight className="size-4 text-[var(--color-stone-muted)]" strokeWidth={1.5} />
          </button>
        </section>

        {/* KONTO */}
        <section aria-labelledby="grp-konto" className="space-y-3">
          <h2 id="grp-konto" className="eyebrow text-center">Konto</h2>
          <div className="myr-card p-5 text-center" style={{ background: "var(--color-sand)" }}>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)]">
              Angemeldet als
            </p>
            <p className="mt-1 text-[16px] text-[var(--color-ink)] normal-case break-all">
              {email ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-12 border border-[var(--color-danger)] text-[var(--color-danger)] uppercase tracking-[0.16em] text-[13px] font-medium hover:bg-[var(--color-danger)] hover:text-[var(--color-paper)] transition-colors"
          >
            Abmelden
          </button>
        </section>
        </div>
      </div>

      <FehlerMeldenDialog open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}

/* ==================== Fehler-Melden Dialog ==================== */

type FileItem = {
  id: string;
  name: string;
  size: number;
  dataUrl?: string;
  progress: number; // 0..100
  status: "loading" | "ready" | "error";
  error?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB pro Datei
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB gesamt
const MAX_FILES = 5;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FehlerMeldenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [notiz, setNotiz] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setNotiz("");
      setFiles([]);
      setSending(false);
      setSendError(null);
    }
  }, [open]);

  const totalBytes = files.reduce((sum, f) => sum + (f.status !== "error" ? f.size : 0), 0);
  const anyLoading = files.some((f) => f.status === "loading");

  function updateFile(id: string, patch: Partial<FileItem>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function readFile(item: FileItem, file: File) {
    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) {
        updateFile(item.id, { progress: Math.round((ev.loaded / ev.total) * 100) });
      }
    };
    reader.onload = () => {
      updateFile(item.id, {
        dataUrl: reader.result as string,
        progress: 100,
        status: "ready",
      });
    };
    reader.onerror = () => {
      updateFile(item.id, {
        status: "error",
        error: "Datei konnte nicht gelesen werden.",
      });
    };
    reader.readAsDataURL(file);
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const remainingSlots = MAX_FILES - files.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximal ${MAX_FILES} Screenshots.`);
      return;
    }
    const incoming = Array.from(list).slice(0, remainingSlots);
    let runningTotal = totalBytes;
    const newItems: { item: FileItem; file: File }[] = [];

    for (const f of incoming) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const base: FileItem = {
        id,
        name: f.name,
        size: f.size,
        progress: 0,
        status: "loading",
      };
      if (!f.type.startsWith("image/")) {
        newItems.push({
          item: { ...base, status: "error", error: "Nur Bilddateien erlaubt." },
          file: f,
        });
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        newItems.push({
          item: {
            ...base,
            status: "error",
            error: `Zu groß (${formatBytes(f.size)}). Max. ${formatBytes(MAX_FILE_BYTES)}.`,
          },
          file: f,
        });
        continue;
      }
      if (runningTotal + f.size > MAX_TOTAL_BYTES) {
        newItems.push({
          item: {
            ...base,
            status: "error",
            error: `Gesamtlimit ${formatBytes(MAX_TOTAL_BYTES)} überschritten.`,
          },
          file: f,
        });
        continue;
      }
      runningTotal += f.size;
      newItems.push({ item: base, file: f });
    }

    setFiles((prev) => [...prev, ...newItems.map((n) => n.item)]);
    // Startet das Lesen für alle validen Items
    for (const n of newItems) {
      if (n.item.status === "loading") readFile(n.item, n.file);
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function send() {
    if (!notiz.trim()) {
      setSendError("Bitte eine Notiz eingeben.");
      return;
    }
    if (anyLoading) {
      setSendError("Bitte warten, bis alle Screenshots geladen sind.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      let betriebId: string | null = null;
      if (userId) {
        const { data: benutzer } = await supabase
          .from("benutzer")
          .select("betrieb_id")
          .eq("id", userId)
          .maybeSingle();
        betriebId = benutzer?.betrieb_id ?? null;
      }
      const validScreens = files
        .filter((f) => f.status === "ready" && f.dataUrl)
        .map((f) => f.dataUrl as string);
      const { error } = await supabase.from("fehlermeldung").insert({
        benutzer_id: userId,
        betrieb_id: betriebId,
        notiz: notiz.trim(),
        screenshots: validScreens,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        route: typeof window !== "undefined" ? window.location.pathname : null,
      });
      if (error) throw error;
      toast.success("Danke — dein Hinweis wurde übermittelt.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Der Fehlerbericht konnte nicht gesendet werden. Bitte erneut versuchen.";
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  const readyCount = files.filter((f) => f.status === "ready").length;
  const canSend = !sending && !anyLoading && notiz.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[480px] w-[calc(100vw-2rem)] p-0 gap-0 border border-[var(--color-hairline)] rounded-[2px] shadow-none"
        style={{ background: "var(--color-paper)" }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--color-hairline)] text-left">
          <div className="eyebrow mb-1">Support</div>
          <DialogTitle className="font-serif text-[22px] leading-tight font-medium text-[var(--color-ink)]">
            Fehler melden
          </DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--color-stone-muted)]">
            Beschreibe kurz, was passiert ist. Screenshots helfen uns beim Nachvollziehen.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-stone-muted)] block mb-2">
              Notiz
            </label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={5}
              placeholder="Was ist passiert? Beschreibe den Fehler …"
              className="w-full px-3 py-2 border border-[var(--color-hairline)] bg-[var(--color-paper)] text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-stone-muted)] focus:outline-none focus:border-[var(--color-brand)] resize-none rounded-[2px]"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-stone-muted)]">
                Screenshots
              </label>
              <span className="text-[11px] text-[var(--color-stone-muted)]">
                {readyCount}/{MAX_FILES} · {formatBytes(totalBytes)} / {formatBytes(MAX_TOTAL_BYTES)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
              className="w-full border border-dashed border-[var(--color-hairline)] py-4 flex flex-col items-center justify-center gap-1 text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-[2px]"
            >
              <Upload className="size-4" strokeWidth={1.5} />
              <span className="text-[13px]">Screenshot aufnehmen / hochladen</span>
              <span className="text-[11px] text-[var(--color-stone-muted)]">
                PNG/JPG · max. {formatBytes(MAX_FILE_BYTES)} pro Datei
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="border border-[var(--color-hairline)] bg-[var(--color-paper)] rounded-[2px]"
                    style={{
                      borderColor:
                        f.status === "error" ? "var(--color-danger)" : "var(--color-hairline)",
                    }}
                  >
                    <div className="flex items-center gap-3 p-2">
                      <div className="size-11 shrink-0 border border-[var(--color-hairline)] bg-[var(--color-sand)] flex items-center justify-center overflow-hidden">
                        {f.status === "ready" && f.dataUrl ? (
                          <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                        ) : f.status === "error" ? (
                          <AlertCircle className="size-5 text-[var(--color-danger)]" strokeWidth={1.5} />
                        ) : (
                          <Loader2 className="size-5 animate-spin text-[var(--color-stone-muted)]" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[13px] text-[var(--color-ink)] truncate">{f.name}</p>
                          <span className="text-[11px] text-[var(--color-stone-muted)] shrink-0">
                            {formatBytes(f.size)}
                          </span>
                        </div>
                        {f.status === "loading" && (
                          <div className="mt-1.5 h-1 w-full bg-[var(--color-sand)] overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-brand)] transition-[width] duration-150"
                              style={{ width: `${f.progress}%` }}
                            />
                          </div>
                        )}
                        {f.status === "error" && (
                          <p className="mt-1 text-[12px] text-[var(--color-danger)]">{f.error}</p>
                        )}
                        {f.status === "ready" && (
                          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-stone-muted)]">
                            Bereit
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(f.id)}
                        className="size-9 shrink-0 flex items-center justify-center text-[var(--color-stone-muted)] hover:text-[var(--color-danger)] transition-colors"
                        aria-label={`${f.name} entfernen`}
                      >
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {sendError && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3 border border-[var(--color-danger)] bg-[var(--color-paper)] rounded-[2px]"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-[var(--color-danger)]" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--color-danger)]">
                  Senden fehlgeschlagen
                </p>
                <p className="text-[12px] text-[var(--color-stone-muted)] mt-0.5 break-words">
                  {sendError}
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 border-t border-[var(--color-hairline)] flex items-center justify-end gap-3"
          style={{ background: "var(--color-sand)" }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 px-4 text-[13px] uppercase tracking-[0.14em] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="h-11 px-5 bg-[var(--color-brand)] text-[var(--color-paper)] text-[13px] uppercase tracking-[0.14em] font-medium hover:bg-[var(--color-brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            {sending && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}
            {sending ? "Senden …" : anyLoading ? "Wird geladen …" : "Senden →"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
