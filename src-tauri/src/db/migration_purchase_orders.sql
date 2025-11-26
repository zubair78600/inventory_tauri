-- =============================================
-- PURCHASE ORDERS SYSTEM
-- Migration SQL for Purchase Order and FIFO Inventory System
-- =============================================

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    expected_delivery_date TEXT,
    received_date TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    total_amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Purchase Order Items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =============================================
-- FIFO INVENTORY TRACKING
-- =============================================

-- Inventory Batches table (FIFO tracking)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    po_item_id INTEGER,
    quantity_remaining INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    purchase_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id)
);

-- Inventory Transactions table (complete audit trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    unit_cost REAL,
    reference_type TEXT,
    reference_id INTEGER,
    balance_after INTEGER NOT NULL,
    transaction_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- =============================================
-- MULTI-SUPPLIER SUPPORT
-- =============================================

-- Product Suppliers junction table (many-to-many)
CREATE TABLE IF NOT EXISTS product_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    supplier_sku TEXT,
    unit_cost REAL,
    lead_time_days INTEGER,
    minimum_order_quantity INTEGER,
    is_preferred INTEGER DEFAULT 0,
    last_purchase_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE(product_id, supplier_id)
);

-- =============================================
-- SUPPLIER PAYMENTS ENHANCEMENT
-- =============================================

-- Add po_id column to supplier_payments if it doesn't exist
-- This links payments to purchase orders

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Purchase Orders indexes
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- Purchase Order Items indexes
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- Inventory Batches indexes
CREATE INDEX IF NOT EXISTS idx_inv_batch_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_date ON inventory_batches(purchase_date);
CREATE INDEX IF NOT EXISTS idx_inv_batch_po_item ON inventory_batches(po_item_id);

-- Inventory Transactions indexes
CREATE INDEX IF NOT EXISTS idx_inv_trans_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inv_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inv_trans_reference ON inventory_transactions(reference_type, reference_id);

-- Product Suppliers indexes
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred ON product_suppliers(is_preferred);

-- Supplier Payments index for PO (will be added after column is added)
CREATE INDEX IF NOT EXISTS idx_supplier_payments_po ON supplier_payments(po_id);
