'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    supplierCommands,
    type SupplierPayment,
    type SupplierPaymentSummary,
    type PurchaseOrderItemWithProduct
} from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';
import { Calendar, Package, CreditCard, ChevronDown, ChevronUp, Plus, Trash2, History } from 'lucide-react';

interface SupplierProductInlineDetailsProps {
    productId: number;
    supplierId: number;
    onPaymentUpdate?: () => void;
}

export function SupplierProductInlineDetails({
    productId,
    supplierId,
    onPaymentUpdate
}: SupplierProductInlineDetailsProps) {
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrderItemWithProduct[]>([]);
    const [summary, setSummary] = useState<SupplierPaymentSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [newPayment, setNewPayment] = useState<{ amount: string; payment_method: string; note: string }>({
        amount: '',
        payment_method: '',
        note: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [productId, supplierId]);

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
            if (onPaymentUpdate) onPaymentUpdate();
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
                if (onPaymentUpdate) onPaymentUpdate();
            } catch (error) {
                console.error('Failed to delete payment:', error);
                alert('Failed to delete payment');
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    }

    return (
        <div className="p-4 bg-sky-50 space-y-6">
            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="p-3 bg-white border-slate-200 shadow-sm text-center">
                        <div className="text-xs text-slate-500 font-medium uppercase">Total Payable</div>
                        <div className="text-lg font-bold text-slate-900 mt-1">₹{summary.total_payable.toFixed(0)}</div>
                    </Card>
                    <Card className="p-3 bg-white border-slate-200 shadow-sm text-center">
                        <div className="text-xs text-slate-500 font-medium uppercase">Total Paid</div>
                        <div className="text-lg font-bold text-emerald-600 mt-1">₹{summary.total_paid.toFixed(0)}</div>
                    </Card>
                    <Card className="p-3 bg-white border-slate-200 shadow-sm text-center">
                        <div className="text-xs text-slate-500 font-medium uppercase">Pending</div>
                        <div className={`text-lg font-bold mt-1 ${summary.pending_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {summary.pending_amount > 0 ? `₹${summary.pending_amount.toFixed(0)}` : 'Cleared'}
                        </div>
                    </Card>
                </div>
            )}

            {/* Purchase History Section */}
            <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    Purchase History (Stock)
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="grid grid-cols-[1.5fr,1.5fr,1fr,1fr,1fr,1fr] gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                        <div>Date</div>
                        <div>PO #</div>
                        <div>SKU</div>
                        <div className="text-right">Quantity</div>
                        <div className="text-right">Unit Cost</div>
                        <div className="text-right">Total Cost</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                        {purchaseHistory.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">
                                No purchase history found.
                            </div>
                        ) : (
                            purchaseHistory.map((item) => (
                                <div key={item.id} className="grid grid-cols-[1.5fr,1.5fr,1fr,1fr,1fr,1fr] gap-2 p-3 items-center text-sm hover:bg-slate-50">
                                    <div className="text-slate-900 font-medium">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-sky-600 font-medium text-xs">
                                        {item.po_number || 'Initial'}
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

            {/* Payment History Section */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                        Payment History
                    </h3>
                    <Button
                        size="sm"
                        variant={showPaymentForm ? 'outline' : 'default'}
                        className="h-8 text-xs"
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
                        {showPaymentForm ? 'Cancel' : (
                            <>
                                <Plus className="w-3 h-3 mr-1" /> Add Payment
                            </>
                        )}
                    </Button>
                </div>

                {/* Payment Form */}
                {showPaymentForm && (
                    <Card className="p-4 bg-white border-slate-200 shadow-sm mb-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="text-xs font-medium mb-1.5 block">Amount</label>
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={newPayment.amount}
                                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1.5 block">Payment Mode</label>
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
                            <div className="md:col-span-1">
                                <label className="text-xs font-medium mb-1.5 block">Note</label>
                                <Input
                                    placeholder="Optional note"
                                    value={newPayment.note}
                                    onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                                />
                            </div>
                            <Button onClick={handleAddPayment} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </Card>
                )}

                {/* Payment Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="grid grid-cols-[1.5fr,1fr,1fr,1fr,2fr,0.5fr] gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                        <div>Date</div>
                        <div>PO #</div>
                        <div className="text-right">Amount</div>
                        <div className="text-center">Mode</div>
                        <div>Note</div>
                        <div></div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                        {payments.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">No payments recorded.</div>
                        ) : (
                            payments.map((payment) => (
                                <div key={payment.id} className="grid grid-cols-[1.5fr,1fr,1fr,1fr,2fr,0.5fr] gap-2 p-3 items-center text-sm hover:bg-slate-50">
                                    <div className="text-slate-500 text-xs">
                                        {new Date(payment.paid_at).toLocaleDateString()} {new Date(payment.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-sky-600 font-medium text-xs">
                                        {payment.po_number || '-'}
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
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
