'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { productCommands, invoiceCommands, Product, Invoice } from '@/lib/tauri';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Package, Tag, BarChart3, FileText, ChevronDown, ChevronUp } from 'lucide-react';

function InventoryDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [product, setProduct] = useState<Product | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [productData, invoicesData] = await Promise.all([
                productCommands.getById(id),
                invoiceCommands.getByProduct(id)
            ]);
            setProduct(productData);
            setInvoices(invoicesData);
        } catch (err) {
            console.error(err);
            setError('Failed to load product details');
        } finally {
            setLoading(false);
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

    // Calculate stats from invoices
    // Note: This is an approximation as we don't have the quantity sold per invoice in the list view
    // Ideally we would fetch that or calculate it better, but for now we show invoice count and total revenue of invoices containing this item
    // A better approach would be to have the backend return specific stats for the product
    const totalInvoices = invoices.length;

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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Stock Purchased</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{product.initial_stock || 0}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Current Stock</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{product.stock_quantity}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Selling Price</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">₹{product.selling_price ? product.selling_price.toFixed(2) : '-'}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Total Sales Count</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{totalInvoices}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Total Amount Sold</div>
                    <div className="text-2xl font-bold text-sky-600 mt-1">₹{invoices.reduce((sum, inv) => sum + inv.total_amount, 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-400 mt-1">From {totalInvoices} invoices</div>
                </Card>
            </div>

            {/* Sales History Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Sales History</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[1.2fr,2fr,1fr,1fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div>Sale Date</div>
                        <div>Invoice</div>
                        <div className="text-right">Total Amount</div>
                        <div className="text-right">Payment</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => (
                            <div
                                key={invoice.id}
                                className="grid grid-cols-[1.2fr,2fr,1fr,1fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                            // We don't have a dedicated invoice details page yet, but maybe we can link to billing or sales?
                            // For now just visual
                            >
                                <div className="text-slate-500 text-sm">
                                    {new Date(invoice.created_at).toLocaleString()}
                                </div>
                                <div className="font-medium text-slate-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    {invoice.invoice_number}
                                </div>
                                <div className="text-right font-medium text-slate-900">
                                    ₹{invoice.total_amount.toFixed(2)}
                                </div>
                                <div className="text-right text-slate-500 capitalize">
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
