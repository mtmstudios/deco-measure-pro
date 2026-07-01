import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

// Cache-Version: bei Breaking-Changes am Query-Shape hochzählen, um alte Snapshots zu verwerfen.
const PERSIST_BUSTER = "v1";
const PERSIST_KEY = "aufmass-rq-cache";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FAF8F3" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Aufmaß-App" },
      { title: "Aufmaß-App · MYR - Deco & More" },
      { name: "description", content: "Mobile Aufmaß-Erfassung für Einrichter." },
      { property: "og:title", content: "Aufmaß-App · MYR - Deco & More" },
      { name: "twitter:title", content: "Aufmaß-App · MYR - Deco & More" },
      { property: "og:description", content: "Mobile Aufmaß-Erfassung für Einrichter." },
      { name: "twitter:description", content: "Mobile Aufmaß-Erfassung für Einrichter." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/66b75c53-d364-4521-b6b8-3f97e621b23d/id-preview-dfd9d7cc--15b8a0b0-e519-4399-9755-c9ed0e24bec7.lovable.app-1782836325325.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/66b75c53-d364-4521-b6b8-3f97e621b23d/id-preview-dfd9d7cc--15b8a0b0-e519-4399-9755-c9ed0e24bec7.lovable.app-1782836325325.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Spectral:wght@300;400;500&family=Hanken+Grotesk:wght@400;500;600&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Persister nur im Browser aufsetzen (SSR hat kein localStorage)
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? null
      : createSyncStoragePersister({
          storage: window.localStorage,
          key: PERSIST_KEY,
          throttleTime: 1000,
        }),
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event === "SIGNED_OUT") {
        // Persistenten Cache beim Logout leeren, damit fremde Nutzer keine Daten sehen
        try {
          window.localStorage.removeItem(PERSIST_KEY);
        } catch {
          /* noop */
        }
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });
    // Offline-Sync starten (idempotent)
    void import("@/lib/offline-sync").then((m) => m.startAutoSync());
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const content = (
    <>
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  );

  if (!persister) {
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          // Nur erfolgreiche Queries persistieren; keine Fehlerzustände zwischenspeichern
          shouldDehydrateQuery: (q) => q.state.status === "success",
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
}

