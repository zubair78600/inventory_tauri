# Payments Documentation

## Overview
The system tracks two types of payments:
1. **supplier_payments**: Payments made TO suppliers
2. **customer_payments**: Payments received FROM customers

## Supplier Payments

Records payments made to suppliers for purchases.

### Key Fields
- **supplier_id**: Which supplier was paid
- **amount**: Payment amount
- **payment_method**: Cash, Bank Transfer, UPI, etc.
- **po_id**: Optional link to specific purchase order
- **product_id**: Optional link to specific product
- **paid_at**: Payment date

### Supplier Balance Calculation
```sql
-- Pending balance = Total PO amount - Total payments
SELECT 
    s.name,
    COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(sp.amount), 0) as pending_balance
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status = 'received'
LEFT JOIN supplier_payments sp ON s.id = sp.supplier_id
GROUP BY s.id
```

## Customer Payments

Records payments received from customers against invoices.

### Key Fields
- **customer_id**: Which customer paid
- **invoice_id**: Which invoice this payment is against
- **amount**: Payment amount
- **payment_method**: Cash, UPI, Card, etc.
- **paid_at**: Payment date

### Customer Credit Calculation
```sql
-- Credit = Total invoice amount - Total payments
SELECT 
    c.name,
    COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(cp.amount), 0) as credit_balance
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
LEFT JOIN customer_payments cp ON c.id = cp.customer_id
GROUP BY c.id
```

## Common Query Patterns

- All payments in date range: WHERE paid_at BETWEEN 'start' AND 'end'
- Payments by method: WHERE payment_method = 'Cash'
- Suppliers with pending balance: HAVING pending_balance > 0
- Customers with credit: HAVING credit_balance > 0
