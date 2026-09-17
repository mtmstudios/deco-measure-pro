/**
 * Guarded Service-Worker-Registrierung mit automatischem Update.
 * - Nur in echter Produktions-Umgebung (kein Dev, keine Lovable-Preview).
 * - `registerType: "autoUpdate"` (vite.config) → ein neuer SW übernimmt sofort
 *   (skipWaiting + clientsClaim). Damit die BEREITS GEÖFFNETE Seite die neue
 *   Version auch wirklich lädt, wird bei `controllerchange` EINMAL neu geladen —
 *   aber nur, wenn vorher schon ein Controller lief (sonst wäre es der Erst-Install
 *   und wir würden beim ersten Besuch unnötig neu laden).
 *   → So bleibt niemand auf einer alten, evtl. fehlerhaften Version hängen.
 * - Beim Start und bei jeder Rückkehr in die App wird auf Updates geprüft.
 * - `?sw=off` als Kill-Switch: hebt bestehende Registrierungen auf.
 */

const SW_PATH = "/sw.js";

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

  // Automatisches Neuladen, sobald ein neuer SW die Kontrolle übernimmt.
  // Nur wenn bereits ein Controller aktiv ist → kein Reload beim Erst-Install.
  if (navigator.serviceWorker.controller) {
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    // Beim Start + bei jeder Rückkehr in die App auf neue Versionen prüfen.
    const check = () =>
      reg.update().catch(() => {
        /* offline o. ä. — ignorieren */
      });
    check();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  } catch (err) {
    console.warn("[sw] register failed", err);
  }
}
