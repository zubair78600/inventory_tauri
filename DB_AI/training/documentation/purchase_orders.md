# Purchase Orders Documentation

## Overview
The `purchase_orders` table tracks orders placed with suppliers to replenish inventory.

## Key Fields

- **id**: Unique identifier
- **po_number**: Purchase order number (e.g., "PO-2024-0001")
- **supplier_id**: Reference to supplier
- **order_date**: When the order was placed
- **expected_delivery_date**: Expected arrival date
- **received_date**: Actual receipt date
- **status**: Order status (pending, ordered, received, cancelled)
- **total_amount**: Total order value
- **notes**: Additional notes

## Purchase Order Items

Each PO has line items in `purchase_order_items`:
- **quantity**: Number of units ordered
- **unit_cost**: Cost per unit
- **total_cost**: quantity * unit_cost
- **product_id**: Reference to product

## Status Flow

1. **pending**: Draft order
2. **ordered**: Order placed with supplier
3. **received**: Goods received and stock updated
4. **cancelled**: Order cancelled

## Inventory Updates

When a PO is marked as "received":
1. Product stock_quantity increases
2. Inventory batch is created for FIFO tracking
3. Inventory transaction is logged

## Common Query Patterns

- Pending POs: WHERE status = 'pending' OR status = 'ordered'
- POs by supplier: WHERE supplier_id = X
- Recent POs: ORDER BY order_date DESC
- Total purchases from supplier:
  ```sql
  SELECT supplier_id, SUM(total_amount)
  FROM purchase_orders
  WHERE status = 'received'
  GROUP BY supplier_id
  ```
