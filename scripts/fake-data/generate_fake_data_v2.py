#!/usr/bin/env python3
"""
Dynamic Fake Data Generator for Inventory Management System
Generates category-specific fake data with proper relationships

Key Features:
- Products are created through Purchase Orders from suppliers
- Proper supplier-product relationships maintained
- Customer credit tracking with payment history
- FIFO inventory batch tracking
- Dynamic category selection with custom option
"""

import sqlite3
import random
import os
from datetime import datetime, timedelta
from faker import Faker

# Initialize Faker with Indian locale
fake = Faker('en_IN')

# ============================================================================
# CATEGORY TEMPLATES
# ============================================================================

CATEGORY_TEMPLATES = {
    "chocolates": {
        "name": "Chocolates",
        "sku_prefix": "Choco",
        "suppliers": [
            {"name": "Cadbury Dealers", "state": "Maharashtra", "district": "Mumbai", "town": "Andheri"},
            {"name": "Nestle Distributors", "state": "Karnataka", "district": "Bangalore", "town": "Whitefield"},
            {"name": "Ferrero Wholesale", "state": "Delhi", "district": "New Delhi", "town": "Connaught Place"},
            {"name": "Mars India Traders", "state": "Tamil Nadu", "district": "Chennai", "town": "T Nagar"},
            {"name": "Hershey's Suppliers", "state": "Telangana", "district": "Hyderabad", "town": "Banjara Hills"},
        ],
        "products": [
            {"name": "Cadbury Dairy Milk", "price": 10, "selling_price": 12},
            {"name": "Cadbury Dairy Milk Silk", "price": 70, "selling_price": 85},
            {"name": "KitKat", "price": 20, "selling_price": 25},
            {"name": "Snickers", "price": 40, "selling_price": 50},
            {"name": "5 Star", "price": 15, "selling_price": 20},
            {"name": "Perk", "price": 10, "selling_price": 12},
            {"name": "Munch", "price": 10, "selling_price": 12},
            {"name": "Milky Bar", "price": 15, "selling_price": 20},
            {"name": "Ferrero Rocher (3pc)", "price": 100, "selling_price": 130},
            {"name": "Ferrero Rocher (16pc)", "price": 400, "selling_price": 500},
            {"name": "Kisses", "price": 90, "selling_price": 120},
            {"name": "Gems", "price": 20, "selling_price": 25},
            {"name": "Eclairs", "price": 5, "selling_price": 7},
            {"name": "Bounty", "price": 50, "selling_price": 65},
            {"name": "Twix", "price": 45, "selling_price": 60},
            {"name": "Mars Bar", "price": 50, "selling_price": 65},
            {"name": "Toblerone", "price": 150, "selling_price": 200},
            {"name": "Lindt Excellence", "price": 250, "selling_price": 320},
            {"name": "Kinder Joy", "price": 40, "selling_price": 50},
            {"name": "Kinder Bueno", "price": 80, "selling_price": 100},
            {"name": "Oreo Chocolate", "price": 30, "selling_price": 40},
            {"name": "Bournville", "price": 100, "selling_price": 130},
            {"name": "Temptations", "price": 90, "selling_price": 120},
            {"name": "Amul Dark Chocolate", "price": 60, "selling_price": 80},
            {"name": "Nutella (350g)", "price": 350, "selling_price": 450},
        ],
    },
    "clothes": {
        "name": "Clothes",
        "sku_prefix": "Cloth",
        "suppliers": [
            {"name": "Levi's Distributors", "state": "Maharashtra", "district": "Mumbai", "town": "Lower Parel"},
            {"name": "Allen Solly Wholesale", "state": "Karnataka", "district": "Bangalore", "town": "MG Road"},
            {"name": "Peter England Dealers", "state": "Tamil Nadu", "district": "Chennai", "town": "Anna Nagar"},
            {"name": "Van Heusen Suppliers", "state": "Delhi", "district": "New Delhi", "town": "Saket"},
            {"name": "Raymond Traders", "state": "Gujarat", "district": "Ahmedabad", "town": "CG Road"},
        ],
        "products": [
            # Men
            {"name": "Levi's 501 Jeans (Men)", "price": 1800, "selling_price": 2500, "subcategory": "Men"},
            {"name": "Allen Solly Formal Shirt (Men)", "price": 800, "selling_price": 1200, "subcategory": "Men"},
            {"name": "Peter England Polo T-Shirt (Men)", "price": 500, "selling_price": 750, "subcategory": "Men"},
            {"name": "Van Heusen Blazer (Men)", "price": 3000, "selling_price": 4500, "subcategory": "Men"},
            {"name": "Raymond Trouser (Men)", "price": 1200, "selling_price": 1800, "subcategory": "Men"},
            {"name": "Cotton Casual Shirt (Men)", "price": 400, "selling_price": 600, "subcategory": "Men"},
            {"name": "Denim Jacket (Men)", "price": 1500, "selling_price": 2200, "subcategory": "Men"},
            {"name": "Formal Suit 2-Piece (Men)", "price": 5000, "selling_price": 7500, "subcategory": "Men"},
            # Women
            {"name": "Cotton Kurti (Women)", "price": 400, "selling_price": 650, "subcategory": "Women"},
            {"name": "Silk Saree (Women)", "price": 2000, "selling_price": 3500, "subcategory": "Women"},
            {"name": "Anarkali Dress (Women)", "price": 1200, "selling_price": 1800, "subcategory": "Women"},
            {"name": "Palazzo Pants (Women)", "price": 500, "selling_price": 750, "subcategory": "Women"},
            {"name": "Designer Blouse (Women)", "price": 600, "selling_price": 900, "subcategory": "Women"},
            {"name": "Lehenga Choli (Women)", "price": 3500, "selling_price": 5500, "subcategory": "Women"},
            {"name": "Western Top (Women)", "price": 350, "selling_price": 550, "subcategory": "Women"},
            {"name": "Jeans (Women)", "price": 800, "selling_price": 1200, "subcategory": "Women"},
            # Kids
            {"name": "Kids T-Shirt", "price": 200, "selling_price": 350, "subcategory": "Kids"},
            {"name": "Kids Jeans", "price": 400, "selling_price": 650, "subcategory": "Kids"},
            {"name": "Kids Frock", "price": 350, "selling_price": 550, "subcategory": "Kids"},
            {"name": "Kids Ethnic Wear", "price": 600, "selling_price": 950, "subcategory": "Kids"},
            {"name": "Kids School Uniform Set", "price": 500, "selling_price": 750, "subcategory": "Kids"},
        ],
    },
    "mobiles": {
        "name": "Mobiles",
        "sku_prefix": "Mobile",
        "suppliers": [
            {"name": "Samsung Authorized Distributors", "state": "Karnataka", "district": "Bangalore", "town": "Electronic City"},
            {"name": "Apple India Wholesale", "state": "Maharashtra", "district": "Mumbai", "town": "BKC"},
            {"name": "OnePlus Official Dealers", "state": "Delhi", "district": "New Delhi", "town": "Nehru Place"},
            {"name": "Xiaomi Distributors India", "state": "Tamil Nadu", "district": "Chennai", "town": "Velachery"},
            {"name": "Vivo Oppo Traders", "state": "Uttar Pradesh", "district": "Noida", "town": "Sector 18"},
        ],
        "products": [
            {"name": "Samsung Galaxy S24 Ultra", "price": 95000, "selling_price": 134999},
            {"name": "Samsung Galaxy S24", "price": 65000, "selling_price": 79999},
            {"name": "Samsung Galaxy A54", "price": 28000, "selling_price": 38999},
            {"name": "Samsung Galaxy M34", "price": 14000, "selling_price": 18999},
            {"name": "iPhone 15 Pro Max", "price": 140000, "selling_price": 179900},
            {"name": "iPhone 15 Pro", "price": 115000, "selling_price": 149900},
            {"name": "iPhone 15", "price": 68000, "selling_price": 79900},
            {"name": "iPhone SE", "price": 40000, "selling_price": 49900},
            {"name": "OnePlus 12", "price": 55000, "selling_price": 69999},
            {"name": "OnePlus Nord CE 4", "price": 22000, "selling_price": 29999},
            {"name": "Xiaomi 14", "price": 55000, "selling_price": 69999},
            {"name": "Redmi Note 13 Pro", "price": 20000, "selling_price": 29999},
            {"name": "Redmi 13C", "price": 8000, "selling_price": 11999},
            {"name": "Vivo V30 Pro", "price": 38000, "selling_price": 51999},
            {"name": "Oppo Reno 11", "price": 32000, "selling_price": 43999},
            {"name": "Realme GT 5 Pro", "price": 40000, "selling_price": 56999},
        ],
    },
    "groceries": {
        "name": "Groceries",
        "sku_prefix": "Grocery",
        "suppliers": [
            {"name": "Tata Consumer Distributors", "state": "Maharashtra", "district": "Mumbai", "town": "Worli"},
            {"name": "ITC Foods Wholesale", "state": "West Bengal", "district": "Kolkata", "town": "Salt Lake"},
            {"name": "Britannia Dealers", "state": "Karnataka", "district": "Bangalore", "town": "Peenya"},
            {"name": "Parle Agro Suppliers", "state": "Gujarat", "district": "Ahmedabad", "town": "Naroda"},
            {"name": "Patanjali Distributors", "state": "Uttarakhand", "district": "Haridwar", "town": "SIDCUL"},
        ],
        "products": [
            {"name": "Tata Salt (1kg)", "price": 22, "selling_price": 28},
            {"name": "Tata Tea Premium (500g)", "price": 180, "selling_price": 240},
            {"name": "Tata Sampann Dal (1kg)", "price": 120, "selling_price": 160},
            {"name": "Aashirvaad Atta (5kg)", "price": 220, "selling_price": 295},
            {"name": "Aashirvaad Atta (10kg)", "price": 420, "selling_price": 550},
            {"name": "Fortune Sunflower Oil (1L)", "price": 130, "selling_price": 175},
            {"name": "Saffola Gold Oil (1L)", "price": 160, "selling_price": 210},
            {"name": "Britannia Good Day (250g)", "price": 40, "selling_price": 55},
            {"name": "Britannia Marie Gold (250g)", "price": 30, "selling_price": 42},
            {"name": "Parle-G (800g)", "price": 65, "selling_price": 85},
            {"name": "Parle Monaco (200g)", "price": 35, "selling_price": 45},
            {"name": "Maggi Noodles (4-pack)", "price": 48, "selling_price": 60},
            {"name": "MTR Ready to Eat Poha", "price": 55, "selling_price": 75},
            {"name": "Patanjali Desi Ghee (500g)", "price": 280, "selling_price": 360},
            {"name": "Patanjali Honey (500g)", "price": 140, "selling_price": 190},
            {"name": "Amul Butter (500g)", "price": 250, "selling_price": 310},
            {"name": "Mother Dairy Milk (1L)", "price": 56, "selling_price": 68},
            {"name": "Nestle Everyday Dairy (1kg)", "price": 380, "selling_price": 480},
            {"name": "Sugar (1kg)", "price": 42, "selling_price": 52},
            {"name": "Basmati Rice (5kg)", "price": 400, "selling_price": 520},
        ],
    },
    "electronics": {
        "name": "Electronics",
        "sku_prefix": "Elec",
        "suppliers": [
            {"name": "Sony India Distributors", "state": "Maharashtra", "district": "Mumbai", "town": "Andheri East"},
            {"name": "LG Electronics Wholesale", "state": "Uttar Pradesh", "district": "Noida", "town": "Sector 62"},
            {"name": "Philips Dealers India", "state": "Gujarat", "district": "Ahmedabad", "town": "GIDC"},
            {"name": "Havells Traders", "state": "Rajasthan", "district": "Jaipur", "town": "Sitapura"},
            {"name": "Bajaj Electricals Suppliers", "state": "Maharashtra", "district": "Pune", "town": "Hadapsar"},
        ],
        "products": [
            {"name": "Sony Bravia 55\" 4K TV", "price": 55000, "selling_price": 74990},
            {"name": "Sony Bravia 43\" Smart TV", "price": 32000, "selling_price": 44990},
            {"name": "LG 32\" LED TV", "price": 12000, "selling_price": 16990},
            {"name": "LG 1.5 Ton Split AC", "price": 32000, "selling_price": 45990},
            {"name": "LG 260L Refrigerator", "price": 22000, "selling_price": 29990},
            {"name": "LG 7kg Washing Machine", "price": 18000, "selling_price": 25990},
            {"name": "Philips Air Fryer", "price": 6000, "selling_price": 8990},
            {"name": "Philips Mixer Grinder", "price": 3500, "selling_price": 5290},
            {"name": "Philips Electric Kettle", "price": 1200, "selling_price": 1790},
            {"name": "Havells Ceiling Fan", "price": 1400, "selling_price": 2090},
            {"name": "Havells Water Heater 15L", "price": 6500, "selling_price": 8990},
            {"name": "Havells Iron", "price": 800, "selling_price": 1290},
            {"name": "Bajaj Room Heater", "price": 1800, "selling_price": 2590},
            {"name": "Bajaj Induction Cooktop", "price": 2200, "selling_price": 3290},
            {"name": "Sony WH-1000XM5 Headphones", "price": 22000, "selling_price": 29990},
            {"name": "JBL Bluetooth Speaker", "price": 3500, "selling_price": 4990},
            {"name": "Boat Airdopes", "price": 1200, "selling_price": 1799},
            {"name": "Mi Power Bank 20000mAh", "price": 1200, "selling_price": 1699},
        ],
    },
}

