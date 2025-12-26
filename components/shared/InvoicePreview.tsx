
export interface InvoiceLayoutSettings {
    company_name: string;
    company_address: string;
    company_phone: string;
    company_email: string;
    company_comments: string;
    logo_path: string | null;
    logo_width: number;
    logo_x: number;
    logo_y: number;
    header_x: number;
    header_y: number;
    font_size_header: number;
    font_size_body: number;
    header_align: 'left' | 'center' | 'right';
    page_size?: 'a4' | 'a5' | 'custom';
    page_mode?: 'full' | 'half';
    page_width?: number;
    page_height?: number;
}

interface InvoicePreviewProps {
    settings: InvoiceLayoutSettings;
    invoice: {
        invoice_number: string;
        created_at: string | Date;
        status: string;
        total_amount: number;
        discount_amount?: number;
        tax_amount?: number;
    };
    customer?: {
        name: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
    } | null;
    items: Array<{
        product_name: string;
        sku?: string;
        quantity: number;
        unit_price: number;
        discount_amount?: number;
        total: number;
    }>;
    logoUrl?: string | null; // Pre-converted asset URL
    amountInWords?: string;
}

// Helpers
const ptToMm = (pt: number) => pt * 0.352778;

export function InvoicePreview({ settings, invoice, customer, items, logoUrl, amountInWords }: InvoicePreviewProps) {
    // Zoom fixed to 1 for the base render (mm to px); parent can scale this component using CSS transform
    // standard screen dpi is approx 3.78 px per mm (96 dpi), but let's use a base scale derived from the settings editor which used zoom=2 for viewing
    // Actually, to make it 1:1 with mm CSS, we can just use 1mm = 1mm in CSS (browsers support mm units), 
    // OR we can map to pixels. absolute positioning in 'mm' is supported in CSS. 
    // behavior in PdfConfiguration used `zoom` state to multiply values. 
    // Let's use standard mm units in CSS for accurate print preview.

    const logoHeight = settings.logo_width;
    const pageWidth = settings.page_size === 'a5'
        ? 148
        : settings.page_size === 'custom'
            ? (settings.page_width || 210)
            : 210;
    const baseHeight = settings.page_size === 'a5'
        ? 210
        : settings.page_size === 'custom'
            ? (settings.page_height || 297)
            : 297;
    const pageHeight = settings.page_mode === 'half' ? baseHeight / 2 : baseHeight;
    const safeHeaderY = Math.max(settings.header_y, 10);
    const lastTextOffset = settings.company_comments ? 21 : 16;
    const addressEndY = safeHeaderY + lastTextOffset;
    const lineY = addressEndY + 6;
    const startY = lineY + 6;

    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    // Match pdf-generator.ts table layout
    const tableStartY = startY + 27;
    const tableFontSize = 9;
    const tableLineHeight = ptToMm(tableFontSize) * 1.15;
    const tableCellPaddingX = 2;
    const tableCellPaddingY = 1.5;
    const tableRowHeight = tableLineHeight + tableCellPaddingY * 2;
    const tableRowCount = items.length + 2; // header + footer
    const tableHeight = tableRowHeight * tableRowCount;
    const totalsStartY = tableStartY + tableHeight + 3.5;

    // Number to words simple placeholder or we import the lib function. 
    // I will just use a placeholder or pass it in maybe? 
    // For now I'll omit or inline a basic one if critical, but the original file imported `numberToWords`.
    // I'll skip it for brevity or handle it if I can import it.

    return (
        <div
            className="bg-white shadow-lg relative mx-auto overflow-hidden"
            style={{
                width: `${pageWidth}mm`,
                height: `${pageHeight}mm`,
                fontFamily: 'Helvetica, Arial, sans-serif',
                // We use mm units directly for positioning
            }}
        >
            {/* === PAGE BORDER (Optional visualization only) === */}
            <div className="absolute" style={{ left: '5mm', top: '5mm', right: '5mm', bottom: '5mm', border: '1px solid rgb(200, 200, 200)', pointerEvents: 'none' }} />

            {/* === LOGO === */}
            {logoUrl && (
                <div
                    className="absolute"
                    style={{
                        left: `${settings.logo_x}mm`,
                        top: `${settings.logo_y}mm`,
                        width: `${settings.logo_width}mm`,
                        height: `${logoHeight}mm`,
                        maxWidth: `calc(${pageWidth}mm - ${settings.logo_x * 2}mm)`,
                    }}
                >
                    <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            {/* === COMPANY HEADER === */}
            <div
                className="absolute"
                style={{
                    left: `${settings.header_x}mm`,
                    top: `${safeHeaderY - ptToMm(settings.font_size_header) * 0.8}mm`, // Baseline adjustment
                    textAlign: settings.header_align,
                    minWidth: '60mm',
                    whiteSpace: 'nowrap',
                    transform: settings.header_align === 'center' ? 'translateX(-50%)' : settings.header_align === 'right' ? 'translateX(-100%)' : 'none',
                }}
            >
                <div style={{
                    fontSize: `${ptToMm(settings.font_size_header)}mm`,
                    fontWeight: 'bold',
                    color: 'rgb(40, 40, 40)',
                }}>
                    {settings.company_name}
                </div>
                <div style={{
                    fontSize: `${ptToMm(settings.font_size_body)}mm`,
                    color: 'rgb(100, 100, 100)',
                    marginTop: '2mm',
                    lineHeight: 1,
                }}>
                    <div>{settings.company_address}</div>
                    <div style={{ marginTop: `${5 - ptToMm(settings.font_size_body)}mm` }}>Phone: {settings.company_phone}</div>
                    <div style={{ marginTop: `${5 - ptToMm(settings.font_size_body)}mm` }}>Email: {settings.company_email}</div>
                    {settings.company_comments && <div style={{ marginTop: `${5 - ptToMm(settings.font_size_body)}mm` }}>{settings.company_comments}</div>}
                </div>
            </div>

            {/* === SEPARATOR LINE === */}
            <div
                className="absolute"
                style={{
                    left: '5mm',
                    right: '5mm',
                    top: `${lineY}mm`,
                    height: '1px',
                    backgroundColor: 'rgb(200, 200, 200)',
                }}
            />

            {/* === BILL TO + INVOICE DETAILS (fixed positions) === */}
            <div className="absolute" style={{ left: '7mm', top: `${startY}mm`, fontSize: `${ptToMm(11)}mm`, fontWeight: 'bold', color: '#000' }}>
                Bill To:
            </div>
            <div className="absolute" style={{ left: '7mm', top: `${startY + 6}mm`, fontSize: `${ptToMm(10)}mm`, color: '#000' }}>
                {customer?.name || 'Walk-in Customer'}
            </div>
            {customer?.phone && (
                <div className="absolute" style={{ left: '7mm', top: `${startY + 11}mm`, fontSize: `${ptToMm(10)}mm`, color: '#000' }}>
                    {customer.phone}
                </div>
            )}
            {customer?.address && (
                <div className="absolute" style={{ left: '7mm', top: `${startY + 21}mm`, fontSize: `${ptToMm(10)}mm`, color: '#000', width: '80mm', lineHeight: 1.15 }}>
                    {customer.address}
                </div>
            )}

            <div className="absolute" style={{ right: '7mm', top: `${startY}mm`, fontSize: `${ptToMm(10)}mm`, textAlign: 'right', color: '#000' }}>
                Invoice #: {invoice.invoice_number}
            </div>
            <div className="absolute" style={{ right: '7mm', top: `${startY + 5}mm`, fontSize: `${ptToMm(10)}mm`, textAlign: 'right', color: '#000' }}>
                Date: {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="absolute" style={{ right: '7mm', top: `${startY + 10}mm`, fontSize: `${ptToMm(10)}mm`, textAlign: 'right', color: '#000' }}>
                Status: {invoice.status}
            </div>

            {/* === ITEMS TABLE === */}
            <div className="absolute" style={{ left: '7mm', right: '7mm', top: `${tableStartY}mm`, border: '1px solid rgb(200, 200, 200)' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    height: `${tableRowHeight}mm`,
                    backgroundColor: 'rgb(66, 66, 66)',
                    color: 'white',
                    fontSize: `${ptToMm(tableFontSize)}mm`,
                    fontWeight: 'bold',
                    padding: `0 ${tableCellPaddingX}mm`,
                    alignItems: 'center',
                }}>
                    <div style={{ flex: 2 }}>Item</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>SKU</div>
                    <div style={{ width: '8%', textAlign: 'center' }}>Qty</div>
                    <div style={{ width: '18%', textAlign: 'center' }}>Price</div>
                    <div style={{ width: '18%', textAlign: 'center' }}>Total</div>
                </div>

                {/* Rows */}
                {items.map((item, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        height: `${tableRowHeight}mm`,
                        fontSize: `${ptToMm(tableFontSize)}mm`,
                        padding: `0 ${tableCellPaddingX}mm`,
                        borderTop: '1px solid rgb(200, 200, 200)',
                        color: '#000',
                        alignItems: 'center',
                    }}>
                        <div style={{ flex: 2 }}>{item.product_name}</div>
                        <div style={{ flex: 1, color: '#666', textAlign: 'center' }}>{item.sku || '-'}</div>
                        <div style={{ width: '8%', textAlign: 'center' }}>{item.quantity}</div>
                        <div style={{ width: '18%', textAlign: 'right' }}>
                            Rs. {((item.unit_price * item.quantity - (item.discount_amount || 0)) / item.quantity).toFixed(1)}
                        </div>
                        <div style={{ width: '18%', textAlign: 'right' }}>Rs. {item.total.toFixed(1)}</div>
                    </div>
                ))}

                {/* Footer Row */}
                <div style={{
                    display: 'flex',
                    height: `${tableRowHeight}mm`,
                    fontSize: `${ptToMm(tableFontSize)}mm`,
                    padding: `0 ${tableCellPaddingX}mm`,
                    borderTop: '2px solid rgb(200, 200, 200)',
                    fontWeight: 'bold',
                    backgroundColor: '#f0f0f0',
                    color: '#000',
                    alignItems: 'center',
                }}>
                    <div style={{ flex: 2 }}>Total</div>
                    <div style={{ flex: 1 }}></div>
                    <div style={{ width: '8%', textAlign: 'center' }}>{totalQty}</div>
                    <div style={{ width: '18%', textAlign: 'center' }}></div>
                    <div style={{ width: '18%', textAlign: 'right' }}>Rs. {invoice.total_amount.toFixed(1)}</div>
                </div>
            </div>

            {/* === AMOUNT IN WORDS & TOTALS === */}
            <div className="absolute" style={{ left: '7mm', right: '7mm', top: `${totalsStartY}mm`, display: 'flex', justifyContent: 'space-between' }}>
                {/* Amount in Words */}
                <div style={{ fontSize: `${ptToMm(10)}mm`, color: '#000', flex: 1, paddingRight: '2mm' }}>
                    {amountInWords && `Amount in Words: ${amountInWords}`}
                </div>

                {/* Totals Summary */}
                <div style={{ width: '61mm', fontSize: `${ptToMm(10)}mm`, paddingRight: '2mm' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2mm' }}>
                        <span>Subtotal:</span>
                        <span>Rs. {(invoice.total_amount - (invoice.tax_amount || 0)).toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2mm' }}>
                        <span>Discount:</span>
                        <span>{(invoice.discount_amount || 0) > 0 ? `-Rs. ${invoice.discount_amount?.toFixed(1)}` : '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2mm' }}>
                        <span>Tax:</span>
                        <span>Rs. {(invoice.tax_amount || 0).toFixed(1)}</span>
                    </div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 'bold',
                        fontSize: '4.2mm', // ~12pt
                        marginTop: '3mm',
                    }}>
                        <span>Total:</span>
                        <span>Rs. {invoice.total_amount.toFixed(1)}</span>
                    </div>
                </div>
            </div>

            {/* === FOOTER === */}
            <div
                className="absolute"
                style={{
                    left: '7mm',
                    right: '7mm',
                    bottom: '7mm',
                    fontSize: '2.8mm', // ~8pt
                    color: 'rgb(150, 150, 150)',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <span>Generated on {new Date().toLocaleString()}</span>
                <span>Page 1 of 1</span>
            </div>
        </div>
    );
}
