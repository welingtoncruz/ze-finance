import { QueryClient } from "@tanstack/react-query"

const STALE_TIME_MS = 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: 5 * 60 * 1000,
    },
  },
})
