import jsPDF from 'jspdf';
import autoTable, { type UserOptions, type CellHookData } from 'jspdf-autotable';
import type { Invoice, InvoiceItem, Customer, Product, Supplier, PurchaseOrderComplete, CustomerInvoice, SupplierPaymentSummary } from './tauri';
import { settingsCommands, imageCommands } from './tauri'; // Import commands to fetch settings/images
import { readFile } from '@tauri-apps/plugin-fs';

// Define the autoTable type extension
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: UserOptions) => jsPDF;
        lastAutoTable: {
            finalY: number;
            columns: Array<{ x: number; width: number }>;
        };
    }
}

// Simple in-memory cache for logo to avoid slow FS/Image ops
let logoCache: {
    path: string;
    dataUrl: string;
    aspect: number;
} | null = null;

// Simple in-memory cache for settings to avoid DB calls on every PDF gen
let settingsCache: any | null = null;

export const clearSettingsCache = () => {
    settingsCache = null;
    logoCache = null; // Also clear logo cache as path might have changed
};

// Default Settings Constants
export const DEFAULT_COMPANY_NAME = "Inventory System";
export const DEFAULT_COMPANY_ADDRESS = "123 Business Street, Tech City, 560001";
export const DEFAULT_COMPANY_PHONE = "+91 98765 43210";
export const DEFAULT_COMPANY_EMAIL = "support@inventorysystem.com";

// Default Settings Object (exported for use in PDF Config component)
export const DEFAULT_SETTINGS = {
    company_name: DEFAULT_COMPANY_NAME,
    company_address: DEFAULT_COMPANY_ADDRESS,
    company_phone: DEFAULT_COMPANY_PHONE,
    company_email: DEFAULT_COMPANY_EMAIL,
    company_comments: "",
    logo_path: null as string | null,
    logo_width: 30,
    logo_x: 20,
    logo_y: 20,
    header_x: 14,
    header_y: 50,
    font_size_header: 16,
    font_size_body: 10,
    header_align: 'left' as 'left' | 'center' | 'right',
};

