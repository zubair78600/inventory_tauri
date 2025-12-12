# Inventory/FIFO Documentation

## Overview
The system uses FIFO (First-In-First-Out) inventory tracking via `inventory_batches` and `inventory_transactions` tables.

## Inventory Batches

Each batch represents a specific purchase of products.

### Key Fields
- **product_id**: Which product
- **po_item_id**: Link to purchase order item
- **quantity_remaining**: Units still available in this batch
- **unit_cost**: Cost per unit for this batch
- **purchase_date**: When this batch was received

### FIFO Logic
When selling products:
1. Find oldest batch (by purchase_date) with quantity_remaining > 0
2. Deduct from that batch first
3. If more needed, move to next oldest batch
4. Continue until requested quantity is fulfilled

## Inventory Transactions

Complete audit trail of all stock movements.

### Transaction Types
- **purchase**: Stock received from supplier (increases stock)
- **sale**: Stock sold to customer (decreases stock)
- **adjustment**: Manual adjustment (increase or decrease)
- **return**: Customer return (increases stock)

### Key Fields
- **transaction_type**: Type of movement
- **quantity_change**: Positive (in) or negative (out)
- **reference_type**: What triggered this (invoice, purchase_order, adjustment)
- **reference_id**: ID of the triggering record
- **balance_after**: Stock level after this transaction

## Common Query Patterns

- Current stock by batch:
  ```sql
  SELECT product_id, SUM(quantity_remaining) as total_stock
  FROM inventory_batches
  GROUP BY product_id
  ```

- Stock movement history:
  ```sql
  SELECT * FROM inventory_transactions
  WHERE product_id = X
  ORDER BY transaction_date DESC
  ```

- Weighted average cost:
  ```sql
  SELECT product_id,
         SUM(quantity_remaining * unit_cost) / SUM(quantity_remaining) as avg_cost
  FROM inventory_batches
  WHERE quantity_remaining > 0
  GROUP BY product_id
  ```

- Stock value:
  ```sql
  SELECT SUM(quantity_remaining * unit_cost) as total_value
  FROM inventory_batches
  WHERE quantity_remaining > 0
  ```
