'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { productCommands, invoiceCommands, supplierCommands, purchaseOrderCommands, type Product, type Invoice, type SupplierPayment, type SupplierPaymentWithDetails, type SupplierPaymentSummary, type ProductSalesSummary, type PurchaseOrderItemWithProduct, type ProductPurchaseSummary } from '@/lib/tauri';
import { generateProductDetailPDF } from '@/lib/pdf-generator';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ask } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Calendar, Package, Tag, BarChart3, FileText, ChevronDown, ChevronUp, ShoppingCart, Boxes, TrendingUp, Wallet, CheckCircle2 } from 'lucide-react';
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { EntityImagePreviewModal } from '@/components/shared/ImagePreviewModal';

function InventoryDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [product, setProduct] = useState<Product | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [purchaseHistory, setPurchaseHistory] = useState<PurchaseOrderItemWithProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payments, setPayments] = useState<SupplierPaymentWithDetails[]>([]);
    const [paymentSummary, setPaymentSummary] = useState<SupplierPaymentSummary | null>(null);
    const [salesSummary, setSalesSummary] = useState<ProductSalesSummary | null>(null);
    const [purchaseSummary, setPurchaseSummary] = useState<ProductPurchaseSummary | null>(null);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [newPayment, setNewPayment] = useState<{ amount: string; payment_method: string; note: string }>({
        amount: '',
        payment_method: '',
        note: '',
    });
    const [savingPayment, setSavingPayment] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('');
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [supplierName, setSupplierName] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productData, invoicesData, salesData, purchasesData, purchaseSummaryData] = await Promise.all([
                productCommands.getById(id),
                invoiceCommands.getByProduct(id),
                invoiceCommands.getProductSalesSummary(id),
                purchaseOrderCommands.getProductPurchaseHistory(id),
                invoiceCommands.getProductPurchaseSummary(id),
            ]);
            setProduct(productData);
            setInvoices(invoicesData);
            setSalesSummary(salesData);
            setPurchaseHistory(purchasesData);
            setPurchaseSummary(purchaseSummaryData);

            // Fetch supplier name if exists
            if (productData.supplier_id) {
                try {
                    const supplier = await supplierCommands.getById(productData.supplier_id);
                    setSupplierName(supplier.name);
                } catch (err) {
                    console.error('Failed to load supplier', err);
                }
            } else {
                setSupplierName(null);
            }

            // Fetch payments and summary globally (all suppliers)
            try {
                const [paymentsData, summaryData] = await Promise.all([
                    supplierCommands.getAllProductPayments(productData.id),
                    supplierCommands.getAllProductPaymentSummary(productData.id),
                ]);
                setPayments(paymentsData);
                setPaymentSummary(summaryData);
            } catch (paymentErr) {
                console.error('Failed to load payment details', paymentErr);
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

    type PurchaseRow = {
        key: string;
        type: 'initial' | 'po';
        date: string;
        quantity: number;
        unit_cost: number;
        total_cost: number;
        selling_price?: number;
        sold_qty?: number;
        sold_revenue?: number;
        po_id?: number;
        po_number?: string;
    };

    const displayPurchaseHistory: PurchaseRow[] = purchaseHistory.map((purchase) => ({
        key: purchase.po_id ? `po-${purchase.id}` : 'initial-stock', // Use unique key
        type: purchase.po_id ? 'po' : 'initial',
        id: purchase.id,
        date: purchase.created_at,
        quantity: purchase.quantity,
        unit_cost: purchase.unit_cost,
        total_cost: purchase.total_cost,
        selling_price: purchase.selling_price || undefined, // Coerce null to undefined
        sold_qty: purchase.quantity_sold || undefined,
        sold_revenue: purchase.sold_revenue || undefined,
        po_id: purchase.po_id || undefined,
        po_number: purchase.po_number || undefined,
    }));

    return (
        <div className="-mt-8 pt-2.5 px-6 pb-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                {/* Row 1: Buttons and Date */}
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:pl-2 transition-all">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inventory
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                const url = await generateProductDetailPDF(product);
                                setPdfUrl(url);
                                setPdfFileName(`${product.name.replace(/\s+/g, '_')}_Details.pdf`);
                                setShowPdfPreview(true);
                            }}
                        >
                            Export PDF
                        </Button>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center justify-end gap-1">
                            <Calendar className="w-4 h-4" />
                            Added {new Date(product.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Row 2: Title and Image */}
                <div className="flex items-center justify-between gap-5">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
                        <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                            <div className="flex items-center gap-1">
                                <Tag className="w-4 h-4" /> SKU: {product.sku}
                            </div>
                            {product.supplier_id && (
                                <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600" onClick={() => router.push(`/suppliers/details?id=${product.supplier_id}`)}>
                                    <Package className="w-4 h-4" /> {supplierName || `Supplier #${product.supplier_id}`}
                                </div>
                            )}
                        </div>
                    </div>
                    <EntityThumbnail
                        entityId={product.id}
                        entityType="product"
                        imagePath={product.image_path}
                        size="lg"
                        className="w-24 h-24 rounded-lg shadow-sm border border-slate-200"
                        onClick={() => setShowImagePreview(true)}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Stock Purchased</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                        {purchaseSummary?.total_quantity ?? product.initial_stock ?? product.stock_quantity}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Units (all POs)</div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Stock Amount</div>
                    <div className="text-2xl font-bold text-indigo-600 mt-1">
                        ₹{(purchaseSummary?.total_value ?? ((product.initial_stock ?? product.stock_quantity) * product.price)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        {paymentSummary ? (
                            paymentSummary.pending_amount > 0 ? (
                                <span className="text-red-500 font-medium">Pending: ₹{paymentSummary.pending_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            ) : (
                                <span className="text-emerald-600 font-medium">Cleared</span>
                            )
                        ) : (
                            'Purchase value'
                        )}
                    </div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Current Stock</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                        {product.stock_quantity}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Units</div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Selling Price</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                        ₹{product.selling_price ? product.selling_price.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Per unit</div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Total Sales Count</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                        {totalInvoices}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Invoices</div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center rounded-xl">
                    <div className="text-sm text-slate-500 font-medium">Total Amount Sold</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                        ₹{(salesSummary?.total_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs font-medium text-emerald-600 mt-1">
                        ACT. PROFIT - ₹{purchaseHistory.reduce((sum, item) => sum + ((item.sold_revenue || 0) - ((item.quantity_sold || 0) * item.unit_cost)), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                </Card>
            </div>

            {/* Purchase History Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Purchase History
                </h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[1fr,1.2fr,0.8fr,1fr,1fr,1fr,1fr,0.8fr,0.8fr,0.6fr] gap-3 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                        <div>Purchase Date</div>
                        <div>PO Number</div>
                        <div>Qty</div>
                        <div>Unit Cost</div>
                        <div>Sell Price</div>
                        <div>Total Cost</div>
                        <div>Exp. Profit</div>
                        <div>Act. Profit</div>
                        <div>Sold Amt</div>
                        <div>View</div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                        {displayPurchaseHistory.map((purchase) => {
                            const expectedProfit = purchase.selling_price
                                ? (purchase.quantity * purchase.selling_price) - purchase.total_cost
                                : 0;
                            const soldQty = purchase.sold_qty || 0;
                            const soldRevenue = purchase.sold_revenue || 0;
                            const actualProfit = soldRevenue - (soldQty * purchase.unit_cost);

                            return (
                                <div
                                    key={purchase.key}
                                    className="grid grid-cols-[1fr,1.2fr,0.8fr,1fr,1fr,1fr,1fr,0.8fr,0.8fr,0.6fr] gap-3 p-4 items-center hover:bg-slate-50 transition-colors"
                                >
                                    <div className="text-slate-500 text-sm text-center">
                                        {new Date(purchase.date).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>
                                    <div className={`font-medium text-center ${purchase.type === 'po' ? 'text-blue-600' : 'text-slate-600'}`}>
                                        {purchase.po_number || (purchase.type === 'po' && purchase.po_id
                                            ? `PO-${purchase.po_id.toString().padStart(3, '0')}`
                                            : 'Initial Stock')}
                                    </div>
                                    <div className="text-center font-medium text-slate-900">
                                        {purchase.quantity}
                                    </div>
                                    <div className="text-center text-slate-700">
                                        ₹{purchase.unit_cost.toFixed(2)}
                                    </div>
                                    <div className="text-center text-slate-700">
                                        {purchase.selling_price ? `₹${purchase.selling_price.toFixed(2)}` : '-'}
                                    </div>
                                    <div className="text-center font-semibold text-slate-700">
                                        ₹{purchase.total_cost.toFixed(2)}
                                    </div>
                                    <div className="text-center">
                                        <Badge className={`${expectedProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                                            ₹{expectedProfit.toFixed(0)}
                                        </Badge>
                                    </div>
                                    <div className="text-center">
                                        <Badge className={`${actualProfit >= 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                                            ₹{actualProfit.toFixed(0)}
                                        </Badge>
                                    </div>
                                    <div className="text-center font-medium text-slate-900">
                                        ₹{soldRevenue.toFixed(0)}
                                    </div>
                                    <div className="text-center">
                                        {purchase.type === 'po' && purchase.po_id ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => router.push(`/purchase-orders/details?id=${purchase.po_id}`)}
                                            >
                                                View PO
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-slate-400">-</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {displayPurchaseHistory.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No purchase history found. Stock may have been added before the Purchase Order system was implemented.
                            </div>
                        )}
                    </div>
                    {/* Purchase History Footer */}
                    <div className="grid grid-cols-[1fr,1.2fr,0.8fr,1fr,1fr,1fr,1fr,0.8fr,0.8fr,0.6fr] gap-3 p-4 bg-slate-100 border-t border-slate-200 text-sm font-bold text-slate-900 items-center rounded-b-xl">
                        <div className="col-span-2 text-right pr-4 text-slate-500 text-xs uppercase tracking-wider">Total</div>
                        <div className="text-center">{displayPurchaseHistory.reduce((s, i) => s + i.quantity, 0)}</div>
                        <div className="col-span-2"></div>
                        <div className="text-center">₹{displayPurchaseHistory.reduce((s, i) => s + i.total_cost, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                        <div className="text-center">₹{displayPurchaseHistory.reduce((s, i) => s + (i.selling_price ? (i.quantity * i.selling_price) - i.total_cost : 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                        <div className="text-center">₹{displayPurchaseHistory.reduce((s, i) => s + ((i.sold_revenue || 0) - ((i.sold_qty || 0) * i.unit_cost)), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                        <div className="text-center">₹{displayPurchaseHistory.reduce((s, i) => s + (i.sold_revenue || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                        <div></div>
                    </div>
                </div>
            </div>

            {/* Payment History Section (global) */}
            {
                paymentSummary && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-slate-900">Payment History</h2>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-[1.2fr,1.5fr,1fr,1fr,2fr,0.9fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                                <div>Paid At</div>
                                <div>Supplier</div>
                                <div>Amount</div>
                                <div>Mode</div>
                                <div>Note</div>
                                <div>Actions</div>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="grid grid-cols-[1.2fr,1.5fr,1fr,1fr,2fr,0.9fr] gap-4 p-3 items-center text-sm"
                                    >
                                        <div className="text-slate-500 text-center">
                                            {new Date(payment.paid_at).toLocaleString()}
                                        </div>
                                        <div className="font-medium text-slate-700 text-center truncate" title={payment.supplier_name}>
                                            {payment.supplier_name}
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
                                            <span className="text-xs text-slate-400">-</span>
                                        </div>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <div className="p-6 text-center text-slate-500">
                                        No payments recorded for this product yet.
                                    </div>
                                )}
                            </div>
                            {/* Payment History Footer */}
                            <div className="grid grid-cols-[1.2fr,1.5fr,1fr,1fr,2fr,0.9fr] gap-4 p-4 bg-slate-100 border-t border-slate-200 text-sm font-bold text-slate-900 items-center rounded-b-xl">
                                <div className="col-span-2 text-right pr-4 text-slate-500 text-xs uppercase tracking-wider">Total</div>
                                <div className="text-center">₹{payments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                <div className="col-span-3"></div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Sales History Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Sales History</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[1.2fr,2fr,1fr,1fr,1fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                        <div>Sale Date</div>
                        <div>Invoice</div>
                        <div>Quantity</div>
                        <div>Total Amount</div>
                        <div>Payment</div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                        {invoices.map((invoice) => (
                            <div
                                key={invoice.id}
                                className="grid grid-cols-[1.2fr,2fr,1fr,1fr,1fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors"
                            >
                                <div className="text-slate-500 text-sm text-center">
                                    {new Date(invoice.created_at).toLocaleString()}
                                </div>
                                <div
                                    className={`font-medium text-center flex items-center justify-center gap-2 ${invoice.customer_id ? 'text-blue-600 cursor-pointer hover:underline' : 'text-slate-900'}`}
                                    onClick={(e) => {
                                        if (invoice.customer_id) {
                                            e.stopPropagation();
                                            router.push(`/customers/details?id=${invoice.customer_id}`);
                                        }
                                    }}
                                >
                                    <FileText className={`w-4 h-4 ${invoice.customer_id ? 'text-blue-600' : 'text-slate-400'}`} />
                                    {invoice.invoice_number}
                                </div>
                                <div className="text-center font-medium text-slate-900">
                                    {invoice.quantity || '-'}
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
                    {/* Sales History Footer */}
                    <div className="grid grid-cols-[1.2fr,2fr,1fr,1fr,1fr] gap-4 p-4 bg-slate-100 border-t border-slate-200 text-sm font-bold text-slate-900 items-center rounded-b-xl">
                        <div className="col-span-2 text-right pr-4 text-slate-500 text-xs uppercase tracking-wider">Total</div>
                        <div className="text-center">{invoices.reduce((s, i) => s + (i.quantity || 0), 0)}</div>
                        <div className="text-center">₹{invoices.reduce((s, i) => s + i.total_amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                        <div></div>
                    </div>
                </div>
            </div>
            <PDFPreviewDialog
                open={showPdfPreview}
                onOpenChange={setShowPdfPreview}
                url={pdfUrl}
                fileName={pdfFileName}
            />
            {product && (
                <EntityImagePreviewModal
                    open={showImagePreview}
                    onOpenChange={setShowImagePreview}
                    entityId={product.id}
                    entityType="product"
                    entityName={product.name}
                    onImageUpdate={(path) => product && setProduct({ ...product, image_path: path })}
                />
            )}
        </div >
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
