# Customers Documentation

## Overview
The `customers` table stores information about customers who purchase products.

## Key Fields

- **id**: Unique identifier
- **name**: Customer name
- **phone**: Phone number (often used for lookup)
- **email**: Email address
- **address, place, state, district, town**: Location details

## Business Rules

1. **Walk-in Customers**: Invoices can be created without a customer_id for cash sales
2. **Credit Tracking**: Customer credit = Total invoices - Total customer_payments
3. **Repeat Customers**: Customers with multiple invoices

## Calculating Customer Credit Balance

```sql
SELECT 
    c.id,
    c.name,
    COALESCE(SUM(i.total_amount), 0) as total_purchases,
    COALESCE(SUM(cp.amount), 0) as total_paid,
    COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(cp.amount), 0) as credit_balance
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id
LEFT JOIN customer_payments cp ON c.id = cp.customer_id
GROUP BY c.id
```

## Relationships

- Customers can have many invoices
- Customers can have many customer_payments
- Invoices link to invoice_items for products purchased

## Customer Activity (Billing) vs Registration

- **Registration Date**: `customers.created_at` (When the customer was first added to the system)
- **Billing Date**: `invoices.created_at` (When a transaction occurred)

To query customers who were **billed** or had activity on a certain date, always JOIN the `invoices` table and use `i.created_at`:

```sql
SELECT c.* 
FROM customers c 
JOIN invoices i ON c.id = i.customer_id 
WHERE DATE(i.created_at) = DATE('now')
```

## Common Query Patterns

- Find customers with credit: WHERE credit_balance > 0
- Top spending customers: ORDER BY total_purchases DESC
- Recently registered customers: ORDER BY c.created_at DESC
- Recently active (billed) customers: JOIN invoices i ... ORDER BY i.created_at DESC
- Customers by location: WHERE state = 'X'
- Customer purchase history: JOIN invoices and invoice_items