const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toFixed(1)}`;
};

export const numberToWords = (num: number): string => {
    if (num === 0) return "Zero";

    const a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
        "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const convertGroup = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return (b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "")).trim();
    };

    const convert = (n: number): string => {
        if (n < 100) return convertGroup(n);
        if (n < 1000) return (a[Math.floor(n / 100)] + " Hundred" + (n % 100 === 0 ? "" : " " + convert(n % 100))).trim();
        if (n < 100000) return (convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 === 0 ? "" : " " + convert(n % 1000))).trim();
        if (n < 10000000) return (convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 === 0 ? "" : " " + convert(n % 100000))).trim();
        return (convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 === 0 ? "" : " " + convert(n % 10000000))).trim();
    };

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    let result = convert(wholePart);

    if (decimalPart > 0) {
        result += ` and ${convert(decimalPart)} Paise`;
    }

    return result + " Rupees Only";
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const addHeader = async (doc: jsPDF, title: string) => {
    const pageWidth = doc.internal.pageSize.width;

    // Fetch Settings
    // Fetch Settings
    let settings: any = {};
    try {
        if (settingsCache) {
            settings = settingsCache;
        } else {
            settings = await settingsCommands.getAll();
            settingsCache = settings;
        }
    } catch (e) {
        console.warn("Failed to load settings for PDF", e);
    }

    const companyName = settings['invoice_company_name'] || DEFAULT_COMPANY_NAME;
    const companyAddress = settings['invoice_company_address'] || DEFAULT_COMPANY_ADDRESS;
    const companyPhone = settings['invoice_company_phone'] || DEFAULT_COMPANY_PHONE;
    const companyEmail = settings['invoice_company_email'] || DEFAULT_COMPANY_EMAIL;
    const companyComments = settings['invoice_company_comments'] || '';

    // Validates number exists and is not NaN, otherwise returns default. Treats 0 as valid.
    const getNumber = (val: any, def: number) => {
        const num = Number(val);
        return !isNaN(num) ? num : def;
    };

    const logoPath = settings['invoice_logo_path'];
    const logoX = getNumber(settings['invoice_logo_x'], 20);
    const logoY = getNumber(settings['invoice_logo_y'], 20);
    const logoWidth = getNumber(settings['invoice_logo_width'], 30);

    const headerX = getNumber(settings['invoice_header_x'], 14);
    const headerY = getNumber(settings['invoice_header_y'], 50);
    const headerFontSize = getNumber(settings['invoice_font_size_header'], 16);
    const bodyFontSize = Number(settings['invoice_font_size_body']) || 10;
    const headerAlign = (settings['invoice_header_align'] as 'left' | 'center' | 'right') || 'left';

    let calculatedLogoHeight = 0;

    // Draw Logo if exists
    // Mobile/Performance Cache
    // We cache the logo processing because readFile + converting to base64 + creating Image + waiting for onload is slow.
    if (logoCache?.path === logoPath && logoCache?.dataUrl) {
        const { dataUrl, aspect } = logoCache;
        doc.addImage(dataUrl, 'PNG', logoX, logoY, logoWidth, logoWidth * aspect);
        calculatedLogoHeight = logoWidth * aspect;
    } else if (logoPath) {
        try {
            const picturesDir = await imageCommands.getPicturesDirectory();
            const fullLogoPath = `${picturesDir}/${logoPath}`;

            // Read file directly from filesystem and convert to base64
            const fileData = await readFile(fullLogoPath);
            const base64 = btoa(
                fileData.reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            // Determine image format from extension
            const ext = logoPath.split('.').pop()?.toLowerCase() || 'png';
            const format = ext === 'jpg' ? 'JPEG' : ext.toUpperCase();
            const dataUrl = `data:image/${ext};base64,${base64}`;

            // Create image to get dimensions
            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Resize image to max 400x400 for performance
            const MAX_SIZE = 400;
            let newWidth = img.width;
            let newHeight = img.height;

            if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
                if (img.width > img.height) {
                    newWidth = MAX_SIZE;
                    newHeight = Math.round(img.height * (MAX_SIZE / img.width));
                } else {
                    newHeight = MAX_SIZE;
                    newWidth = Math.round(img.width * (MAX_SIZE / img.height));
                }
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
            }

            // Get compressed data URL (JPEG at 0.8 quality for smaller size)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const aspect = newHeight / newWidth;

            console.log(`Logo resized from ${img.width}x${img.height} to ${newWidth}x${newHeight}`);

            // Update Cache with compressed image
            logoCache = {
                path: logoPath,
                dataUrl: compressedDataUrl,
                aspect: aspect
            };

            doc.addImage(compressedDataUrl, 'JPEG', logoX, logoY, logoWidth, logoWidth * aspect);
            calculatedLogoHeight = logoWidth * aspect;
        } catch (e) {
            console.error("Failed to load logo for PDF", e);
        }
    }

    // Company Info / Header Text
    // We position this based on headerX, headerY
    // We'll align text right or left? visual editor implies we place the block.
    // Let's assume left aligned to the point, or maybe we should respect alignment?
    // For now, let's just draw text at X,Y

    doc.setFontSize(headerFontSize);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    // Ensure minimum Y position to prevent text clipping (font baseline needs room)
    const safeHeaderY = Math.max(headerY, 10);
    doc.text(companyName, headerX, safeHeaderY, { align: headerAlign }); // Title (Company Name)

    doc.setFontSize(bodyFontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(companyAddress, headerX, safeHeaderY + 6, { align: headerAlign });
    doc.text(`Phone: ${companyPhone}`, headerX, safeHeaderY + 11, { align: headerAlign });
    doc.text(`Email: ${companyEmail}`, headerX, safeHeaderY + 16, { align: headerAlign });
    if (companyComments) {
        doc.text(companyComments, headerX, safeHeaderY + 21, { align: headerAlign });
    }

    // Document Title (INVOICE, PO, etc)
    // We can keep this fixed or maybe move it? 
    // For now let's keep the document title fixed to top right or derived from settings?
    // User request: "header size everything i should able to move"
    // The "Header" usually refers to Company Info. 
    // The "Title" like INVOICE is usually standard but let's leave it top right for now,
    // or maybe below the company info?
    // Let's stick to standard position for Title (INVOICE) but respect Company Info position.

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold'); // Match preview bold
    doc.setTextColor(0, 0, 0);
    // Right align title to page edge - margin
    // Preview uses top: 20mm. PDF uses baseline. 16pt ~ 6mm height.
    // So Y should be 20 + 6 = 26mm to match visual top alignment.
    // doc.text(title, pageWidth - 14, 26, { align: 'right' });
    doc.setFont('helvetica', 'normal'); // Reset for other text

    // Line separator - calculate based on header text position only
    // Logo is now independent - user can resize/position it without affecting the line

    // Check if comments exist to determine actual text end Y
    // Default steps: Address(6), Phone(11), Email(16), Comments(21)
    const lastTextOffset = companyComments ? 21 : 16;
    const addressEndY = safeHeaderY + lastTextOffset;

    // Line is 6mm below text (logo no longer affects position)
    const lineY = addressEndY + 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(5, lineY, pageWidth - 5, lineY);

    // Return the Y position where content should start
    // 20px (approx 6mm) padding after line
    return lineY + 6;
};

const addFooter = (doc: jsPDF) => {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
        doc.text(
            `Generated on ${new Date().toLocaleString()}`,
            14,
            pageHeight - 10
        );
    }
};

const createBlobUrl = (doc: jsPDF): string => {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
};

export const generateInvoicePDF = async (invoice: Invoice, items: InvoiceItem[], customer?: Customer | null): Promise<{ url: string; size: string; duration: string }> => {
    const startTime = performance.now();
    console.log("Generating Invoice PDF...");
    const doc = new jsPDF();

    // Add page border with 5mm (≈15px) padding on all sides
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const borderPadding = 5; // 5mm ≈ 15px
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(borderPadding, borderPadding, pageWidth - (borderPadding * 2), pageHeight - (borderPadding * 2));

    const startY = await addHeader(doc, 'INVOICE');

    // Invoice Details
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const rightColX = pageWidth - 7;

    doc.text(`Invoice #: ${invoice.invoice_number}`, rightColX, startY, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.created_at)}`, rightColX, startY + 5, { align: 'right' });
    doc.text(`Status: Paid`, rightColX, startY + 10, { align: 'right' });

    // Customer Details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 7, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (customer) {
        doc.text(customer.name, 7, startY + 6);
        if (customer.phone) doc.text(customer.phone, 7, startY + 11);
        if (customer.email) doc.text(customer.email, 7, startY + 16);
        if (customer.address) {
            const splitAddress = doc.splitTextToSize(customer.address, 80);
            doc.text(splitAddress, 7, startY + 21);
        }
    } else {
        doc.text('Walk-in Customer', 7, startY + 6);
    }

    // Items Table - Apply Global Discount Weightage or Per-Item Discount
    const tableColumn = ["Item", "SKU", "Qty", "Price", "Total"];

    // Calculate total gross amount to determine weightage if global discount exists
    const totalGross = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const globalDiscount = invoice.discount_amount || 0;
    const hasPerItemDiscount = items.some(i => (i.discount_amount || 0) > 0);

    const tableRows = items.map(item => {
        const originalGross = item.quantity * item.unit_price;
        let itemDiscount = item.discount_amount || 0;

        // If no per-item discount found but global discount exists, distribute weighted by value
        if (!hasPerItemDiscount && globalDiscount > 0 && totalGross > 0) {
            const weight = originalGross / totalGross;
            itemDiscount = weight * globalDiscount;
        }

        const finalTotal = originalGross - itemDiscount;

        // Calculate discounted unit price for display
        const discountedUnitPrice = item.quantity > 0 ? finalTotal / item.quantity : item.unit_price;

        // Show detailed prices
        const priceDisplay = formatCurrency(discountedUnitPrice);
        const totalDisplay = formatCurrency(finalTotal);

        return [
            item.product_name,
            item.product_sku || '-',
            item.quantity,
            priceDisplay,
            totalDisplay
        ];
    });

    // Calculate Totals for Footer (using final amounts to match visual sum)
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const netSubtotal = invoice.total_amount - (invoice.tax_amount || 0);

    const tableMargin = 7;
    const tableCellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2 };
    let totalValueX: number | null = null;

    autoTable(doc, {
        startY: startY + 27,
        head: [tableColumn],
        body: tableRows,
        foot: [[
            { content: "Total", styles: { halign: 'left' } },
            { content: "", styles: { halign: 'center' } },
            { content: totalQty.toString(), styles: { halign: 'center' } },
            { content: "", styles: { halign: 'right' } }, // Empty for Price column
            { content: formatCurrency(netSubtotal), styles: { halign: 'right' } } // Match sum of items (Subtotal)
        ]],
        theme: 'grid',
        margin: { left: tableMargin, right: tableMargin }, // 5mm border + 2mm inner padding
        headStyles: { fillColor: [66, 66, 66], halign: 'center' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: {
            fontSize: 9,
            font: 'helvetica',
            cellPadding: tableCellPadding
        },
        columnStyles: {
            0: { cellWidth: 'auto', halign: 'left' }, // Item Name remains left aligned
            1: { halign: 'center' }, // SKU
            2: { halign: 'center' }, // Qty
            3: { halign: 'right' }, // Price - match preview (right aligned)
            4: { halign: 'right' }  // Total - match preview (right aligned)
        },
        didDrawCell: (data: CellHookData) => {
            if (totalValueX !== null) return;
            if ((data.section === 'body' || data.section === 'foot') && data.column.index === tableColumn.length - 1) {
                totalValueX = data.cell.getTextPos().x;
            }
        },
    });

    // Amount in Words - 10px (~3.5mm) gap after table
    const finalY = doc.lastAutoTable.finalY + 3.5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const amountInWords = numberToWords(Math.round(invoice.total_amount));
    doc.text(`Amount in Words: ${amountInWords}`, 7, finalY);

    // Totals Section - align values with the actual Total column text position
    const summaryBlockWidth = 61;
    const summaryRightX = totalValueX ?? (pageWidth - tableMargin - tableCellPadding.right);
    const summaryLabelX = summaryRightX - summaryBlockWidth;

    doc.text(`Subtotal:`, summaryLabelX, finalY);
    doc.text(formatCurrency(netSubtotal), summaryRightX, finalY, { align: 'right' });

    if (invoice.discount_amount && invoice.discount_amount > 0) {
        doc.text(`Discount:`, summaryLabelX, finalY + 6);
        doc.text(`-${formatCurrency(invoice.discount_amount)}`, summaryRightX, finalY + 6, { align: 'right' });
    } else {
        doc.text(`Discount:`, summaryLabelX, finalY + 6);
        doc.text(`-`, summaryRightX, finalY + 6, { align: 'right' });
    }

    doc.text(`Tax:`, summaryLabelX, finalY + 12);
    doc.text(formatCurrency(invoice.tax_amount || 0), summaryRightX, finalY + 12, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total:`, summaryLabelX, finalY + 20);
    doc.text(formatCurrency(invoice.total_amount), summaryRightX, finalY + 20, { align: 'right' });

    addFooter(doc);

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2) + 'ms';

    const blob = doc.output('blob');
    const size = (blob.size / 1024).toFixed(2) + ' KB';
    const url = URL.createObjectURL(blob);

    console.log(`PDF Generated in ${duration}, Size: ${size}`);

    return { url, size, duration };
};

export const generatePurchaseOrderPDF = async (poComplete: PurchaseOrderComplete): Promise<string> => {
    console.log("Generating Purchase Order PDF...");
    const doc = new jsPDF();
    const po = poComplete.purchase_order;
    const supplier = poComplete.supplier;

    await addHeader(doc, 'PURCHASE ORDER');

    // PO Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const pageWidth = doc.internal.pageSize.width;
    const rightColX = pageWidth - 14;

    doc.text(`PO #: ${po.po_number}`, rightColX, 50, { align: 'right' });
    doc.text(`Date: ${formatDate(po.order_date)}`, rightColX, 55, { align: 'right' });
    doc.text(`Status: ${po.status.toUpperCase()}`, rightColX, 60, { align: 'right' });

    // Supplier Details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendor:', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text(supplier.name, 14, 56);
    if (supplier.contact_info) doc.text(supplier.contact_info, 14, 61);
    if (supplier.email) doc.text(supplier.email, 14, 66);
    if (supplier.address) {
        const splitAddress = doc.splitTextToSize(supplier.address, 80);
        doc.text(splitAddress, 14, 71);
    }

    // Items Table
    const tableColumn = ["Item", "SKU", "Qty", "Unit Cost", "Total"];
    const tableRows = poComplete.items.map(item => [
        item.product_name,
        item.sku,
        item.quantity,
        formatCurrency(item.unit_cost),
        formatCurrency(item.total_cost)
    ]);

    autoTable(doc, {
        startY: 85,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9, font: 'helvetica' },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10;
    const summaryX = pageWidth - 70;
    const valueX = pageWidth - 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total Amount:`, summaryX, finalY);
    doc.text(formatCurrency(po.total_amount), valueX, finalY, { align: 'right' });

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateInventoryReportPDF = async (products: Product[]): Promise<string> => {
    console.log("Generating Inventory Report PDF...");
    const doc = new jsPDF();

    await addHeader(doc, 'INVENTORY REPORT');

    const tableColumn = ["Name", "SKU", "Stock", "Price", "Value"];
    const tableRows = products.map(product => [
        product.name,
        product.sku,
        product.stock_quantity,
        formatCurrency(product.price),
        formatCurrency(product.stock_quantity * product.price)
    ]);

    autoTable(doc, {
        startY: 50,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8, font: 'helvetica' },
        columnStyles: {
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    // Summary
    const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.stock_quantity * p.price), 0);

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Items: ${products.length}`, 14, finalY);
    doc.text(`Total Stock Quantity: ${totalStock}`, 14, finalY + 5);
    doc.text(`Total Inventory Value: ${formatCurrency(totalValue)}`, 14, finalY + 10);

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateCustomerListPDF = async (customers: Customer[]): Promise<string> => {
    console.log("Generating Customer List PDF...");
    const doc = new jsPDF();

    await addHeader(doc, 'CUSTOMER LIST');

    const tableColumn = ["Name", "Phone", "Email", "Place", "Last Billed"];
    const tableRows = customers.map(customer => [
        customer.name,
        customer.phone || '-',
        customer.email || '-',
        customer.place || '-',
        customer.last_billed ? formatDate(customer.last_billed) : '-'
    ]);

    autoTable(doc, {
        startY: 50,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [39, 174, 96] },
        styles: { fontSize: 8, font: 'helvetica' }
    });

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateSupplierListPDF = async (suppliers: Supplier[]): Promise<string> => {
    console.log("Generating Supplier List PDF...");
    const doc = new jsPDF();

    await addHeader(doc, 'SUPPLIER LIST');

    const tableColumn = ["Name", "Contact", "Email", "Location"];
    const tableRows = suppliers.map(supplier => [
        supplier.name,
        supplier.contact_info || '-',
        supplier.email || '-',
        [supplier.town, supplier.district, supplier.state].filter(Boolean).join(', ') || '-'
    ]);

    autoTable(doc, {
        startY: 50,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [142, 68, 173] },
        styles: { fontSize: 8, font: 'helvetica' }
    });

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateCustomerDetailPDF = async (
    customer: Customer,
    invoices: CustomerInvoice[] = [],
    stats?: { total_spent: number; invoice_count: number }
): Promise<string> => {
    const doc = new jsPDF();
    await addHeader(doc, 'CUSTOMER DETAILS');

    // Determine Last Billed Date
    let lastBilled = '-';
    if (customer.last_billed) {
        lastBilled = formatDate(customer.last_billed);
    } else if (invoices.length > 0) {
        // Sort invoices by date descending to get the latest one
        const sortedInvoices = [...invoices].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        lastBilled = formatDate(sortedInvoices[0].created_at);
    }

    const tableRows = [
        ['Name', customer.name],
        ['Email', customer.email || '-'],
        ['Phone', customer.phone || '-'],
        ['Address', customer.address || '-'],
        ['Place', customer.place || '-'],
        ['Last Billed', lastBilled]
    ];

    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;
    const gap = 10;
    const availableWidth = pageWidth - (margin * 2);
    const tableWidth = (availableWidth - gap) / 2;

    autoTable(doc, {
        startY: 50,
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 10, font: 'helvetica' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40, fillColor: [240, 240, 240] },
            1: { cellWidth: 'auto' }
        },
        margin: { left: margin },
        tableWidth: tableWidth
    });

    const leftFinalY = doc.lastAutoTable.finalY;
    let rightFinalY = 50;

    // Stats Section
    if (stats) {
        const rightTableX = margin + tableWidth + gap;

        // Title for Summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', rightTableX, 48);

        const statsRows = [
            ['Total Spent', formatCurrency(stats.total_spent)],
            ['Total Invoices', stats.invoice_count.toString()],
            ['Last Billed', lastBilled]
        ];

        autoTable(doc, {
            startY: 50,
            body: statsRows,
            theme: 'grid',
            styles: { fontSize: 10, font: 'helvetica' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40, fillColor: [240, 240, 240] },
                1: { cellWidth: 'auto' }
            },
            margin: { left: rightTableX },
            tableWidth: tableWidth
        });

        rightFinalY = doc.lastAutoTable.finalY;
    }

    const finalY = Math.max(leftFinalY, rightFinalY) + 15;

    // Invoice History
    if (invoices.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Invoice History', 14, finalY + 5);

        const invoiceTableColumn = ["Invoice #", "Date", "Items", "Amount", "Status"];
        const invoiceTableRows = invoices.map(inv => [
            inv.invoice_number,
            formatDate(inv.created_at),
            inv.item_count || 0,
            formatCurrency(inv.total_amount),
            "Paid" // Assuming paid for now as per UI
        ]);

        autoTable(doc, {
            startY: finalY + 10,
            head: [invoiceTableColumn],
            body: invoiceTableRows,
            theme: 'striped',
            headStyles: { fillColor: [66, 66, 66] },
            styles: { fontSize: 9, font: 'helvetica' },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right' }
            }
        });
    }

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateProductDetailPDF = async (product: Product, supplierName?: string): Promise<string> => {
    const doc = new jsPDF();
    await addHeader(doc, 'PRODUCT DETAILS');

    const tableRows = [
        ['Name', product.name],
        ['SKU', product.sku],
        ['Price', formatCurrency(product.price)],
        ['Selling Price', product.selling_price ? formatCurrency(product.selling_price) : '-'],
        ['Stock Quantity', product.stock_quantity.toString()],
        ['Supplier', supplierName || '-']
    ];

    autoTable(doc, {
        startY: 50,
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 10, font: 'helvetica' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40, fillColor: [240, 240, 240] },
            1: { cellWidth: 'auto' }
        }
    });

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generateSupplierDetailPDF = async (
    supplier: Supplier,
    products: Product[] = [],
    stats?: { totalProducts: number; totalStock: number; totalValue: number; totalPending: number },
    paymentSummaries: Record<number, SupplierPaymentSummary | null> = {}
): Promise<string> => {
    const doc = new jsPDF();
    await addHeader(doc, 'SUPPLIER DETAILS');

    const tableRows = [
        ['Name', supplier.name],
        ['Contact', supplier.contact_info || '-'],
        ['Email', supplier.email || '-'],
        ['Address', supplier.address || '-'],
        ['Location', [supplier.town, supplier.district, supplier.state].filter(Boolean).join(', ') || '-'],
        ['Comments', supplier.comments || '-']
    ];

    autoTable(doc, {
        startY: 50,
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 10, font: 'helvetica' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40, fillColor: [240, 240, 240] },
            1: { cellWidth: 'auto' }
        }
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // Stats Section
    if (stats) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, finalY);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Total Products', 'Total Stock', 'Stock Value', 'Pending Amount']],
            body: [[
                stats.totalProducts.toString(),
                stats.totalStock.toString(),
                formatCurrency(stats.totalValue),
                formatCurrency(stats.totalPending)
            ]],
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 10, font: 'helvetica', halign: 'center' },
        });

        finalY = doc.lastAutoTable.finalY + 10;
    }

    // Supplied Products Section
    if (products.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Supplied Products', 14, finalY + 5);

        const productTableColumn = ["Purchased Date", "Product", "SKU", "Stock", "Price", "Stock Amount"];
        const productTableRows = products.map(product => {
            const stockAmount = (product.initial_stock ?? product.stock_quantity) * product.price;
            const summary = paymentSummaries[product.id];
            let stockAmountText = formatCurrency(stockAmount);

            if (summary && summary.pending_amount > 0) {
                stockAmountText += `\n(Pending: ${formatCurrency(summary.pending_amount)})`;
            }

            return [
                new Date(product.created_at).toLocaleDateString(),
                product.name,
                product.sku,
                (product.initial_stock ?? product.stock_quantity).toString(),
                formatCurrency(product.price),
                stockAmountText
            ];
        });

        autoTable(doc, {
            startY: finalY + 10,
            head: [productTableColumn],
            body: productTableRows,
            theme: 'striped',
            headStyles: { fillColor: [66, 66, 66] },
            styles: { fontSize: 9, font: 'helvetica' },
            columnStyles: {
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            }
        });
    }

    addFooter(doc);
    return createBlobUrl(doc);
};
