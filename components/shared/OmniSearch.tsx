'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Search, SquareArrowOutUpRight } from 'lucide-react';

type CategoryId = 'customers' | 'items' | 'suppliers' | 'invoices' | 'sales' | 'inventory';

type Category = {
  id: CategoryId;
  label: string;
  placeholder: string;
  fetcher: (q: string) => Promise<SearchResult[]>;
};

type SearchResult = {
  id: string | number;
  title: string;
  subtitle?: string | null;
  meta?: string;
  href: string;
};

import {
  customerCommands,
  productCommands,
  supplierCommands,
  invoiceCommands,
  searchCommands,
} from '@/lib/tauri';

const categories: Category[] = [
  {
    id: 'customers',
    label: 'Customers',
    placeholder: 'Search in Customers ( / )',
    fetcher: async (q) => {
      const data = await customerCommands.search(q);
      return data.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.phone ?? c.email ?? '',
        meta: 'Customer',
        href: `/customers/details?id=${c.id}`,
      }));
    },
  },
  {
    id: 'items',
    label: 'Items',
    placeholder: 'Search in Items ( / )',
    fetcher: async (q) => {
      const data = await productCommands.getAll(q);
      return data.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `SKU: ${p.sku} • Stock: ${p.stock_quantity}`,
        meta: `₹${p.price.toFixed(2)}`,
        href: `/inventory/details?id=${p.id}`,
      }));
    },
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    placeholder: 'Search in Suppliers ( / )',
    fetcher: async (q) => {
      const data = await supplierCommands.getAll(q);
      return data.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.contact_info ?? 'No contact info',
        meta: 'Supplier',
        href: `/suppliers/details?id=${s.id}`,
      }));
    },
  },
  {
    id: 'invoices',
    label: 'Invoices',
    placeholder: 'Search in Invoices ( / )',
    fetcher: async (q) => {
      const res = await searchCommands.omnisearch(q);
      return res.invoices.map((inv) => ({
        id: inv.id,
        title: inv.invoice_number,
        subtitle: 'Invoice', // search result doesn't have customer name, using generic
        meta: `₹${inv.total_amount.toFixed(2)}`,
        href: '/billing',
      }));
    },
  },
  {
    id: 'sales',
    label: 'Sales',
    placeholder: 'Search Sales (invoices)',
    fetcher: async (q) => {
      const res = await searchCommands.omnisearch(q);
      return res.invoices.slice(0, 10).map((inv) => ({
        id: inv.id,
        title: inv.invoice_number,
        subtitle: 'Invoice',
        meta: `₹${inv.total_amount.toFixed(2)}`,
        href: '/sales',
      }));
    },
  },
  {
    id: 'inventory',
    label: 'Inventory',
    placeholder: 'Search Inventory (name or SKU)',
    fetcher: async (q) => {
      const data = await productCommands.getAll(q);
      return data.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `SKU: ${p.sku} • Stock: ${p.stock_quantity}`,
        meta: `₹${p.price.toFixed(2)}`,
        href: `/inventory/details?id=${p.id}`,
      }));
    },
  },
];

