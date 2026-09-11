/**
 * Guarded Service-Worker-Registrierung.
 * - Nur in echter Produktions-Umgebung (kein Dev, keine Lovable-Preview).
 * - `?sw=off` als Kill-Switch: hebt bestehende Registrierungen auf.
 */

import { toast } from "sonner";

const SW_PATH = "/sw.js";

let updatePromptShown = false;

/** Toast „Neue Version verfügbar" mit Neu-laden-Aktion (nur einmal). */
function promptUpdate(): void {
  if (updatePromptShown) return;
  updatePromptShown = true;
  toast("Neue Version verfügbar", {
    description: "Aktualisiere, um die neuesten Änderungen zu laden.",
    duration: Infinity,
    action: {
      label: "Neu laden",
      onClick: () => window.location.reload(),
    },
  });
}

/**
 * Erkennt eine neue App-Version (neuer Service Worker) und zeigt den Hinweis.
 * Prüft zusätzlich bei jeder Rückkehr in die App auf Updates — praktisch für
 * eine Home-Bildschirm-App, die selten komplett geschlossen wird.
 */
function watchForUpdate(reg: ServiceWorkerRegistration): void {
  // Update wurde schon vor dieser Sitzung installiert und wartet.
  if (reg.waiting && navigator.serviceWorker.controller) promptUpdate();

  reg.addEventListener("updatefound", () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener("statechange", () => {
      // "installed" bei bestehendem Controller = echtes Update (kein Erst-Install).
      if (nw.state === "installed" && navigator.serviceWorker.controller) {
        promptUpdate();
      }
    });
  });

  // Bei Rückkehr in die App nach neuen Versionen suchen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reg.update().catch(() => {
        /* offline o. ä. — ignorieren */
      });
    }
  });
}

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  // Dev-Build
  if (!import.meta.env.PROD) return true;
  // In einem iframe (Lovable-Preview läuft eingebettet)
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  const badHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  if (badHost) return true;
  // Kill-Switch
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith(SW_PATH)) await r.unregister();
    }
  } catch {
    /* noop */
  }
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isRefusedContext()) {
    if ("serviceWorker" in navigator) await unregisterMatching();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    watchForUpdate(reg);
  } catch (err) {
    console.warn("[sw] register failed", err);
  }
}
