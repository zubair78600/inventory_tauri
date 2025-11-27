'use client';

import type { Product } from '@/types';
import { useEffect, useState } from 'react';
import { productCommands, customerCommands, invoiceCommands } from '@/lib/tauri';
import { LocationSelector } from '@/components/shared/LocationSelector';
import { useLocationDefaults } from '@/hooks/useLocationDefaults';

type CartItem = {
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
};

export default function Billing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerSuggestions, setCustomerSuggestions] = useState<
    { id: number; name: string; phone?: string | null }[]
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
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

  const fetchProducts = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await productCommands.getAll();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProducts(true);
  }, []);

  useEffect(() => {
    if (productSearch.length >= 2) {
      const search = productSearch.toLowerCase();
      const filtered = products.filter(
        (p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [productSearch, products]);

  useEffect(() => {
    const controller = new AbortController();
    const lookup = async () => {
      const trimmed = customerName.trim();
      if (trimmed.length < 2) {
        setCustomerSuggestions([]);
        return;
      }
      try {
        const data = await customerCommands.getAll(trimmed);
        setCustomerSuggestions(data);
      } catch (error) {
        console.error(error);
      }
    };

    const timer = setTimeout(lookup, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [customerName]);

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
          place: null,
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

      setShowSuccessModal(true);
      setCart([]);
      setDiscount(0);
      setTaxRate(0);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId(null);
      await fetchProducts();
    } catch (error) {
      console.error(error);
      alert('Checkout failed: ' + error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="card space-y-4">
          <h2 className="section-title">Current Bill</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="form-label">Customer Name</label>
              <input
                className="form-input"
                value={customerName}
                onFocus={() => setShowCustomerSuggestions(true)}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null); // Reset selected ID when typing
                  setShowCustomerSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 120)}
                placeholder="Enter Name"
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
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.phone ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="form-label">Phone (Optional)</label>
              <input
                className="form-input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter Phone"
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
          <h2 className="section-title">Products</h2>
          <span className="text-xs text-muted-foreground">Tap to add to cart</span>
        </div>

        <input
          className="form-input"
          placeholder="Search Product (min 2 chars)..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />

        {productSearch.length >= 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="card border border-sky-100 text-left hover:-translate-y-0.5 transition"
                onClick={() => addToCart(product)}
              >
                <div className="font-semibold">{product.name}</div>
                <div className="text-muted-foreground text-sm">SKU: {product.sku}</div>
                <div className="flex justify-between mt-2 text-sm">
                  <span>₹{(product.selling_price || product.price).toFixed(0)}</span>
                  <span className={product.stock_quantity < 5 ? 'text-danger' : 'text-success'}>
                    Stock: {product.stock_quantity}
                  </span>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-muted-foreground">No products found</div>
            )}
          </div>
        )}

        <h3 className="text-lg font-semibold">All Products</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {products.map((product) => (
            <button
              type="button"
              key={product.id}
              className="card text-left hover:-translate-y-0.5 transition"
              onClick={() => addToCart(product)}
            >
              <div className="font-semibold">{product.name}</div>
              <div className="text-muted-foreground text-sm">SKU: {product.sku}</div>
              <div className="flex justify-between mt-2 text-sm">
                <span>₹{(product.selling_price || product.price).toFixed(0)}</span>
                <span className={product.stock_quantity < 5 ? 'text-danger' : 'text-success'}>
                  Stock: {product.stock_quantity}
                </span>
              </div>
            </button>
          ))}
        </div>
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
