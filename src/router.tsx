import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // 7 Tage im Cache halten, damit persistierte Daten offline verfügbar sind
        gcTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 1000 * 30,
        // Wenn offline: gecachte Daten sofort ausliefern statt endlos zu laden
        networkMode: "offlineFirst",
        retry: (failureCount) => (typeof navigator !== "undefined" && !navigator.onLine ? false : failureCount < 2),
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
