use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::schema::CREATE_TABLES_SQL;

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
        }

        Ok(())
    }

    /// Get a reference to the connection (for queries)
    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }
}
