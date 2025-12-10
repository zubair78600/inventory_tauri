/// SQL schema for creating tables
/// This matches the Prisma schema but adapted for rusqlite

pub const CREATE_TABLES_SQL: &str = r#"
-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    selling_price REAL,
    initial_stock INTEGER,
    stock_quantity INTEGER NOT NULL,
    quantity_sold INTEGER,
    sold_revenue REAL,
    supplier_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    image_path TEXT,
    category TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_info TEXT,
    address TEXT,
    email TEXT,
    comments TEXT,
    state TEXT,
    district TEXT,
    town TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    place TEXT,
    state TEXT,
    district TEXT,
    town TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    total_amount REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    cgst_amount REAL,
    fy_year TEXT,
    gst_rate REAL,
    igst_amount REAL,
    sgst_amount REAL,
    state TEXT,
    district TEXT,
    town TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- InvoiceItems table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    product_name TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Deleted Items table (audit trail for all deletions)
CREATE TABLE IF NOT EXISTS deleted_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_data TEXT NOT NULL,
    related_data TEXT,
    deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_by TEXT
);

-- Invoice Modifications table (audit trail for invoice edits)
CREATE TABLE IF NOT EXISTS invoice_modifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    modified_by TEXT,
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    original_data TEXT,
    new_data TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Entity Modifications table (universal audit trail for all entity updates)
CREATE TABLE IF NOT EXISTS entity_modifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_name TEXT,
    action TEXT NOT NULL DEFAULT 'updated',
    field_changes TEXT,
    modified_by TEXT,
    modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Supplier Payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT,
    note TEXT,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Customer Payments table (for credit/accounts receivable tracking)
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    note TEXT,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_type ON deleted_items(entity_type);
CREATE INDEX IF NOT EXISTS idx_deleted_items_date ON deleted_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_paid_at ON supplier_payments(paid_at);

-- Customer Payments indexes
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_invoice ON customer_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_paid_at ON customer_payments(paid_at);

-- Performance Indices for Sorting and Searching
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON suppliers(contact_info);

-- Critical Performance Indexes for Large Datasets (100K+ records)
-- Index for invoice sorting by date (used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Composite index for customer invoice stats (JOIN optimization)
CREATE INDEX IF NOT EXISTS idx_invoices_customer_created ON invoices(customer_id, created_at DESC);

-- Composite indexes for keyset/cursor pagination (fast pagination at any page)
CREATE INDEX IF NOT EXISTS idx_products_name_id ON products(name, id);
CREATE INDEX IF NOT EXISTS idx_customers_name_id ON customers(name, id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_id ON suppliers(name, id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_id ON invoices(created_at DESC, id);

-- Partial index for low stock products (dashboard widget)
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock_quantity) WHERE stock_quantity < 10;

-- Index for invoice items aggregation
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_product ON invoice_items(invoice_id, product_id);

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        permissions TEXT NOT NULL, -- JSON string of allowed paths/modules
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
"#;

/// Migration SQL to update existing tables
/// These are run after table creation to handle schema updates
pub const MIGRATION_SQL: &str = r#"
-- Suppliers table migrations
-- Add district column if it doesn't exist (replaces place)
-- Add town column if it doesn't exist
-- Note: SQLite doesn't support DROP COLUMN directly, so we keep place for backwards compatibility

-- Check and add district column to suppliers
-- SQLite doesn't have an elegant way to check if column exists, so we use a workaround
-- This will fail silently if column already exists (which is fine)

PRAGMA foreign_keys=off;

-- For suppliers: Add new columns if they don't exist
-- SQLite will error if column exists, but we handle this in Rust

-- For invoices: Add new columns if they don't exist
-- SQLite will error if column exists, but we handle this in Rust

-- For products: Add selling_price and initial_stock columns if they don't exist
-- SQLite will error if column exists, but we handle this in Rust

-- Add category to products
-- ALTER TABLE products ADD COLUMN category TEXT;

-- Add image_path to suppliers if missing (manual check needed in code usually, but here we rely on Rust logic to run specific ALTERs if needed, or lenient execution)
-- In `db.rs` migration logic, we should probably handle this.
-- But since we are using lenient execution (ignoring 'duplicate column' errors), we can just try to add them.

-- ALTER TABLE suppliers ADD COLUMN image_path TEXT;
-- ALTER TABLE customers ADD COLUMN image_path TEXT;

PRAGMA foreign_keys=on;
"#;

// Include the purchase order migration module
pub mod purchase_order_migration {
    /// Migration SQL for Purchase Order and FIFO Inventory System
    pub const PURCHASE_ORDER_MIGRATION_SQL: &str = include_str!("migration_purchase_orders.sql");
}
