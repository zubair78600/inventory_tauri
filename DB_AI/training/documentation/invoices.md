# Invoices/Sales Documentation

## Overview
The `invoices` table represents sales transactions. Each invoice can contain multiple items via `invoice_items`.

## Key Fields

- **id**: Unique identifier
- **invoice_number**: Human-readable invoice number (e.g., "INV-2024-0001")
- **customer_id**: Reference to customer (NULL for walk-in sales)
- **total_amount**: Final amount including tax
- **tax_amount**: Total tax amount
- **discount_amount**: Any discounts applied
- **payment_method**: Cash, UPI, Card, Credit
- **created_at**: Sale date and time
- **cgst_amount, sgst_amount, igst_amount**: GST breakdown
- **gst_rate**: GST percentage applied
- **fy_year**: Fiscal year (e.g., "2024-25")

## GST Calculation Rules

1. **Intra-state sales**: CGST + SGST (each is gst_rate/2)
2. **Inter-state sales**: IGST (equals gst_rate)
3. **Total Tax**: Either (CGST + SGST) or IGST

## Invoice Items

Each invoice has line items in `invoice_items`:
- **quantity**: Number of units sold
- **unit_price**: Selling price at time of sale
- **product_id**: Reference to product
- **product_name**: Denormalized for historical reference

## Common Query Patterns

- Daily sales: WHERE DATE(created_at) = 'YYYY-MM-DD'
- Sales by date range: WHERE created_at BETWEEN 'start' AND 'end'
- Sales by payment method: WHERE payment_method = 'Cash'
- Sales by customer: WHERE customer_id = X
- Top selling products: 
  ```sql
  SELECT p.name, SUM(ii.quantity) as total_sold
  FROM invoice_items ii
  JOIN products p ON ii.product_id = p.id
  GROUP BY p.id
  ORDER BY total_sold DESC
  ```

## Revenue Calculations

- Total Revenue: SUM(total_amount) from invoices
- Revenue by product: SUM(quantity * unit_price) from invoice_items
- Average order value: AVG(total_amount)
