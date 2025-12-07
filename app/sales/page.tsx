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
    error,
    isLoading: loading,
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

  if (loading && !sales.length) return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error ? error.message : 'Unknown error'}</div>;

  const loadMore = () => {
    void fetchNextPage();
  };

  const totalCount = data?.pages[0]?.total_count ?? 0;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col relative">
      <div className="flex items-center justify-between h-14 min-h-[3.5rem]">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-[25px]">
            <h1 className="page-title !mb-0">Sales</h1>
            <SearchPill
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search invoices..."
              className="w-[260px] mt-1.5"
            />
          </div>
          <p className="text-sm text-muted-foreground">{totalCount} total orders</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr] h-full overflow-hidden">
        <Card className="p-0 overflow-hidden flex flex-col h-full relative">
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
            {/* Loading Overlay */}
            {(loading || isFetchingNextPage) && sales.length > 0 && (
              <div className="absolute inset-0 bg-white/50 z-20 pointer-events-none flex items-start justify-center pt-20">
                {/* Optional spinner */}
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
          <CardContent className="p-0 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
            {selected ? (
              <div className="flex flex-col min-h-full p-8 max-w-[210mm] mx-auto">
                {/* Document Header: Company Info & Title */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-6 mb-8">
                  <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      Inventory System
                    </h1>
                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-0.5">
                      <p>123 Business Street, Tech City, 560001</p>
                      <p>Phone: +91 98765 43210</p>
                      <p>Email: support@inventorysystem.com</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-normal text-slate-900 dark:text-slate-100 tracking-widest uppercase">
                      INVOICE
                    </h2>
                  </div>
                </div>

                {/* Bill To & Invoice Meta */}
                <div className="flex justify-between items-start mb-12">
                  <div className="w-1/2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                      Bill To:
                    </h3>
                    <div className="text-sm text-slate-900 dark:text-slate-100 space-y-1">
                      <p className="font-medium text-base">
                        {selected.customer_name || 'Walk-in Customer'}
                      </p>
                      {selected.customer_phone && <p>{selected.customer_phone}</p>}
                      {/* Placeholder for address if we had it in the view model, matching PDF style */}
                      {/* <p>H.No. 57, Varughese Street, Dehradun 116137</p> */}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold">Invoice #:</span> {selected.invoice_number}
                    </p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold">Date:</span>{' '}
                      {new Date(selected.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-semibold">Status:</span> Paid
                    </p>
                  </div>
                </div>

                {/* Items Table - PDF Style */}
                <div className="mb-8">
                  <table className="w-full text-sm">
                    <thead className="bg-[#333333] text-white">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">Item</th>
                        <th className="px-4 py-2 text-left font-bold w-32">SKU</th>
                        <th className="px-4 py-2 text-center font-bold w-20">Qty</th>
                        <th className="px-4 py-2 text-right font-bold w-32">Price</th>
                        <th className="px-4 py-2 text-right font-bold w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {itemsLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            Loading items...
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No items found for this order.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id} className="text-slate-700 dark:text-slate-300">
                            <td className="px-4 py-3 font-medium">{item.product_name}</td>
                            <td className="px-4 py-3 text-slate-500">{item.sku || '-'}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">
                              ₹{item.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ₹{item.total.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-medium">Subtotal:</span>
                      <span>
                        Rs. {(selected.total_amount - (selected.tax_amount || 0) + (selected.discount_amount || 0)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-medium">Discount:</span>
                      <span>-Rs. {(selected.discount_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-medium">Tax:</span>
                      <span>Rs. {(selected.tax_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2">
                      <span className="text-xl font-bold text-slate-900 dark:text-slate-100">Total:</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Rs. {selected.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                  No Order Selected
                </h3>
                <p>Select an order from the list to view details.</p>
              </div>
            )}
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

