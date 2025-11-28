'use client';

import type { Invoice } from '@/types';
import { useState, useDeferredValue } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchPill } from '@/components/shared/SearchPill';
import { invoiceCommands, customerCommands, type PaginatedResult, type Customer } from '@/lib/tauri';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

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
        <h1 className="page-title">Sales ({sales.length})</h1>
        <SearchPill
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search invoices..."
        />
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selected ? selected.invoice_number : 'Select an order to view products'}
                </p>
              </div>
              {selected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!selected) return;

                    try {
                      // Fetch full invoice details
                      const fullInvoice = await invoiceCommands.getById(selected.id);

                      let customer = null;
                      if (selected.customer_id) {
                        try {
                          customer = await customerCommands.getById(selected.customer_id);
                        } catch (e) {
                          console.error("Could not fetch customer details", e);
                          customer = {
                            name: selected.customer_name || 'Customer',
                            phone: selected.customer_phone,
                          } as unknown as Customer;
                        }
                      } else if (selected.customer_name) {
                        customer = {
                          name: selected.customer_name,
                          phone: selected.customer_phone,
                        } as unknown as Customer;
                      }

                      const url = generateInvoicePDF(fullInvoice.invoice, fullInvoice.items, customer);
                      setPdfUrl(url);
                      setPdfFileName(`Invoice_${selected.invoice_number}.pdf`);
                      setShowPdfPreview(true);
                    } catch (error) {
                      console.error("Error generating PDF:", error);
                      alert("Failed to generate PDF");
                    }
                  }}
                >
                  Download PDF
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 overflow-y-auto p-4">
            {selected && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-medium">{selected.customer_name || 'Walk-in Customer'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p className="font-medium">{new Date(selected.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <p className="font-medium">₹{selected.total_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Items:</span>
                    <p className="font-medium">{selected.item_count || 0}</p>
                  </div>
                </div>
              </>
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
        </Card >
      </div >
      <PDFPreviewDialog
        open={showPdfPreview}
        onOpenChange={setShowPdfPreview}
        url={pdfUrl}
        fileName={pdfFileName}
      />
    </div >
  );
}

