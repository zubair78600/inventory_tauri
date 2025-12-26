'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    supplierCommands,
    type SupplierPayment,
    type SupplierPaymentSummary,
    type PurchaseOrderItemWithProduct
} from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';

interface SupplierProductPaymentModalProps {
    productId: number;
    supplierId: number;
    productName: string;
    isOpen: boolean;
    onClose: () => void;
}

export function SupplierProductPaymentModal({
    productId,
    supplierId,
    productName,
    isOpen,
    onClose,
}: SupplierProductPaymentModalProps) {
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrderItemWithProduct[]>([]);
    const [summary, setSummary] = useState<SupplierPaymentSummary | null>(null);
    const [loading, setLoading] = useState(false);

    // Tab state: 'purchase' (default) or 'payment'
    const [activeTab, setActiveTab] = useState<'purchase' | 'payment'>('purchase');

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [newPayment, setNewPayment] = useState<{ amount: string; payment_method: string; note: string }>({
        amount: '',
        payment_method: '',
        note: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && productId && supplierId) {
            loadData();
            setActiveTab('purchase'); // Reset to default on open
            setShowPaymentForm(false);
        }
    }, [isOpen, productId, supplierId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [paymentsData, summaryData, purchaseData] = await Promise.all([
                supplierCommands.getPayments(supplierId, productId),
                supplierCommands.getPaymentSummary(supplierId, productId),
                supplierCommands.getSupplierProductPurchaseHistory(supplierId, productId),
            ]);
            setPayments(paymentsData);
            setSummary(summaryData);
            setPurchaseHistory(purchaseData);
        } catch (error) {
            console.error('Failed to load details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPayment = async () => {
        const amountNumber = Number(newPayment.amount);
        if (!amountNumber || Number.isNaN(amountNumber)) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setSaving(true);
            await supplierCommands.addPayment({
                supplier_id: supplierId,
                product_id: productId,
                amount: amountNumber,
                payment_method: newPayment.payment_method || null,
                note: newPayment.note || null,
            });
            setNewPayment({ amount: '', payment_method: '', note: '' });
            setShowPaymentForm(false);
            await loadData();
        } catch (error) {
            console.error('Failed to add payment:', error);
            alert('Failed to save payment');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePayment = async (id: number) => {
        const confirm = await ask('Are you sure you want to delete this payment record?', {
            title: 'Delete Payment',
            kind: 'warning',
            okLabel: 'Delete',
            cancelLabel: 'Cancel',
        });

        if (confirm) {
            try {
                await supplierCommands.deletePayment(id);
                await loadData();
            } catch (error) {
                console.error('Failed to delete payment:', error);
                alert('Failed to delete payment');
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
                <DialogHeader>
                    <DialogTitle>{productName}</DialogTitle>
                    <DialogDescription>
                        Manage payments and view purchase history for this product from this supplier.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                    {/* Summary Cards (Visible for both) */}
                    {summary ? (
                        <div className="grid grid-cols-3 gap-3">
                            <Card className="p-3 text-center bg-slate-50">
                                <div className="text-xs text-slate-500 font-medium uppercase">Total Payable</div>
                                <div className="text-lg font-bold text-slate-900 mt-1">₹{summary.total_payable.toFixed(0)}</div>
                            </Card>
                            <Card className="p-3 text-center bg-slate-50">
                                <div className="text-xs text-slate-500 font-medium uppercase">Total Paid</div>
                                <div className="text-lg font-bold text-emerald-600 mt-1">₹{summary.total_paid.toFixed(0)}</div>
                            </Card>
                            <Card className="p-3 text-center bg-slate-50">
                                <div className="text-xs text-slate-500 font-medium uppercase">Pending</div>
                                <div className={`text-lg font-bold mt-1 ${summary.pending_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                    {summary.pending_amount > 0 ? `₹${summary.pending_amount.toFixed(0)}` : 'Cleared'}
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <div className="text-center text-sm text-slate-500">Loading summary...</div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'purchase'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            onClick={() => setActiveTab('purchase')}
                        >
                            Purchase History (Stock)
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payment'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            onClick={() => setActiveTab('payment')}
                        >
                            Payment History
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-4">
                        {activeTab === 'purchase' ? (
                            <div className="space-y-4">
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-[1.5fr,1.5fr,1fr,1fr,1fr] gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                                        <div>Date</div>
                                        <div>SKU</div>
                                        <div className="text-right">Quantity</div>
                                        <div className="text-right">Unit Cost</div>
                                        <div className="text-right">Total Cost</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 bg-white max-h-[400px] overflow-y-auto">
                                        {purchaseHistory.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 text-sm">
                                                No purchase history found for this supplier.
                                            </div>
                                        ) : (
                                            purchaseHistory.map((item) => (
                                                <div key={item.id} className="grid grid-cols-[1.5fr,1.5fr,1fr,1fr,1fr] gap-2 p-3 items-center text-sm hover:bg-slate-50">
                                                    <div className="text-slate-900 font-medium">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-slate-500 text-xs font-mono">{item.sku}</div>
                                                    <div className="text-slate-900 text-right">{item.quantity}</div>
                                                    <div className="text-slate-900 text-right">₹{item.unit_cost.toFixed(2)}</div>
                                                    <div className="text-slate-900 text-right font-medium">₹{item.total_cost.toFixed(2)}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Actions */}
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        variant={showPaymentForm ? 'outline' : 'default'}
                                        onClick={() => {
                                            if (summary && summary.pending_amount <= 0 && !showPaymentForm) {
                                                ask('All payments are cleared. Add an advance payment?', {
                                                    title: 'Payments Cleared',
                                                    kind: 'info',
                                                    okLabel: 'Yes',
                                                    cancelLabel: 'Cancel'
                                                }).then(yes => {
                                                    if (yes) setShowPaymentForm(true);
                                                });
                                                return;
                                            }
                                            setShowPaymentForm(!showPaymentForm);
                                        }}
                                    >
                                        {showPaymentForm ? 'Cancel' : 'Add Payment'}
                                    </Button>
                                </div>

                                {/* Payment Form */}
                                {showPaymentForm && (
                                    <Card className="p-4 bg-white border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">Amount</label>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter amount"
                                                    value={newPayment.amount}
                                                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">Payment Mode</label>
                                                <Select
                                                    value={newPayment.payment_method}
                                                    onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                                                >
                                                    <option value="">Select mode</option>
                                                    <option value="Cash">Cash</option>
                                                    <option value="UPI">UPI</option>
                                                    <option value="Card">Card</option>
                                                    <option value="Bank Transfer">Bank Transfer</option>
                                                    <option value="Other">Other</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium mb-1 block">Note</label>
                                                <Input
                                                    placeholder="Optional note"
                                                    value={newPayment.note}
                                                    onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                                                />
                                            </div>
                                            <Button className="w-full" onClick={handleAddPayment} disabled={saving}>
                                                {saving ? 'Saving...' : 'Save Payment'}
                                            </Button>
                                        </div>
                                    </Card>
                                )}

                                {/* History Table */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr,0.5fr] gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                                        <div>Date</div>
                                        <div className="text-right">Amount</div>
                                        <div className="text-center">Mode</div>
                                        <div>Note</div>
                                        <div></div>
                                    </div>
                                    <div className="divide-y divide-slate-100 bg-white max-h-[300px] overflow-y-auto">
                                        {payments.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-500">No payments found.</div>
                                        ) : (
                                            payments.map((payment) => (
                                                <div key={payment.id} className="grid grid-cols-[1.5fr,1fr,1fr,1fr,0.5fr] gap-2 p-3 items-center text-sm">
                                                    <div className="text-slate-500 text-xs">
                                                        {new Date(payment.paid_at).toLocaleDateString()} {new Date(payment.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="font-medium text-slate-900 text-right">
                                                        ₹{payment.amount.toFixed(0)}
                                                    </div>
                                                    <div className="text-slate-500 text-center text-xs">
                                                        {payment.payment_method || '-'}
                                                    </div>
                                                    <div className="text-slate-500 text-xs truncate" title={payment.note || ''}>
                                                        {payment.note || '-'}
                                                    </div>
                                                    <div className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-400 hover:text-red-600"
                                                            onClick={() => handleDeletePayment(payment.id)}
                                                            title="Delete Payment"
                                                        >
                                                            <span className="sr-only">Delete</span>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