export function OmniSearch() {
  // Keep router/pathname handy for future navigation needs (currently not used)
  const router = useRouter();
  const _pathname = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>(categories[0]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  type DetailContent = { title: string; content: React.ReactNode } | null;
  const [detail, setDetail] = useState<DetailContent>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchResults = (q: string) => {
    setLoading(true);
    activeCategory
      .fetcher(q.trim())
      .then((data) => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || showCategories) return;
    const timer = setTimeout(() => fetchResults(query), 150);
    return () => clearTimeout(timer);
  }, [query, activeCategory, open, showCategories]);

  const loadDetail = async (item: SearchResult) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      if (activeCategory.id === 'customers') {
        const [customer, invoices] = await Promise.all([
          customerCommands.getById(Number(item.id)),
          invoiceCommands.getAll(Number(item.id)),
        ]);

        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{customer.name}</p>
              <p className="text-muted-foreground">{customer.phone ?? 'No phone'}</p>
              <p className="text-muted-foreground">{customer.email ?? 'No email'}</p>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Recent Invoices</p>
                <div className="divide-y border rounded-lg max-h-48 overflow-auto">
                  {invoices?.map((inv) => (
                    <div key={inv.id} className="px-3 py-2 flex justify-between">
                      <span className="font-semibold">{inv.invoice_number}</span>
                      <span className="text-muted-foreground text-xs">
                        ₹{inv.total_amount.toFixed(2)}
                      </span>
                    </div>
                  )) || <p className="px-3 py-2">No invoices</p>}
                </div>
              </div>
            </div>
          ),
        });
        return;
      }

      if (activeCategory.id === 'invoices' || activeCategory.id === 'sales') {
        const data = await invoiceCommands.getById(Number(item.id));
        const { invoice, items } = data;

        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{invoice?.customer_id ? 'Customer #' + invoice.customer_id : 'Walk-in'}</p>
              <p className="text-muted-foreground">
                Total ₹{invoice?.total_amount?.toFixed?.(2) ?? '-'}
              </p>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Items</p>
                <div className="divide-y border rounded-lg max-h-48 overflow-auto">
                  {items.map((it) => (
                    <div key={it.id} className="px-3 py-2 flex justify-between">
                      <span>{it.product_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {it.quantity} × ₹{it.unit_price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {items.length === 0 && <p className="px-3 py-2">No items</p>}
                </div>
              </div>
            </div>
          ),
        });
        return;
      }

      if (activeCategory.id === 'inventory' || activeCategory.id === 'items') {
        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{item.subtitle}</p>
              <p className="font-semibold">{item.meta}</p>
            </div>
          ),
        });
        return;
      }

      if (activeCategory.id === 'suppliers') {
        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{item.title}</p>
              <p className="text-muted-foreground">{item.subtitle ?? ''}</p>
            </div>
          ),
        });
        return;
      }

      setDetail(null);
    } catch (error) {
      console.error(error);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (open && !showCategories) {
      fetchResults(query);
    }
  }, [activeCategory, open, showCategories, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowCategories(false);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTypingInField = ['INPUT', 'TEXTAREA'].includes(
        (document.activeElement?.tagName ?? '').toUpperCase()
      );
      if (e.key === '/' && !isTypingInField) {
        e.preventDefault();
        setOpen(true);
        setShowCategories(false);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (item: SearchResult) => {
    setOpen(false);
    setShowCategories(false);
    setQuery('');

    if (['customers', 'suppliers', 'items', 'inventory'].includes(activeCategory.id)) {
      router.push(item.href);
      return;
    }

    void loadDetail(item);
  };

  return (
    <div className="relative w-full max-w-[448px]" ref={containerRef}>
      <div className="flex h-10 items-center gap-3 rounded-2xl border border-slate-200 bg-white text-slate-800 px-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5)]">
        <button
          type="button"
          className="flex items-center gap-1 text-base font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
            setShowCategories((prev) => !prev);
          }}
          aria-label="Change search category"
        >
          <Search className="h-5 w-5" />
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showCategories ? 'rotate-180' : ''}`}
          />
        </button>
        <div className="h-6 w-px bg-white/20" />
        <input
          ref={inputRef}
          value={query}
          onFocus={() => {
            setOpen(true);
            setShowCategories(false);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setShowCategories(false);
          }}
          placeholder={activeCategory.placeholder}
          className="flex-1 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-slate-200/90 bg-white shadow-[0_18px_80px_-60px_rgba(15,23,42,0.55)] overflow-hidden">
          {showCategories ? (
            <div className="max-h-[360px] overflow-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`flex w-full items-center justify-between px-4 py-3 text-base hover:bg-sky-50 ${cat.id === activeCategory.id ? 'bg-sky-100 text-sky-800 font-semibold' : ''
                    }`}
                  onClick={() => {
                    setActiveCategory(cat);
                    setShowCategories(false);
                    setQuery('');
                    setOpen(true);
                    // Use setTimeout to ensure focus happens after state updates and triggers properly
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 0);
                  }}
                >
                  <span>{cat.label}</span>
                  {cat.id === activeCategory.id && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-[360px] overflow-auto">
              {loading && (
                <div className="px-4 py-4 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching {activeCategory.label.toLowerCase()}…
                </div>
              )}
              {!loading && results.length === 0 && (
                <div className="px-4 py-4 text-sm text-slate-500">
                  No {activeCategory.label.toLowerCase()} found
                </div>
              )}
              {results.map((item) => (
                <button
                  key={`${activeCategory.id}-${item.id}`}
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-sky-50"
                  onClick={() => handleSelect(item)}
                >
                  <div className="mt-0.5 rounded-md bg-sky-100 text-sky-700 h-6 w-6 flex items-center justify-center text-xs font-semibold">
                    {activeCategory.label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </span>
                      {item.meta && (
                        <span className="text-xs font-semibold text-slate-500 shrink-0">
                          {item.meta}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-slate-500 leading-tight truncate">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  <SquareArrowOutUpRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detailOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-900">{detail?.title ?? 'Details'}</h3>
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-slate-100 text-slate-500 transition-colors"
                  onClick={() => setDetailOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              {detailLoading && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading details...
                </div>
              )}
              {!detailLoading && detail?.content && <div>{detail.content}</div>}
              {!detailLoading && !detail?.content && (
                <p className="text-sm text-muted-foreground">No details available.</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
