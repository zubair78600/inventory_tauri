'use client';

import { useDeferredValue, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchPill } from '@/components/shared/SearchPill';
import { purchaseOrderCommands, supplierCommands, productCommands } from '@/lib/tauri';
import type { PurchaseOrderWithDetails, Supplier, Product, PurchaseOrderItemInput } from '@/lib/tauri';

type NewPurchaseOrderForm = {
  supplier_id: number | null;
  items: Array<{
    product_id: number | null;
    quantity: number;
    unit_cost: number;
  }>;
  order_date: string;
  notes: string;
};

export default function PurchaseOrders() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [, startTransition] = useTransition();

  const [newPO, setNewPO] = useState<NewPurchaseOrderForm>({
    supplier_id: null,
    items: [{ product_id: null, quantity: 0, unit_cost: 0 }],
    order_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    void fetchData();
    void fetchSuppliers();
    void fetchProducts();
  }, []);

  useEffect(() => {
    router.prefetch('/inventory');
  }, [router]);

  const fetchData = async () => {
    try {
      const data = await purchaseOrderCommands.getAll();
      startTransition(() => setPurchaseOrders(data));
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      alert('Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await supplierCommands.getAll(1, 100);
      setSuppliers(data.items);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await productCommands.getAll(1, 100);
      setProducts(data.items);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newPO.supplier_id) {
      alert('Please select a supplier');
      return;
    }

    // Validate items
    const validItems = newPO.items.filter(
      item => item.product_id && item.quantity > 0 && item.unit_cost > 0
    );

    if (validItems.length === 0) {
      alert('Please add at least one item with valid product, quantity, and cost');
      return;
    }

    try {
      await purchaseOrderCommands.create({
        supplier_id: newPO.supplier_id,
        items: validItems.map(item => ({
          product_id: item.product_id!,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
        order_date: newPO.order_date || undefined,
        notes: newPO.notes || undefined,
      });

      setShowAddForm(false);
      setNewPO({
        supplier_id: null,
        items: [{ product_id: null, quantity: 0, unit_cost: 0 }],
        order_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      void fetchData();
      alert('Purchase Order created successfully!');
    } catch (error) {
      console.error('Error creating purchase order:', error);
      alert(`Error creating purchase order: ${error}`);
    }
  };

  const addItemRow = () => {
    setNewPO({
      ...newPO,
      items: [...newPO.items, { product_id: null, quantity: 0, unit_cost: 0 }],
    });
  };

  const removeItemRow = (index: number) => {
    setNewPO({
      ...newPO,
      items: newPO.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...newPO.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setNewPO({ ...newPO, items: updatedItems });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-700',
      ordered: 'bg-blue-100 text-blue-700',
      received: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-700';
  };

  const deferredSearch = useDeferredValue(searchTerm);
  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const matchesSearch = !term ||
        po.po_number.toLowerCase().includes(term) ||
        po.supplier_name.toLowerCase().includes(term);

      const matchesStatus = !statusFilter || po.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, deferredSearch, statusFilter]);

  const displayed = useMemo(
    () => (deferredSearch || statusFilter ? filtered : filtered.slice(0, 20)),
    [filtered, deferredSearch, statusFilter]
  );

  if (loading) return <div>Loading...</div>;



  return (
    <div className="space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-5">
          <h1 className="page-title">Purchase Orders</h1>
          <SearchPill
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by PO number or supplier..."
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="ghost" onClick={() => router.push('/inventory')}>
            Back to Inventory
          </Button>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
            }}
          >
            {showAddForm ? 'Cancel' : 'Create Purchase Order'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">New Purchase Order</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Supplier and Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Supplier *</label>
                  <select
                    value={newPO.supplier_id || ''}
                    onChange={(e) => setNewPO({ ...newPO, supplier_id: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Order Date</label>
                  <Input
                    type="date"
                    value={newPO.order_date}
                    onChange={(e) => setNewPO({ ...newPO, order_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label">Items *</label>
                  <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                    + Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {newPO.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <label className="form-label text-xs">Product</label>
                        <select
                          value={item.product_id || ''}
                          onChange={(e) => updateItem(index, 'product_id', parseInt(e.target.value) || null)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          required
                        >
                          <option value="">Select Product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="form-label text-xs">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          required
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="form-label text-xs">Unit Cost (₹)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_cost || ''}
                          onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          required
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItemRow(index)}
                          disabled={newPO.items.length === 1}
                          className="w-full text-xs h-9"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm font-semibold">
                    Total: {formatCurrency(
                      newPO.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Notes</label>
                <Input
                  value={newPO.notes}
                  onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <Button type="submit" className="mt-4">
              Create Purchase Order
            </Button>
          </form>
        </Card>
      )}

      <div className="w-full flex-1 overflow-hidden">
        <Card className="table-container p-0 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="text-center font-bold text-black">PO Number</TableHead>
                  <TableHead className="text-center font-bold text-black">Supplier</TableHead>
                  <TableHead className="text-center font-bold text-black">Order Date</TableHead>
                  <TableHead className="text-center font-bold text-black">Status</TableHead>
                  <TableHead className="text-center font-bold text-black">Items</TableHead>
                  <TableHead className="text-center font-bold text-black">Total Amount</TableHead>
                  <TableHead className="text-center font-bold text-black">Paid</TableHead>
                  <TableHead className="text-center font-bold text-black">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((po) => (
                  <TableRow
                    key={po.id}
                    className="hover:bg-sky-50/60 cursor-pointer"
                    onClick={() => router.push(`/purchase-orders/details?id=${po.id}`)}
                  >
                    <TableCell className="font-semibold text-center text-blue-600">
                      {po.po_number}
                    </TableCell>
                    <TableCell className="text-center">{po.supplier_name}</TableCell>
                    <TableCell className="text-center">{formatDate(po.order_date)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(po.status)}`}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{po.items_count}</TableCell>
                    <TableCell className="text-center font-semibold">{formatCurrency(po.total_amount)}</TableCell>
                    <TableCell className="text-center text-green-600">{formatCurrency(po.total_paid)}</TableCell>
                    <TableCell className="text-center text-orange-600 font-semibold">
                      {formatCurrency(po.total_pending)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No purchase orders found. Create your first purchase order to get started!
        </div>
      )}
    </div>
  );
}
