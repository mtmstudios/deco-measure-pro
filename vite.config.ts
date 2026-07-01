// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        // Kein SW im Dev / in der Lovable-Preview
        devOptions: { enabled: false },
        manifest: false, // wir verwenden public/manifest.webmanifest
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/, /^\/auth\/callback/],
          runtimeCaching: [
            {
              // HTML-Navigationen: netzwerk zuerst, damit Deploys sofort greifen
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              // Gehashte, gleich-origin Build-Assets: aus dem Cache bedienen
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\/assets\//.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "build-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Google Fonts CSS
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts-css" },
            },
            {
              // Google Fonts Files
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
