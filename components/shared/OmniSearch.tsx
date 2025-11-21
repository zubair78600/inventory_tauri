'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

const fetchJSON = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch results');
  return (await res.json()) as T;
};

const categories: Category[] = [
  {
    id: 'customers',
    label: 'Customers',
    placeholder: 'Search in Customers ( / )',
    fetcher: async (q) => {
      const data = await fetchJSON<
        { id: number; name: string; email?: string | null; phone?: string | null }[]
      >(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return data.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.phone ?? c.email ?? '',
        meta: 'Customer',
        href: '/customers',
      }));
    },
  },
  {
    id: 'items',
    label: 'Items',
    placeholder: 'Search in Items ( / )',
    fetcher: async (q) => {
      const data = await fetchJSON<
        { id: number; name: string; sku: string; price: number; stock_quantity: number }[]
      >(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return data.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `SKU: ${p.sku} • Stock: ${p.stock_quantity}`,
        meta: `₹${p.price.toFixed(2)}`,
        href: '/inventory',
      }));
    },
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    placeholder: 'Search in Suppliers ( / )',
    fetcher: async (q) => {
      const data = await fetchJSON<{ id: number; name: string; contact_info?: string | null }[]>(
        `/api/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`
      );
      return data.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.contact_info ?? 'No contact info',
        meta: 'Supplier',
        href: '/suppliers',
      }));
    },
  },
  {
    id: 'invoices',
    label: 'Invoices',
    placeholder: 'Search in Invoices ( / )',
    fetcher: async (q) => {
      const data = await fetchJSON<
        {
          id: number;
          invoice_number: string;
          customer_name?: string | null;
          total_amount: number;
        }[]
      >(`/api/invoices${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return data.map((inv) => ({
        id: inv.id,
        title: inv.invoice_number,
        subtitle: inv.customer_name ?? 'Walk-in',
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
      const data = await fetchJSON<
        {
          id: number;
          invoice_number: string;
          customer_name?: string | null;
          total_amount: number;
        }[]
      >(`/api/invoices${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return data.slice(0, 10).map((inv) => ({
        id: inv.id,
        title: inv.invoice_number,
        subtitle: inv.customer_name ?? 'Walk-in',
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
      const data = await fetchJSON<
        { id: number; name: string; sku: string; price: number; stock_quantity: number }[]
      >(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return data.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `SKU: ${p.sku} • Stock: ${p.stock_quantity}`,
        meta: `₹${p.price.toFixed(2)}`,
        href: '/inventory',
      }));
    },
  },
];

export function OmniSearch() {
  // Keep router/pathname handy for future navigation needs (currently not used)
  const _router = useRouter();
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
        const res = await fetch(`/api/customers/${item.id}`);
        if (!res.ok) throw new Error('Failed to load details');
        const data = (await res.json()) as {
          customer: { name: string; phone?: string | null; email?: string | null };
          invoices?: {
            id: number;
            invoice_number: string;
            total_amount: number;
          }[];
        };
        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{data.customer.name}</p>
              <p className="text-muted-foreground">{data.customer.phone ?? 'No phone'}</p>
              <p className="text-muted-foreground">{data.customer.email ?? 'No email'}</p>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Recent Invoices</p>
                <div className="divide-y border rounded-lg max-h-48 overflow-auto">
                  {data.invoices?.map((inv) => (
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
        const [itemRes, invRes] = await Promise.all([
          fetch(`/api/invoices/${item.id}/items`),
          fetch(`/api/invoices?q=${encodeURIComponent(String(item.title))}`),
        ]);
        const items =
          itemRes && itemRes.ok
            ? ((await itemRes.json()) as {
                id: number;
                product_name: string;
                quantity: number;
                unit_price: number;
              }[])
            : [];
        type InvoiceBrief = {
          id: number;
          invoice_number: string;
          customer_name?: string | null;
          total_amount: number;
        };
        const invoiceList = invRes && invRes.ok ? ((await invRes.json()) as InvoiceBrief[]) : [];
        const invoice = invoiceList.find((i) => i.id === item.id) ?? invoiceList[0];
        setDetail({
          title: item.title,
          content: (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{invoice?.customer_name ?? 'Walk-in'}</p>
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
                  className={`flex w-full items-center justify-between px-4 py-3 text-base hover:bg-sky-50 ${
                    cat.id === activeCategory.id ? 'bg-sky-100 text-sky-800 font-semibold' : ''
                  }`}
                  onClick={() => {
                    setActiveCategory(cat);
                    setShowCategories(false);
                    setQuery('');
                    setOpen(true);
                    inputRef.current?.focus();
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

      {detailOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">{detail?.title ?? 'Details'}</h3>
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-700"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
            </div>
            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading details...
              </div>
            )}
            {!detailLoading && detail?.content && <div>{detail.content}</div>}
            {!detailLoading && !detail?.content && (
              <p className="text-sm text-muted-foreground">No details available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
