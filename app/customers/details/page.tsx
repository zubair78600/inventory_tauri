'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { analyticsCommands, invoiceCommands, customerPaymentCommands, type CustomerReport, type Invoice, type InvoiceItem, type CustomerCreditSummary } from '@/lib/tauri';
import { generateCustomerDetailPDF } from '@/lib/pdf-generator';
import { PDFPreviewDialog } from '@/components/shared/PDFPreviewDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, MapPin, Phone, Mail, FileText, Package, ChevronDown, ChevronUp, Home, CreditCard } from 'lucide-react';

import { EntityThumbnail } from '@/components/shared/EntityThumbnail';
import { EntityImagePreviewModal } from '@/components/shared/ImagePreviewModal';
import { CustomerCreditHistory } from '@/components/customers/CustomerCreditHistory';

function CustomerDetailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const id = Number(searchParams.get('id'));

    const [report, setReport] = useState<CustomerReport | null>(null);
    const [creditSummary, setCreditSummary] = useState<CustomerCreditSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('');
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [showCreditDetails, setShowCreditDetails] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadReport();
    }, [id]);

    const loadReport = async () => {
        try {
            setLoading(true);
            const data = await analyticsCommands.getReport(id);
            setReport(data);
            const creditData = await customerPaymentCommands.getCreditSummary(id);
            setCreditSummary(creditData);
        } catch (err) {
            console.error(err);
            setError('Failed to load customer details');
        } finally {
            setLoading(false);
        }
    };

    const toggleInvoice = async (invoiceId: number) => {
        if (expandedInvoiceId === invoiceId) {
            setExpandedInvoiceId(null);
            setInvoiceItems([]);
            return;
        }

        setExpandedInvoiceId(invoiceId);
        setItemsLoading(true);
        try {
            const data = await invoiceCommands.getById(invoiceId);

            // Calculate weighted discount logic for display
            const items = data.items;
            const totalGross = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const globalDiscount = data.invoice.discount_amount || 0;
            const hasPerItemDiscount = items.some(i => (i.discount_amount || 0) > 0);

            const processedItems = items.map(item => {
                let discount = item.discount_amount || 0;
                if (!hasPerItemDiscount && globalDiscount > 0 && totalGross > 0) {
                    const originalGross = item.quantity * item.unit_price;
                    const weight = originalGross / totalGross;
                    discount = weight * globalDiscount;
                }
                return { ...item, discount_amount: discount };
            });

            setInvoiceItems(processedItems);
        } catch (err) {
            console.error(err);
        } finally {
            setItemsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="p-6">
                <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <div className="text-red-500">{error || 'Customer not found'}</div>
            </div>
        );
    }

    const { customer, invoices, stats } = report;

    return (
        <div className="-mt-8 pt-2.5 px-6 pb-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                {/* Row 1: Buttons and Date */}
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:pl-2 transition-all">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                const url = await generateCustomerDetailPDF(customer, invoices, stats);
                                setPdfUrl(url);
                                setPdfFileName(`${customer.name.replace(/\s+/g, '_')}_Details.pdf`);
                                setShowPdfPreview(true);
                            }}
                        >
                            Export PDF
                        </Button>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                        <div className="flex items-center justify-end gap-1">
                            <Calendar className="w-4 h-4" />
                            Joined {new Date(customer.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Row 2: Title and Image */}
                <div className="flex items-center justify-between gap-5">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{customer.name}</h1>
                        <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                            {(customer.town || customer.place) && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" /> {customer.town || customer.place}
                                </div>
                            )}
                            {customer.phone && (
                                <div className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" /> {customer.phone}
                                </div>
                            )}
                            {customer.email && (
                                <div className="flex items-center gap-1">
                                    <Mail className="w-4 h-4" /> {customer.email}
                                </div>
                            )}
                            {customer.address && (
                                <div className="flex items-center gap-1">
                                    <Home className="w-4 h-4" /> {customer.address}
                                </div>
                            )}
                        </div>
                    </div>
                    <EntityThumbnail
                        entityId={customer.id}
                        entityType="customer"
                        imagePath={customer.image_path}
                        size="lg"
                        className="w-24 h-24 rounded-lg shadow-sm border border-slate-200"
                        onClick={() => setShowImagePreview(true)}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Spent</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">₹{stats.total_spent.toFixed(0)}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Total Invoices</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{stats.invoice_count}</div>
                </Card>
                <Card className="p-4 bg-white border-slate-200 shadow-sm text-center">
                    <div className="text-sm text-slate-500 font-medium">Last Billed</div>
                    <div className="text-xl font-semibold text-slate-900 mt-1">
                        {invoices[0] ? new Date(invoices[0].created_at).toLocaleDateString() : 'Never'}
                    </div>
                </Card>
                <Card
                    className="p-4 bg-white border-slate-200 shadow-sm text-center cursor-pointer hover:bg-slate-50 transition-colors relative overflow-hidden"
                    onClick={() => setShowCreditDetails(!showCreditDetails)}
                >
                    <div className="text-sm text-slate-500 font-medium flex items-center justify-center gap-1">
                        Current Credit
                        {showCreditDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>

                    {showCreditDetails && creditSummary ? (
                        <div className="mt-2 text-sm text-slate-600 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                            <div className="flex justify-between items-center px-4">
                                <span>Given:</span>
                                <span className="font-semibold text-amber-600">₹{creditSummary.total_credit_amount.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between items-center px-4">
                                <span>Repaid:</span>
                                <span className="font-semibold text-emerald-600">
                                    ₹{(creditSummary.total_credit_amount - creditSummary.pending_amount).toFixed(0)}
                                </span>
                            </div>
                            <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between items-center px-4 font-bold">
                                <span>Pending:</span>
                                <span>₹{creditSummary.pending_amount.toFixed(0)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xl font-semibold text-amber-600 mt-1">
                            ₹{creditSummary?.pending_amount.toFixed(0) || '0'}
                        </div>
                    )}
                </Card>
            </div>

            {/* Credit History Section */}
            <CustomerCreditHistory customerId={id} onPaymentUpdate={loadReport} />

            {/* Invoices Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Invoice History</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[2fr,1.5fr,1fr,1fr,1fr,0.5fr] gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-black uppercase tracking-wider text-center">
                        <div>Invoice</div>
                        <div>Date</div>
                        <div>Amount</div>
                        <div>Items</div>
                        <div>Discount</div>
                        <div></div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="group">
                                <div
                                    className={`grid grid-cols-[2fr,1.5fr,1fr,1fr,1fr,0.5fr] gap-4 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer ${expandedInvoiceId === invoice.id ? 'bg-slate-50' : ''}`}
                                    onClick={() => toggleInvoice(invoice.id)}
                                >
                                    <div className="font-medium text-slate-900 flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        {invoice.invoice_number}
                                    </div>
                                    <div className="text-slate-500 text-sm text-center">
                                        {new Date(invoice.created_at).toLocaleString()}
                                    </div>
                                    <div className="text-center font-medium text-slate-900">
                                        ₹{invoice.total_amount.toFixed(0)}
                                    </div>
                                    <div className="text-center text-slate-500">
                                        {invoice.item_count}
                                    </div>
                                    <div className="text-center text-slate-500">
                                        {invoice.discount_amount > 0 ? `₹${invoice.discount_amount.toFixed(0)}` : '-'}
                                    </div>
                                    <div className="text-center">
                                        {expandedInvoiceId === invoice.id ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400 mx-auto" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedInvoiceId === invoice.id && (
                                    <div className="bg-slate-50/50 px-4 pb-4 pt-0 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                        <div className="pl-10 pt-4">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Purchased Items</h4>
                                            {itemsLoading ? (
                                                <div className="text-sm text-slate-400 py-2">Loading items...</div>
                                            ) : (
                                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-w-3xl">
                                                    {invoiceItems.map((item) => (
                                                        <div key={item.id} className="grid grid-cols-[2fr,1fr,1fr] gap-4 p-3 text-sm">
                                                            <div className="font-medium text-slate-900 flex items-center gap-2">
                                                                <Package className="w-3 h-3 text-slate-400" />
                                                                {item.product_name}
                                                            </div>
                                                            <div className="text-slate-500">
                                                                {item.quantity} x ₹{((item.quantity * item.unit_price - (item.discount_amount || 0)) / item.quantity).toFixed(1)}
                                                            </div>
                                                            <div className="text-right font-medium text-slate-900">
                                                                ₹{(item.quantity * item.unit_price - (item.discount_amount || 0)).toFixed(1)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {invoices.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No invoices found for this customer.
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
            {customer && (
                <EntityImagePreviewModal
                    open={showImagePreview}
                    onOpenChange={setShowImagePreview}
                    entityId={customer.id}
                    entityType="customer"
                    entityName={customer.name}
                    onImageUpdate={(path) => report && setReport({ ...report, customer: { ...customer, image_path: path } })}
                />
            )}
        </div>
    );
}

export default function CustomerDetailsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        }>
            <CustomerDetailsContent />
        </Suspense>
    );
}
