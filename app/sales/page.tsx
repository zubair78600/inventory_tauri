'use client';

import type { Invoice } from '@/types';
import { useState, useDeferredValue, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchPill } from '@/components/shared/SearchPill';
import { invoiceCommands, customerCommands, settingsCommands, imageCommands, productCommands, type PaginatedResult, type Customer, type UpdateInvoiceInput, type CreateInvoiceItemInput, type DeletedInvoice, type InvoiceModification } from '@/lib/tauri';
import { generateInvoicePDF, DEFAULT_COMPANY_NAME, DEFAULT_COMPANY_ADDRESS, DEFAULT_COMPANY_PHONE, DEFAULT_COMPANY_EMAIL, numberToWords } from '@/lib/pdf-generator';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { Pencil, Trash2, Plus, X, Minus, History, FileX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

type InvoiceItem = {
  id: number;
  product_id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  total: number;
};

interface ExtendedInvoice extends Invoice {
  customer_name?: string | null;
  customer_phone?: string | null;
  item_count?: number;
}

export default function Sales() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  // Settings State for dynamic header
  const [companySettings, setCompanySettings] = useState({
    name: DEFAULT_COMPANY_NAME,
    address: DEFAULT_COMPANY_ADDRESS,
    phone: DEFAULT_COMPANY_PHONE,
    email: DEFAULT_COMPANY_EMAIL,
    logoUrl: null as string | null,
    headerAlign: 'left' as 'left' | 'center' | 'right',
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsCommands.getAll();
        let logoUrl = null;
        if (settings['invoice_logo_path']) {
          const picturesDir = await imageCommands.getPicturesDirectory();
          logoUrl = convertFileSrc(`${picturesDir}/${settings['invoice_logo_path']}`);
        }

        setCompanySettings({
          name: settings['invoice_company_name'] || DEFAULT_COMPANY_NAME,
          address: settings['invoice_company_address'] || DEFAULT_COMPANY_ADDRESS,
          phone: settings['invoice_company_phone'] || DEFAULT_COMPANY_PHONE,
          email: settings['invoice_company_email'] || DEFAULT_COMPANY_EMAIL,
          logoUrl,
          headerAlign: (settings['invoice_header_align'] as 'left' | 'center' | 'right') || 'left',
        });
      } catch (err) {
        console.error("Failed to load company settings", err);
      }
    };
    loadSettings();
  }, []);

  // Edit/Delete State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UpdateInvoiceInput>>({});
  const [editItems, setEditItems] = useState<CreateInvoiceItemInput[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const queryClient = useQueryClient();

  // Fetch customers for edit dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customerCommands.getAll(1, 1000), // Fetch all reasonable amount
  });
  const customers = customersData?.items ?? [];

  // Fetch products for adding to invoice
  const { data: productsData } = useQuery({
    queryKey: ['products-for-edit', productSearchTerm],
    queryFn: () => productCommands.getAll(1, 50, productSearchTerm || undefined),
  });
  const products = productsData?.items ?? [];



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
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  const sales = data?.pages.flatMap((page) => page.items) ?? [];
  const selected = sales.find((s) => s.id === selectedId) ?? sales[0] ?? null;

  // Fetch details for selected invoice
  const { data: details, isLoading: itemsLoading } = useQuery({
    queryKey: ['invoice-details', selected?.id],
    queryFn: async () => {
      if (!selected?.id) return { items: [], customer: null }; // Return null customer default
      const data = await invoiceCommands.getById(selected.id);

      let customer: Customer | null = null;
      if (selected.customer_id) {
        try {
          customer = await customerCommands.getById(selected.customer_id);
        } catch (e) { console.error("Failed to fetch customer", e); }
      }

      // Calculate weighted discounts if needed
      const items = data.items;
      const totalGross = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const globalDiscount = data.invoice.discount_amount || 0;
      const hasPerItemDiscount = items.some(i => (i.discount_amount || 0) > 0);

      const mappedItems = items.map((item) => {
        let discount = item.discount_amount || 0;
        if (!hasPerItemDiscount && globalDiscount > 0 && totalGross > 0) {
          const originalGross = item.quantity * item.unit_price;
          const weight = originalGross / totalGross;
          discount = weight * globalDiscount;
        }

        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: discount,
          total: item.quantity * item.unit_price - discount,
        };
      });

      return {
        customer,
        items: mappedItems,
      };
    },
    enabled: !!selected?.id,
  });

  const items = details?.items ?? [];
  const fullCustomer = details?.customer;

  // Calculate Totals for Footer
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  if (loading && !sales.length) return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error ? error.message : 'Unknown error'}</div>;

  const loadMore = () => {
    void fetchNextPage();
  };

  const totalCount = data?.pages[0]?.total_count ?? 0;

  const openEditDialog = () => {
    if (!selected) return;
    setEditForm({
      id: selected.id,
      customer_id: selected.customer_id,
      payment_method: selected.payment_method,
      created_at: selected.created_at,
      status: 'paid',
    });
    // Load current items into editable state
    setEditItems(items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })));
    setProductSearchTerm('');
    setIsEditOpen(true);
  };

  const handleUpdateInvoice = async () => {
    if (!editForm.id) return;
    try {
      // Update metadata
      await invoiceCommands.update(editForm as UpdateInvoiceInput);
      // Update items if changed
      await invoiceCommands.updateItems(editForm.id, editItems, user?.username);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-details', editForm.id] });
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update invoice:', error);
      alert('Failed to update invoice');
    }
  };

  const addProductToEdit = (product: { id: number; selling_price: number | null; price: number }) => {
    const existing = editItems.find(i => i.product_id === product.id);
    if (existing) {
      // Increase quantity
      setEditItems(prev => prev.map(i =>
        i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      // Add new item
      setEditItems(prev => [...prev, {
        product_id: product.id,
        quantity: 1,
        unit_price: product.selling_price ?? product.price,
      }]);
    }
  };

  const removeProductFromEdit = (productId: number) => {
    setEditItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateItemQuantity = (productId: number, delta: number) => {
    setEditItems(prev => prev.map(i => {
      if (i.product_id === productId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const handleDeleteInvoice = async () => {
    if (!selected?.id) return;
    try {
      await invoiceCommands.delete(selected.id, user?.username);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      setSelectedId(null);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      alert('Failed to delete invoice');
    }
  };

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

      <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr] h-full overflow-hidden">
        <Card className="p-0 overflow-hidden flex flex-col h-full relative">
          <CardHeader className="pb-2">
            <CardTitle>Sales History</CardTitle>
            <p className="text-sm text-muted-foreground">
              {totalCount} total orders
            </p>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {/* Sales List */}
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
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Rs. {sale.total_amount.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.item_count ? `${sale.item_count} items` : ''}
                    </p>
                  </div>
                </button>
              ))}
              {sales.length === 0 && (
                <div className="px-4 py-4 text-sm text-muted-foreground">No sales found.</div>
              )}
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
            </div>

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
                <div className="flex items-center gap-2">
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

                        const { url, size, duration } = await generateInvoicePDF(fullInvoice.invoice, fullInvoice.items, customer);
                        setPdfUrl(url);
                        setPdfFileName(`Invoice_${selected.invoice_number}.pdf`);
                        setShowPdfPreview(true);
                        // Show stats
                        // alert(`PDF Generated!\nSize: ${size}\nTime: ${duration}`);
                      } catch (error) {
                        console.error("Error generating PDF:", error);
                        alert("Failed to generate PDF");
                      }
                    }}
                  >
                    Download PDF
                  </Button>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-md p-1 gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600" onClick={openEditDialog}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setIsDeleteOpen(true)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden bg-slate-100/50 dark:bg-slate-950/50">
            {selected ? (
              <div className="origin-top transform scale-[0.65] w-full max-w-[210mm] bg-white shadow-lg mx-auto mt-2 p-6 text-slate-900">
                {/* Document Header: Company Info & Title */}
                <div className={`flex flex-col border-b border-slate-300 pb-4 mb-4 relative min-h-[120px] ${companySettings.headerAlign === 'center' ? 'items-center text-center' :
                  companySettings.headerAlign === 'right' ? 'items-end text-right' : 'items-start text-left'
                  }`}>

                  {/* INVOICE Title - Absolute positioned to top-right to avoid cramping, or flexed */}
                  <div className="absolute top-0 right-0">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-widest uppercase">
                      INVOICE
                    </h2>
                  </div>

                  <div className="w-full space-y-2 mt-2 max-w-[70%]">
                    {/* Dynamic Logo if available */}
                    {companySettings.logoUrl && (
                      <div className={`mb-3 h-16 relative ${companySettings.headerAlign === 'center' ? 'mx-auto' :
                        companySettings.headerAlign === 'right' ? 'ml-auto' : 'mr-auto'
                        }`}>
                        <img src={companySettings.logoUrl} alt="Logo" className="h-full object-contain" />
                      </div>
                    )}

                    <div>
                      <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                        {companySettings.name}
                      </h1>
                      <div className="text-xs text-slate-600 space-y-1 mt-1 leading-relaxed">
                        <p className="whitespace-pre-line">{companySettings.address}</p>
                        {companySettings.phone && <p>Phone: {companySettings.phone}</p>}
                        {companySettings.email && <p>Email: {companySettings.email}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Removed separate INVOICE title div since it's now absolute positioned above */}

                {/* Bill To & Invoice Meta */}
                <div className="flex justify-between items-start mb-6">
                  <div className="w-1/2">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">
                      Bill To:
                    </h3>
                    <div className="text-sm text-slate-900 space-y-1">
                      <p className="font-medium text-base">
                        {fullCustomer?.name || selected.customer_name || 'Walk-in Customer'}
                      </p>
                      <p>{fullCustomer?.phone || selected.customer_phone}</p>
                      {fullCustomer?.email && <p>{fullCustomer.email}</p>}
                      {fullCustomer?.address && <p>{fullCustomer.address}</p>}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">Invoice #:</span> {selected.invoice_number}
                    </p>
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">Date:</span>{' '}
                      {new Date(selected.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">Status:</span> Paid
                    </p>
                  </div>
                </div>

                {/* Items Table - PDF Style */}
                <div className="mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-[#333333] text-white">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold">Item</th>
                        <th className="px-4 py-2 text-center font-bold w-32">SKU</th>
                        <th className="px-4 py-2 text-center font-bold w-20">Qty</th>
                        <th className="px-4 py-2 text-center font-bold w-32">Price</th>
                        <th className="px-4 py-2 text-center font-bold w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
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
                        <>
                          {items.map((item) => (
                            <tr key={item.id} className="text-slate-700">
                              <td className="px-4 py-3 font-medium text-left">{item.product_name}</td>
                              <td className="px-4 py-3 text-slate-500 text-center">{item.sku || '-'}</td>
                              <td className="px-4 py-3 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-center">
                                Rs. {((item.unit_price * item.quantity - (item.discount_amount || 0)) / item.quantity).toFixed(1)}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold">
                                Rs. {item.total.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                          {/* Footer Row matching PDF */}
                          <tr className="bg-slate-100 font-bold border-t border-slate-300">
                            <td className="px-4 py-3 text-left">Total</td>
                            <td className="px-4 py-3 text-center"></td>
                            <td className="px-4 py-3 text-center">{totalQty}</td>
                            <td className="px-4 py-3 text-center"></td>
                            <td className="px-4 py-3 text-center">Rs. {selected.total_amount.toFixed(1)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="mb-6 border-b border-slate-200 pb-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Amount in Words:
                  </p>
                  <p className="text-sm text-slate-600 italic mt-1">
                    {numberToWords(Math.round(selected.total_amount))}
                  </p>
                </div>

                {/* Summary Section */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm text-slate-800">
                      <span className="font-medium">Subtotal:</span>
                      <span>
                        Rs. {(selected.total_amount - (selected.tax_amount || 0) + (selected.discount_amount || 0)).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-800">
                      <span className="font-medium">Discount:</span>
                      <span>-Rs. {(selected.discount_amount || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-800">
                      <span className="font-medium">Tax:</span>
                      <span>Rs. {(selected.tax_amount || 0).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2">
                      <span className="text-xl font-bold text-slate-900">Total:</span>
                      <span className="text-xl font-bold text-slate-900">
                        Rs. {selected.total_amount.toFixed(1)}
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

      {/* Edit Invoice Sheet (Full Editor) */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="fixed inset-0 m-auto w-[90%] max-w-2xl h-[70vh] rounded-xl overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl">
          <SheetHeader>
            <SheetTitle>Edit Invoice {selected?.invoice_number}</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 py-4">
            {/* Metadata Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer</label>
                <Select
                  value={editForm.customer_id?.toString() || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customer_id: Number(e.target.value) || null }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select
                  value={editForm.payment_method || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </Select>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Invoice Items</h3>
                <span className="text-xs text-slate-500">
                  {editItems.length} item(s) • Rs. {editItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0).toFixed(1)}
                </span>
              </div>

              {/* Current Items Table */}
              <div className="border rounded-lg divide-y">
                {editItems.length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-sm">No items in invoice</div>
                )}
                {editItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.product_id);
                  const productName = product?.name || items.find(i => i.product_id === item.product_id)?.product_name || `Product #${item.product_id}`;
                  return (
                    <div key={idx} className="flex items-center justify-between p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{productName}</p>
                        <p className="text-xs text-slate-500">Rs. {item.unit_price.toFixed(1)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateItemQuantity(item.product_id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateItemQuantity(item.product_id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeProductFromEdit(item.product_id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="w-20 text-right font-medium text-sm">Rs. {(item.quantity * item.unit_price).toFixed(1)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Add Products */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Add Product</label>
                <Input
                  placeholder="Search products..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                />
                {productSearchTerm && products.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                    {products.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => { addProductToEdit(p); setProductSearchTerm(''); }}
                      >
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.sku} • Stock: {p.stock_quantity}</p>
                        </div>
                        <p className="text-sm font-medium">Rs. {(p.selling_price ?? p.price).toFixed(1)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-sky-600">
                Rs. {editItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0).toFixed(1)}
              </span>
            </div>
          </div>
          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateInvoice}>Save Changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-500">
            Are you sure you want to delete this invoice? This will restore stock quantities. This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteInvoice}>Delete Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}

