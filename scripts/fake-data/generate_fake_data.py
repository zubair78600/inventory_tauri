#!/usr/bin/env python3
"""
Fake Data Generator for Inventory Management System
Generates realistic fake data for testing and development
"""

import sqlite3
import random
import string
from datetime import datetime, timedelta
from faker import Faker

# Initialize Faker
fake = Faker('en_IN')  # Using Indian locale for Indian names and data

# Database schema based on the Tauri app
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

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
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

-- Inventory batches table
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

-- Inventory transactions table
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);

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

-- Supplier Payments indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_paid_at ON supplier_payments(paid_at);
"""

# Product categories and prefixes
PRODUCT_CATEGORIES = {
    'Medicines': ['TAB', 'CAP', 'SYR', 'INJ'],
    'Medical Supplies': ['MED', 'SUP', 'EQP'],
    'Health Products': ['VIT', 'SUP', 'HRB'],
}

MEDICINE_NAMES = [
    'Paracetamol', 'Amoxicillin', 'Ibuprofen', 'Aspirin', 'Omeprazole',
    'Metformin', 'Atorvastatin', 'Lisinopril', 'Levothyroxine', 'Albuterol',
    'Ciprofloxacin', 'Azithromycin', 'Prednisone', 'Losartan', 'Gabapentin',
    'Hydrochlorothiazide', 'Clopidogrel', 'Sertraline', 'Montelukast', 'Furosemide'
]

DOSAGES = ['50mg', '100mg', '250mg', '500mg', '10ml', '20ml', '100ml']

PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

def random_date(start_date, end_date):
    """Generate random date between start and end"""
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    return start_date + timedelta(days=random_days)

def generate_sku(prefix, number):
    """Generate SKU in format PREFIX-XXXXXX"""
    return f"{prefix}-{number:06d}"

def generate_po_number(number):
    """Generate PO number in format PO-YYYY-XXXXXX"""
    year = datetime.now().year
    return f"PO-{year}-{number:06d}"

def generate_invoice_number(number):
    """Generate invoice number in format INV-YYYY-XXXXXX"""
    year = datetime.now().year
    return f"INV-{year}-{number:06d}"

class DataGenerator:
    def __init__(self, db_path='fake_inventory.db'):
        self.db_path = db_path
        self.conn = None
        self.cursor = None

        # Tracking data
        self.supplier_ids = []
        self.product_ids = []
        self.customer_ids = []
        self.po_ids = []
        self.invoice_ids = []

    def connect(self):
        """Connect to database"""
        # Delete existing database to start fresh
        import os
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            print(f"✓ Removed existing database: {self.db_path}")

        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        print(f"✓ Connected to database: {self.db_path}")

    def create_schema(self):
        """Create database schema"""
        print("Creating database schema...")
        self.cursor.executescript(DB_SCHEMA)
        self.conn.commit()
        print("✓ Schema created successfully")

    def generate_suppliers(self, count, start_date, end_date):
        """Generate fake suppliers"""
        print(f"\nGenerating {count:,} suppliers...")
        suppliers = []

        indian_states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'Uttar Pradesh']
        indian_cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Pune', 'Hyderabad']

        for i in range(count):
            company_type = random.choice(['Pharma', 'Medical', 'Healthcare', 'Supplies', 'Labs'])
            name = f"{fake.company()} {company_type}"
            contact_person = fake.name()
            phone = fake.phone_number()
            contact_info = f"{contact_person}, {phone}"

            state = random.choice(indian_states)
            town = random.choice(indian_cities)
            district = town  # Simplified: using city as district

            # Random timestamp within date range
            created_at = fake.date_time_between(start_date=start_date, end_date=end_date).isoformat()
            updated_at = created_at

            supplier = (
                name,
                contact_info,
                fake.address().replace('\n', ', '),
                fake.email(),
                None,  # comments
                state,
                district,
                town,
                created_at,
                updated_at
            )
            suppliers.append(supplier)

            if (i + 1) % 1000 == 0:
                print(f"  Generated {i + 1:,} suppliers...")

        self.cursor.executemany("""
            INSERT INTO suppliers (name, contact_info, address, email, comments, state, district, town, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, suppliers)
        self.conn.commit()

        # Get all supplier IDs
        self.cursor.execute("SELECT id FROM suppliers")
        self.supplier_ids = [row[0] for row in self.cursor.fetchall()]
        print(f"✓ Created {count:,} suppliers")

    def generate_products(self, count, start_date, end_date):
        """Generate fake products"""
        print(f"\nGenerating {count:,} products...")
        products = []

        # Track SKU counters for each prefix to ensure uniqueness
        sku_counters = {}

        for i in range(count):
            category = random.choice(list(PRODUCT_CATEGORIES.keys()))
            prefix = random.choice(PRODUCT_CATEGORIES[category])

            # Generate product name
            if category == 'Medicines':
                base_name = random.choice(MEDICINE_NAMES)
                dosage = random.choice(DOSAGES)
                name = f"{base_name} {dosage}"
            else:
                name = f"{fake.word().title()} {category} {random.randint(1, 999)}"

            # Ensure unique SKU for each prefix
            if prefix not in sku_counters:
                sku_counters[prefix] = 1
            else:
                sku_counters[prefix] += 1

            sku = generate_sku(prefix, sku_counters[prefix])
            price = round(random.uniform(10, 500), 2)
            selling_price = round(price * random.uniform(1.2, 2.5), 2)

            # CRITICAL: Start with 0 stock - inventory will be added via purchase orders
            # This ensures FIFO tracking is accurate from the start
            stock_quantity = 0
            initial_stock = 0  # No initial stock

            supplier_id = random.choice(self.supplier_ids)
            amount_paid = 0.0  # No payment since no initial stock

            # Random timestamp within date range
            created_at = fake.date_time_between(start_date=start_date, end_date=end_date).isoformat()
            updated_at = created_at

            product = (
                name, sku, price, selling_price, stock_quantity, initial_stock, supplier_id, amount_paid,
                created_at, updated_at
            )
            products.append(product)

            if (i + 1) % 1000 == 0:
                print(f"  Generated {i + 1:,} products...")

        self.cursor.executemany("""
            INSERT INTO products (name, sku, price, selling_price, stock_quantity, initial_stock,
                                supplier_id, amount_paid, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, products)
        self.conn.commit()

        # Get all product IDs
        self.cursor.execute("SELECT id FROM products")
        self.product_ids = [row[0] for row in self.cursor.fetchall()]
        print(f"✓ Created {count:,} products")

    def generate_customers(self, count, start_date, end_date):
        """Generate fake customers"""
        print(f"\nGenerating {count:,} customers...")
        customers = []

        indian_cities = [
            'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
            'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur',
            'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna'
        ]

        for i in range(count):
            # Random timestamp within date range
            created_at = fake.date_time_between(start_date=start_date, end_date=end_date).isoformat()
            updated_at = created_at

            customer = (
                fake.name(),
                fake.email() if random.random() > 0.3 else None,
                fake.phone_number() if random.random() > 0.2 else None,
                fake.address().replace('\n', ', ') if random.random() > 0.5 else None,
                random.choice(indian_cities),
                created_at,
                updated_at
            )
            customers.append(customer)

            if (i + 1) % 5000 == 0:
                print(f"  Generated {i + 1:,} customers...")

        self.cursor.executemany("""
            INSERT INTO customers (name, email, phone, address, place, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, customers)
        self.conn.commit()

        # Get all customer IDs
        self.cursor.execute("SELECT id FROM customers")
        self.customer_ids = [row[0] for row in self.cursor.fetchall()]
        print(f"✓ Created {count:,} customers")

    def generate_purchase_orders(self, count, start_date, end_date):
        """Generate fake purchase orders with items"""
        print(f"\nGenerating {count:,} purchase orders...")

        purchase_orders = []
        po_items = []

        for i in range(count):
            po_number = generate_po_number(i + 1)
            supplier_id = random.choice(self.supplier_ids)
            order_date = random_date(start_date, end_date)
            expected_delivery = order_date + timedelta(days=random.randint(7, 30))
            received_date = order_date + timedelta(days=random.randint(5, 35))
            status = random.choice(['received', 'received', 'received', 'pending'])  # 75% received

            # Generate PO items (2-10 items per PO)
            num_items = random.randint(2, 10)
            total_amount = 0

            item_products = random.sample(self.product_ids, min(num_items, len(self.product_ids)))

            # Random timestamp within date range
            created_at = fake.date_time_between(start_date=start_date, end_date=end_date).isoformat()
            updated_at = created_at

            for product_id in item_products:
                # Get product details
                self.cursor.execute("SELECT price FROM products WHERE id = ?", (product_id,))
                unit_cost = self.cursor.fetchone()[0]

                quantity = random.randint(50, 500)
                total_cost = quantity * unit_cost
                total_amount += total_cost

                po_items.append((
                    i + 1,  # Will be replaced with actual po_id later
                    product_id,
                    quantity,
                    unit_cost,
                    total_cost,
                    created_at
                ))

            purchase_order = (
                po_number, supplier_id, order_date.isoformat(),
                expected_delivery.isoformat(), received_date.isoformat(),
                status, total_amount, None,
                created_at, updated_at
            )
            purchase_orders.append(purchase_order)

            if (i + 1) % 1000 == 0:
                print(f"  Generated {i + 1:,} purchase orders...")

        # Insert purchase orders
        self.cursor.executemany("""
            INSERT INTO purchase_orders (po_number, supplier_id, order_date,
                                        expected_delivery_date, received_date, status,
                                        total_amount, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, purchase_orders)
        self.conn.commit()

        # Get PO IDs and update po_items
        self.cursor.execute("SELECT id FROM purchase_orders ORDER BY id")
        po_ids = [row[0] for row in self.cursor.fetchall()]

        # Update po_items with correct po_id
        updated_items = []
        for po_idx, po_id in enumerate(po_ids):
            items_for_po = [item for item in po_items if item[0] == po_idx + 1]
            for item in items_for_po:
                updated_items.append((
                    po_id, item[1], item[2], item[3], item[4], item[5]
                ))

        # Insert PO items
        self.cursor.executemany("""
            INSERT INTO purchase_order_items (po_id, product_id, quantity,
                                             unit_cost, total_cost, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, updated_items)
        self.conn.commit()

        # NOW CREATE INVENTORY BATCHES AND UPDATE STOCK - THIS IS CRITICAL FOR FIFO!
        print(f"  Creating inventory batches and updating product stock...")

        # Get all PO item IDs we just created
        self.cursor.execute("SELECT id, po_id, product_id, quantity, unit_cost, created_at FROM purchase_order_items ORDER BY id")
        po_item_records = self.cursor.fetchall()

        inventory_batches = []
        inventory_transactions = []

        for po_item_id, po_id, product_id, quantity, unit_cost, created_at_str in po_item_records:
            # Get the purchase date from the PO
            self.cursor.execute("SELECT order_date FROM purchase_orders WHERE id = ?", (po_id,))
            purchase_date = self.cursor.fetchone()[0]

            # UPDATE PRODUCT STOCK QUANTITY (critical!)
            self.cursor.execute("""
                UPDATE products
                SET stock_quantity = stock_quantity + ?,
                    updated_at = ?
                WHERE id = ?
            """, (quantity, created_at_str, product_id))

            # Get new stock for balance_after
            self.cursor.execute("SELECT stock_quantity FROM products WHERE id = ?", (product_id,))
            balance_after = self.cursor.fetchone()[0]

            # Create inventory batch (for FIFO tracking)
            inventory_batches.append((
                product_id,
                po_item_id,
                quantity,  # quantity_remaining
                unit_cost,
                purchase_date,
                created_at_str
            ))

            # Create inventory transaction (audit trail)
            inventory_transactions.append((
                product_id,
                'purchase',  # transaction_type
                quantity,  # quantity_change (positive for purchases)
                unit_cost,
                'purchase_order',  # reference_type
                po_item_id,  # reference_id
                balance_after,
                purchase_date,
                None,  # notes
                created_at_str
            ))

        # Insert inventory batches
        self.cursor.executemany("""
            INSERT INTO inventory_batches (product_id, po_item_id, quantity_remaining,
                                          unit_cost, purchase_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, inventory_batches)

        # Insert inventory transactions
        self.cursor.executemany("""
            INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change,
                                               unit_cost, reference_type, reference_id,
                                               balance_after, transaction_date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, inventory_transactions)

        self.conn.commit()

        print(f"✓ Created {count:,} purchase orders with {len(updated_items):,} items")
        print(f"✓ Created {len(inventory_batches):,} inventory batches (FIFO tracking)")
        print(f"✓ Created {len(inventory_transactions):,} inventory transactions (audit trail)")

    def generate_supplier_payments(self):
        """Generate supplier payments for purchase orders"""
        print(f"\nGenerating supplier payments...")

        # Get all purchase orders
        self.cursor.execute("SELECT id, supplier_id, total_amount, order_date FROM purchase_orders")
        purchase_orders = self.cursor.fetchall()

        payments = []
        for po_id, supplier_id, total_amount, order_date in purchase_orders:
            # Randomly decide payment strategy:
            # 60% fully paid, 30% partially paid, 10% unpaid
            payment_strategy = random.choices(['full', 'partial', 'unpaid'], weights=[60, 30, 10])[0]

            if payment_strategy == 'unpaid':
                continue  # Skip this PO

            if payment_strategy == 'full':
                # Single payment for full amount
                payment_amount = total_amount
                num_payments = 1
            else:
                # Partial payment: 2-3 payments covering 50-90% of total
                num_payments = random.randint(2, 3)
                total_payment_percent = random.uniform(0.5, 0.9)
                payment_amount = total_amount * total_payment_percent

            # Split into multiple payments if needed
            payments_for_this_po = []
            for i in range(num_payments):
                if num_payments == 1:
                    amount = payment_amount
                else:
                    # Divide payment amount across multiple payments
                    if i == num_payments - 1:
                        # Last payment gets remainder
                        amount = payment_amount - sum(p[0] for p in payments_for_this_po)
                    else:
                        amount = payment_amount / num_payments

                # Payment date is order_date + random days (0-60 days after order)
                order_date_obj = datetime.fromisoformat(order_date)
                payment_date = order_date_obj + timedelta(days=random.randint(0, 60))
                paid_at = payment_date.isoformat()
                created_at = paid_at

                payment_method = random.choice(PAYMENT_METHODS)

                payment_tuple = (
                    round(amount, 2),  # amount (for tracking in payments_for_this_po)
                    supplier_id,
                    None,  # product_id (null for PO payments)
                    po_id,
                    round(amount, 2),
                    payment_method,
                    None,  # note
                    paid_at,
                    created_at
                )
                payments_for_this_po.append(payment_tuple)
                payments.append(payment_tuple[1:])  # Skip the first amount (used for calculation)

        # Insert payments
        self.cursor.executemany("""
            INSERT INTO supplier_payments (supplier_id, product_id, po_id, amount,
                                          payment_method, note, paid_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, payments)
        self.conn.commit()

        print(f"✓ Created {len(payments):,} supplier payments")

    def deduct_fifo_inventory(self, product_id, quantity_needed, sale_date):
        """
        Deduct inventory using FIFO method
        Returns total COGS and updates batches
        """
        # Get batches for this product ordered by purchase date (FIFO)
        self.cursor.execute("""
            SELECT id, quantity_remaining, unit_cost
            FROM inventory_batches
            WHERE product_id = ? AND quantity_remaining > 0
            ORDER BY purchase_date ASC, id ASC
        """, (product_id,))

        batches = self.cursor.fetchall()

        remaining_to_deduct = quantity_needed
        total_cogs = 0.0
        batches_to_update = []
        batches_to_delete = []

        for batch_id, qty_remaining, unit_cost in batches:
            if remaining_to_deduct <= 0:
                break

            qty_to_use = min(remaining_to_deduct, qty_remaining)
            total_cogs += qty_to_use * unit_cost
            remaining_to_deduct -= qty_to_use

            new_qty = qty_remaining - qty_to_use
            if new_qty <= 0:
                batches_to_delete.append(batch_id)
            else:
                batches_to_update.append((new_qty, batch_id))

        if remaining_to_deduct > 0:
            raise ValueError(f"Insufficient inventory for product {product_id}: need {remaining_to_deduct} more units")

        # Update/delete batches
        for batch_id in batches_to_delete:
            self.cursor.execute("DELETE FROM inventory_batches WHERE id = ?", (batch_id,))

        for new_qty, batch_id in batches_to_update:
            self.cursor.execute("UPDATE inventory_batches SET quantity_remaining = ? WHERE id = ?",
                              (new_qty, batch_id))

        # Update product stock_quantity
        self.cursor.execute("""
            UPDATE products
            SET stock_quantity = stock_quantity - ?
            WHERE id = ?
        """, (quantity_needed, product_id))

        # Get new balance
        self.cursor.execute("SELECT stock_quantity FROM products WHERE id = ?", (product_id,))
        balance_after = self.cursor.fetchone()[0]

        # Create inventory transaction
        self.cursor.execute("""
            INSERT INTO inventory_transactions
            (product_id, transaction_type, quantity_change, unit_cost, reference_type,
             balance_after, transaction_date, created_at)
            VALUES (?, 'sale', ?, ?, 'invoice', ?, ?, ?)
        """, (product_id, -quantity_needed, total_cogs / quantity_needed,
              balance_after, sale_date, sale_date))

        return total_cogs

    def generate_sales(self, count, start_date, end_date):
        """Generate fake sales (invoices with items)"""
        print(f"\nGenerating {count:,} sales (invoices)...")

        invoices = []
        invoice_items = []

        sales_created = 0
        sales_skipped = 0

        for i in range(count):
            # Create invoice
            invoice_number = generate_invoice_number(i + 1)
            customer_id = random.choice(self.customer_ids) if random.random() > 0.3 else None

            # Get customer details if customer_id exists
            customer_name = None
            customer_phone = None
            if customer_id:
                self.cursor.execute("SELECT name, phone FROM customers WHERE id = ?", (customer_id,))
                result = self.cursor.fetchone()
                if result:
                    customer_name, customer_phone = result
            else:
                customer_name = "Walk-in Customer"

            # Generate invoice items (1-5 items per invoice)
            num_items = random.randint(1, 5)
            subtotal = 0

            item_products = random.sample(self.product_ids, min(num_items, len(self.product_ids)))

            # Random created_at timestamp within date range for invoice
            created_at = random_date(start_date, end_date).isoformat()
            sale_date = created_at.split('T')[0]  # Extract date part

            temp_invoice_items = []
            try:
                for product_id in item_products:
                    # Get product details
                    self.cursor.execute("""
                        SELECT name, sku, selling_price, stock_quantity FROM products WHERE id = ?
                    """, (product_id,))
                    result = self.cursor.fetchone()
                    if not result:
                        continue

                    product_name, product_sku, selling_price, stock_qty = result

                    # Choose a reasonable quantity (1-10, but not more than available stock)
                    max_qty = min(10, stock_qty)
                    if max_qty <= 0:
                        continue  # Skip if no stock

                    quantity = random.randint(1, max_qty)
                    unit_price = selling_price or random.uniform(50, 500)

                    # Try to deduct inventory using FIFO
                    try:
                        cogs = self.deduct_fifo_inventory(product_id, quantity, sale_date)
                    except ValueError as e:
                        # Insufficient inventory - skip this item
                        continue

                    item_total = quantity * unit_price
                    subtotal += item_total

                    temp_invoice_items.append((
                        i + 1,  # Will be replaced with actual invoice_id later
                        product_id,
                        product_name,
                        product_sku,
                        quantity,
                        unit_price,
                        created_at
                    ))

                # Only create invoice if at least one item was successfully added
                if not temp_invoice_items:
                    sales_skipped += 1
                    continue

                invoice_items.extend(temp_invoice_items)

            except Exception as e:
                print(f"  Warning: Skipped invoice {i+1} due to error: {e}")
                sales_skipped += 1
                continue

            # GST calculations
            gst_rate = random.choice([0, 5, 12, 18, 28])  # Common GST rates in India
            if gst_rate > 0:
                tax_amount = subtotal * (gst_rate / 100)
                # For intra-state: CGST + SGST, for inter-state: IGST
                is_intra_state = random.random() > 0.3
                if is_intra_state:
                    cgst_amount = tax_amount / 2
                    sgst_amount = tax_amount / 2
                    igst_amount = None
                else:
                    cgst_amount = None
                    sgst_amount = None
                    igst_amount = tax_amount
            else:
                tax_amount = 0
                cgst_amount = None
                sgst_amount = None
                igst_amount = None

            discount_amount = subtotal * random.uniform(0, 0.1) if random.random() > 0.7 else 0
            total_amount = subtotal + tax_amount - discount_amount

            payment_method = random.choice(PAYMENT_METHODS)

            # Financial year calculation (Apr-Mar)
            created_date = datetime.fromisoformat(created_at)
            if created_date.month >= 4:
                fy_year = f"{created_date.year}-{created_date.year + 1}"
            else:
                fy_year = f"{created_date.year - 1}-{created_date.year}"

            # Location data
            indian_states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat']
            indian_cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Ahmedabad']
            state = random.choice(indian_states)
            town = random.choice(indian_cities)
            district = town

            invoice = (
                invoice_number, customer_id, total_amount, tax_amount, discount_amount,
                payment_method, created_at, cgst_amount, fy_year, gst_rate,
                igst_amount, sgst_amount, state, district, town
            )
            invoices.append(invoice)
            sales_created += 1

            if (i + 1) % 5000 == 0:
                print(f"  Generated {i + 1:,} invoices...")

        # Insert invoices
        self.cursor.executemany("""
            INSERT INTO invoices (invoice_number, customer_id, total_amount, tax_amount, discount_amount,
                                payment_method, created_at, cgst_amount, fy_year, gst_rate,
                                igst_amount, sgst_amount, state, district, town)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, invoices)
        self.conn.commit()

        # Get invoice IDs and update invoice_items
        self.cursor.execute("SELECT id FROM invoices ORDER BY id")
        invoice_ids = [row[0] for row in self.cursor.fetchall()]

        # Update invoice_items with correct invoice_id
        updated_items = []
        item_idx = 0
        for inv_idx, invoice_id in enumerate(invoice_ids):
            items_for_invoice = [item for item in invoice_items if item[0] == inv_idx + 1]
            for item in items_for_invoice:
                updated_items.append((
                    invoice_id, item[1], item[2], item[3], item[4], item[5], item[6]
                ))

        # Insert invoice items
        self.cursor.executemany("""
            INSERT INTO invoice_items (invoice_id, product_id, product_name, product_sku,
                                      quantity, unit_price, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, updated_items)
        self.conn.commit()

        print(f"✓ Created {sales_created:,} invoices with {len(updated_items):,} items")
        if sales_skipped > 0:
            print(f"  (Skipped {sales_skipped} invoices due to insufficient inventory)")
        print(f"  FIFO inventory tracking: batches depleted and transactions recorded")

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print(f"\n✓ Database saved: {self.db_path}")

def main():
    print("=" * 60)
    print("INVENTORY MANAGEMENT SYSTEM - FAKE DATA GENERATOR")
    print("=" * 60)
    print()

    # Get user input
    print("Enter the number of records to generate:")
    print("(Press Enter to use default values)")
    print()

    try:
        sales_input = input("Sales/Invoices [default: 100]: ").strip()
        sales_count = int(sales_input) if sales_input else 100

        customer_input = input("Customers [default: 70]: ").strip()
        customer_count = int(customer_input) if customer_input else 70

        inventory_input = input("Inventory/Products [default: 50]: ").strip()
        inventory_count = int(inventory_input) if inventory_input else 50

        supplier_input = input("Suppliers [default: 25]: ").strip()
        supplier_count = int(supplier_input) if supplier_input else 25

        po_input = input("Purchase Orders [default: 50]: ").strip()
        po_count = int(po_input) if po_input else 50

    except ValueError:
        print("\n✗ Invalid input! Please enter numbers only.")
        return

    # Get date range
    print()
    print("Enter date range for data generation:")
    print("(Format: YYYY-MM-DD, press Enter for defaults)")
    print()

    try:
        from_date_input = input("From Date [default: 1 year ago]: ").strip()
        if from_date_input:
            from_date = datetime.strptime(from_date_input, "%Y-%m-%d")
        else:
            from_date = datetime.now() - timedelta(days=365)

        to_date_input = input("To Date [default: today]: ").strip()
        if to_date_input:
            to_date = datetime.strptime(to_date_input, "%Y-%m-%d")
        else:
            to_date = datetime.now()

        if from_date >= to_date:
            print("\n✗ Error: 'From Date' must be earlier than 'To Date'")
            return

    except ValueError:
        print("\n✗ Invalid date format! Please use YYYY-MM-DD format.")
        return

    print()
    print("-" * 60)
    print("SUMMARY:")
    print(f"  Suppliers:        {supplier_count:,}")
    print(f"  Products:         {inventory_count:,}")
    print(f"  Customers:        {customer_count:,}")
    print(f"  Purchase Orders:  {po_count:,}")
    print(f"  Sales:            {sales_count:,}")
    print(f"  Date Range:       {from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')}")
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

    # Generate data
    generator = DataGenerator()

    try:
        generator.connect()
        generator.create_schema()

        # Generate in order (dependencies)
        generator.generate_suppliers(supplier_count, from_date, to_date)
        generator.generate_products(inventory_count, from_date, to_date)
        generator.generate_customers(customer_count, from_date, to_date)

        # CRITICAL: Purchase orders must happen BEFORE sales for FIFO to work
        # Split the date range: first 70% for purchases, last 70% for sales (with overlap)
        date_range_days = (to_date - from_date).days
        po_end_date = from_date + timedelta(days=int(date_range_days * 0.7))
        sales_start_date = from_date + timedelta(days=int(date_range_days * 0.3))

        print(f"\n📅 Date Strategy:")
        print(f"  Purchase Orders: {from_date.strftime('%Y-%m-%d')} to {po_end_date.strftime('%Y-%m-%d')}")
        print(f"  Sales/Invoices:  {sales_start_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')}")
        print(f"  (Overlap ensures inventory is available before sales)")

        generator.generate_purchase_orders(po_count, from_date, po_end_date)
        generator.generate_supplier_payments()  # Generate payments for POs
        generator.generate_sales(sales_count, sales_start_date, to_date)

        generator.close()

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
        print("2. Or use it for testing/development")
        print()

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        generator.close()

if __name__ == "__main__":
    main()