# ============================================================================
# DATABASE SCHEMA
# ============================================================================

DB_SCHEMA = """
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
    place TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    selling_price REAL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    initial_stock INTEGER,
    supplier_id INTEGER,
    amount_paid REAL,
    category TEXT,
    image_path TEXT,
    quantity_sold INTEGER DEFAULT 0,
    sold_revenue REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
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
    initial_paid REAL DEFAULT 0,
    credit_amount REAL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT,
    product_sku TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Purchase orders table
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

-- Purchase order items table
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

-- Supplier payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    product_id INTEGER,
    po_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT,
    note TEXT,
    paid_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

-- Customer payments table
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

-- Inventory batches table (FIFO tracking)
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

-- Inventory transactions table (audit trail)
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

-- Product suppliers junction table (multi-supplier support)
CREATE TABLE IF NOT EXISTS product_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    supplier_sku TEXT,
    unit_cost REAL,
    lead_time_days INTEGER,
    minimum_order_quantity INTEGER DEFAULT 1,
    is_preferred INTEGER DEFAULT 0,
    last_purchase_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE(product_id, supplier_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_trans_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_invoice ON customer_payments(invoice_id);

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

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_deleted_items_type ON deleted_items(entity_type);
CREATE INDEX IF NOT EXISTS idx_deleted_items_date ON deleted_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_created ON invoices(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name_id ON products(name, id);
CREATE INDEX IF NOT EXISTS idx_customers_name_id ON customers(name, id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_id ON suppliers(name, id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_id ON invoices(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock_quantity) WHERE stock_quantity < 10;
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_product ON invoice_items(invoice_id, product_id);
"""

PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def random_date(start_date, end_date):
    """Generate random datetime between start and end"""
    delta = end_date - start_date
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start_date + timedelta(seconds=random_seconds)


def format_currency(amount):
    """Format amount as Indian currency"""
    return f"₹{amount:,.2f}"


def scale_category_prices(category_data, target_avg_cost, target_avg_selling):
    """Scale product prices to hit target average cost and selling prices"""
    products = category_data.get("products", [])
    if not products:
        return category_data

    avg_cost = sum(p.get("price", 0) for p in products) / max(1, len(products))
    avg_selling = sum(p.get("selling_price", 0) for p in products) / max(1, len(products))

    cost_scale = (target_avg_cost / avg_cost) if avg_cost > 0 else 1.0
    selling_scale = (target_avg_selling / avg_selling) if avg_selling > 0 else 1.0

    scaled_products = []
    min_price = 0.01
    for product in products:
        new_product = product.copy()
        new_cost = round(max(min_price, product.get("price", 0) * cost_scale), 2)
        new_selling = round(max(min_price, product.get("selling_price", 0) * selling_scale), 2)
        new_product["price"] = new_cost
        new_product["selling_price"] = new_selling
        scaled_products.append(new_product)

    return {
        "name": category_data.get("name", "General"),
        "sku_prefix": category_data.get("sku_prefix", "PROD"),
        "suppliers": category_data.get("suppliers", []),
        "products": scaled_products
    }


