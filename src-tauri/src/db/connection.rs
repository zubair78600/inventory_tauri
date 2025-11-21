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
        Ok(())
    }

    /// Get a reference to the connection (for queries)
    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        self.conn.clone()
    }
}
