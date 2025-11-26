'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { purchaseOrderCommands } from '@/lib/tauri';
import type { PurchaseOrderComplete, SupplierPayment } from '@/lib/tauri';

function PurchaseOrderDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [poData, setPoData] = useState<PurchaseOrderComplete | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'Cash',
    note: '',
    paid_at: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (id) {
      void fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      const data = await purchaseOrderCommands.getById(parseInt(id));
      setPoData(data);
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      alert('Failed to fetch purchase order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: 'draft' | 'ordered' | 'received' | 'cancelled') => {
    if (!id) return;

    const receivedDate = newStatus === 'received' ? new Date().toISOString().split('T')[0] : null;

    try {
      await purchaseOrderCommands.updateStatus(parseInt(id), newStatus, receivedDate);
      void fetchData();
      alert(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert(`Failed to update status: ${error}`);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !paymentForm.amount) return;

    try {
      await purchaseOrderCommands.addPayment({
        po_id: parseInt(id),
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method || null,
        note: paymentForm.note || null,
        paid_at: paymentForm.paid_at || null,
      });

      setShowPaymentForm(false);
      setPaymentForm({
        amount: '',
        payment_method: 'Cash',
        note: '',
        paid_at: new Date().toISOString().split('T')[0],
      });
      void fetchData();
      alert('Payment recorded successfully!');
    } catch (error) {
      console.error('Error recording payment:', error);
      alert(`Failed to record payment: ${error}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
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

  if (loading) return <div>Loading...</div>;
  if (!poData) return <div>Purchase Order not found</div>;

  const { purchase_order: po, supplier, items, payments, total_paid, total_pending } = poData;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="page-title">{po.po_number}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(po.status)}`}>
            {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => fetchData()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* PO Details */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Purchase Order Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="font-semibold">{supplier.name}</p>
            {supplier.contact_info && <p className="text-sm text-gray-600">{supplier.contact_info}</p>}
          </div>
          <div>
            <p className="text-sm text-gray-500">Order Date</p>
            <p className="font-semibold">{formatDate(po.order_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Expected Delivery</p>
            <p className="font-semibold">{formatDate(po.expected_delivery_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Received Date</p>
            <p className="font-semibold">{formatDate(po.received_date)}</p>
          </div>
        </div>

        {po.notes && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-sm">{po.notes}</p>
          </div>
        )}

        {/* Status Actions */}
        <div className="mt-4 flex gap-2">
          <p className="text-sm text-gray-500 self-center">Update Status:</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate('ordered')}
            disabled={po.status === 'ordered'}
          >
            Mark as Ordered
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate('received')}
            disabled={po.status === 'received'}
          >
            Mark as Received
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate('cancelled')}
            disabled={po.status === 'cancelled'}
            className="text-red-600 hover:text-red-700"
          >
            Cancel
          </Button>
        </div>
      </Card>

      {/* Items */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Items ({items.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center font-bold text-black">Product</TableHead>
              <TableHead className="text-center font-bold text-black">SKU</TableHead>
              <TableHead className="text-center font-bold text-black">Quantity</TableHead>
              <TableHead className="text-center font-bold text-black">Unit Cost</TableHead>
              <TableHead className="text-center font-bold text-black">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-semibold text-center">{item.product_name}</TableCell>
                <TableCell className="text-center text-gray-600">{item.sku}</TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-center">{formatCurrency(item.unit_cost)}</TableCell>
                <TableCell className="text-center font-semibold">{formatCurrency(item.total_cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-blue-50 rounded-md flex justify-between">
          <span className="font-semibold text-lg">Total Amount:</span>
          <span className="font-bold text-lg text-blue-600">{formatCurrency(po.total_amount)}</span>
        </div>
      </Card>

      {/* Payment Summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Payment Summary</h2>
          <Button
            size="sm"
            onClick={() => setShowPaymentForm(!showPaymentForm)}
            disabled={total_pending <= 0}
          >
            {showPaymentForm ? 'Cancel' : '+ Add Payment'}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-lg font-bold">{formatCurrency(po.total_amount)}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-md">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(total_paid)}</p>
          </div>
          <div className="p-3 bg-orange-50 rounded-md">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(total_pending)}</p>
          </div>
        </div>

        {showPaymentForm && (
          <Card className="p-4 mb-4 bg-gray-50">
            <form onSubmit={handlePaymentSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={total_pending}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Date</label>
                  <Input
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Note</label>
                  <Input
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="mt-3">
                Record Payment
              </Button>
            </form>
          </Card>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <>
            <h3 className="text-md font-semibold mb-2 mt-4">Payment History</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center font-bold text-black">Date</TableHead>
                  <TableHead className="text-center font-bold text-black">Amount</TableHead>
                  <TableHead className="text-center font-bold text-black">Method</TableHead>
                  <TableHead className="text-center font-bold text-black">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-center">{formatDate(payment.paid_at)}</TableCell>
                    <TableCell className="text-center font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-center">{payment.payment_method || '-'}</TableCell>
                    <TableCell className="text-center text-gray-600">{payment.note || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {payments.length === 0 && (
          <p className="text-center text-gray-500 py-4">No payments recorded yet</p>
        )}
      </Card>
    </div>
  );
}

export default function PurchaseOrderDetails() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PurchaseOrderDetailsContent />
    </Suspense>
  );
}
