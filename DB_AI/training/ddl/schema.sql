-- Complete Database Schema for Inventory System
-- This file contains all table definitions for training VannaAI

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,           -- Stock Keeping Unit, unique identifier
    price REAL NOT NULL,                 -- Purchase/cost price from supplier
    selling_price REAL,                  -- Selling price to customers
    initial_stock INTEGER,               -- Starting stock when product was added
    stock_quantity INTEGER NOT NULL,     -- Current available stock
    quantity_sold INTEGER,               -- Total quantity sold to date
    sold_revenue REAL,                   -- Total revenue from sales
    supplier_id INTEGER,                 -- Primary supplier reference
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    image_path TEXT,                     -- Path to product image
    category TEXT,                       -- Product category/type
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- =============================================
-- SUPPLIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_info TEXT,                   -- Phone number or contact details
    address TEXT,                        -- Full address
    email TEXT,
    comments TEXT,                       -- Notes about supplier
    state TEXT,                          -- State/Province
    district TEXT,                       -- District/County
    town TEXT,                           -- Town/City
    image_path TEXT,                     -- Path to supplier image
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    place TEXT,                          -- Location/Place name
    state TEXT,
    district TEXT,
    town TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================
-- INVOICES TABLE (Sales)
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,  -- Format: INV-YYYY-NNNN
    customer_id INTEGER,                  -- Can be NULL for walk-in customers
    total_amount REAL NOT NULL,           -- Final amount including tax
    tax_amount REAL NOT NULL DEFAULT 0,   -- Total tax amount
    discount_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT,                  -- Cash, UPI, Card, Credit
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    cgst_amount REAL,                     -- Central GST
    fy_year TEXT,                         -- Fiscal year (e.g., "2024-25")
    gst_rate REAL,                        -- GST percentage
    igst_amount REAL,                     -- Integrated GST (inter-state)
    sgst_amount REAL,                     -- State GST
    state TEXT,
    district TEXT,
    town TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- =============================================
-- INVOICE ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,            -- Quantity sold
    unit_price REAL NOT NULL,             -- Price per unit at time of sale
    product_name TEXT,                    -- Denormalized product name
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =============================================
-- PURCHASE ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,       -- Format: PO-YYYY-NNNN
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    expected_delivery_date TEXT,
    received_date TEXT,
    status TEXT NOT NULL DEFAULT 'received', -- pending, ordered, received, cancelled
    total_amount REAL NOT NULL,           -- Total PO value
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- =============================================
-- PURCHASE ORDER ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,            -- Quantity ordered/received
    unit_cost REAL NOT NULL,              -- Cost per unit
    total_cost REAL NOT NULL,             -- quantity * unit_cost
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =============================================
-- INVENTORY BATCHES TABLE (FIFO Tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    po_item_id INTEGER,                   -- Link to purchase order item
    quantity_remaining INTEGER NOT NULL,  -- Units remaining in batch
    unit_cost REAL NOT NULL,              -- Cost per unit for this batch
    purchase_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id)
);

-- =============================================
-- INVENTORY TRANSACTIONS TABLE (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,       -- purchase, sale, adjustment, return
    quantity_change INTEGER NOT NULL,     -- Positive for in, negative for out
    unit_cost REAL,
    reference_type TEXT,                  -- invoice, purchase_order, adjustment
    reference_id INTEGER,
    balance_after INTEGER NOT NULL,       -- Stock balance after transaction
    transaction_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =============================================
-- PRODUCT SUPPLIERS TABLE (Many-to-Many)
-- =============================================
CREATE TABLE IF NOT EXISTS product_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    supplier_sku TEXT,                    -- SKU used by this supplier
    unit_cost REAL,                       -- Cost from this supplier
    lead_time_days INTEGER,               -- Days to receive
    minimum_order_quantity INTEGER,
    is_preferred INTEGER DEFAULT 0,       -- 1 if preferred supplier
    last_purchase_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE(product_id, supplier_id)
);

-- =============================================
-- SUPPLIER PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_id INTEGER,                   -- Optional link to product
    po_id INTEGER,                        -- Optional link to purchase order
    amount REAL NOT NULL,                 -- Payment amount
    payment_method TEXT,                  -- Cash, Bank Transfer, UPI
    note TEXT,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =============================================
-- CUSTOMER PAYMENTS TABLE (Credit/AR Tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,                 -- Payment amount
    payment_method TEXT,
    note TEXT,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- =============================================
-- DELETED ITEMS TABLE (Audit Trail for Deletions)
-- =============================================
CREATE TABLE IF NOT EXISTS deleted_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,            -- product, customer, supplier, invoice
    entity_id INTEGER NOT NULL,
    entity_data TEXT NOT NULL,            -- JSON of deleted entity
    related_data TEXT,                    -- JSON of related deleted data
    deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_by TEXT
);

-- =============================================
-- INVOICE MODIFICATIONS TABLE (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS invoice_modifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    action TEXT NOT NULL,                 -- edit, delete
    modified_by TEXT,
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    original_data TEXT,                   -- JSON of original state
    new_data TEXT,                        -- JSON of new state
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- =============================================
-- ENTITY MODIFICATIONS TABLE (Universal Audit)
-- =============================================
CREATE TABLE IF NOT EXISTS entity_modifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_name TEXT,
    action TEXT NOT NULL DEFAULT 'updated',
    field_changes TEXT,                   -- JSON of field changes
    modified_by TEXT,
    modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,                   -- admin, user
    permissions TEXT NOT NULL,            -- JSON of allowed paths/modules
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
