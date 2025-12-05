'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { DataPrefetcher } from '@/components/DataPrefetcher';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 30 seconds - prevents unnecessary refetches on tab switch
        staleTime: 30 * 1000,
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Disable auto-refetch on window focus for desktop app
        refetchOnWindowFocus: false,
        // Retry once on failure
        retry: 1,
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
      },
    },
  }));

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <DataPrefetcher />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
