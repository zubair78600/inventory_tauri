'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { productCommands, invoiceCommands, supplierCommands, Product, Invoice, SupplierPayment, SupplierPaymentSummary, ProductSalesSummary } from '@/lib/tauri';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ask } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Calendar, Package, Tag, BarChart3, FileText, ChevronDown, ChevronUp } from 'lucide-react';

function InventoryDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [product, setProduct] = useState<Product | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [paymentSummary, setPaymentSummary] = useState<SupplierPaymentSummary | null>(null);
    const [salesSummary, setSalesSummary] = useState<ProductSalesSummary | null>(null);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [newPayment, setNewPayment] = useState<{ amount: string; payment_method: string; note: string }>({
        amount: '',
        payment_method: '',
        note: '',
    });
    const [savingPayment, setSavingPayment] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productData, invoicesData, salesData] = await Promise.all([
                productCommands.getById(id),
                invoiceCommands.getByProduct(id),
                invoiceCommands.getProductSalesSummary(id),
            ]);
            setProduct(productData);
            setInvoices(invoicesData);
            setSalesSummary(salesData);

            if (productData.supplier_id) {
                try {
                    const [paymentsData, summaryData] = await Promise.all([
                        supplierCommands.getPayments(productData.supplier_id, productData.id),
                        supplierCommands.getPaymentSummary(productData.supplier_id, productData.id),
                    ]);
                    setPayments(paymentsData);
                    setPaymentSummary(summaryData);
                } catch (paymentErr) {
                    console.error('Failed to load supplier payment details', paymentErr);
                    setPayments([]);
                    setPaymentSummary(null);
                }
            } else {
                setPayments([]);
                setPaymentSummary(null);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load product details');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPayment = async () => {
        if (!product || !product.supplier_id) return;
        const amountNumber = Number(newPayment.amount);
        if (!amountNumber || Number.isNaN(amountNumber)) {
            alert('Please enter a valid amount');
            return;
        }

         // Do not allow adding payments if already cleared
        if (paymentSummary && paymentSummary.pending_amount <= 0) {
            alert('All payments are already cleared for this product.');
            return;
        }

        try {
            setSavingPayment(true);
            await supplierCommands.addPayment({
                supplier_id: product.supplier_id,
                product_id: product.id,
                amount: amountNumber,
                payment_method: newPayment.payment_method || null,
                note: newPayment.note || null,
            });
            setNewPayment({ amount: '', payment_method: '', note: '' });
            setShowPaymentForm(false);
            await loadData();
        } catch (err) {
            console.error(err);
            alert('Failed to save payment');
        } finally {
            setSavingPayment(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="p-6">
                <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <div className="text-red-500">{error || 'Product not found'}</div>
            </div>
        );
    }

    const totalInvoices = salesSummary?.invoice_count ?? invoices.length;

    const isCleared =
        !!product.supplier_id &&
        !!paymentSummary &&
        paymentSummary.pending_amount <= 0;

    // To get accurate "Total Sold" and "Revenue from this product", we would need to inspect invoice items
    // Since we only have the invoice list, we can show "Invoices containing this item"

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Button variant="ghost" onClick={() => router.back()} className="mb-2 pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inventory
                    </Button>
                    <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                        <div className="flex items-center gap-1">
                            <Tag className="w-4 h-4" /> SKU: {product.sku}
                        </div>
                        {product.supplier_id && (
                            <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600" onClick={() => router.push(`/suppliers/details?id=${product.supplier_id}`)}>
                                <Package className="w-4 h-4" /> Supplier #{product.supplier_id}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right text-sm text-slate-500">
                    <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-4 h-4" />
                        Added {new Date(product.created_at).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Stock Purchased</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{product.initial_stock || product.stock_quantity}</div>
                    <div className="text-xs text-slate-400 mt-1">Units</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Stock Amount</div>
                    <div className="text-2xl font-bold text-indigo-600 mt-1">
                        ₹{((product.initial_stock || product.stock_quantity) * product.price).toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        {product.supplier_id && paymentSummary ? (
                            paymentSummary.pending_amount > 0 ? (
                                <span className="text-red-600 font-semibold">
                                    Pending: ₹{paymentSummary.pending_amount.toFixed(0)}
                                </span>
                            ) : (
                                <span className="text-emerald-600 font-semibold">Cleared</span>
                            )
                        ) : (
                            'Purchase value'
                        )}
                    </div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Current Stock</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{product.stock_quantity}</div>
                    <div className="text-xs text-slate-400 mt-1">Units</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Selling Price</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">₹{product.selling_price ? product.selling_price.toFixed(0) : '-'}</div>
                    <div className="text-xs text-slate-400 mt-1">Per unit</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Sales Count</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{totalInvoices}</div>
                    <div className="text-xs text-slate-400 mt-1">Invoices</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Amount Sold</div>
                    <div className="text-2xl font-bold text-sky-600 mt-1">
                        ₹{(salesSummary?.total_amount ?? 0).toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Revenue from this product</div>
                </Card>
            </div>

            {/* Payment History Section (per product/supplier) */}
            {product.supplier_id && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">Payment History</h2>
                        <Button
                            size="sm"
                            variant={showPaymentForm ? 'outline' : 'default'}
                            onClick={async () => {
                                if (isCleared && paymentSummary) {
                                    await ask(
                                        `All payments are already cleared for this product.\n\nTotal Paid: ₹${paymentSummary.total_paid.toFixed(0)}\nTotal Payable: ₹${paymentSummary.total_payable.toFixed(0)}`,
                                        {
                                            title: 'Payments Cleared',
                                            kind: 'info',
                                            okLabel: 'OK',
                                        },
                                    );
                                    return;
                                }
                                setShowPaymentForm(!showPaymentForm);
                            }}
                        >
                            {showPaymentForm ? 'Cancel' : 'Add Payment'}
                        </Button>
                    </div>

                    {showPaymentForm && (
                        <Card className="p-4 bg-white border-slate-200 shadow-sm">
                            {paymentSummary && (
                                <div className="mb-3 text-xs text-slate-500">
                                    Already paid:{' '}
                                    <span className="font-semibold text-slate-700">
                                        ₹{paymentSummary.total_paid.toFixed(0)}
                                    </span>{' '}
                                    of ₹{paymentSummary.total_payable.toFixed(0)}{' '}
                                    {paymentSummary.pending_amount > 0 && (
                                        <span className="text-red-600 font-semibold">
                                            (Pending: ₹{paymentSummary.pending_amount.toFixed(0)})
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="form-label">Amount</label>
                                    <Input
                                        type="number"
                                        value={newPayment.amount}
                                        onChange={(e) =>
                                            setNewPayment({ ...newPayment, amount: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Payment Mode</label>
                                    <Select
                                        value={newPayment.payment_method}
                                        onChange={(e) =>
                                            setNewPayment({
                                                ...newPayment,
                                                payment_method: e.target.value,
                                            })
                                        }
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
                                    <label className="form-label">Note</label>
                                    <Input
                                        value={newPayment.note}
                                        onChange={(e) =>
                                            setNewPayment({ ...newPayment, note: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <Button
                                className="mt-4"
                                disabled={savingPayment}
                                onClick={handleAddPayment}
                            >
                                {savingPayment ? 'Saving...' : 'Save Payment'}
                            </Button>
                        </Card>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="grid grid-cols-[1.7fr,1fr,1fr,2fr,0.9fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                            <div>Paid At</div>
                            <div>Amount</div>
                            <div>Mode</div>
                            <div>Note</div>
                            <div>Actions</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="grid grid-cols-[1.7fr,1fr,1fr,2fr,0.9fr] gap-4 p-3 items-center text-sm"
                                >
                                    <div className="text-slate-500 text-center">
                                        {new Date(payment.paid_at).toLocaleString()}
                                    </div>
                                    <div className="font-medium text-slate-900 text-center">
                                        ₹{payment.amount.toFixed(0)}
                                    </div>
                                    <div className="text-slate-500 text-center">
                                        {payment.payment_method || '-'}
                                    </div>
                                    <div className="text-slate-500 text-center">
                                        {payment.note || '-'}
                                    </div>
                                    <div className="text-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                            onClick={async () => {
                                                const confirmed = await ask(
                                                    'Are you sure you want to delete this payment entry?',
                                                    {
                                                        title: 'Delete Payment',
                                                        kind: 'warning',
                                                        okLabel: 'Delete',
                                                        cancelLabel: 'Cancel',
                                                    },
                                                );
                                                if (!confirmed) return;
                                                await supplierCommands.deletePayment(payment.id);
                                                await loadData();
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {payments.length === 0 && (
                                <div className="p-6 text-center text-slate-500">
                                    No payments recorded for this product yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sales History Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Sales History</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[1.2fr,2fr,1fr,1fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                        <div>Sale Date</div>
                        <div>Invoice</div>
                        <div>Total Amount</div>
                        <div>Payment</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => (
                            <div
                                key={invoice.id}
                                className="grid grid-cols-[1.2fr,2fr,1fr,1fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                <div className="text-slate-500 text-sm text-center">
                                    {new Date(invoice.created_at).toLocaleString()}
                                </div>
                                <div className="font-medium text-slate-900 flex items-center justify-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    {invoice.invoice_number}
                                </div>
                                <div className="text-center font-medium text-slate-900">
                                    ₹{invoice.total_amount.toFixed(0)}
                                </div>
                                <div className="text-center text-slate-500 capitalize">
                                    {invoice.payment_method || '-'}
                                </div>
                            </div>
                        ))}
                        {invoices.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No sales found for this product.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function InventoryDetailsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        }>
            <InventoryDetailsContent />
        </Suspense>
    );
}
