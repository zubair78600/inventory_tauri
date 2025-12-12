# Products Documentation

## Overview
The `products` table stores all product/item information in the inventory system.

## Key Fields

- **id**: Unique identifier for the product
- **name**: Display name of the product
- **sku**: Stock Keeping Unit - unique code for the product (e.g., "SKU-001")
- **price**: Purchase/cost price from the supplier
- **selling_price**: Price at which the product is sold to customers
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
