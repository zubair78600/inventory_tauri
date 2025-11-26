use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::schema::CREATE_TABLES_SQL;
use super::schema::purchase_order_migration::PURCHASE_ORDER_MIGRATION_SQL;

/// Database wrapper with thread-safe connection
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Create a new database connection and initialize tables
    pub fn new(db_path: PathBuf) -> Result<Self> {
        log::info!("Initializing database at: {:?}", db_path);

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| rusqlite::Error::InvalidPath(parent.to_path_buf()))?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };

        // Initialize tables
        db.init_tables()?;

        log::info!("Database initialized successfully");
        Ok(db)
    }

    /// Initialize database tables
    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(CREATE_TABLES_SQL)?;

        // Migration: Add place column to customers if it doesn't exist
        let place_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('customers') WHERE name = 'place'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !place_exists {
            log::info!("Migrating: Adding place column to customers table");
            conn.execute("ALTER TABLE customers ADD COLUMN place TEXT", [])?;
        }

        // Migration: Add address, email, comments columns to suppliers if they don't exist
        let supplier_address_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'address'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_address_exists {
            log::info!("Migrating: Adding address column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN address TEXT", [])?;
        }

        let supplier_email_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'email'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_email_exists {
            log::info!("Migrating: Adding email column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN email TEXT", [])?;
        }

        let supplier_comments_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'comments'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_comments_exists {
            log::info!("Migrating: Adding comments column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN comments TEXT", [])?;
        }

        let supplier_state_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'state'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_state_exists {
            log::info!("Migrating: Adding state column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN state TEXT", [])?;
        }

        let supplier_place_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'place'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_place_exists {
            log::info!("Migrating: Adding place column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN place TEXT", [])?;
        }

        // Migration: Add district and town columns to suppliers
        let supplier_district_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'district'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_district_exists {
            log::info!("Migrating: Adding district column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN district TEXT", [])?;

            // Copy place data to district for existing records
            log::info!("Migrating: Copying place data to district column");
            conn.execute("UPDATE suppliers SET district = place WHERE place IS NOT NULL", [])?;
        }

        let supplier_town_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'town'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_town_exists {
            log::info!("Migrating: Adding town column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN town TEXT", [])?;
        }

        // Migration: Add state, district, and town columns to invoices
        let invoice_state_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('invoices') WHERE name = 'state'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !invoice_state_exists {
            log::info!("Migrating: Adding state column to invoices table");
            conn.execute("ALTER TABLE invoices ADD COLUMN state TEXT", [])?;
        }

        let invoice_district_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('invoices') WHERE name = 'district'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !invoice_district_exists {
            log::info!("Migrating: Adding district column to invoices table");
            conn.execute("ALTER TABLE invoices ADD COLUMN district TEXT", [])?;
        }

        let invoice_town_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('invoices') WHERE name = 'town'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !invoice_town_exists {
            log::info!("Migrating: Adding town column to invoices table");
            conn.execute("ALTER TABLE invoices ADD COLUMN town TEXT", [])?;
            log::info!("Migrating: Adding town column to invoices table");
            conn.execute("ALTER TABLE invoices ADD COLUMN town TEXT", [])?;
        }

        // Migration: Create users table if it doesn't exist (handled by init_tables but good to be safe or for specific updates)
        // Seed default admin user if users table is empty
        let user_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
            .unwrap_or(0);

        if user_count == 0 {
            log::info!("Seeding default admin user");
            conn.execute(
                "INSERT INTO users (username, password, role, permissions) VALUES (?1, ?2, ?3, ?4)",
                (
                    "Admin",
                    "1014209932",
                    "admin",
                    "[\"*\"]" // Wildcard for all permissions
                ),
            )?;
        }

        // Migration: Add created_at and updated_at to products
        let product_created_at_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'created_at'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !product_created_at_exists {
            log::info!("Migrating: Adding created_at column to products table");
            // Add as nullable first, then update with current timestamp
            conn.execute("ALTER TABLE products ADD COLUMN created_at TEXT", [])?;
        }
        
        // Always update NULL values (in case migration was interrupted)
        conn.execute("UPDATE products SET created_at = datetime('now') WHERE created_at IS NULL", [])?;

        let product_updated_at_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'updated_at'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !product_updated_at_exists {
            log::info!("Migrating: Adding updated_at column to products table");
            conn.execute("ALTER TABLE products ADD COLUMN updated_at TEXT", [])?;
        }
        
        // Always update NULL values (in case migration was interrupted)
        conn.execute("UPDATE products SET updated_at = datetime('now') WHERE updated_at IS NULL", [])?;

        // Migration: Add created_at and updated_at to suppliers
        let supplier_created_at_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'created_at'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_created_at_exists {
            log::info!("Migrating: Adding created_at column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN created_at TEXT", [])?;
        }
        
        // Always update NULL values (in case migration was interrupted)
        conn.execute("UPDATE suppliers SET created_at = datetime('now') WHERE created_at IS NULL", [])?;

        let supplier_updated_at_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('suppliers') WHERE name = 'updated_at'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_updated_at_exists {
            log::info!("Migrating: Adding updated_at column to suppliers table");
            conn.execute("ALTER TABLE suppliers ADD COLUMN updated_at TEXT", [])?;
        }
        
        // Always update NULL values (in case migration was interrupted)
        conn.execute("UPDATE suppliers SET updated_at = datetime('now') WHERE updated_at IS NULL", [])?;

        // Migration: Add selling_price column to products
        let selling_price_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'selling_price'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !selling_price_exists {
            log::info!("Migrating: Adding selling_price column to products table");
            conn.execute("ALTER TABLE products ADD COLUMN selling_price REAL", [])?;
        }

        // Migration: Add initial_stock column to products
        let initial_stock_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('products') WHERE name = 'initial_stock'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !initial_stock_exists {
            log::info!("Migrating: Adding initial_stock column to products table");
            conn.execute("ALTER TABLE products ADD COLUMN initial_stock INTEGER", [])?;
        }

        // Migration: Add product_id column to supplier_payments (for per-product payment tracking)
        let supplier_payments_product_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('supplier_payments') WHERE name = 'product_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_payments_product_exists {
            log::info!("Migrating: Adding product_id column to supplier_payments table");
            conn.execute("ALTER TABLE supplier_payments ADD COLUMN product_id INTEGER", [])?;
        }

        // Ensure indexes for supplier_payments with product_id exist (now that column is present)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_supplier_payments_product ON supplier_payments(product_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_product ON supplier_payments(supplier_id, product_id)",
            [],
        )?;

        // Migration: Add po_id column to supplier_payments (for linking payments to purchase orders)
        let supplier_payments_po_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('supplier_payments') WHERE name = 'po_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !supplier_payments_po_exists {
            log::info!("Migrating: Adding po_id column to supplier_payments table");
            conn.execute("ALTER TABLE supplier_payments ADD COLUMN po_id INTEGER REFERENCES purchase_orders(id)", [])?;
        }

        // Migration: Run Purchase Order and FIFO Inventory System migration
        log::info!("Running Purchase Order and FIFO migration...");
        conn.execute_batch(PURCHASE_ORDER_MIGRATION_SQL)?;
        log::info!("Purchase Order and FIFO migration completed successfully");

        Ok(())
    }

    /// Get a reference to the connection (for queries)
    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }
}
