'use client';

import type { Product, Invoice } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { productCommands, customerCommands, invoiceCommands, settingsCommands } from '@/lib/tauri';
import { useQueryClient, useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { LocationSelector } from '@/components/shared/LocationSelector';
import { useLocationDefaults } from '@/hooks/useLocationDefaults';
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { FileText, Clock, Loader2, Pin } from 'lucide-react';
import { shareInvoiceViaWhatsApp, openWhatsAppChat } from '@/lib/whatsapp-share';
import { PhoneEntryDialog } from '@/components/shared/PhoneEntryDialog';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

type CartItem = {
  product_id: number;
  name: string;
  unit_price: number;
  cost_price: number; // For profit-weighted discount calculation
  quantity: number;
  max_stock: number;
};

export default function Billing() {
  const queryClient = useQueryClient();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [sharingWhatsAppId, setSharingWhatsAppId] = useState<number | null>(null);
  const [showPhoneEntry, setShowPhoneEntry] = useState(false);
  const [pendingShareData, setPendingShareData] = useState<{
    filePath: string;
  } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerSuggestions, setCustomerSuggestions] = useState<
    { id: number; name: string; phone?: string | null }[]
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [initialPaid, setInitialPaid] = useState<number>(0); // For credit payments

  // Location state management with smart defaults
  const { defaults, recordSelection } = useLocationDefaults('invoices');
  const [location, setLocation] = useState({
    state: defaults?.state || '',
    district: defaults?.district || '',
    town: defaults?.town || '',
  });

  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Quick Add State
  const [quickAddIds, setQuickAddIds] = useState<number[]>([]);
  const [gridColumns, setGridColumns] = useState<number>(2);
  const [showQuickAddSettings, setShowQuickAddSettings] = useState(false);
  const importQuickAddSettingsModal = () => import('@/components/billing/QuickAddSettingsModal');
  const [QuickAddModal, setQuickAddModal] = useState<any>(null);

  const pageSize = 20;

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // 1. Fetch Pinned Products (Quick List) separately
  const { data: pinnedProducts } = useQuery({
    queryKey: ['pinned-products', quickAddIds],
    queryFn: async () => {
      if (quickAddIds.length === 0) return [];
      return await productCommands.getByIds(quickAddIds);
    },
    enabled: quickAddIds.length > 0 && !selectedCategory, // Only fetch when in "All Categories" mode
    staleTime: 60 * 1000,
  });

  // 2. Fetch All Products (Infinite Scroll)
  // We ALWAYS fetch from top selling/all endpoint now, even if we have quick add ids
  const {
    data: quickAddData,
    fetchNextPage: fetchNextQuickAdd,
    hasNextPage: hasMoreQuickAdd,
    isFetchingNextPage: isFetchingMoreQuickAdd,
    isLoading: isQuickAddLoading,
  } = useInfiniteQuery({
    queryKey: ['billing-products', selectedCategory], // Removed quickAddIds from key to prevent re-fetch on ID change
    queryFn: async ({ pageParam = 1 }) => {
      // Always fetch paginated list
      return await productCommands.getTopSelling(pageSize, pageParam, selectedCategory || undefined);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap(p => p.items).length;
      if (loadedCount < lastPage.total_count) {
        return allPages.length + 1;
      }
      return undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

  // Flatten and Merge: Pinned First + Rest
  const topProducts = useMemo(() => {
    const pinned = pinnedProducts || [];
    const infinite = quickAddData?.pages.flatMap(page => page.items) ?? [];

    if (selectedCategory) {
      // If specific category is selected, just show the infinite filtered list
      return infinite;
    }

    // Merge: Pinned -> Infinite (deduplicated)
    // Filter pinned items: must be in stock (> 0)
    const activePinned = pinned.filter(p => p.stock_quantity > 0);
    const pinnedIds = new Set(activePinned.map(p => p.id));
    const filteredInfinite = infinite.filter(p => !pinnedIds.has(p.id));

    return [...activePinned, ...filteredInfinite];
  }, [quickAddData, pinnedProducts, selectedCategory]);

  const totalProductCount = quickAddData?.pages[0]?.total_count ?? 0;

  // Infinite query for search results
  const {
    data: searchData,
    fetchNextPage: fetchNextSearch,
    hasNextPage: hasMoreSearch,
    isFetchingNextPage: isFetchingMoreSearch,
    isLoading: isSearchLoading,
    isFetching: isSearching,
  } = useInfiniteQuery({
    queryKey: ['billing-search', debouncedProductSearch],
    queryFn: async ({ pageParam = 1 }) => {
      return await productCommands.getAll(pageParam, 50, debouncedProductSearch);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap(p => p.items).length;
      if (loadedCount < lastPage.total_count) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: debouncedProductSearch.length >= 2,
    placeholderData: keepPreviousData,
  });

  // Flatten search results
  const searchResults = useMemo(() => {
    return searchData?.pages.flatMap(page => page.items) ?? [];
  }, [searchData]);

  const totalSearchCount = searchData?.pages[0]?.total_count ?? 0;

  // Recent invoices query (cached)
  const { data: recentInvoices = [], isLoading: isRecentInvoicesLoading } = useQuery({
    queryKey: ['recent-invoices-billing'],
    queryFn: async () => {
      const result = await invoiceCommands.getAll(1, 5);
      return result.items;
    },
    staleTime: 30 * 1000,
  });


  const handleViewPdf = async (invoice: Invoice) => {
    if (generatingPdfId === invoice.id) return; // Prevent double click
    setGeneratingPdfId(invoice.id);
    try {
      const fullInvoice = await invoiceCommands.getById(invoice.id);

      let customer = null;
      if (invoice.customer_id) {
        try {
          customer = await customerCommands.getById(invoice.customer_id);
        } catch (e) {
          console.error('Failed to fetch customer for PDF:', e);
          // Fallback
          customer = { name: invoice.customer_name || 'Customer', phone: invoice.customer_phone } as any;
        }
      } else {
        customer = { name: invoice.customer_name || 'Customer', phone: invoice.customer_phone } as any;
      }

      const { url } = await generateInvoicePDF(fullInvoice.invoice, fullInvoice.items, customer);
      setPdfUrl(url);
      setPdfFileName(`Invoice_${invoice.invoice_number}.pdf`);
      setShowPdfPreview(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleShareWhatsApp = async (invoice: Invoice) => {
    if (sharingWhatsAppId === invoice.id) return; // Prevent double click
    try {
      setSharingWhatsAppId(invoice.id);

      const fullInvoice = await invoiceCommands.getById(invoice.id);
      let customer = null;

      if (invoice.customer_id) {
        try {
          customer = await customerCommands.getById(invoice.customer_id);
        } catch (e) {
          console.error('Could not fetch customer details', e);
        }
      }

      const { url } = await generateInvoicePDF(
        fullInvoice.invoice,
        fullInvoice.items,
        customer
      );

      const fileName = `Invoice_${invoice.invoice_number}.pdf`;
      const phone = customer?.phone || invoice.customer_phone;

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
      setSharingWhatsAppId(null);
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

  useEffect(() => {
    // Load the modal component dynamically to avoid circular dependencies if any, or just performance
    importQuickAddSettingsModal().then(mod => setQuickAddModal(() => mod.QuickAddSettingsModal));
  }, []);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productCommands.getAllCategories(),
    staleTime: 60 * 1000,
  });

  // Load quick add IDs from settings on mount
  useEffect(() => {
    const loadQuickAddIds = async () => {
      try {
        const settings = await settingsCommands.getAll();
        const savedIdsJson = settings['quick_add_ids'];
        if (savedIdsJson) {
          const ids = JSON.parse(savedIdsJson);
          if (Array.isArray(ids) && ids.length > 0) {
            setQuickAddIds(ids);
          }
        }
        const savedCols = settings['billing_grid_columns'];
        if (savedCols) {
          const cols = parseInt(savedCols, 10);
          if (!isNaN(cols) && cols >= 2 && cols <= 6) {
            setGridColumns(cols);
          }
        }
      } catch (e) {
        console.error("Failed to load quick add ids", e);
      }
    };
    loadQuickAddIds();
  }, []);

  const handleUpdateQuickAdd = async (newIds: number[]) => {
    try {
      await settingsCommands.set('quick_add_ids', JSON.stringify(newIds));
      setQuickAddIds(newIds);
      // Invalidate the query to refetch with new IDs
      await queryClient.resetQueries({ queryKey: ['billing-products'] });
    } catch (err) {
      console.error("Failed to save quick add settings", err);
    }
  };

  const handleUpdateGridColumns = async (cols: number) => {
    try {
      await settingsCommands.set('billing_grid_columns', cols.toString());
      setGridColumns(cols);
    } catch (err) {
      console.error("Failed to save grid column settings", err);
    }
  };

  const fetchDefaultLocation = async () => {
    try {
      // Import dynamically to avoid SSR issues if any, though 'use client' is set
      const { settingsCommands } = await import('@/lib/tauri');
      const settings = await settingsCommands.getAll();

      // Only set if we found defaults and current location is empty (or just overwrite? User said "default this only in every new invoice i can manually change")
      // So we overwrite on mount.
      if (settings['default_state']) {
        setLocation({
          state: settings['default_state'] || '',
          district: settings['default_district'] || '',
          town: settings['default_town'] || ''
        });
      }
    } catch (err) {
      console.error('Error fetching default location:', err);
    }
  };

  useEffect(() => {
    void fetchDefaultLocation();
  }, []);

  // Customer phone lookup effect
  useEffect(() => {
    const controller = new AbortController();
    const lookup = async () => {
      // Lookup by Phone Number now
      const trimmedPhone = customerPhone.trim();
      if (trimmedPhone.length < 3) { // Start searching after 3 digits
        setCustomerSuggestions([]);
        return;
      }
      try {
        // We use getAll but we filter results on client or use backend search if supported
        // customerCommands.getAll searches name/phone/email
        const result = await customerCommands.getAll(1, 10, trimmedPhone);

        // Filter to prioritize phone matches if generic search
        setCustomerSuggestions(result.items);

        // Auto-fill logic: If exact match on phone, set name
        // (Be careful not to overwrite if user is typing a NEW name for an existing number?)
        // Let's just show suggestions and let user click
      } catch (error) {
        console.error(error);
      }
    };

    const timer = setTimeout(lookup, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [customerPhone]);


  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.stock_quantity) {
        alert('Not enough stock');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (product.stock_quantity < 1) {
        alert('Out of stock');
        return;
      }
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.selling_price || product.price,
          cost_price: product.price, // Store cost price for profit-weighted discount
          quantity: 1,
          max_stock: product.stock_quantity,
        },
      ]);
    }
    setProductSearch('');
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateQuantity = (productId: number, newQty: number) => {
    const item = cart.find((i) => i.product_id === productId);
    if (!item) return;
    if (newQty > item.max_stock) {
      alert('Not enough stock');
      return;
    }
    if (newQty < 1) return;
    setCart(
      cart.map((cartItem) =>
        cartItem.product_id === productId ? { ...cartItem, quantity: newQty } : cartItem
      )
    );
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const taxAmount = subtotal * (taxRate / 100);
    return subtotal + taxAmount - discount;
  };

  // Calculate profit-weighted discount for each item
  // Formula: Product Discount = (Product Profit / Total Profit) × Total Discount
  const calculateWeightedDiscounts = () => {
    if (discount <= 0 || cart.length === 0) return [];

    const itemsWithProfit = cart.map(item => ({
      product_id: item.product_id,
      profit: Math.max(0, (item.unit_price - item.cost_price) * item.quantity)
    }));

    const totalProfit = itemsWithProfit.reduce((sum, item) => sum + item.profit, 0);

    // Edge case: if all items have zero/negative profit, distribute equally
    if (totalProfit <= 0) {
      const equalDiscount = discount / cart.length;
      return cart.map(item => ({ product_id: item.product_id, discount: equalDiscount }));
    }

    // Calculate weighted discount for each product
    return itemsWithProfit.map(item => ({
      product_id: item.product_id,
      discount: (item.profit / totalProfit) * discount
    }));
  };

  // Get discount for a specific item (for UI display)
  const getItemDiscount = (productId: number): number => {
    const discounts = calculateWeightedDiscounts();
    return discounts.find(d => d.product_id === productId)?.discount || 0;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (!customerName) return alert('Customer Name is required');

    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const taxAmount = subtotal * (taxRate / 100);

    let finalCustomerId = selectedCustomerId;

    try {
      // If no customer selected but name provided, create new customer
      if (!finalCustomerId && customerName) {
        const newCustomer = await customerCommands.create({
          name: customerName,
          phone: customerPhone || null,
          email: null,
          address: null,
          place: location.town || null,
          state: location.state || null,
          district: location.district || null,
          town: location.town || null,
        });
        finalCustomerId = newCustomer.id;
      }

      // Calculate weighted discounts for each item
      const weightedDiscounts = calculateWeightedDiscounts();

      const invoiceInput = {
        customer_id: finalCustomerId,
        items: cart.map((item) => {
          const itemDiscount = weightedDiscounts.find(d => d.product_id === item.product_id)?.discount || 0;
          return {
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: itemDiscount, // Per-item weighted discount
          };
        }),
        tax_amount: taxAmount,
        discount_amount: discount,
        payment_method: paymentMethod,
        state: location.state || undefined,
        district: location.district || undefined,
        town: location.town || undefined,
        // Include initial_paid for credit payments
        initial_paid: paymentMethod === 'Credit' ? initialPaid : undefined,
      };

      await invoiceCommands.create(invoiceInput);

      // Record location selection for smart defaults
      if (location.state && location.district && location.town) {
        recordSelection(location);
      }

      // Invalidate queries to refresh data across the app
      await queryClient.invalidateQueries({ queryKey: ['sales'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['customers'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false }); // Update stock levels
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'], exact: false }); // Update KPIs
      await queryClient.invalidateQueries({ queryKey: ['recent-sales'], exact: false }); // Update Dashboard recent sales

      setShowSuccessModal(true);
      setCart([]);
      setDiscount(0);
      setTaxRate(0);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId(null);
      setPaymentMethod('Cash');
      setInitialPaid(0);
      // Invalidate queries to refresh product stock and recent invoices
      await queryClient.invalidateQueries({ queryKey: ['billing-products'] });
      await queryClient.invalidateQueries({ queryKey: ['recent-invoices-billing'] });
    } catch (error) {
      console.error(error);
      alert('Checkout failed: ' + error);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 h-[calc(100vh-6rem)] overflow-hidden">
      {QuickAddModal && (
        <QuickAddModal
          isOpen={showQuickAddSettings}
          onClose={() => setShowQuickAddSettings(false)}
          currentIds={quickAddIds}
          onSave={handleUpdateQuickAdd}
          columns={gridColumns}
          onColumnsChange={handleUpdateGridColumns}
        />
      )}
      <div className="h-full flex flex-col overflow-hidden">
        <div className="card space-y-4 flex-1 overflow-y-auto">
          <h2 className="section-title">Current Bill</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Phone Number - First and Mandatory */}
            <div className="relative">
              <label className="form-label">Phone <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                value={customerPhone}
                onChange={(e) => {
                  const newVal = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setCustomerPhone(newVal);
                  setShowCustomerSuggestions(true);

                  // If a customer was previously selected from suggestions,
                  // changing the phone number should reset the selection and name
                  // to avoid data mismatch (e.g. valid name with invalid/new phone)
                  if (selectedCustomerId) {
                    setSelectedCustomerId(null);
                    setCustomerName('');
                  }
                }}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                placeholder="Enter Phone (10 digits)"
                maxLength={10}
                required
              />
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-[0_12px_30px_-22px_rgba(15,23,42,0.4)] max-h-56 overflow-auto">
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-sky-50"
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone ?? '');
                        setSelectedCustomerId(c.id);
                        setShowCustomerSuggestions(false);
                      }}
                    >
                      <div className="text-left">
                        <span className="font-semibold text-slate-800 block">{c.phone}</span>
                        <span className="text-xs text-slate-500">{c.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Name - Second */}
            <div>
              <label className="form-label">Customer Name <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter Name"
                required
              />
            </div>
          </div>

          <div className="table-container">
            <div className="space-y-2 w-full">
              <div className="grid grid-cols-[1.2fr,0.6fr,0.9fr,0.9fr,0.5fr] md:grid-cols-[1.4fr,0.7fr,1fr,1fr,0.6fr] gap-2 text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-[0.05em]">
                <span className="pl-2">Item</span>
                <span className="text-center">Qty</span>
                <span className="text-center">Price</span>
                <span className="text-center">Total</span>
                <span className="text-center">Action</span>
              </div>
              <div
                className={`divide-y divide-slate-200 dark:divide-slate-700/70 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/70 overflow-hidden ${cart.length > 3 ? 'max-h-48 overflow-y-auto' : ''
                  }`}
              >
                {cart.map((item) => {
                  const itemDiscount = getItemDiscount(item.product_id);
                  const originalTotal = item.unit_price * item.quantity;
                  const finalTotal = originalTotal - itemDiscount;
                  const discountedUnitPrice = item.quantity > 0 ? finalTotal / item.quantity : 0;
                  const hasDiscount = discount > 0 && itemDiscount > 0;

                  return (
                    <div
                      key={item.product_id}
                      className="grid grid-cols-[1.2fr,0.6fr,0.9fr,0.9fr,0.5fr] md:grid-cols-[1.4fr,0.7fr,1fr,1fr,0.6fr] items-center gap-2 px-4 py-3 text-sm md:text-base"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-50 break-words pl-2">
                        {item.name}
                      </span>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.product_id, parseInt(e.target.value, 10))
                        }
                        className="w-14 md:w-16 justify-self-center form-input text-center"
                      />
                      {/* Price column with strikethrough when discounted */}
                      <span className="text-center">
                        {hasDiscount ? (
                          <span className="flex flex-col items-center">
                            <span className="line-through text-slate-400 text-xs">₹{item.unit_price.toFixed(0)}</span>
                            <span className="text-green-600 font-medium">₹{discountedUnitPrice.toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-200">₹{item.unit_price.toFixed(0)}</span>
                        )}
                      </span>
                      {/* Total column with strikethrough when discounted */}
                      <span className="text-center">
                        {hasDiscount ? (
                          <span className="flex flex-col items-center">
                            <span className="line-through text-slate-400 text-xs">₹{originalTotal.toFixed(0)}</span>
                            <span className="text-green-600 font-semibold">₹{finalTotal.toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-slate-50">₹{originalTotal.toFixed(0)}</span>
                        )}
                      </span>
                      <button
                        className="text-danger text-xl justify-self-center font-semibold leading-none"
                        aria-label="Remove item"
                        onClick={() => removeFromCart(item.product_id)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Cart is empty
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Tax Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="form-label">Discount (₹)</label>
              <input
                type="number"
                className="form-input"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="form-label">Payment Method</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  // Reset initial paid when switching away from Credit
                  if (e.target.value !== 'Credit') {
                    setInitialPaid(0);
                  }
                }}
              >
                <option>Cash</option>
                <option>Credit Card</option>
                <option>Online</option>
                <option>UPI</option>
                <option>NetBanking</option>
                <option>Wallet</option>
                <option>Credit</option>
              </select>
            </div>
          </div>

          {/* Credit Payment - Partial Payment Input */}
          {paymentMethod === 'Credit' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-sm">Credit Sale - Customer will pay later</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-amber-800">Amount Paid Now</label>
                  <input
                    type="number"
                    className="form-input"
                    value={initialPaid || ''}
                    onChange={(e) => setInitialPaid(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                    max={calculateTotal()}
                  />
                </div>
                <div>
                  <label className="form-label text-amber-800">Credit Amount</label>
                  <div className="form-input bg-amber-100 text-amber-900 font-semibold">
                    ₹{(calculateTotal() - initialPaid).toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <LocationSelector
            value={location}
            onChange={setLocation}
          />

          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span>₹{calculateTotal().toFixed(0)}</span>
          </div>

          <button className="btn btn-primary w-full" onClick={handleCheckout}>
            Generate Invoice
          </button>

          {/* Recent Invoices Section */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              <h2 className="section-title mb-0">Recent Invoices</h2>
            </div>

            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
              {isRecentInvoicesLoading ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Loading recent invoices...
                </div>
              ) : recentInvoices.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No invoices yet.
                </div>
              ) : (
                recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="space-y-1">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {inv.invoice_number}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{new Date(inv.created_at).toLocaleString()}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-medium">₹{inv.total_amount.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewPdf(inv)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                        title="View Invoice PDF"
                        disabled={generatingPdfId === inv.id}
                      >
                        {generatingPdfId === inv.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(inv)}
                        className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                        title="Share via WhatsApp"
                        disabled={sharingWhatsAppId === inv.id}
                      >
                        {sharingWhatsAppId === inv.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        ) : (
                          <WhatsAppIcon size={20} />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 h-full flex flex-col overflow-hidden px-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title">
            Products {isSearching || productSearch.length >= 2 ? `(${totalSearchCount})` : `(${totalProductCount})`}
          </h2>
          <span className="text-xs text-muted-foreground">Tap to add to cart</span>
        </div>

        <div className="relative">
          <input
            className="form-input"
            placeholder="Search Product (min 2 chars)..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-sky-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {productSearch.length >= 2 ? (
          <div>
            <h3 className="text-lg font-semibold mb-3">Search Results</h3>
            <div className={`grid gap-2.5 max-h-[420px] overflow-y-auto pr-1 ${gridColumns === 2 ? 'grid-cols-2' :
              gridColumns === 3 ? 'grid-cols-2 lg:grid-cols-3' :
                gridColumns === 4 ? 'grid-cols-2 lg:grid-cols-4' :
                  gridColumns === 5 ? 'grid-cols-3 lg:grid-cols-5' :
                    'grid-cols-3 lg:grid-cols-6'
              }`}>
              {searchResults.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`card !p-2 border border-sky-100 text-left hover:-translate-y-0.5 transition ${gridColumns >= 5 ? '!p-1.5' : ''}`}
                  onClick={() => addToCart(product)}
                >
                  <div className="flex flex-col gap-1.5 h-full">
                    <div className="flex gap-2">
                      {gridColumns <= 4 && (
                        <EntityThumbnail
                          entityId={product.id}
                          entityType="product"
                          imagePath={product.image_path}
                          size="sm"
                          className={gridColumns >= 4 ? 'h-8 w-8' : ''}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold truncate leading-tight ${gridColumns >= 4 ? 'text-[10px]' : 'text-xs'}`} title={product.name}>
                          {product.name}
                        </div>
                        {gridColumns <= 3 && (
                          <div className="text-slate-500 text-[10px] truncate">SKU: {product.sku}</div>
                        )}
                      </div>
                    </div>
                    <div className={`flex justify-between items-center pt-1 border-t border-slate-50 mt-auto ${gridColumns >= 5 ? 'gap-1' : ''}`}>
                      <span className={`font-bold text-slate-900 ${gridColumns >= 4 ? 'text-[10px]' : 'text-xs'}`}>
                        ₹{(product.selling_price || product.price).toFixed(0)}
                      </span>
                      <span className={`${product.stock_quantity < 5 ? 'text-red-500' : 'text-emerald-600'} ${gridColumns >= 4 ? 'text-[9px]' : 'text-[10px]'} font-medium`}>
                        {gridColumns >= 5 ? '' : 'Qty: '}{product.stock_quantity}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && !isSearching && (
                <div className="text-muted-foreground">No products found</div>
              )}
              {hasMoreSearch && (
                <div className="col-span-1 md:col-span-2 pt-2">
                  <button
                    onClick={() => fetchNextSearch()}
                    disabled={isFetchingMoreSearch}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 font-medium rounded-md transition-colors"
                  >
                    {isFetchingMoreSearch ? 'Loading...' : `Load More Results (${totalSearchCount - searchResults.length} remaining)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="mb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold whitespace-nowrap">Quick Add</h3>
                  <select
                    className="form-select py-1 px-2 text-sm w-40"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat: string) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  {!selectedCategory && (
                    <button
                      onClick={() => setShowQuickAddSettings(true)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                      title="Customize Quick Add List"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{totalProductCount} total products</p>
            </div>

            <div className={`grid gap-2 flex-1 overflow-y-auto pr-1 ${gridColumns === 2 ? 'grid-cols-2' :
              gridColumns === 3 ? 'grid-cols-2 lg:grid-cols-3' :
                gridColumns === 4 ? 'grid-cols-2 lg:grid-cols-4' :
                  gridColumns === 5 ? 'grid-cols-3 lg:grid-cols-5' :
                    'grid-cols-3 lg:grid-cols-6'
              }`}>
              {isQuickAddLoading && topProducts.length === 0 ? (
                <div className="col-span-full text-center text-sm text-muted-foreground py-6">
                  Loading products...
                </div>
              ) : (
                topProducts.map((product, index) => (
                  <button
                    type="button"
                    key={product.id}
                    className={`card !p-2 text-left hover:-translate-y-0.5 transition relative flex flex-col h-full bg-white group ${gridColumns >= 5 ? '!p-1.5' : ''}`}
                    onClick={() => addToCart(product)}
                  >
                    <div className={`absolute top-1 right-1 flex items-center justify-center rounded-full bg-slate-100 font-bold text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-600 transition-colors ${gridColumns >= 4 ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[10px]'}`}>
                      {quickAddIds.includes(product.id) ? <Pin size={gridColumns >= 4 ? 8 : 10} className="fill-current" /> : index + 1}
                    </div>
                    <div className="flex flex-col gap-1.5 h-full">
                      <div className="flex gap-2">
                        {gridColumns <= 4 && (
                          <EntityThumbnail
                            entityId={product.id}
                            entityType="product"
                            imagePath={product.image_path}
                            size="sm"
                            className={`flex-shrink-0 ${gridColumns >= 4 ? 'h-8 w-8' : 'h-10 w-10'}`}
                          />
                        )}
                        <div className={`flex-1 min-w-0 ${gridColumns <= 3 ? 'pr-4' : ''}`}>
                          <div className={`font-bold text-slate-800 truncate leading-tight group-hover:text-sky-700 ${gridColumns >= 4 ? 'text-[10px]' : 'text-xs'}`} title={product.name}>
                            {product.name}
                          </div>
                          {gridColumns <= 3 && (
                            <div className="text-slate-500 text-[10px] truncate" title={product.sku}>SKU: {product.sku}</div>
                          )}
                        </div>
                      </div>
                      <div className={`flex justify-between items-center pt-1 border-t border-slate-50 mt-auto ${gridColumns >= 5 ? 'gap-1' : ''}`}>
                        <span className={`font-bold text-slate-900 ${gridColumns >= 4 ? 'text-[10px]' : 'text-xs'}`}>
                          ₹{(product.selling_price || product.price).toFixed(0)}
                        </span>
                        <span className={`${product.stock_quantity < 5 ? 'text-red-500' : 'text-emerald-600'} ${gridColumns >= 4 ? 'text-[9px]' : 'text-[10px]'} font-medium`}>
                          {gridColumns >= 5 ? '' : 'Qty: '}{product.stock_quantity}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            {/* Load More for Quick Add */}
            {hasMoreQuickAdd && (
              <div className="pt-2">
                <button
                  onClick={() => fetchNextQuickAdd()}
                  disabled={isFetchingMoreQuickAdd}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 font-medium rounded-md transition-colors"
                >
                  {isFetchingMoreQuickAdd ? 'Loading...' : `Load More Products (${totalProductCount - topProducts.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success Modal */}
      {
        showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Invoice Generated!</h3>
                <p className="text-sm text-slate-500">
                  The invoice has been successfully created and saved.
                </p>
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={() => setShowSuccessModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        )
      }
      <PDFPreviewDialog
        open={showPdfPreview}
        onOpenChange={setShowPdfPreview}
        url={pdfUrl}
        fileName={pdfFileName}
      />
      <PhoneEntryDialog
        open={showPhoneEntry}
        onOpenChange={setShowPhoneEntry}
        onConfirm={handlePhoneEntryConfirm}
      />
    </div >
  );
}
