'use client';

import type { Product } from '@/types';
import { useEffect, useState } from 'react';
import { productCommands, customerCommands, invoiceCommands } from '@/lib/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { LocationSelector } from '@/components/shared/LocationSelector';
import { useLocationDefaults } from '@/hooks/useLocationDefaults';
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';

type CartItem = {
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
};

export default function Billing() {
  const queryClient = useQueryClient();
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerSuggestions, setCustomerSuggestions] = useState<
    { id: number; name: string; phone?: string | null }[]
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [totalSearchCount, setTotalSearchCount] = useState<number>(0);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [totalProductCount, setTotalProductCount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

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
  const [showQuickAddSettings, setShowQuickAddSettings] = useState(false);
  const importQuickAddSettingsModal = () => import('@/components/billing/QuickAddSettingsModal');
  const [QuickAddModal, setQuickAddModal] = useState<any>(null);

  useEffect(() => {
    // Load the modal component dynamically to avoid circular dependencies if any, or just performance
    importQuickAddSettingsModal().then(mod => setQuickAddModal(() => mod.QuickAddSettingsModal));
  }, []);

  const fetchQuickAddProducts = async () => {
    try {
      const { settingsCommands } = await import('@/lib/tauri');
      const settings = await settingsCommands.getAll();
      const savedIdsJson = settings['quick_add_ids'];

      let ids: number[] = [];
      if (savedIdsJson) {
        try {
          ids = JSON.parse(savedIdsJson);
        } catch (e) {
          console.error("Failed to parse quick add ids", e);
        }
      }

      if (ids.length > 0) {
        setQuickAddIds(ids);
        const products = await productCommands.getByIds(ids);
        setTopProducts(products);
        setTotalProductCount(products.length); // Just display count of Quick Add
      } else {
        // Fallback to top 20 sellers
        const products = await productCommands.getTopSelling(20);
        setTopProducts(products);
        setQuickAddIds(products.map(p => p.id));
        setTotalProductCount(products.length);
      }
    } catch (error) {
      console.error("Error fetching quick add products", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuickAdd = async (newIds: number[]) => {
    setQuickAddIds(newIds);
    // Persist
    try {
      const { settingsCommands } = await import('@/lib/tauri');
      await settingsCommands.set('quick_add_ids', JSON.stringify(newIds));

      // Refresh display
      const products = await productCommands.getByIds(newIds);
      setTopProducts(products);
    } catch (err) {
      console.error("Failed to save quick add settings", err);
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
    void fetchQuickAddProducts();
    void fetchDefaultLocation();
  }, []);

  // Debounced product search
  useEffect(() => {
    const controller = new AbortController();

    const searchProducts = async () => {
      const trimmed = productSearch.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        setTotalSearchCount(0);
        setSearchPage(1);
        setIsSearching(false);
        // If search cleared, show Quick Add list again
        return;
      }

      setIsSearching(true);
      try {
        // Reset to page 1 for new search
        const data = await productCommands.getAll(1, 50, trimmed);
        setSearchResults(data.items);
        setTotalSearchCount(data.total_count);
        setSearchPage(1);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchProducts, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [productSearch]);

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

  const loadMoreSearchResults = async () => {
    const trimmed = productSearch.trim();
    if (trimmed.length < 2) return;

    const nextPage = searchPage + 1;
    try {
      const data = await productCommands.getAll(nextPage, 50, trimmed);
      setSearchResults((prev) => [...prev, ...data.items]);
      setSearchPage(nextPage);
    } catch (error) {
      console.error(error);
    }
  };

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
          place: location.town || null, // Set place to invoice town
        });
        finalCustomerId = newCustomer.id;
      }

      const invoiceInput = {
        customer_id: finalCustomerId,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        tax_amount: taxAmount,
        discount_amount: discount,
        payment_method: paymentMethod,
        state: location.state || undefined,
        district: location.district || undefined,
        town: location.town || undefined,
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
      await fetchQuickAddProducts();
    } catch (error) {
      console.error(error);
      alert('Checkout failed: ' + error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {QuickAddModal && (
        <QuickAddModal
          isOpen={showQuickAddSettings}
          onClose={() => setShowQuickAddSettings(false)}
          currentIds={quickAddIds}
          onSave={handleUpdateQuickAdd}
        />
      )}
      <div>
        <div className="card space-y-4">
          <h2 className="section-title">Current Bill</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Phone Number - First and Mandatory */}
            <div className="relative">
              <label className="form-label">Phone <span className="text-red-500">*</span></label>
              <input
                className="form-input"
                value={customerPhone}
                onChange={(e) => {
                  const newVal = e.target.value;
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
                placeholder="Enter Phone"
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
                className={`divide-y divide-slate-200 dark:divide-slate-700/70 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/70 overflow-hidden ${cart.length > 3 ? 'max-h-60 overflow-y-auto' : ''
                  }`}
              >
                {cart.map((item) => (
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
                    <span className="text-slate-700 dark:text-slate-200 text-center">
                      ₹{item.unit_price.toFixed(0)}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-50 text-center">
                      ₹{(item.unit_price * item.quantity).toFixed(0)}
                    </span>
                    <button
                      className="text-danger text-xl justify-self-center font-semibold leading-none"
                      aria-label="Remove item"
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
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
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option>Cash</option>
                <option>Credit Card</option>
                <option>Online</option>
                <option>UPI</option>
                <option>NetBanking</option>
                <option>Wallet</option>
              </select>
            </div>
          </div>

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
        </div>
      </div>

      <div className="space-y-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {searchResults.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className="card border border-sky-100 text-left hover:-translate-y-0.5 transition"
                  onClick={() => addToCart(product)}
                >
                  <div className="flex gap-3">
                    <EntityThumbnail
                      entityId={product.id}
                      entityType="product"
                      imagePath={product.image_path}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{product.name}</div>
                      <div className="text-muted-foreground text-sm">SKU: {product.sku}</div>
                      <div className="flex justify-between mt-2 text-sm">
                        <span>₹{(product.selling_price || product.price).toFixed(0)}</span>
                        <span className={product.stock_quantity < 5 ? 'text-danger' : 'text-success'}>
                          Stock: {product.stock_quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && !isSearching && (
                <div className="text-muted-foreground">No products found</div>
              )}
              {searchResults.length < totalSearchCount && (
                <div className="col-span-1 md:col-span-2 pt-2">
                  <button
                    onClick={loadMoreSearchResults}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors"
                  >
                    Load More Results
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Quick Add</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowQuickAddSettings(true)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                  title="Customize Quick Add List"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {topProducts.map((product, index) => (
                <button
                  type="button"
                  key={product.id}
                  className="card text-left hover:-translate-y-0.5 transition relative"
                  onClick={() => addToCart(product)}
                >
                  <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                    {index + 1}
                  </div>
                  <div className="flex gap-3">
                    <EntityThumbnail
                      entityId={product.id}
                      entityType="product"
                      imagePath={product.image_path}
                      size="md"
                    />
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="font-semibold truncate">{product.name}</div>
                      <div className="text-muted-foreground text-sm">SKU: {product.sku}</div>
                      <div className="flex justify-between mt-2 text-sm">
                        <span>₹{(product.selling_price || product.price).toFixed(0)}</span>
                        <span className={product.stock_quantity < 5 ? 'text-danger' : 'text-success'}>
                          Stock: {product.stock_quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
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
      )}
    </div>
  );
}
