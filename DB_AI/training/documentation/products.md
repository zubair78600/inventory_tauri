# Products Documentation

## Overview
The `products` table stores all product/item information in the inventory system.

## Key Fields

- **id**: Unique identifier for the product
- **name**: Display name of the product
- **sku**: Stock Keeping Unit - unique code for the product (e.g., "SKU-001")
- **price**: Purchase/cost price from the supplier
- **selling_price**: Price at which the product is sold to customers
- **initial_stock**: Starting stock when product was first added to inventory
- **stock_quantity**: Current available quantity in stock
- **quantity_sold**: Total units sold historically
- **sold_revenue**: Total revenue generated from this product
- **supplier_id**: Reference to the primary supplier
- **category**: Product category (e.g., "Electronics", "Clothing", "Food")

## Business Rules

1. **Stock Management**: `stock_quantity` decreases when sales are made and increases when purchase orders are received
2. **Profit Calculation**: Profit per unit = `selling_price` - `price`
3. **Low Stock**: Products with `stock_quantity < 10` are considered low stock
4. **Out of Stock**: Products with `stock_quantity = 0` cannot be sold

## Key Metrics Calculations

### Current Stock
The current available quantity of a product.
```sql
SELECT stock_quantity FROM products WHERE LOWER(name) LIKE LOWER('%product_name%')
```

### Total Stock Purchased (Initial + All Received POs)
Total quantity ever added to inventory = initial stock + all purchase order items.
```sql
SELECT p.name,
    p.initial_stock,
    COALESCE(SUM(poi.quantity), 0) as purchased_via_po,
    p.initial_stock + COALESCE(SUM(poi.quantity), 0) as total_stock_purchased
FROM products p
LEFT JOIN purchase_order_items poi ON p.id = poi.product_id
LEFT JOIN purchase_orders po ON poi.po_id = po.id AND po.status = 'received'
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
GROUP BY p.id
```

### Total Sales Count (Number of Invoices)
How many invoices contain this product.
```sql
SELECT p.name, COUNT(DISTINCT i.id) as sales_count
FROM products p
JOIN invoice_items ii ON p.id = ii.product_id
JOIN invoices i ON ii.invoice_id = i.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
GROUP BY p.id
```

### Total Amount Sold (Revenue)
Total revenue generated from selling this product.
```sql
SELECT p.name,
    COALESCE(SUM(ii.quantity * ii.unit_price), 0) as total_amount_sold,
    COALESCE(SUM(ii.quantity), 0) as total_quantity_sold
FROM products p
LEFT JOIN invoice_items ii ON p.id = ii.product_id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
GROUP BY p.id
```

### Selling Price and Profit Margin
```sql
SELECT p.name,
    p.price as cost_price,
    p.selling_price,
    (p.selling_price - p.price) as profit_margin
FROM products p
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
```

### Complete Product Details Query
Returns all key metrics for a product in a single query.
```sql
SELECT p.id, p.name, p.sku,
    p.price as cost_price,
    p.selling_price,
    p.stock_quantity as current_stock,
    p.initial_stock + COALESCE((SELECT SUM(poi.quantity) FROM purchase_order_items poi
        JOIN purchase_orders po ON poi.po_id = po.id
        WHERE poi.product_id = p.id AND po.status = 'received'), 0) as total_stock_purchased,
    COALESCE(p.quantity_sold, 0) as quantity_sold,
    COUNT(DISTINCT i.id) as sales_invoice_count,
    COALESCE(SUM(ii.quantity * ii.unit_price), 0) as total_amount_sold,
    p.category,
    s.name as supplier_name
FROM products p
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN invoice_items ii ON p.id = ii.product_id
LEFT JOIN invoices i ON ii.invoice_id = i.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
GROUP BY p.id
```

## Common Query Patterns

- Get products with low stock: WHERE stock_quantity < 10
- Get products by category: WHERE category = 'CategoryName'
- Get top selling products: ORDER BY quantity_sold DESC
- Get products by supplier: WHERE supplier_id = X
- Calculate total inventory value: SUM(stock_quantity * price)
- Calculate total potential revenue: SUM(stock_quantity * selling_price)

## Relationships

- Each product can have one primary supplier (supplier_id)
- Products appear in invoice_items when sold
- Products appear in purchase_order_items when purchased
- Multiple suppliers can be linked via product_suppliers table
- Payments to suppliers can be tracked via supplier_payments.product_id

## Related Tables for Product Queries

### Purchase History (from purchase_order_items)
```sql
SELECT p.name as product, po.po_number, po.order_date,
    poi.quantity, poi.unit_cost, poi.total_cost,
    s.name as supplier, po.status
FROM products p
JOIN purchase_order_items poi ON p.id = poi.product_id
JOIN purchase_orders po ON poi.po_id = po.id
JOIN suppliers s ON po.supplier_id = s.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
ORDER BY po.order_date DESC
```

### Sales History (from invoice_items)
```sql
SELECT p.name as product, i.invoice_number, i.created_at as sale_date,
    ii.quantity, ii.unit_price, (ii.quantity * ii.unit_price) as line_total,
    c.name as customer
FROM products p
JOIN invoice_items ii ON p.id = ii.product_id
JOIN invoices i ON ii.invoice_id = i.id
LEFT JOIN customers c ON i.customer_id = c.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
ORDER BY i.created_at DESC
```

### Customers Who Bought Product
```sql
SELECT DISTINCT c.name as customer, c.phone,
    COUNT(DISTINCT i.id) as purchase_count,
    SUM(ii.quantity) as total_quantity
FROM products p
JOIN invoice_items ii ON p.id = ii.product_id
JOIN invoices i ON ii.invoice_id = i.id
JOIN customers c ON i.customer_id = c.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
GROUP BY c.id
ORDER BY total_quantity DESC
```

### Supplier Payments for Product
```sql
SELECT p.name as product, sp.amount, sp.payment_method,
    sp.paid_at, sp.note, s.name as supplier
FROM products p
JOIN supplier_payments sp ON p.id = sp.product_id
JOIN suppliers s ON sp.supplier_id = s.id
WHERE LOWER(p.name) LIKE LOWER('%product_name%')
ORDER BY sp.paid_at DESC
```
