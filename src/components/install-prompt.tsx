import { useEffect, useState } from "react";
import { Download, Share, Plus, X, ArrowDown, ArrowUpRight } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const IOS_DISMISS_KEY = "myr.pwa.iosDismissedAt";
const IOS_DISMISS_MS = 1000 * 60 * 60 * 24 * 14; // 14 Tage Ruhe nach "Später"

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari legacy
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

type AppleDevice = "iphone" | "ipad" | null;

function detectAppleDevice(): AppleDevice {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isIPad =
    /iPad/.test(ua) ||
    // iPadOS 13+ meldet sich als "Macintosh" mit Touchpoints
    (ua.includes("Macintosh") && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
  if (isIPad) return "ipad";
  if (/iPhone|iPod/.test(ua)) return "iphone";
  return null;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Safari, aber nicht Chrome/Firefox/Edge auf iOS (die sind trotzdem WebKit,
  // zeigen aber ihre eigenen Menüs — der Hinweis wäre falsch).
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [iosDevice, setIosDevice] = useState<AppleDevice>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setShowIos(false);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);

    // iOS-Hinweis prüfen (Apple hat kein beforeinstallprompt)
    const apple = detectAppleDevice();
    if (apple && isSafari()) {
      let dismissedAt = 0;
      try {
        dismissedAt = Number(localStorage.getItem(IOS_DISMISS_KEY) || 0);
      } catch {
        /* noop */
      }
      if (!dismissedAt || Date.now() - dismissedAt > IOS_DISMISS_MS) {
        setIosDevice(apple);
        // Kurze Verzögerung, damit die App erst rendert
        const t = setTimeout(() => setShowIos(true), 1200);
        return () => {
          clearTimeout(t);
          window.removeEventListener("beforeinstallprompt", onBefore);
          window.removeEventListener("appinstalled", onInstalled);
        };
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  }

  function dismissIos() {
    setShowIos(false);
    try {
      localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  }

  if (installed) return null;

  return (
    <>
      {deferred && (
        <button
          type="button"
          onClick={handleInstall}
          className="fixed z-30 flex items-center gap-2 h-11 px-4 border border-[var(--color-brand)] bg-[var(--color-paper)] text-[var(--color-brand)] text-[12px] uppercase tracking-[0.14em] font-medium hover:bg-[var(--color-brand)] hover:text-[var(--color-paper)] transition-colors shadow-sm"
          style={{
            right: "calc(env(safe-area-inset-right) + 20px)",
            bottom: "calc(env(safe-area-inset-bottom) + 84px)",
          }}
          aria-label="App installieren"
        >
          <Download className="size-4" strokeWidth={1.75} />
          App installieren
        </button>
      )}

      {showIos && iosDevice && <IosInstallSheet device={iosDevice} onClose={dismissIos} />}
    </>
  );
}

function IosInstallSheet({ device, onClose }: { device: Exclude<AppleDevice, null>; onClose: () => void }) {
  const isIphone = device === "iphone";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <button
        type="button"
        aria-label="Hinweis schließen"
        onClick={onClose}
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--color-ink)_55%,transparent)]"
      />
      <div
        className="relative w-full sm:max-w-[420px] bg-[var(--color-paper)] border border-[var(--color-hairline)] rounded-t-[8px] sm:rounded-[4px] shadow-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute top-3 right-3 size-9 flex items-center justify-center text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          <X className="size-5" strokeWidth={1.5} />
        </button>

        <div className="px-6 pt-6 pb-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-stone-muted)] mb-2">
            App installieren
          </div>
          <h2
            id="ios-install-title"
            className="font-serif text-[22px] leading-tight font-medium text-[var(--color-ink)]"
          >
            Für das beste App-Erlebnis: Füge uns zu deinem Home-Bildschirm hinzu!
          </h2>
          <p className="mt-3 text-[14px] text-[var(--color-stone-muted)] leading-relaxed">
            {isIphone
              ? "Tippe unten in Safari auf das Teilen-Symbol und wähle „Zum Home-Bildschirm"."
              : "Tippe oben rechts in Safari auf das Teilen-Symbol neben der Adressleiste und wähle „Zum Home-Bildschirm"."}
          </p>

          <ol className="mt-5 space-y-3">
            <li className="flex items-center gap-3">
              <span className="size-9 shrink-0 flex items-center justify-center border border-[var(--color-hairline)] bg-[var(--color-sand)] text-[var(--color-brand)]">
                <Share className="size-5" strokeWidth={1.75} />
              </span>
              <span className="text-[14px] text-[var(--color-ink)]">
                1. Auf <strong>Teilen</strong> tippen
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="size-9 shrink-0 flex items-center justify-center border border-[var(--color-hairline)] bg-[var(--color-sand)] text-[var(--color-brand)]">
                <Plus className="size-5" strokeWidth={1.75} />
              </span>
              <span className="text-[14px] text-[var(--color-ink)]">
                2. <strong>Zum Home-Bildschirm</strong> wählen
              </span>
            </li>
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full h-11 border border-[var(--color-hairline)] text-[var(--color-stone-muted)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] text-[12px] uppercase tracking-[0.14em] transition-colors"
          >
            Später
          </button>
        </div>

        {/* Richtungspfeil auf das Safari-Menü */}
        {isIphone ? (
          <IphoneArrow />
        ) : (
          <IpadArrow />
        )}
      </div>
    </div>
  );
}

function IphoneArrow() {
  // Pfeil nach unten, mittig — Safari-Menüleiste unten auf dem iPhone
  return (
    <div
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 flex flex-col items-center text-[var(--color-brand)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      aria-hidden
    >
      <span className="text-[11px] uppercase tracking-[0.16em] mb-1 bg-[var(--color-paper)] px-2 py-0.5 border border-[var(--color-hairline)]">
        Teilen-Symbol
      </span>
      <ArrowDown className="size-8 animate-bounce" strokeWidth={2} />
    </div>
  );
}

function IpadArrow() {
  // Pfeil nach oben-rechts — Teilen sitzt neben der Adressleiste
  return (
    <div
      className="pointer-events-none fixed top-3 right-4 flex flex-col items-end text-[var(--color-brand)]"
      aria-hidden
    >
      <ArrowUpRight className="size-9 animate-pulse" strokeWidth={2} />
      <span className="mt-1 text-[11px] uppercase tracking-[0.16em] bg-[var(--color-paper)] px-2 py-0.5 border border-[var(--color-hairline)]">
        Teilen-Symbol
      </span>
    </div>
  );
}