def distribute_invoice_items(invoice_count, total_items, min_items_per_invoice=1, max_items_per_invoice=5):
    """Distribute total items across invoices with per-invoice min/max caps."""
    if invoice_count <= 0:
        raise ValueError("Invoice count must be > 0.")
    if total_items < (invoice_count * min_items_per_invoice):
        raise ValueError("Total items must be >= invoice count * min items per invoice.")
    if total_items > (invoice_count * max_items_per_invoice):
        raise ValueError("Total items exceed invoice count * max items per invoice.")

    items_per_invoice = [min_items_per_invoice] * invoice_count
    remaining = total_items - (invoice_count * min_items_per_invoice)
    max_extra = max_items_per_invoice - min_items_per_invoice

    for idx in range(invoice_count):
        invoices_left = invoice_count - idx - 1
        max_for_this = min(max_extra, remaining)
        min_for_this = max(0, remaining - (invoices_left * max_extra))
        extra = random.randint(min_for_this, max_for_this) if max_for_this > 0 else 0
        items_per_invoice[idx] += extra
        remaining -= extra
        if remaining <= 0:
            break

    if remaining != 0:
        raise RuntimeError("Failed to distribute invoice items to target count.")

    return items_per_invoice


# ============================================================================
# DATA GENERATOR CLASS
# ============================================================================

