'use client';

import type { Invoice } from '@/types';
import { useState, useDeferredValue, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchPill } from '@/components/shared/SearchPill';
import { invoiceCommands, customerCommands, productCommands, type PaginatedResult, type Customer, type UpdateInvoiceInput, type CreateInvoiceItemInput, type DeletedInvoice, type InvoiceModification } from '@/lib/tauri';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { useInfiniteQuery, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { Pencil, Trash2, Plus, X, Minus, History, FileX, Loader2 } from 'lucide-react';
import { shareInvoiceViaWhatsApp, openWhatsAppChat } from '@/lib/whatsapp-share';
import { PhoneEntryDialog } from '@/components/shared/PhoneEntryDialog';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [inlinePdfUrl, setInlinePdfUrl] = useState<string | null>(null);
  const [isInlinePdfLoading, setIsInlinePdfLoading] = useState(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [showPhoneEntry, setShowPhoneEntry] = useState(false);
  const [pendingShareData, setPendingShareData] = useState<{
    filePath: string;
  } | null>(null);

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
      if (!selected?.id) return { items: [], rawItems: [], customer: null, invoice: null }; // Return null customer default
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
        invoice: data.invoice,
        customer,
        items: mappedItems,
        rawItems: data.items,
      };
    },
    enabled: !!selected?.id,
  });

  const items = details?.items ?? [];
  const rawItems = details?.rawItems ?? [];
  const fullCustomer = details?.customer;
  const invoice = details?.invoice ?? selected;

  useEffect(() => {
    let isActive = true;
    const buildPreview = async () => {
      if (!invoice || rawItems.length === 0) {
        setInlinePdfUrl(null);
        setIsInlinePdfLoading(false);
        return;
      }

      setIsInlinePdfLoading(true);
      try {
        const { url } = await generateInvoicePDF(invoice, rawItems, fullCustomer || undefined);
        if (!isActive) {
          URL.revokeObjectURL(url);
          return;
        }
        setInlinePdfUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (error) {
        console.error('Failed to generate inline PDF preview:', error);
        setInlinePdfUrl(null);
      } finally {
        if (isActive) setIsInlinePdfLoading(false);
      }
    };

    buildPreview();

    return () => {
      isActive = false;
    };
  }, [invoice?.id, rawItems, fullCustomer]);

  useEffect(() => {
    return () => {
      if (inlinePdfUrl) URL.revokeObjectURL(inlinePdfUrl);
    };
  }, [inlinePdfUrl]);

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
      created_at: selected.created_at ? new Date(selected.created_at).toISOString().slice(0, 16) : undefined,
      status: 'paid',
      tax_amount: selected.tax_amount,
      discount_amount: selected.discount_amount,
      state: selected.state,
      district: selected.district,
      town: selected.town,
    });
    // Load current items into editable state - use rawItems to get actual stored values
    const sourceItems = rawItems.length > 0 ? rawItems : items;
    setEditItems(sourceItems.map(item => {
      // Get original price from product catalog, not from corrupted saved data
      const product = products.find(p => p.id === item.product_id);
      const originalPrice = product?.selling_price ?? product?.price ?? item.unit_price;
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: originalPrice,
        discount_amount: item.discount_amount || 0,
      };
    }));
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
        original_price: product.selling_price ?? product.price,
        discount_amount: 0,
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
        // Recalculate discount based on new quantity
        const originalPrice = (i as any).original_price || i.unit_price;
        const perUnitDiscount = Math.max(0, originalPrice - i.unit_price);
        const newDiscount = perUnitDiscount * newQty;
        return { ...i, quantity: newQty, discount_amount: newDiscount };
      }
      return i;
    }));
  };

  const handleItemChange = (productId: number, field: 'quantity' | 'unit_price' | 'discount_amount', value: number) => {
    setEditItems(prev => prev.map(i => {
      if (i.product_id === productId) {
        if (field === 'unit_price') {
          // Auto-calculate total discount when price is changed (per unit diff × quantity)
          const originalPrice = (i as any).original_price || i.unit_price;
          const perUnitDiscount = Math.max(0, originalPrice - value);
          const totalDiscount = perUnitDiscount * i.quantity;
          return { ...i, unit_price: value, discount_amount: totalDiscount };
        }
        return { ...i, [field]: value };
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

  const handleShareWhatsApp = async () => {
    if (!selected) return;

    try {
      setIsSharingWhatsApp(true);

      const fullInvoice = await invoiceCommands.getById(selected.id);

      let customer = null;
      if (selected.customer_id) {
        try {
          customer = await customerCommands.getById(selected.customer_id);
        } catch (e) {
          console.error('Could not fetch customer details', e);
          customer = {
            name: selected.customer_name || 'Customer',
            phone: selected.customer_phone,
          } as any;
        }
      } else if (selected.customer_name) {
        customer = {
          name: selected.customer_name,
          phone: selected.customer_phone,
        } as any;
      }

      const { url } = await generateInvoicePDF(
        fullInvoice.invoice,
        fullInvoice.items,
        customer
      );

      const fileName = `Invoice_${selected.invoice_number}.pdf`;
      const phone = customer?.phone || selected.customer_phone;

      await shareInvoiceViaWhatsApp(
        url,
        fileName,
        phone,
        (filePath: string) => {
          // Phone required callback - PDF already saved to temp
          setPendingShareData({ filePath });
          setShowPhoneEntry(true);
        }
      );
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      alert('Failed to share via WhatsApp');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handlePhoneEntryConfirm = async (phone: string) => {
    if (!pendingShareData) return;

    try {
      // PDF already saved, just open WhatsApp with the file
      await openWhatsAppChat(phone, pendingShareData.filePath);
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      alert('Failed to share via WhatsApp');
    } finally {
      setPendingShareData(null);
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
          <p className="text-sm text-slate-500 font-medium">{totalCount} total orders</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr] h-full overflow-hidden">
        <Card className="p-0 overflow-hidden flex flex-col h-full relative">
          <CardHeader className="pb-2">
            <CardTitle>Sales History</CardTitle>
            <p className="text-sm text-slate-500 font-medium">
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

                        const { url } = await generateInvoicePDF(fullInvoice.invoice, fullInvoice.items, customer);
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
                  <button
                    onClick={handleShareWhatsApp}
                    disabled={isSharingWhatsApp}
                    className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Share via WhatsApp"
                  >
                    {isSharingWhatsApp ? (
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                    ) : (
                      <WhatsAppIcon size={20} />
                    )}
                  </button>
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
              <div className="h-full overflow-auto p-4 flex justify-center">
                <div className="w-full max-w-[900px] aspect-[210/297] bg-white border rounded-md shadow-sm overflow-hidden">
                  {isInlinePdfLoading && (
                    <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                      Generating preview...
                    </div>
                  )}
                  {!isInlinePdfLoading && inlinePdfUrl && !isEditOpen && (
                    <iframe
                      src={inlinePdfUrl}
                      className="w-full h-full"
                      title="Invoice PDF Preview"
                    />
                  )}
                  {!isInlinePdfLoading && inlinePdfUrl && isEditOpen && (
                    <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                      Edit in progress...
                    </div>
                  )}
                  {!isInlinePdfLoading && !inlinePdfUrl && (
                    <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
                      Preview unavailable.
                    </div>
                  )}
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

      {/* Edit Invoice Sheet (Full Editor - Billing Style) */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent
          className="w-[98vw] max-w-7xl h-auto max-h-[85vh] rounded-2xl flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl border"
          side="center"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 dark:bg-slate-800 shrink-0">
            <SheetTitle className="text-lg font-semibold">Edit Invoice {selected?.invoice_number}</SheetTitle>
          </div>

          {/* Main Content - 2 Column Grid (Billing Style) */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Customer & Location */}
              <div className="card space-y-4">
                <h3 className="section-title text-sm font-semibold">Customer & Location</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="form-label">Customer</label>
                    <Select
                      value={editForm.customer_id?.toString() || ''}
                      onValueChange={(val) => {
                        const cid = val ? Number(val) : null;
                        const customer = customers.find(c => c.id === cid);
                        setEditForm(prev => ({
                          ...prev,
                          customer_id: cid,
                          state: customer?.state || prev.state,
                          district: customer?.district || prev.district,
                          town: customer?.town || prev.town,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Walk-in Customer</SelectItem>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="form-label">Date & Time</label>
                    <Input
                      type="text"
                      value={editForm.created_at ? new Date(editForm.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, created_at: e.target.value }))}
                      className="form-input"
                      placeholder="DD/MM/YYYY, HH:MM"
                    />
                  </div>
                  <div>
                    <label className="form-label">Payment Method</label>
                    <Select
                      value={editForm.payment_method || ''}
                      onValueChange={(val) => setEditForm(prev => ({ ...prev, payment_method: val }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Town</label>
                    <Input
                      value={editForm.town || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, town: e.target.value }))}
                      className="form-input"
                      placeholder="Town"
                    />
                  </div>
                  <div>
                    <label className="form-label">District</label>
                    <Input
                      value={editForm.district || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, district: e.target.value }))}
                      className="form-input"
                      placeholder="District"
                    />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <Input
                      value={editForm.state || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                      className="form-input"
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Tax (₹)</label>
                    <Input
                      type="number"
                      value={editForm.tax_amount ?? 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, tax_amount: parseFloat(e.target.value) || 0 }))}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Discount (₹)</label>
                    <Input
                      type="number"
                      value={editForm.discount_amount ?? 0}
                      onChange={(e) => setEditForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Invoice Items */}
              <div className="card space-y-4">
                <h3 className="section-title text-sm font-semibold">Invoice Items</h3>

                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[50vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Product</th>
                          <th className="text-right py-2 px-3 font-medium w-24">Price (₹)</th>
                          <th className="text-center py-2 px-3 font-medium w-32">Qty</th>
                          <th className="text-right py-2 px-3 font-medium w-24">Disc (₹)</th>
                          <th className="text-right py-2 px-3 font-medium w-28">Total (₹)</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {editItems.map((item, idx) => {
                          const product = products.find(p => p.id === item.product_id);
                          const productName = product?.name || items.find(i => i.product_id === item.product_id)?.product_name || `Product #${item.product_id}`;
                          const itemTotal = item.quantity * item.unit_price; // Discount already reflected in reduced price

                          return (
                            <tr key={idx} className="bg-white dark:bg-slate-900">
                              <td className="py-2 px-3">
                                <p className="font-medium truncate max-w-[200px]">{productName}</p>
                                <p className="text-xs text-slate-500">{product?.sku}</p>
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  className="h-8 text-right px-2 w-full"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemChange(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateItemQuantity(item.product_id, -1)}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="w-8 text-center">{item.quantity}</span>
                                  <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateItemQuantity(item.product_id, 1)}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  type="number"
                                  className="h-8 text-right px-2 w-full"
                                  value={item.discount_amount || 0}
                                  onChange={(e) => handleItemChange(item.product_id, 'discount_amount', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-medium">
                                {itemTotal.toFixed(1)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeProductFromEdit(item.product_id)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {editItems.length === 0 && (
                      <div className="p-8 text-center text-slate-500">No items in invoice</div>
                    )}
                  </div>
                </div>

                {/* Add Products */}
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-medium">Add Product</label>
                  <div className="relative">
                    <Input
                      placeholder="Search to add product..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                    <div className="absolute left-3 top-2.5 text-slate-400">
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                  {productSearchTerm && products.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto divide-y bg-white dark:bg-slate-800 shadow-md">
                      {products.slice(0, 5).map(p => (
                        <button
                          key={p.id}
                          className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
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
            </div> {/* End 2-col grid */}
          </div> {/* End scrollable area */}

          {/* Footer Totals */}
          <div className="border-t p-4 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800">
            <div className="text-sm">
              <div className="flex gap-4 text-slate-500">
                <span>Items: <strong className="text-foreground">{editItems.length}</strong></span>
                <span>Qty: <strong className="text-foreground">{editItems.reduce((acc, i) => acc + i.quantity, 0)}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <p className="text-xs text-slate-500">Net Total</p>
                <p className="text-xl font-bold text-sky-600">
                  Rs. {(
                    editItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0) +
                    (editForm.tax_amount || 0) - (editForm.discount_amount || 0)
                  ).toFixed(2)}
                </p>
              </div>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateInvoice} className="bg-sky-600 hover:bg-sky-700 text-white">Save Changes</Button>
            </div>
          </div>
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

      {/* Phone Entry Dialog */}
      <PhoneEntryDialog
        open={showPhoneEntry}
        onOpenChange={setShowPhoneEntry}
        onConfirm={handlePhoneEntryConfirm}
      />
    </div>
  );
}
