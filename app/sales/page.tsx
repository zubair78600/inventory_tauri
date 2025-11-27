'use client';

import type { Invoice } from '@/types';
import { useState, useDeferredValue } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchPill } from '@/components/shared/SearchPill';
import { invoiceCommands, type PaginatedResult } from '@/lib/tauri';
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';

type InvoiceItem = {
  id: number;
  product_id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total: number;
};

interface ExtendedInvoice extends Invoice {
  customer_name?: string | null;
  customer_phone?: string | null;
  item_count?: number;
}

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Fetch sales with infinite query for pagination + search
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery({
    queryKey: ['sales', deferredSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await invoiceCommands.getAll(pageParam, 50, deferredSearch);
      return result as PaginatedResult<ExtendedInvoice>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedResult<ExtendedInvoice>, allPages: PaginatedResult<ExtendedInvoice>[]) => {
      const loadedCount = allPages.flatMap(p => p.items).length;
      if (loadedCount < lastPage.total_count) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData, // Keep showing old data while fetching new search results
  });

  const sales = data?.pages.flatMap((page) => page.items) ?? [];
  const selected = sales.find((s) => s.id === selectedId) ?? sales[0] ?? null;

  // Fetch details for selected invoice
  const { data: details, isLoading: itemsLoading } = useQuery({
    queryKey: ['invoice-details', selected?.id],
    queryFn: async () => {
      if (!selected?.id) return { items: [] };
      const data = await invoiceCommands.getById(selected.id);
      return {
        items: data.items.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
      };
    },
    enabled: !!selected?.id,
  });

  const items = details?.items ?? [];

  if (status === 'pending') return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error ? error.message : 'Unknown error'}</div>;

  const loadMore = () => {
    void fetchNextPage();
  };

  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-5">
          <h1 className="page-title">Sales</h1>
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search invoices or customers..."
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr] h-full overflow-hidden">
        <Card className="p-0 overflow-hidden flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle>Recent Sales</CardTitle>
            <p className="text-sm text-muted-foreground">Last 10 orders with timestamp</p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {sales.map((sale) => (
                <button
                  key={sale.id}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${selected?.id === sale.id
                    ? 'bg-sky-50 border-l-4 border-sky-400'
                    : 'hover:bg-slate-50'
                    }`}
                  onClick={() => setSelectedId(sale.id)}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{sale.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.customer_name ?? 'Walk-in'} •{' '}
                      {new Date(sale.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">₹{sale.total_amount.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.item_count ? `${sale.item_count} items` : ''}
                    </p>
                  </div>
                </button>
              ))}
              {sales.length === 0 && (
                <div className="px-4 py-4 text-sm text-muted-foreground">No sales found.</div>
              )}
            </div>
            {hasNextPage && (
              <div className="px-4 pb-4 pt-2">
                <button
                  onClick={loadMore}
                  className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load 50 More'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle>Invoice Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected ? selected.invoice_number : 'Select an order to view products'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 overflow-y-auto p-4">
            {selected && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-semibold">{selected.customer_name ?? 'Walk-in'}</p>
                  {selected.customer_phone && (
                    <p className="text-xs text-muted-foreground">{selected.customer_phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-semibold">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="font-semibold">{selected.payment_method ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GST / Discount</p>
                  <p className="font-semibold">
                    GST: ₹{selected.tax_amount.toFixed(0)} | Disc: ₹
                    {selected.discount_amount.toFixed(0)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">₹{selected.total_amount.toFixed(0)}</p>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200">
              {selected && itemsLoading && (
                <div className="px-4 py-3 text-sm text-muted-foreground">Loading items…</div>
              )}
              {selected && !itemsLoading && items.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No items for this order.
                </div>
              )}
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{item.unit_price.toFixed(0)} • Qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">₹{item.total.toFixed(0)}</p>
                </div>
              ))}
              {!selected && (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  Select a sale to view details.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
