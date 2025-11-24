'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supplierCommands, productCommands, Supplier, Product } from '@/lib/tauri';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, MapPin, Phone, Mail, Package, FileText, ChevronDown, ChevronUp, Building } from 'lucide-react';

function SupplierDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [supplierData, productsData] = await Promise.all([
                supplierCommands.getById(id),
                productCommands.getBySupplier(id)
            ]);
            setSupplier(supplierData);
            setProducts(productsData);
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

    const totalStock = products.reduce((acc, p) => acc + p.stock_quantity, 0);
    const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock_quantity), 0);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Button variant="ghost" onClick={() => router.back()} className="mb-2 pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Suppliers
                    </Button>
                    <h1 className="text-3xl font-bold text-slate-900">{supplier.name}</h1>
                    <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                        {supplier.town && (
                            <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> {supplier.town}, {supplier.state}
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
                <div className="text-right text-sm text-slate-500">
                    <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-4 h-4" />
                        Joined {new Date(supplier.created_at).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Total Products</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{products.length}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Total Stock</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{totalStock}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Stock Value</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalValue.toFixed(2)}</div>
                </Card>
            </div>

            {/* Products Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Supplied Products</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div>Product</div>
                        <div>SKU</div>
                        <div className="text-right">Price</div>
                        <div className="text-right">Stock</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="grid grid-cols-[2fr,1fr,1fr,1fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => router.push(`/inventory/details?id=${product.id}`)}
                            >
                                <div className="font-medium text-slate-900 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-slate-400" />
                                    {product.name}
                                </div>
                                <div className="text-slate-500 text-sm">
                                    {product.sku}
                                </div>
                                <div className="text-right font-medium text-slate-900">
                                    ₹{product.price.toFixed(2)}
                                </div>
                                <div className="text-right text-slate-500">
                                    {product.stock_quantity}
                                </div>
                            </div>
                        ))}
                        {products.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No products found for this supplier.
                            </div>
                        )}
                    </div>
                </div>
            </div>
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
