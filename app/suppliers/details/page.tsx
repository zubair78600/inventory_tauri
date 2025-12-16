'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supplierCommands, productCommands, type Supplier, type Product, type SupplierPaymentSummary } from '@/lib/tauri';
import { generateSupplierDetailPDF } from '@/lib/pdf-generator';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, MapPin, Phone, Mail, Package, Building, ChevronUp, ChevronDown } from 'lucide-react';
import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { EntityImagePreviewModal } from '@/components/shared/ImagePreviewModal';
import { SupplierProductInlineDetails } from '@/components/suppliers/SupplierProductInlineDetails';

function SupplierDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [paymentSummaries, setPaymentSummaries] = useState<Record<number, SupplierPaymentSummary | null>>({});
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('');

    const [showImagePreview, setShowImagePreview] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [supplierData, productsData] = await Promise.all([
                supplierCommands.getById(id),
                productCommands.getBySupplier(id),
            ]);
            setSupplier(supplierData);
            setProducts(productsData);

            if (productsData.length > 0) {
                const entries = await Promise.all(
                    productsData.map(async (product) => {
                        try {
                            const summary = await supplierCommands.getPaymentSummary(id, product.id);
                            return [product.id, summary] as const;
                        } catch (err) {
                            console.error('Failed to load payment summary for product', product.id, err);
                            return [product.id, null] as const;
                        }
                    }),
                );
                setPaymentSummaries(Object.fromEntries(entries));
            } else {
                setPaymentSummaries({});
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load supplier details');
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

    if (error || !supplier) {
        return (
            <div className="p-6">
                <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <div className="text-red-500">{error || 'Supplier not found'}</div>
            </div>
        );
    }

    const totalStock = products.reduce((acc, p) => acc + (p.total_purchased_quantity ?? 0), 0);
    const totalValue = products.reduce(
        (acc, p) => acc + p.price * (p.total_purchased_quantity ?? 0),
        0,
    );
    const totalPending = Object.values(paymentSummaries).reduce((sum, summary) => {
        if (!summary) return sum;
        return sum + Math.max(0, summary.pending_amount);
    }, 0);

    return (
        <div className="-mt-8 pt-2.5 px-6 pb-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                {/* Row 1: Buttons and Date */}
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:pl-2 transition-all">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Suppliers
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                const stats = {
                                    totalProducts: products.length,
                                    totalStock,
                                    totalValue,
                                    totalPending
                                };
                                const url = await generateSupplierDetailPDF(supplier, products, stats, paymentSummaries);
                                setPdfUrl(url);
                                setPdfFileName(`${supplier.name.replace(/\s+/g, '_')}_Details.pdf`);
                                setShowPdfPreview(true);
                            }}
                        >
                            Export PDF
                        </Button>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center justify-end gap-1">
                            <Calendar className="w-4 h-4" />
                            Joined {new Date(supplier.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Row 2: Title and Image */}
                <div className="flex items-center justify-between gap-5">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{supplier.name}</h1>
                        <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                            {(supplier.state || supplier.district || supplier.town) && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {[supplier.town, supplier.district, supplier.state].filter(Boolean).join(', ')}
                                </div>
                            )}
                            {supplier.contact_info && (
                                <div className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" /> {supplier.contact_info}
                                </div>
                            )}
                            {supplier.email && (
                                <div className="flex items-center gap-1">
                                    <Mail className="w-4 h-4" /> {supplier.email}
                                </div>
                            )}
                            {supplier.address && (
                                <div className="flex items-center gap-1">
                                    <Building className="w-4 h-4" /> {supplier.address}
                                </div>
                            )}
                        </div>
                    </div>
                    <EntityThumbnail
                        entityId={supplier.id}
                        entityType="supplier"
                        imagePath={supplier.image_path}
                        size="lg"
                        className="w-24 h-24 rounded-lg shadow-sm border border-slate-200"
                        onClick={() => setShowImagePreview(true)}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Products</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{products.length}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Stock</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{totalStock}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Stock Value</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalValue.toFixed(0)}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Pending Amount</div>
                    <div className={`text-2xl font-bold mt-1 ${totalPending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{totalPending.toFixed(0)}
                    </div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Actual Profit</div>
                    <div className="text-2xl font-bold text-emerald-600 mt-1">
                        ₹{products.reduce((acc, p) => acc + ((p.total_sold_amount ?? 0) - ((p.total_sold ?? 0) * p.price)), 0).toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                        Exp: ₹{products.reduce((acc, p) => acc + (((p.selling_price ?? 0) - p.price) * (p.total_purchased_quantity ?? 0)), 0).toFixed(0)}
                    </div>
                </Card>
            </div>

            {/* Products Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Supplied Products</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[1.2fr,2fr,1fr,0.8fr,0.8fr,1.2fr,1.2fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                        <div>Purchased Date</div>
                        <div>Product</div>
                        <div>SKU</div>
                        <div>Stock</div>
                        <div>Price</div>
                        <div>Stock Value</div>
                        <div>Act Profit</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {products.map((product) => {
                            const isExpanded = selectedProduct?.id === product.id;
                            const summary = paymentSummaries[product.id];

                            // Calculate metrics
                            const actualProfit = (product.total_sold_amount ?? 0) - ((product.total_sold ?? 0) * product.price);
                            const expectedProfit = ((product.selling_price ?? 0) - product.price) * (product.total_purchased_quantity ?? 0);

                            return (
                                <div key={product.id}>
                                    <div
                                        className={`grid grid-cols-[1.2fr,2fr,1fr,0.8fr,0.8fr,1.2fr,1.2fr] gap-4 p-4 items-center transition-colors cursor-pointer ${isExpanded ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                                        onClick={() => setSelectedProduct(isExpanded ? null : product)}
                                    >
                                        <div className="text-slate-500 text-sm text-center">
                                            {new Date(product.created_at).toLocaleString()}
                                        </div>
                                        <div className="font-medium text-slate-900 flex items-center justify-center gap-2">
                                            <Package className={`w-4 h-4 ${isExpanded ? 'text-sky-600' : 'text-slate-400'}`} />
                                            {product.name}
                                        </div>
                                        <div className="text-slate-500 text-sm text-center">
                                            {product.sku}
                                        </div>
                                        <div className="text-center font-medium text-slate-900">
                                            {product.total_purchased_quantity ?? 0}
                                        </div>
                                        <div className="text-center text-slate-500">
                                            ₹{product.price.toFixed(0)}
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm font-semibold text-slate-900">
                                                ₹{((product.total_purchased_quantity ?? 0) * product.price).toFixed(0)}
                                            </div>
                                            <div className="text-[11px] mt-0.5">
                                                {(() => {
                                                    if (!summary) {
                                                        return <span className="text-slate-400">-</span>;
                                                    }
                                                    if (summary.pending_amount > 0) {
                                                        return (
                                                            <span className="text-red-600 font-semibold">
                                                                Pending: ₹{summary.pending_amount.toFixed(0)}
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span className="text-emerald-600 font-semibold">
                                                            Cleared
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="text-right pr-4">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="text-center min-w-[80px]">
                                                    <div className="text-sm font-bold text-emerald-600">
                                                        ₹{actualProfit.toFixed(0)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                        Exp: ₹{expectedProfit.toFixed(0)}
                                                    </div>
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-sky-100 animate-in slide-in-from-top-1">
                                            <SupplierProductInlineDetails
                                                productId={product.id}
                                                supplierId={supplier.id}
                                                onPaymentUpdate={() => loadData()} // Refresh parent summaries
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {products.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No products found for this supplier.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <PDFPreviewDialog
                open={showPdfPreview}
                onOpenChange={setShowPdfPreview}
                url={pdfUrl}
                fileName={pdfFileName}
            />
            <EntityImagePreviewModal
                open={showImagePreview}
                onOpenChange={setShowImagePreview}
                entityId={supplier.id}
                entityType="supplier"
                entityName={supplier.name}
                onImageUpdate={(path) => supplier && setSupplier({ ...supplier, image_path: path })}
            />
        </div>
    );
}


export default function SupplierDetailsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        }>
            <SupplierDetailsContent />
        </Suspense>
    );
}
