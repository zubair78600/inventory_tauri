'use client';

import type { Invoice } from '@/types';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchPill } from '@/components/shared/SearchPill';
import { invoiceCommands } from '@/lib/tauri';

type InvoiceItem = {
  id: number;
  product_id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export default function Sales() {
  const [sales, setSales] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [_, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const data = await invoiceCommands.getAll();
        setSales(data);
        setSelected((data ?? []).slice(0, 10)[0] ?? null);
      } catch (error) {
        console.error(error);
        setError('Failed to load sales.');
      } finally {
        setLoading(false);
      }
    };
    void fetchSales();
  }, []);

  useEffect(() => {
    const loadItems = async () => {
      if (!selected) {
        setItems([]);
        return;
      }
      setItemsLoading(true);
      try {
        const data = await invoiceCommands.getById(selected.id);
        setItems(
          data.items.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.product_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }))
        );
      } catch (error) {
        console.error(error);
        setItems([]);
      } finally {
        setItemsLoading(false);
      }
    };
    void loadItems();
  }, [selected]);

  if (loading) return <div>Loading...</div>;

  const filtered = sales.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      s.invoice_number.toLowerCase().includes(term) ||
      (s.customer_name ?? '').toLowerCase().includes(term)
    );
  });
  const displayed = searchTerm ? filtered : filtered.slice(0, 10);

  return (
    <div className="space-y-5">
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
      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <Card className="p-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Recent Sales</CardTitle>
            <p className="text-sm text-muted-foreground">Last 10 orders with timestamp</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {displayed.map((sale) => (
                <button
                  key={sale.id}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${selected?.id === sale.id
                    ? 'bg-sky-50 border-l-4 border-sky-400'
                    : 'hover:bg-slate-50'
                    }`}
                  onClick={() => setSelected(sale)}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{sale.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.customer_name ?? 'Walk-in'} •{' '}
                      {new Date(sale.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">₹{sale.total_amount.toFixed(2)}</p>
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
          </CardContent>
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Invoice Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected ? selected.invoice_number : 'Select an order to view products'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    GST: ₹{selected.tax_amount.toFixed(2)} | Disc: ₹
                    {selected.discount_amount.toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">₹{selected.total_amount.toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="max-h-[360px] overflow-auto divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200">
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
                      ₹{item.unit_price.toFixed(2)} • Qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">₹{item.total.toFixed(2)}</p>
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
