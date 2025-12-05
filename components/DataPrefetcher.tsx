'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { productCommands, customerCommands, supplierCommands } from '@/lib/tauri';

/**
 * DataPrefetcher - Prefetches critical data on app startup
 *
 * This component runs once when the app loads and prefetches the first page
 * of products, customers, and suppliers in parallel. This ensures that when
 * the user clicks on any tab for the first time, the data is already in the
 * React Query cache, resulting in instant navigation.
 */
export function DataPrefetcher() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchData = async () => {
      // Prefetch all entities in parallel for faster startup
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: ['products', ''],
          queryFn: () => productCommands.getAll(1, 50, undefined),
          initialPageParam: 1,
        }),
        queryClient.prefetchInfiniteQuery({
          queryKey: ['customers', ''],
          queryFn: () => customerCommands.getAll(1, 50, undefined),
          initialPageParam: 1,
        }),
        queryClient.prefetchInfiniteQuery({
          queryKey: ['suppliers', ''],
          queryFn: () => supplierCommands.getAll(1, 50, undefined),
          initialPageParam: 1,
        }),
      ]);
    };

    void prefetchData();
  }, [queryClient]);

  return null; // This component renders nothing
}
