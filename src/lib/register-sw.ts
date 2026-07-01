/**
 * Guarded Service-Worker-Registrierung.
 * - Nur in echter Produktions-Umgebung (kein Dev, keine Lovable-Preview).
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
  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[sw] register failed", err);
  }
}