class DynamicDataGenerator:
    def __init__(
        self,
        category_data,
        budget,
        sales_start,
        sales_end,
        customer_count,
        sales_count,
        target_invoice_items=None,
        target_total_sales=None,
        target_purchase_orders=None,
        target_suppliers=None,
        cash_ratio=0.7,
        min_items_per_invoice=1,
        max_items_per_invoice=5,
        stock_buffer_multiplier=1.2,
        db_path='fake_inventory.db'
    ):
        self.category_data = category_data
        self.budget = budget
        self.sales_start = sales_start
        self.sales_end = sales_end
        self.customer_count = customer_count
        self.sales_count = sales_count
        self.target_invoice_items = target_invoice_items
        self.target_total_sales = target_total_sales
        self.target_purchase_orders = target_purchase_orders
        self.target_suppliers = target_suppliers
        self.cash_ratio = cash_ratio
        self.min_items_per_invoice = min_items_per_invoice
        self.max_items_per_invoice = max_items_per_invoice
        self.stock_buffer_multiplier = stock_buffer_multiplier
        self.db_path = db_path

        # Purchase dates: 1 month before sales start
        self.purchase_start = sales_start - timedelta(days=30)
        self.purchase_end = sales_start

        # Track created records
        self.supplier_ids = []
        self.product_data = []  # List of (id, name, sku, price, selling_price, supplier_id)
        self.customer_ids = []
        self.po_ids = []
        self.invoice_ids = []
        self.invoice_item_plan = None
        self.unit_price_cents = None
        self.unit_price_remainder = None
        self.unit_price_cursor = 0
        self.active_supplier_ids = []

        self.conn = None
        self.cursor = None

    def connect(self):
        """Connect to database and create schema"""
        # Remove existing database
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            print(f"✓ Removed existing database: {self.db_path}")

        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        print(f"✓ Connected to database: {self.db_path}")

        # Speed up large inserts
        self.cursor.execute("PRAGMA journal_mode=MEMORY")
        self.cursor.execute("PRAGMA synchronous=OFF")
        self.cursor.execute("PRAGMA temp_store=MEMORY")
        self.cursor.execute("PRAGMA cache_size=-20000")

        # Create schema
        print("Creating database schema...")
        self.cursor.executescript(DB_SCHEMA)
        self.conn.commit()
        print("✓ Schema created successfully")

        # Create default admin user
        self.cursor.execute("""
            INSERT INTO users (username, password, role, permissions, created_at)
            VALUES ('Admin', '1014209932', 'admin', '["/*"]', datetime('now'))
        """)
        self.conn.commit()

    def generate_suppliers(self):
        """Generate category-specific suppliers"""
        suppliers_data = self.category_data.get("suppliers", [])

        if self.target_suppliers:
            num_suppliers = min(self.target_suppliers, len(suppliers_data))
        else:
            # For large datasets (many products), use more suppliers
            # 1 supplier per ~100 products, minimum 3, max all available
            products_count = len(self.category_data.get("products", []))
            min_suppliers = max(3, products_count // 100)
            num_suppliers = min(len(suppliers_data), max(min_suppliers, random.randint(3, 5)))

        selected_suppliers = (
            random.sample(suppliers_data, num_suppliers)
            if num_suppliers < len(suppliers_data)
            else suppliers_data
        )

        print(f"\nGenerating {num_suppliers} suppliers...")

        for supplier in selected_suppliers:
            phone = fake.phone_number()
            email = fake.email()
            address = fake.address().replace('\n', ', ')
            created_at = random_date(self.purchase_start - timedelta(days=30), self.purchase_start).isoformat()

            self.cursor.execute("""
                INSERT INTO suppliers (name, contact_info, address, email, state, district, town, place, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                supplier["name"],
                f"Contact: {phone}",
                address,
                email,
                supplier.get("state", ""),
                supplier.get("district", ""),
                supplier.get("town", ""),
                supplier.get("town", ""),
                created_at,
                created_at
            ))
            self.supplier_ids.append(self.cursor.lastrowid)

        self.conn.commit()
        print(f"✓ Created {num_suppliers} suppliers")
        for sid in self.supplier_ids:
            self.cursor.execute("SELECT name FROM suppliers WHERE id = ?", (sid,))
            name = self.cursor.fetchone()[0]
            print(f"  - {name}")

        if self.target_purchase_orders:
            if self.target_purchase_orders > len(self.supplier_ids):
                print(f"  Note: purchase orders capped to {len(self.supplier_ids)} suppliers.")
                self.active_supplier_ids = list(self.supplier_ids)
            else:
                self.active_supplier_ids = random.sample(self.supplier_ids, self.target_purchase_orders)
        else:
            self.active_supplier_ids = list(self.supplier_ids)

    def generate_products_and_purchase_orders(self):
        """Generate products through purchase orders, distributing budget"""
        products_template = self.category_data.get("products", [])
        sku_prefix = self.category_data.get("sku_prefix", "PROD")
        category_name = self.category_data.get("name", "General")
        products_count = len(products_template)

        print(f"\nGenerating products and purchase orders...")
        print(f"  Budget: {format_currency(self.budget)}")
        print(f"  Products to create: {products_count}")

        # For large datasets, we need to distribute ALL products across suppliers
        # and buy enough quantity for target sales (avg 3 items per sale)
        quantity_plan = None
        if self.target_invoice_items:
            target_units = int(self.target_invoice_items * self.stock_buffer_multiplier)
            if target_units < products_count:
                target_units = products_count

            base_quantity = max(1, target_units // max(1, products_count))
            quantities = [base_quantity] * products_count
            remaining = target_units - (base_quantity * products_count)
            if remaining > 0:
                extra_indices = random.sample(range(products_count), remaining)
                for idx in extra_indices:
                    quantities[idx] += 1
            quantity_plan = quantities

        active_suppliers = self.active_supplier_ids or self.supplier_ids
        if not active_suppliers:
            print("✗ No active suppliers available for purchase orders!")
            return

        # Distribute products across active suppliers evenly
        products_per_supplier = max(1, len(products_template) // len(active_suppliers))

        total_spent = 0
        po_number = 1
        sku_number = 1
        product_idx = 0

        for supplier_id in active_suppliers:
            # Get supplier name
            self.cursor.execute("SELECT name FROM suppliers WHERE id = ?", (supplier_id,))
            supplier_name = self.cursor.fetchone()[0]

            # Allocate products to this supplier (distribute evenly for large datasets)
            start_idx = product_idx
            end_idx = min(product_idx + products_per_supplier, len(products_template))

            # Last supplier gets remaining products
            if supplier_id == active_suppliers[-1]:
                end_idx = len(products_template)

            supplier_products = products_template[start_idx:end_idx]
            product_idx = end_idx

            if not supplier_products:
                continue

            # Create PO for this supplier
            po_date = random_date(self.purchase_start, self.purchase_end)
            received_date = po_date + timedelta(days=random.randint(1, 5))

            year = po_date.year
            po_number_str = f"PO-{year}-{po_number:03d}"

            # Calculate budget per supplier
            supplier_budget = self.budget / len(active_suppliers)
            po_total = 0
            po_items = []

            for idx, product in enumerate(supplier_products):
                # Create product
                product_name = product["name"]
                price = product["price"]
                selling_price = product["selling_price"]
                subcategory = product.get("subcategory", "")
                # Use _category if set (from merged categories), otherwise use category_name
                prod_category = product.get("_category", category_name)
                full_category = f"{prod_category} - {subcategory}" if subcategory else prod_category

                # Use product-specific SKU prefix if available (from merged categories)
                prod_sku_prefix = product.get("_sku_prefix", sku_prefix)
                sku = f"{prod_sku_prefix}_{sku_number}"
                sku_number += 1

                # Calculate quantity - enough for target sales
                if quantity_plan:
                    global_idx = start_idx + idx
                    quantity = quantity_plan[global_idx]
                else:
                    if self.target_invoice_items:
                        target_units = int(self.target_invoice_items * self.stock_buffer_multiplier)
                        base_quantity = max(10, target_units // max(1, len(products_template)))
                    else:
                        # Each product should have enough stock for: (target_sales * 3 items * buffer) / num_products
                        # Using 5x buffer to ensure we don't run out (random selection causes uneven distribution)
                        base_quantity = max(100, (self.sales_count * 3 * 5) // max(1, len(products_template)))
                    # Add some randomness
                    quantity = random.randint(base_quantity, int(base_quantity * 1.5))

                    # Respect budget but prioritize getting enough stock
                    max_affordable = int(supplier_budget / price) if price > 0 else quantity
                    quantity = min(quantity, max(10, max_affordable))

                    if quantity <= 0:
                        continue

                item_total = quantity * price
                if not quantity_plan and total_spent + item_total > self.budget:
                    # Reduce quantity to fit remaining budget
                    remaining = self.budget - total_spent
                    quantity = int(remaining / price) if price > 0 else 0
                    if quantity < 0:
                        quantity = 0
                    item_total = quantity * price

                supplier_budget -= item_total

                created_at = po_date.isoformat()

                # Insert product
                self.cursor.execute("""
                    INSERT INTO products (name, sku, price, selling_price, stock_quantity, initial_stock,
                                        supplier_id, amount_paid, category, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    product_name, sku, price, selling_price, 0, 0,
                    supplier_id, 0, full_category, created_at, created_at
                ))
                product_id = self.cursor.lastrowid

                self.product_data.append({
                    "id": product_id,
                    "name": product_name,
                    "sku": sku,
                    "price": price,
                    "selling_price": selling_price,
                    "supplier_id": supplier_id,
                    "stock": quantity
                })

                if quantity > 0:
                    po_items.append({
                        "product_id": product_id,
                        "quantity": quantity,
                        "unit_cost": price,
                        "total_cost": item_total
                    })

                po_total += item_total
                total_spent += item_total

            if not po_items:
                # Create empty PO to preserve PO count when budget is exhausted
                self.cursor.execute("""
                    INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_delivery_date,
                                                received_date, status, total_amount, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    po_number_str, supplier_id, po_date.isoformat(),
                    (po_date + timedelta(days=7)).isoformat(),
                    received_date.isoformat(), 'received', 0,
                    'No items (budget exhausted)', po_date.isoformat(), received_date.isoformat()
                ))
                po_id = self.cursor.lastrowid
                self.po_ids.append(po_id)
                po_number += 1
                continue

            # Create purchase order
            self.cursor.execute("""
                INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_delivery_date,
                                            received_date, status, total_amount, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                po_number_str, supplier_id, po_date.isoformat(),
                (po_date + timedelta(days=7)).isoformat(),
                received_date.isoformat(), 'received', po_total,
                po_date.isoformat(), received_date.isoformat()
            ))
            po_id = self.cursor.lastrowid
            self.po_ids.append(po_id)

            # Create PO items, update product stock, and create inventory batches
            for item in po_items:
                self.cursor.execute("""
                    INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost, total_cost, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (po_id, item["product_id"], item["quantity"], item["unit_cost"], item["total_cost"], po_date.isoformat()))
                po_item_id = self.cursor.lastrowid

                # Update product stock
                self.cursor.execute("""
                    UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ?
                    WHERE id = ?
                """, (item["quantity"], received_date.isoformat(), item["product_id"]))

                # Get new balance
                self.cursor.execute("SELECT stock_quantity FROM products WHERE id = ?", (item["product_id"],))
                balance = self.cursor.fetchone()[0]

                # Create inventory batch
                self.cursor.execute("""
                    INSERT INTO inventory_batches (product_id, po_item_id, quantity_remaining, unit_cost, purchase_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (item["product_id"], po_item_id, item["quantity"], item["unit_cost"], po_date.isoformat(), po_date.isoformat()))

                # Create inventory transaction
                self.cursor.execute("""
                    INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, unit_cost,
                                                       reference_type, reference_id, balance_after, transaction_date, created_at)
                    VALUES (?, 'purchase', ?, ?, 'purchase_order', ?, ?, ?, ?)
                """, (item["product_id"], item["quantity"], item["unit_cost"], po_item_id, balance, po_date.isoformat(), po_date.isoformat()))

            # Create supplier payment (50% of PO total)
            payment_amount = po_total * 0.5
            self.cursor.execute("""
                INSERT INTO supplier_payments (supplier_id, po_id, amount, payment_method, note, paid_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                supplier_id, po_id, payment_amount, random.choice(PAYMENT_METHODS),
                "Initial payment (50%)", po_date.isoformat(), po_date.isoformat()
            ))

            print(f"  - PO {po_number_str}: {supplier_name} - {len(po_items)} products, {format_currency(po_total)} (50% paid: {format_currency(payment_amount)})")
            po_number += 1


        self.conn.commit()
        print(f"✓ Created {len(self.product_data)} products via {len(self.po_ids)} purchase orders")
        print(f"✓ Total purchase amount: {format_currency(total_spent)} (50% paid, 50% pending)")

    def generate_customers(self):
        """Generate fake customers"""
        print(f"\nGenerating {self.customer_count} customers...")

        indian_cities = [
            {'place': 'Mumbai', 'state': 'Maharashtra', 'district': 'Mumbai'},
            {'place': 'Delhi', 'state': 'Delhi', 'district': 'New Delhi'},
            {'place': 'Bangalore', 'state': 'Karnataka', 'district': 'Bangalore'},
            {'place': 'Hyderabad', 'state': 'Telangana', 'district': 'Hyderabad'},
            {'place': 'Chennai', 'state': 'Tamil Nadu', 'district': 'Chennai'},
            {'place': 'Kolkata', 'state': 'West Bengal', 'district': 'Kolkata'},
            {'place': 'Pune', 'state': 'Maharashtra', 'district': 'Pune'},
            {'place': 'Ahmedabad', 'state': 'Gujarat', 'district': 'Ahmedabad'},
            {'place': 'Jaipur', 'state': 'Rajasthan', 'district': 'Jaipur'},
            {'place': 'Lucknow', 'state': 'Uttar Pradesh', 'district': 'Lucknow'},
            {'place': 'Kurnool', 'state': 'Andhra Pradesh', 'district': 'Kurnool'},
        ]

        for i in range(self.customer_count):
            location = random.choice(indian_cities)
            created_at = random_date(self.sales_start - timedelta(days=30), self.sales_end).isoformat()

            self.cursor.execute("""
                INSERT INTO customers (name, email, phone, address, place, state, district, town, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                fake.name(),
                fake.email() if random.random() > 0.3 else None,
                fake.phone_number() if random.random() > 0.2 else None,
                fake.address().replace('\n', ', ') if random.random() > 0.4 else None,
                location['place'],
                location['state'],
                location['district'],
                location['place'],
                created_at,
                created_at
            ))
            self.customer_ids.append(self.cursor.lastrowid)

        self.conn.commit()
        print(f"✓ Created {self.customer_count} customers")

    def generate_sales(self):
        """Generate invoices and sales"""
        print(f"\nGenerating {self.sales_count} sales/invoices...")

        # Get products with available stock
        self.cursor.execute("SELECT id, name, sku, selling_price, stock_quantity FROM products WHERE stock_quantity > 0")
        available_products = self.cursor.fetchall()

        if not available_products:
            print("✗ No products with stock available for sales!")
            return

        product_info = {pid: (name, sku, price) for pid, name, sku, price, _ in available_products}
        stock_map = {pid: stock for pid, _, _, _, stock in available_products}
        seed_product_ids = []
        if self.target_invoice_items and self.target_invoice_items >= len(stock_map):
            seed_product_ids = list(stock_map.keys())
            random.shuffle(seed_product_ids)

        if self.target_invoice_items:
            if self.target_invoice_items < (self.sales_count * self.min_items_per_invoice):
                raise ValueError("Target invoice items are below invoices * min items per invoice.")
            if self.target_invoice_items > (self.sales_count * self.max_items_per_invoice):
                raise ValueError("Target invoice items exceed max items per invoice capacity.")
            self.invoice_item_plan = distribute_invoice_items(
                self.sales_count,
                self.target_invoice_items,
                min_items_per_invoice=self.min_items_per_invoice,
                max_items_per_invoice=self.max_items_per_invoice
            )
        else:
            self.target_invoice_items = self.sales_count * self.min_items_per_invoice
            self.invoice_item_plan = distribute_invoice_items(
                self.sales_count,
                self.target_invoice_items,
                min_items_per_invoice=self.min_items_per_invoice,
                max_items_per_invoice=self.max_items_per_invoice
            )

        if self.target_total_sales and self.target_invoice_items:
            total_cents = int(round(self.target_total_sales * 100))
            base_cents = total_cents // self.target_invoice_items
            remainder = total_cents - (base_cents * self.target_invoice_items)
            self.unit_price_cents = base_cents
            self.unit_price_remainder = remainder
            self.unit_price_cursor = 0

        invoice_number = 1
        sales_created = 0
        credit_sales = 0
        cash_sales = 0

        for i in range(self.sales_count):
            # Select random products (1-5 items per invoice)
            if self.invoice_item_plan:
                num_items = min(self.invoice_item_plan[i], len(available_products))
            else:
                num_items = random.randint(1, min(5, len(available_products)))
            selected_products = random.sample(available_products, num_items)

            # Check stock availability and calculate totals
            invoice_items = []
            subtotal = 0
            attempts = 0

            while len(invoice_items) < num_items and attempts < (num_items * 10):
                if seed_product_ids:
                    prod_id = seed_product_ids.pop()
                    prod_name, prod_sku, selling_price = product_info[prod_id]
                elif selected_products:
                    prod_id, prod_name, prod_sku, selling_price, stock_qty = selected_products.pop()
                else:
                    prod_id, prod_name, prod_sku, selling_price, stock_qty = random.choice(available_products)

                current_stock = stock_map.get(prod_id, 0)
                attempts += 1

                if current_stock <= 0:
                    continue

                if self.target_invoice_items:
                    quantity = 1
                else:
                    quantity = random.randint(1, min(5, current_stock))

                if self.unit_price_cents is not None:
                    if self.unit_price_cursor < self.unit_price_remainder:
                        price_cents = self.unit_price_cents + 1
                    else:
                        price_cents = self.unit_price_cents
                    unit_price = price_cents / 100
                    self.unit_price_cursor += 1
                else:
                    unit_price = selling_price or 0

                item_total = quantity * unit_price
                subtotal += item_total

                invoice_items.append({
                    "product_id": prod_id,
                    "product_name": prod_name,
                    "product_sku": prod_sku,
                    "quantity": quantity,
                    "unit_price": unit_price
                })

            if self.target_invoice_items and len(invoice_items) < num_items:
                raise RuntimeError("Insufficient stock to fulfill target invoice items.")

            if not invoice_items or subtotal <= 0:
                continue

            # Create invoice
            invoice_date = random_date(self.sales_start, self.sales_end)
            invoice_number_str = f"INV-{invoice_number:06d}"

            # Determine payment type: 30% credit, 70% cash
            is_credit = random.random() < (1 - self.cash_ratio)

            # Select customer (some invoices may not have customer for cash sales)
            customer_id = random.choice(self.customer_ids) if (is_credit or random.random() > 0.3) else None

            # Get customer location if available
            state, district, town = None, None, None
            if customer_id:
                self.cursor.execute("SELECT state, district, town FROM customers WHERE id = ?", (customer_id,))
                result = self.cursor.fetchone()
                if result:
                    state, district, town = result

            # Calculate GST (simplified)
            if self.target_total_sales:
                gst_rate = 0
                tax_amount = 0
                discount_amount = 0
            else:
                gst_rate = random.choice([0, 5, 12, 18])
                tax_amount = subtotal * (gst_rate / 100)
                discount_amount = subtotal * random.uniform(0, 0.1) if random.random() > 0.7 else 0
            total_amount = subtotal + tax_amount - discount_amount

            # Payment details
            if is_credit:
                payment_method = "Credit"
                initial_paid = total_amount * 0.5  # 50% initial payment
                credit_amount = total_amount - initial_paid
                credit_sales += 1
            else:
                payment_method = random.choice(['Cash', 'UPI', 'Card'])
                initial_paid = total_amount
                credit_amount = 0
                cash_sales += 1

            # Financial year
            if invoice_date.month >= 4:
                fy_year = f"{invoice_date.year}-{invoice_date.year + 1}"
            else:
                fy_year = f"{invoice_date.year - 1}-{invoice_date.year}"

            # GST split
            cgst_amount = tax_amount / 2 if gst_rate > 0 else 0
            sgst_amount = tax_amount / 2 if gst_rate > 0 else 0

            created_at = invoice_date.isoformat()

            # Insert invoice
            self.cursor.execute("""
                INSERT INTO invoices (invoice_number, customer_id, total_amount, tax_amount, discount_amount,
                                     payment_method, created_at, cgst_amount, fy_year, gst_rate, sgst_amount,
                                     state, district, town, initial_paid, credit_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                invoice_number_str, customer_id, total_amount, tax_amount, discount_amount,
                payment_method, created_at, cgst_amount, fy_year, gst_rate, sgst_amount,
                state, district, town, initial_paid, credit_amount
            ))
            invoice_id = self.cursor.lastrowid
            self.invoice_ids.append(invoice_id)

            # Insert invoice items and update product stock
            for item in invoice_items:
                self.cursor.execute("""
                    INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku, quantity, unit_price, discount_amount, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                """, (
                    invoice_id, item["product_id"], item["product_name"],
                    item["product_sku"], item["quantity"], item["unit_price"], created_at
                ))

                # Update product stock and sales tracking
                new_stock = stock_map[item["product_id"]] - item["quantity"]
                stock_map[item["product_id"]] = new_stock
                self.cursor.execute("""
                    UPDATE products
                    SET stock_quantity = stock_quantity - ?,
                        quantity_sold = COALESCE(quantity_sold, 0) + ?,
                        sold_revenue = COALESCE(sold_revenue, 0) + ?,
                        updated_at = ?
                    WHERE id = ?
                """, (item["quantity"], item["quantity"], item["quantity"] * item["unit_price"], created_at, item["product_id"]))

                # Create inventory transaction for sale
                self.cursor.execute("""
                    INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change,
                                                       reference_type, reference_id, balance_after, transaction_date, created_at)
                    VALUES (?, 'sale', ?, 'invoice', ?, ?, ?, ?)
                """, (item["product_id"], -item["quantity"], invoice_id, new_stock, created_at, created_at))

                # Update inventory batch (FIFO deduction)
                remaining = item["quantity"]
                self.cursor.execute("""
                    SELECT id, quantity_remaining FROM inventory_batches
                    WHERE product_id = ? AND quantity_remaining > 0
                    ORDER BY purchase_date ASC, id ASC
                """, (item["product_id"],))

                for batch_id, batch_qty in self.cursor.fetchall():
                    if remaining <= 0:
                        break
                    deduct = min(remaining, batch_qty)
                    new_qty = batch_qty - deduct
                    if new_qty <= 0:
                        self.cursor.execute("DELETE FROM inventory_batches WHERE id = ?", (batch_id,))
                    else:
                        self.cursor.execute("UPDATE inventory_batches SET quantity_remaining = ? WHERE id = ?", (new_qty, batch_id))
                    remaining -= deduct

            # Create initial customer payment record for credit sales
            if is_credit and customer_id and initial_paid > 0:
                self.cursor.execute("""
                    INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, note, paid_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    customer_id, invoice_id, initial_paid, 'Cash',
                    'Initial payment at invoice creation', created_at, created_at
                ))

            invoice_number += 1
            sales_created += 1

            # Refresh available products list periodically
            if sales_created % 2000 == 0:
                available_products = [
                    (pid, product_info[pid][0], product_info[pid][1], product_info[pid][2], stock)
                    for pid, stock in stock_map.items()
                    if stock > 0
                ]
                if not available_products:
                    print(f"  Stock depleted after {sales_created} sales")
                    break
            if sales_created % 10000 == 0:
                print(f"  Generated {sales_created:,} invoices...")

        self.conn.commit()
        print(f"✓ Created {sales_created} invoices")
        print(f"  - Cash sales: {cash_sales} (70%)")
        print(f"  - Credit sales: {credit_sales} (30% with 50% initial payment)")

    def generate_additional_customer_payments(self):
        """Generate additional payments for credit invoices (some cleared, some pending)"""
        print("\nGenerating customer payment history...")

        # Get all credit invoices
        self.cursor.execute("""
            SELECT id, customer_id, total_amount, initial_paid, credit_amount, created_at
            FROM invoices
            WHERE payment_method = 'Credit' AND customer_id IS NOT NULL AND credit_amount > 0
        """)
        credit_invoices = self.cursor.fetchall()

        payments_created = 0
        invoices_cleared = 0

        for invoice_id, customer_id, total_amount, initial_paid, credit_amount, created_at in credit_invoices:
            # 60% of credit invoices get additional payments
            if random.random() > 0.6:
                continue

            invoice_date = datetime.fromisoformat(created_at)
            remaining_credit = credit_amount

            # Generate 1-3 additional payments
            num_payments = random.randint(1, 3)

            for _ in range(num_payments):
                if remaining_credit <= 0:
                    break

                # Payment amount: either full remaining or partial
                if random.random() > 0.5:
                    payment_amount = remaining_credit  # Clear fully
                else:
                    payment_amount = remaining_credit * random.uniform(0.3, 0.7)

                payment_amount = round(payment_amount, 2)

                # Payment date: within 30 days after invoice
                payment_date = invoice_date + timedelta(days=random.randint(1, 30))
                if payment_date > self.sales_end:
                    payment_date = self.sales_end

                self.cursor.execute("""
                    INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, note, paid_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    customer_id, invoice_id, payment_amount, random.choice(PAYMENT_METHODS),
                    'Credit repayment', payment_date.isoformat(), payment_date.isoformat()
                ))

                remaining_credit -= payment_amount
                payments_created += 1

            # Update invoice credit_amount
            new_credit = max(0, credit_amount - (credit_amount - remaining_credit))
            if remaining_credit <= 0:
                invoices_cleared += 1

        self.conn.commit()
        print(f"✓ Created {payments_created} additional customer payments")
        print(f"  - {invoices_cleared} credit invoices fully cleared")

    def print_summary(self):
        """Print summary of generated data"""
        print("\n" + "=" * 60)
        print("DATA GENERATION SUMMARY")
        print("=" * 60)

        # Count records
        counts = {}
        tables = ['suppliers', 'products', 'customers', 'purchase_orders', 'invoices',
                  'invoice_items', 'purchase_order_items', 'supplier_payments',
                  'customer_payments', 'inventory_batches', 'inventory_transactions']

        for table in tables:
            self.cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = self.cursor.fetchone()[0]

        print(f"\nSuppliers:              {counts['suppliers']:,}")
        print(f"Products:               {counts['products']:,}")
        print(f"Customers:              {counts['customers']:,}")
        print(f"Purchase Orders:        {counts['purchase_orders']:,}")
        print(f"  - PO Items:           {counts['purchase_order_items']:,}")
        print(f"Invoices:               {counts['invoices']:,}")
        print(f"  - Invoice Items:      {counts['invoice_items']:,}")
        print(f"Supplier Payments:      {counts['supplier_payments']:,}")
        print(f"Customer Payments:      {counts['customer_payments']:,}")
        print(f"Inventory Batches:      {counts['inventory_batches']:,}")
        print(f"Inventory Transactions: {counts['inventory_transactions']:,}")

        # Financial summary
        self.cursor.execute("SELECT SUM(total_amount) FROM purchase_orders")
        total_purchases = self.cursor.fetchone()[0] or 0

        self.cursor.execute("SELECT SUM(amount) FROM supplier_payments")
        total_supplier_paid = self.cursor.fetchone()[0] or 0

        self.cursor.execute("SELECT SUM(total_amount) FROM invoices")
        total_sales = self.cursor.fetchone()[0] or 0

        self.cursor.execute("SELECT SUM(credit_amount) FROM invoices WHERE payment_method = 'Credit'")
        total_customer_credit = self.cursor.fetchone()[0] or 0

        self.cursor.execute("SELECT SUM(amount) FROM customer_payments")
        total_customer_paid = self.cursor.fetchone()[0] or 0

        print(f"\n--- Financial Summary ---")
        print(f"Total Purchases:        {format_currency(total_purchases)}")
        print(f"Paid to Suppliers:      {format_currency(total_supplier_paid)} ({total_supplier_paid/total_purchases*100:.0f}%)" if total_purchases > 0 else "")
        print(f"Pending to Suppliers:   {format_currency(total_purchases - total_supplier_paid)}")
        print(f"Total Sales:            {format_currency(total_sales)}")
        print(f"Customer Credit Given:  {format_currency(total_customer_credit)}")
        print(f"Customer Payments:      {format_currency(total_customer_paid)}")

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print(f"\n✓ Database saved: {self.db_path}")

    def run(self):
        """Run the complete data generation"""
        self.connect()
        self.generate_suppliers()
        self.generate_products_and_purchase_orders()
        self.generate_customers()
        self.generate_sales()
        self.generate_additional_customer_payments()
        self.print_summary()
        self.close()


# ============================================================================
# CLI INTERFACE
# ============================================================================

def get_custom_category():
    """Get custom category details from user"""
    print("\n--- Custom Category Setup ---")

    category_name = input("Enter category name: ").strip()
    if not category_name:
        category_name = "Custom"

    sku_prefix = input(f"Enter SKU prefix [{category_name[:4]}]: ").strip()
    if not sku_prefix:
        sku_prefix = category_name[:4]

    print("\nEnter supplier names (comma-separated):")
    print("Example: ABC Dealers, XYZ Distributors, PQR Wholesale")
    suppliers_input = input("> ").strip()

    suppliers = []
    for name in suppliers_input.split(","):
        name = name.strip()
        if name:
            suppliers.append({
                "name": name,
                "state": "Maharashtra",
                "district": "Mumbai",
                "town": "Mumbai"
            })

    if not suppliers:
        suppliers = [{"name": f"{category_name} Supplier", "state": "Maharashtra", "district": "Mumbai", "town": "Mumbai"}]

    print("\nEnter products (format: name, cost_price, selling_price)")
    print("Enter empty line when done.")
    print("Example: Product Name, 100, 150")

    products = []
    while True:
        line = input("> ").strip()
        if not line:
            break

        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 3:
            try:
                products.append({
                    "name": parts[0],
                    "price": float(parts[1]),
                    "selling_price": float(parts[2])
                })
            except ValueError:
                print("  Invalid format, skipping...")
        elif len(parts) == 1:
            # Just name, generate prices
            products.append({
                "name": parts[0],
                "price": random.randint(50, 500),
                "selling_price": random.randint(70, 700)
            })

    if not products:
        print("  No products entered, using default product")
        products = [{"name": f"{category_name} Item", "price": 100, "selling_price": 150}]

    return {
        "name": category_name,
        "sku_prefix": sku_prefix,
        "suppliers": suppliers,
        "products": products
    }


def parse_date(date_str, format_hint="DD/MM/YYYY"):
    """Parse date string in various formats"""
    formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"]

    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    raise ValueError(f"Invalid date format. Please use {format_hint}")


def expand_products(category_data, target_count):
    """Expand product list to target count by creating variations"""
    base_products = category_data['products']
    expanded_products = list(base_products)  # Start with originals

    # Variation suffixes for generating more products
    sizes = ['Small', 'Medium', 'Large', 'XL', 'XXL', 'Mini', 'Jumbo', 'Family Pack', 'Economy', 'Premium']
    colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Grey', 'Navy', 'Brown', 'Pink', 'Purple']
    variants = ['Classic', 'Pro', 'Lite', 'Plus', 'Max', 'Ultra', 'Neo', 'Elite', 'Basic', 'Deluxe']
    editions = ['2024', '2023', 'New', 'Limited Edition', 'Special', 'Anniversary', 'Festive', 'Summer', 'Winter']

    variation_sets = [sizes, colors, variants, editions]
    variation_idx = 0

    while len(expanded_products) < target_count:
        for base_product in base_products:
            if len(expanded_products) >= target_count:
                break

            # Pick a variation type
            variations = variation_sets[variation_idx % len(variation_sets)]
            variation = random.choice(variations)

            # Create variation
            new_product = base_product.copy()
            new_product['name'] = f"{base_product['name']} {variation}"

            # Slightly vary prices (±20%)
            price_factor = random.uniform(0.8, 1.2)
            new_product['price'] = round(base_product['price'] * price_factor, 2)
            new_product['selling_price'] = round(base_product['selling_price'] * price_factor, 2)

            expanded_products.append(new_product)

        variation_idx += 1

    # Create more suppliers if needed (1 supplier per 50 products)
    suppliers_needed = max(len(category_data['suppliers']), target_count // 50)
    expanded_suppliers = list(category_data['suppliers'])

    supplier_suffixes = ['Traders', 'Distributors', 'Wholesale', 'Suppliers', 'Dealers', 'Merchants', 'Enterprises', 'Agency']
    indian_states = [
        {'state': 'Maharashtra', 'district': 'Mumbai', 'town': 'Andheri'},
        {'state': 'Karnataka', 'district': 'Bangalore', 'town': 'Koramangala'},
        {'state': 'Tamil Nadu', 'district': 'Chennai', 'town': 'T Nagar'},
        {'state': 'Delhi', 'district': 'New Delhi', 'town': 'Karol Bagh'},
        {'state': 'Gujarat', 'district': 'Ahmedabad', 'town': 'CG Road'},
        {'state': 'Telangana', 'district': 'Hyderabad', 'town': 'Ameerpet'},
        {'state': 'West Bengal', 'district': 'Kolkata', 'town': 'Park Street'},
        {'state': 'Uttar Pradesh', 'district': 'Lucknow', 'town': 'Hazratganj'},
        {'state': 'Rajasthan', 'district': 'Jaipur', 'town': 'MI Road'},
        {'state': 'Andhra Pradesh', 'district': 'Kurnool', 'town': 'Kurnool'},
    ]

    while len(expanded_suppliers) < suppliers_needed:
        location = random.choice(indian_states)
        suffix = random.choice(supplier_suffixes)
        name = f"{fake.company()} {suffix}"
        expanded_suppliers.append({
            'name': name,
            'state': location['state'],
            'district': location['district'],
            'town': location['town']
        })

    return {
        'name': category_data['name'],
        'sku_prefix': category_data.get('sku_prefix', 'PROD'),
        'suppliers': expanded_suppliers,
        'products': expanded_products
    }


def expand_suppliers(category_data, target_count):
    """Expand or reduce suppliers to target count"""
    suppliers = list(category_data.get('suppliers', []))
    if target_count <= 0:
        return category_data

    if len(suppliers) >= target_count:
        category_data['suppliers'] = random.sample(suppliers, target_count)
        return category_data

    supplier_suffixes = ['Traders', 'Distributors', 'Wholesale', 'Suppliers', 'Dealers', 'Merchants', 'Enterprises', 'Agency']
    indian_states = [
        {'state': 'Maharashtra', 'district': 'Mumbai', 'town': 'Andheri'},
        {'state': 'Karnataka', 'district': 'Bangalore', 'town': 'Koramangala'},
        {'state': 'Tamil Nadu', 'district': 'Chennai', 'town': 'T Nagar'},
        {'state': 'Delhi', 'district': 'New Delhi', 'town': 'Karol Bagh'},
        {'state': 'Gujarat', 'district': 'Ahmedabad', 'town': 'CG Road'},
        {'state': 'Telangana', 'district': 'Hyderabad', 'town': 'Ameerpet'},
        {'state': 'West Bengal', 'district': 'Kolkata', 'town': 'Park Street'},
        {'state': 'Uttar Pradesh', 'district': 'Lucknow', 'town': 'Hazratganj'},
        {'state': 'Rajasthan', 'district': 'Jaipur', 'town': 'MI Road'},
        {'state': 'Andhra Pradesh', 'district': 'Kurnool', 'town': 'Kurnool'},
    ]

    while len(suppliers) < target_count:
        location = random.choice(indian_states)
        suffix = random.choice(supplier_suffixes)
        name = f"{fake.company()} {suffix}"
        suppliers.append({
            'name': name,
            'state': location['state'],
            'district': location['district'],
            'town': location['town']
        })

    category_data['suppliers'] = suppliers
    return category_data


def merge_categories(selected_templates):
    """Merge multiple category templates into one"""
    if len(selected_templates) == 1:
        return selected_templates[0]

    # Merge all categories
    merged = {
        "name": " + ".join([t["name"] for t in selected_templates]),
        "sku_prefix": "Mixed",
        "suppliers": [],
        "products": []
    }

    for template in selected_templates:
        # Add suppliers with category prefix
        for supplier in template.get("suppliers", []):
            merged["suppliers"].append(supplier)

        # Add products with unique SKU prefix per category
        cat_prefix = template.get("sku_prefix", "PROD")
        for product in template.get("products", []):
            # Create a copy with category info
            prod_copy = product.copy()
            prod_copy["_category"] = template["name"]
            prod_copy["_sku_prefix"] = cat_prefix
            merged["products"].append(prod_copy)

    return merged


def main():
    print("=" * 60)
    print("INVENTORY MANAGEMENT SYSTEM - DYNAMIC FAKE DATA GENERATOR")
    print("=" * 60)
    print()

    # Category selection
    print("Select Product Category (use comma for multiple, e.g., 1,2,3):")
    categories = list(CATEGORY_TEMPLATES.keys())
    for i, cat in enumerate(categories, 1):
        template = CATEGORY_TEMPLATES[cat]
        print(f"  {i}. {template['name']} ({len(template['products'])} products)")
    print(f"  {len(categories) + 1}. Custom (enter your own)")
    print()

    try:
        choice_input = input(f"Enter choice [1-{len(categories) + 1}]: ").strip()

        # Parse comma-separated choices
        choices = [c.strip() for c in choice_input.split(",")]
        selected_templates = []
        has_custom = False

        for choice_str in choices:
            if not choice_str:
                continue
            choice = int(choice_str)

            if choice == len(categories) + 1:
                has_custom = True
            elif 1 <= choice <= len(categories):
                category_key = categories[choice - 1]
                selected_templates.append(CATEGORY_TEMPLATES[category_key])

        # Handle custom category
        if has_custom:
            custom_data = get_custom_category()
            selected_templates.append(custom_data)

        # If no valid selection, default to Chocolates
        if not selected_templates:
            selected_templates = [CATEGORY_TEMPLATES["chocolates"]]

        # Merge categories if multiple selected
        category_data = merge_categories(selected_templates)

        if len(selected_templates) == 1:
            print(f"\n✓ Selected: {category_data['name']}")
        else:
            print(f"\n✓ Selected {len(selected_templates)} categories: {category_data['name']}")
            print(f"  Total products: {len(category_data['products'])}")
            print(f"  Total suppliers: {len(category_data['suppliers'])}")

    except (ValueError, IndexError) as e:
        print(f"Invalid choice ({e}), using Chocolates")
        category_data = CATEGORY_TEMPLATES["chocolates"]

    # Total purchases (budget)
    print()
    purchases_input = input("Enter total purchases (₹) [default: 3500000]: ").strip()
    try:
        target_total_purchases = float(purchases_input) if purchases_input else 3500000
    except ValueError:
        target_total_purchases = 3500000
    budget = target_total_purchases
    print(f"✓ Budget: {format_currency(budget)}")

    # Date range
    print()
    print("Enter Sales Date Range (DD/MM/YYYY):")

    start_input = input("  Start Date [default: 01/01/2024]: ").strip()
    try:
        sales_start = parse_date(start_input) if start_input else datetime(2024, 1, 1)
    except ValueError as e:
        print(f"  {e}, using default")
        sales_start = datetime(2024, 1, 1)

    end_input = input("  End Date [default: today]: ").strip()
    try:
        sales_end = parse_date(end_input) if end_input else datetime.now()
    except ValueError as e:
        print(f"  {e}, using default")
        sales_end = datetime.now()

    if sales_start >= sales_end:
        print("  Start date must be before end date, adjusting...")
        sales_end = sales_start + timedelta(days=365)

    purchase_start = sales_start - timedelta(days=30)

    print(f"✓ Purchase Period: {purchase_start.strftime('%d/%m/%Y')} to {sales_start.strftime('%d/%m/%Y')}")
    print(f"✓ Sales Period: {sales_start.strftime('%d/%m/%Y')} to {sales_end.strftime('%d/%m/%Y')}")

    # Customer count
    print()
    customer_input = input("Enter number of customers [default: 100000]: ").strip()
    try:
        customer_count = int(customer_input) if customer_input else 100000
    except ValueError:
        customer_count = 100000

    # Product count (for large datasets)
    product_input = input("Enter number of products to generate [default: 10000]: ").strip()
    try:
        target_products = int(product_input) if product_input else 10000
    except ValueError:
        target_products = 10000

    # If target products specified, expand product list
    if target_products > len(category_data['products']):
        print(f"  Expanding products from {len(category_data['products'])} to {target_products}...")
        category_data = expand_products(category_data, target_products)

    # Supplier count
    supplier_input = input("Enter number of suppliers [default: 250]: ").strip()
    try:
        target_suppliers = int(supplier_input) if supplier_input else 250
    except ValueError:
        target_suppliers = 250

    category_data = expand_suppliers(category_data, target_suppliers)

    # Purchase orders count (note: generator creates one PO per supplier)
    po_input = input("Enter number of purchase orders [default: 100]: ").strip()
    try:
        target_purchase_orders = int(po_input) if po_input else 100
    except ValueError:
        target_purchase_orders = 100

    # Sales count
    sales_input = input("Enter number of sales/invoices [default: 500000]: ").strip()
    try:
        sales_count = int(sales_input) if sales_input else 500000
    except ValueError:
        sales_count = 500000

    # Invoice items per invoice
    min_items_input = input("Enter min items per invoice [default: 3]: ").strip()
    try:
        min_items_per_invoice = int(min_items_input) if min_items_input else 3
    except ValueError:
        min_items_per_invoice = 3

    max_items_input = input("Enter max items per invoice [default: 12]: ").strip()
    try:
        max_items_per_invoice = int(max_items_input) if max_items_input else 12
    except ValueError:
        max_items_per_invoice = 12

    if max_items_per_invoice < min_items_per_invoice:
        print("  Max items per invoice cannot be less than min; adjusting.")
        max_items_per_invoice = min_items_per_invoice

    # Target invoice items (optional)
    invoice_items_input = input("Enter number of invoice items [default: invoices * min items]: ").strip()
    try:
        target_invoice_items = int(invoice_items_input) if invoice_items_input else 0
    except ValueError:
        target_invoice_items = 0
    if target_invoice_items <= 0:
        target_invoice_items = sales_count * min_items_per_invoice

    # Target sales total
    sales_total_input = input("Enter total sales revenue (₹) [default: 4000000]: ").strip()
    try:
        target_total_sales = float(sales_total_input) if sales_total_input else 4000000
    except ValueError:
        target_total_sales = 4000000

    if target_invoice_items and target_invoice_items < (sales_count * min_items_per_invoice):
        print("  Invoice items cannot be less than invoices * min items. Adjusting.")
        target_invoice_items = sales_count * min_items_per_invoice

    # Auto-calculate budget based on target sales if budget is default
    # Formula: sales_count * avg_items_per_sale * avg_price * quantity_multiplier
    # We need enough stock for all sales + buffer
    if budget == 100000 and sales_count > 500:
        # Calculate average product price
        avg_price = sum(p.get('price', 100) for p in category_data['products']) / max(1, len(category_data['products']))
        # Need ~3 items per sale, with 5x buffer to ensure we have enough stock
        # (we need extra buffer because items are randomly selected and some products may have uneven sales)
        items_needed = int(sales_count * 3 * 5)
        # Calculate required budget
        auto_budget = items_needed * avg_price
        print(f"\n  Auto-calculating budget for {sales_count:,} sales...")
        print(f"  Average product cost: {format_currency(avg_price)}")
        print(f"  Estimated items needed: {items_needed:,}")
        budget = auto_budget
        print(f"✓ Auto Budget: {format_currency(budget)}")

    # Scale prices to hit target averages
    estimated_items = target_invoice_items if target_invoice_items else (sales_count * min_items_per_invoice)
    target_units = int(estimated_items * 1.2)
    target_avg_cost = target_total_purchases / max(1, target_units)
    target_avg_selling = target_total_sales / max(1, estimated_items)
    category_data = scale_category_prices(category_data, target_avg_cost, target_avg_selling)

    # Summary
    print()
    print("-" * 60)
    print("SUMMARY:")
    print(f"  Category:         {category_data['name']}")
    print(f"  Suppliers:        {len(category_data['suppliers'])} available")
    print(f"  Products:         {len(category_data['products'])} types")
    print(f"  Purchase Budget:  {format_currency(budget)} (50% paid, 50% pending)")
    print(f"  Purchase Orders:  {target_purchase_orders}")
    print(f"  Purchase Period:  {purchase_start.strftime('%d/%m/%Y')} to {sales_start.strftime('%d/%m/%Y')}")
    print(f"  Sales Period:     {sales_start.strftime('%d/%m/%Y')} to {sales_end.strftime('%d/%m/%Y')}")
    print(f"  Customers:        {customer_count}")
    print(f"  Target Sales:     {sales_count:,} (70% cash, 30% credit)")
    print(f"  Items/Invoice:    {min_items_per_invoice}-{max_items_per_invoice}")
    if target_invoice_items:
        print(f"  Invoice Items:    {target_invoice_items:,}")
    print(f"  Sales Revenue:    {format_currency(target_total_sales)}")
    print(f"  Purchases Total:  {format_currency(target_total_purchases)}")
    print(f"  Credit Payment:   50% initial on all credit sales")
    print("-" * 60)
    print()

    confirm = input("Generate data with these settings? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("\n✗ Cancelled")
        return

    print()
    print("=" * 60)
    print("STARTING DATA GENERATION...")
    print("=" * 60)

    # Run generator
    generator = DynamicDataGenerator(
        category_data=category_data,
        budget=budget,
        sales_start=sales_start,
        sales_end=sales_end,
        customer_count=customer_count,
        sales_count=sales_count,
        target_invoice_items=target_invoice_items,
        target_total_sales=target_total_sales,
        target_purchase_orders=target_purchase_orders,
        target_suppliers=target_suppliers,
        cash_ratio=0.7,
        min_items_per_invoice=min_items_per_invoice,
        max_items_per_invoice=max_items_per_invoice
    )

    try:
        generator.run()

        print()
        print("=" * 60)
        print("✓ DATA GENERATION COMPLETE!")
        print("=" * 60)
        print()
        print(f"Database file: {generator.db_path}")
        print()
        print("To use this database in your Tauri app:")
        print(f"1. Copy {generator.db_path} to:")
        print("   macOS: ~/Library/Application Support/com.inventry.tauri/inventory.db")
        print("   Windows: %APPDATA%\\com.inventry.tauri\\inventory.db")
        print()

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
