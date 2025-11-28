import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import type { Invoice, InvoiceItem, Customer, Product, Supplier, PurchaseOrderComplete, CustomerInvoice } from './tauri';

// Define the autoTable type extension
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: UserOptions) => jsPDF;
        lastAutoTable: { finalY: number };
    }
}

const COMPANY_NAME = "Inventory System";
const COMPANY_ADDRESS = "123 Business Street, Tech City, 560001";
const COMPANY_PHONE = "+91 98765 43210";
const COMPANY_EMAIL = "support@inventorysystem.com";

const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toFixed(2)}`;
};

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const addHeader = (doc: jsPDF, title: string) => {
    const pageWidth = doc.internal.pageSize.width;

    // Company Info
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(COMPANY_NAME, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(COMPANY_ADDRESS, 14, 26);
    doc.text(`Phone: ${COMPANY_PHONE}`, 14, 31);
    doc.text(`Email: ${COMPANY_EMAIL}`, 14, 36);

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(title, pageWidth - 14, 20, { align: 'right' });

    // Line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, pageWidth - 14, 42);
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

export const generateInvoicePDF = (invoice: Invoice, items: InvoiceItem[], customer?: Customer | null): string => {
    console.log("Generating Invoice PDF...");
    const doc = new jsPDF();

    addHeader(doc, 'INVOICE');

    // Invoice Details
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const pageWidth = doc.internal.pageSize.width;
    const rightColX = pageWidth - 14;

    doc.text(`Invoice #: ${invoice.invoice_number}`, rightColX, 50, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.created_at)}`, rightColX, 55, { align: 'right' });
    doc.text(`Status: Paid`, rightColX, 60, { align: 'right' });

    // Customer Details
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (customer) {
        doc.text(customer.name, 14, 56);
        if (customer.phone) doc.text(customer.phone, 14, 61);
        if (customer.email) doc.text(customer.email, 14, 66);
        if (customer.address) {
            const splitAddress = doc.splitTextToSize(customer.address, 80);
            doc.text(splitAddress, 14, 71);
        }
    } else {
        doc.text('Walk-in Customer', 14, 56);
    }

    // Items Table
    const tableColumn = ["Item", "SKU", "Qty", "Price", "Total"];
    const tableRows = items.map(item => [
        item.product_name,
        item.product_sku || '-',
        item.quantity,
        formatCurrency(item.unit_price),
        formatCurrency(item.quantity * item.unit_price)
    ]);

    autoTable(doc, {
        startY: 85,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 9, font: 'helvetica' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10;
    const summaryX = pageWidth - 70;
    const valueX = pageWidth - 14;

    doc.setFont('helvetica', 'normal');
    doc.text(`Subtotal:`, summaryX, finalY);
    doc.text(formatCurrency(invoice.total_amount - invoice.tax_amount + invoice.discount_amount), valueX, finalY, { align: 'right' });

    doc.text(`Discount:`, summaryX, finalY + 6);
    doc.text(`-${formatCurrency(invoice.discount_amount)}`, valueX, finalY + 6, { align: 'right' });

    doc.text(`Tax:`, summaryX, finalY + 12);
    doc.text(formatCurrency(invoice.tax_amount), valueX, finalY + 12, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Total:`, summaryX, finalY + 20);
    doc.text(formatCurrency(invoice.total_amount), valueX, finalY + 20, { align: 'right' });

    addFooter(doc);
    return createBlobUrl(doc);
};

export const generatePurchaseOrderPDF = (poComplete: PurchaseOrderComplete): string => {
    console.log("Generating Purchase Order PDF...");
    const doc = new jsPDF();
    const po = poComplete.purchase_order;
    const supplier = poComplete.supplier;

    addHeader(doc, 'PURCHASE ORDER');

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

export const generateInventoryReportPDF = (products: Product[]): string => {
    console.log("Generating Inventory Report PDF...");
    const doc = new jsPDF();

    addHeader(doc, 'INVENTORY REPORT');

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

export const generateCustomerListPDF = (customers: Customer[]): string => {
    console.log("Generating Customer List PDF...");
    const doc = new jsPDF();

    addHeader(doc, 'CUSTOMER LIST');

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

export const generateSupplierListPDF = (suppliers: Supplier[]): string => {
    console.log("Generating Supplier List PDF...");
    const doc = new jsPDF();

    addHeader(doc, 'SUPPLIER LIST');

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

export const generateCustomerDetailPDF = (
    customer: Customer,
    invoices: CustomerInvoice[] = [],
    stats?: { total_spent: number; invoice_count: number }
): string => {
    const doc = new jsPDF();
    addHeader(doc, 'CUSTOMER DETAILS');

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

        const statsRows = [
            ['Total Spent', formatCurrency(stats.total_spent)],
            ['Total Invoices', stats.invoice_count.toString()],
            ['Last Billed', lastBilled]
        ];

        autoTable(doc, {
            startY: finalY + 5,
            body: statsRows,
            theme: 'grid',
            styles: { fontSize: 10, font: 'helvetica' },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40, fillColor: [240, 240, 240] },
                1: { cellWidth: 'auto' }
            }
        });

        finalY = doc.lastAutoTable.finalY + 10;
    }

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

export const generateProductDetailPDF = (product: Product, supplierName?: string): string => {
    const doc = new jsPDF();
    addHeader(doc, 'PRODUCT DETAILS');

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

export const generateSupplierDetailPDF = (supplier: Supplier): string => {
    const doc = new jsPDF();
    addHeader(doc, 'SUPPLIER DETAILS');

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

    addFooter(doc);
    return createBlobUrl(doc);
};
