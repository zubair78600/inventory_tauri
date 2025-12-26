import jsPDF from 'jspdf';
import type {
  PriceCalculationResult,
  PriceCalculationInputs,
} from '../price-calculator';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// Import helper functions from main pdf-generator
import { settingsCommands, imageCommands } from '../tauri';
import { readFile } from '@tauri-apps/plugin-fs';

const formatCurrency = (amount: number) => {
  return `Rs. ${amount.toFixed(2)}`;
};

const formatDate = () => {
  return new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = () => {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Generate PDF for price calculation report
 */
export async function generatePriceCalculationPDF(
  calculation: PriceCalculationResult,
  inputs: PriceCalculationInputs,
  productName?: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  let yPos = 20;

  // Add Header with Company Info
  await addCompanyHeader(doc);
  yPos = 60; // Start content after header

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Price Calculation Report', margin, yPos);
  yPos += 10;

  // Date and Time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${formatDate()} at ${formatTime()}`, margin, yPos);
  yPos += 4;

  if (productName) {
    doc.text(`Product: ${productName}`, margin, yPos);
    yPos += 4;
  }

  yPos += 6;

  // Cost Breakdown Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Cost Breakdown', margin, yPos);
  yPos += 8;

  // Cost Breakdown Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const tableData: Array<[string, string]> = [
    [
      `Base Cost (${formatCurrency(inputs.productCost)} × ${inputs.quantity} units)`,
      formatCurrency(calculation.baseCost),
    ],
  ];

  // Add additional costs
  inputs.additionalCosts.forEach((cost) => {
    if (cost.amount > 0) {
      tableData.push([cost.label, formatCurrency(cost.amount)]);
    }
  });

  // Draw table manually for more control
  const colWidth = [pageWidth - margin * 2 - 40, 40];
  const rowHeight = 7;

  // Table header
  doc.setFillColor(66, 66, 66);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, yPos, colWidth[0], rowHeight, 'F');
  doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight, 'F');
  doc.text('Description', margin + 2, yPos + 5);
  doc.text('Amount (₹)', margin + colWidth[0] + 2, yPos + 5);
  yPos += rowHeight;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  tableData.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.rect(margin, yPos, colWidth[0], rowHeight, 'F');
    doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight, 'F');

    // Draw borders
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos, colWidth[0], rowHeight);
    doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight);

    doc.text(row[0], margin + 2, yPos + 5);
    doc.text(row[1], margin + colWidth[0] + colWidth[1] - 2, yPos + 5, { align: 'right' });
    yPos += rowHeight;
  });

  // Totals section
  doc.setFillColor(240, 240, 240);
  doc.setFont('helvetica', 'bold');

  // Total Additional Costs
  if (inputs.additionalCosts.length > 0) {
    doc.rect(margin, yPos, colWidth[0], rowHeight, 'F');
    doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos, colWidth[0], rowHeight);
    doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight);
    doc.text('Total Additional Costs', margin + 2, yPos + 5);
    doc.text(
      formatCurrency(calculation.totalAdditionalCosts),
      margin + colWidth[0] + colWidth[1] - 2,
      yPos + 5,
      { align: 'right' }
    );
    yPos += rowHeight;
  }

  // Total Cost
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, yPos, colWidth[0], rowHeight, 'F');
  doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, colWidth[0], rowHeight);
  doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight);
  doc.text('Total Cost', margin + 2, yPos + 5);
  doc.text(
    formatCurrency(calculation.totalCost),
    margin + colWidth[0] + colWidth[1] - 2,
    yPos + 5,
    { align: 'right' }
  );
  yPos += rowHeight;

  // Cost Per Piece (highlighted)
  doc.setFillColor(209, 250, 229); // emerald-100
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.rect(margin, yPos, colWidth[0], rowHeight, 'F');
  doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight, 'F');
  doc.setDrawColor(167, 243, 208); // emerald-300
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, colWidth[0], rowHeight);
  doc.rect(margin + colWidth[0], yPos, colWidth[1], rowHeight);
  doc.text('Cost Per Piece', margin + 2, yPos + 5);
  doc.text(
    formatCurrency(calculation.costPerPiece),
    margin + colWidth[0] + colWidth[1] - 2,
    yPos + 5,
    { align: 'right' }
  );
  yPos += rowHeight + 10;

  // Profit Calculation Section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit Calculation', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Profit Mode Description
  let profitModeText = '';
  switch (inputs.profitMode) {
    case 'percentage':
      profitModeText = `Percentage Profit: ${inputs.profitValue}%`;
      break;
    case 'flat':
      profitModeText = `Flat Amount Per Piece: ${formatCurrency(inputs.profitValue)}`;
      break;
    case 'total':
      profitModeText = `Total Profit Needed: ${formatCurrency(inputs.profitValue)}`;
      break;
  }

  doc.text(`Method: ${profitModeText}`, margin, yPos);
  yPos += 7;

  // Profit Details
  const profitDetails: Array<[string, string]> = [
    ['Profit Per Piece', formatCurrency(calculation.profitPerPiece)],
    ['Total Profit (all units)', formatCurrency(calculation.totalProfit)],
    ['Profit Margin', `${calculation.profitMarginPercentage.toFixed(1)}%`],
  ];

  profitDetails.forEach((detail) => {
    doc.text(`${detail[0]}: ${detail[1]}`, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Final Pricing Summary Box
  doc.setFillColor(209, 250, 229); // emerald-100
  doc.setDrawColor(167, 243, 208); // emerald-300
  doc.setLineWidth(1);
  const boxHeight = 25;
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, boxHeight, 3, 3, 'FD');

  // Selling Price
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('SELLING PRICE PER PIECE', pageWidth / 2, yPos + 8, { align: 'center' });

  doc.setFontSize(20);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text(formatCurrency(calculation.sellingPrice), pageWidth / 2, yPos + 17, {
    align: 'center',
  });

  yPos += boxHeight + 8;

  // Revenue Calculation
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const totalRevenue = calculation.sellingPrice * inputs.quantity;
  doc.text(
    `Total Revenue (${inputs.quantity} units): ${formatCurrency(totalRevenue)}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  // Footer
  addFooter(doc);

  // Save PDF
  const blob = doc.output('blob');
  const buffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  const filePath = await save({
    defaultPath: `Price_Calculation_${new Date().getTime()}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (filePath) {
    await writeFile(filePath, uint8Array);
  }
}

/**
 * Add company header to PDF
 */
async function addCompanyHeader(doc: jsPDF): Promise<void> {
  const margin = 14;

  // Fetch settings
  let settings: any = {};
  try {
    settings = await settingsCommands.getAll();
  } catch (e) {
    console.warn('Failed to load settings for PDF', e);
  }

  const companyName = settings['invoice_company_name'] || 'Your Company';
  const companyAddress = settings['invoice_company_address'] || '';
  const companyPhone = settings['invoice_company_phone'] || '';
  const companyEmail = settings['invoice_company_email'] || '';

  // Company info
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(companyName, margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  let yPos = 26;
  if (companyAddress) {
    doc.text(companyAddress, margin, yPos);
    yPos += 5;
  }
  if (companyPhone) {
    doc.text(`Phone: ${companyPhone}`, margin, yPos);
    yPos += 5;
  }
  if (companyEmail) {
    doc.text(`Email: ${companyEmail}`, margin, yPos);
  }

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, 48, doc.internal.pageSize.width - margin, 48);
}

/**
 * Add footer to PDF
 */
function addFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated on ${formatDate()} at ${formatTime()}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}
