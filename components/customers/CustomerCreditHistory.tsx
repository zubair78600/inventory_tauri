'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    customerPaymentCommands,
    type CustomerPayment,
    type CustomerInvoiceCreditSummary,
    type CustomerCreditSummary
} from '@/lib/tauri';
import { ask } from '@tauri-apps/plugin-dialog';
import { CreditCard, ChevronDown, ChevronUp, Plus, Trash2, Receipt, CheckCircle2, Clock } from 'lucide-react';

interface CustomerCreditHistoryProps {
    customerId: number;
    onPaymentUpdate?: () => void;
}

export function CustomerCreditHistory({
    customerId,
    onPaymentUpdate
}: CustomerCreditHistoryProps) {
    const [creditHistory, setCreditHistory] = useState<CustomerInvoiceCreditSummary[]>([]);
    const [summary, setSummary] = useState<CustomerCreditSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
    const [invoicePayments, setInvoicePayments] = useState<CustomerPayment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
    const [newPayment, setNewPayment] = useState<{ amount: string; payment_method: string; note: string }>({
        amount: '',
        payment_method: '',
        note: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [customerId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [historyData, summaryData] = await Promise.all([
                customerPaymentCommands.getCreditHistory(customerId),
                customerPaymentCommands.getCreditSummary(customerId),
            ]);
            setCreditHistory(historyData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to load credit history:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadInvoicePayments = async (invoiceId: number) => {
        try {
            setPaymentsLoading(true);
            const payments = await customerPaymentCommands.getByInvoice(invoiceId);
            setInvoicePayments(payments);
        } catch (error) {
            console.error('Failed to load invoice payments:', error);
        } finally {
            setPaymentsLoading(false);
        }
    };

    const toggleInvoice = async (invoiceId: number) => {
        if (expandedInvoiceId === invoiceId) {
            setExpandedInvoiceId(null);
            setInvoicePayments([]);
            setShowPaymentForm(false);
            return;
        }

        setExpandedInvoiceId(invoiceId);
        setSelectedInvoiceId(invoiceId);
        await loadInvoicePayments(invoiceId);
    };

    const handleAddPayment = async () => {
        if (!selectedInvoiceId) return;

        const amountNumber = Number(newPayment.amount);
        if (!amountNumber || Number.isNaN(amountNumber)) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setSaving(true);
            await customerPaymentCommands.create({
                customer_id: customerId,
                invoice_id: selectedInvoiceId,
                amount: amountNumber,
                payment_method: newPayment.payment_method || null,
                note: newPayment.note || null,
            });
            setNewPayment({ amount: '', payment_method: '', note: '' });
            setShowPaymentForm(false);
            await loadData();
            await loadInvoicePayments(selectedInvoiceId);
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
                await customerPaymentCommands.delete(id);
                await loadData();
                if (expandedInvoiceId) {
                    await loadInvoicePayments(expandedInvoiceId);
                }
                if (onPaymentUpdate) onPaymentUpdate();
            } catch (error) {
                console.error('Failed to delete payment:', error);
                alert('Failed to delete payment');
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading credit history...</div>;
    }

    if (!summary || summary.total_credit_amount === 0) {
        return null; // Don't render if no credit history
    }

    return (
        <div className="space-y-4">
            {/* Section Title */}
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-500" />
                Credit History
            </h2>

            {/* Credit History Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr,1.5fr,1fr,1fr,1fr,1fr,0.5fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                    <div>Invoice</div>
                    <div>Date</div>
                    <div>Bill Amount</div>
                    <div>Initial Paid</div>
                    <div>Credit</div>
                    <div>Status</div>
                    <div></div>
                </div>

                <div className="divide-y divide-slate-100">
                    {creditHistory.map((invoice) => (
                        <div key={invoice.invoice_id} className="group">
                            <div
                                className={`grid grid-cols-[2fr,1.5fr,1fr,1fr,1fr,1fr,0.5fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer ${expandedInvoiceId === invoice.invoice_id ? 'bg-slate-50' : ''}`}
                                onClick={() => toggleInvoice(invoice.invoice_id)}
                            >
                                <div className="font-medium text-slate-900 flex items-center justify-center gap-2">
                                    <Receipt className="w-4 h-4 text-slate-400" />
                                    {invoice.invoice_number}
                                </div>
                                <div className="text-slate-500 text-sm text-center">
                                    {new Date(invoice.invoice_date).toLocaleString()}
                                </div>
                                <div className="text-center font-medium text-slate-900">
                                    ₹{invoice.bill_amount.toFixed(0)}
                                </div>
                                <div className="text-center text-slate-500">
                                    ₹{invoice.initial_paid.toFixed(0)}
                                </div>
                                <div className="text-center font-medium">
                                    {invoice.balance_remaining <= 0 ? (
                                        <div className="flex flex-col items-center leading-tight">
                                            <span className="text-amber-600">₹0</span>
                                            <span className="text-[10px] text-emerald-600 font-medium">
                                                Repaid ({invoice.credit_amount.toFixed(0)})
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-amber-600">
                                            ₹{invoice.balance_remaining.toFixed(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-center">
                                    {invoice.balance_remaining <= 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Cleared
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                            <Clock className="w-3 h-3" />
                                            ₹{invoice.balance_remaining.toFixed(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-center">
                                    {expandedInvoiceId === invoice.invoice_id ? (
                                        <ChevronUp className="w-4 h-4 text-slate-400 mx-auto" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Payment History */}
                            {expandedInvoiceId === invoice.invoice_id && (
                                <div className="bg-sky-50 px-4 pb-4 pt-0 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                    <div className="pl-4 pt-4 space-y-4">
                                        {/* Payment History Header */}
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                                <CreditCard className="w-4 h-4 text-slate-500" />
                                                Payment History
                                            </h4>
                                            <Button
                                                size="sm"
                                                variant={showPaymentForm ? 'outline' : 'default'}
                                                className="h-8 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
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
                                            <Card className="p-4 bg-white border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                    <div>
                                                        <label className="text-xs font-medium mb-1.5 block">Amount</label>
                                                        <Input
                                                            type="number"
                                                            placeholder={`Max: ₹${invoice.balance_remaining.toFixed(0)}`}
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
                                            <div className="grid grid-cols-[1.5fr,1fr,1fr,2fr,0.5fr] gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                                                <div>Date</div>
                                                <div className="text-right">Amount</div>
                                                <div className="text-center">Mode</div>
                                                <div>Note</div>
                                                <div></div>
                                            </div>
                                            <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                                                {paymentsLoading ? (
                                                    <div className="p-4 text-center text-slate-500 text-sm">Loading payments...</div>
                                                ) : invoicePayments.length === 0 ? (
                                                    <div className="p-6 text-center text-slate-500 text-sm">No payments recorded yet.</div>
                                                ) : (
                                                    invoicePayments.map((payment) => (
                                                        <div key={payment.id} className="grid grid-cols-[1.5fr,1fr,1fr,2fr,0.5fr] gap-2 p-3 items-center text-sm hover:bg-slate-50">
                                                            <div className="text-slate-500 text-xs">
                                                                {new Date(payment.paid_at).toLocaleDateString()} {new Date(payment.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <div className="font-medium text-emerald-600 text-right">
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
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeletePayment(payment.id);
                                                                    }}
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
                            )}
                        </div>
                    ))}
                    {creditHistory.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No credit invoices found for this customer.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
