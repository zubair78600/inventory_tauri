# Suppliers Documentation

## Overview
The `suppliers` table stores information about vendors who supply products to the inventory.

## Key Fields

- **id**: Unique identifier for the supplier
- **name**: Supplier/vendor company name
- **contact_info**: Phone number or primary contact
- **email**: Email address
- **address**: Full street address
- **state, district, town**: Location breakdown

## Business Rules

1. **Supplier Balance**: Total amount owed = Total purchases - Total payments made
2. **Pending Balance**: Calculate from purchase_orders and supplier_payments
3. **Active Suppliers**: Suppliers with recent purchase orders

## Calculating Supplier Balance

To calculate pending balance for a supplier:
```sql
SELECT 
    s.id,
    s.name,
    COALESCE(SUM(po.total_amount), 0) as total_purchases,
    COALESCE(SUM(sp.amount), 0) as total_paid,
    COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(sp.amount), 0) as pending_balance
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id
LEFT JOIN supplier_payments sp ON s.id = sp.supplier_id
GROUP BY s.id
```

## Relationships

- Suppliers can have many products (via products.supplier_id)
- Suppliers can have many purchase_orders
- Suppliers can have many supplier_payments
- Many-to-many with products via product_suppliers table

## Common Query Patterns

- Find suppliers with pending balance: WHERE pending_balance > 0
- Find suppliers by location: WHERE state = 'X' AND district = 'Y'
- Get supplier purchase history: JOIN with purchase_orders
- Get total products from supplier: COUNT products WHERE supplier_id = X
