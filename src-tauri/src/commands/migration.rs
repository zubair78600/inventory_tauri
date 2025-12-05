/// Data Migration Commands
/// Migrates existing products with initial_stock to the new Purchase Order and FIFO system

use rusqlite::{params, Connection};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::Database;
use crate::services::inventory_service;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    pub products_migrated: i32,
    pub purchase_orders_created: i32,
    pub batches_created: i32,
    pub transactions_created: i32,
    pub errors: Vec<String>,
    pub details: Vec<String>,
}

/// Migrate existing products with initial_stock to Purchase Order system
#[tauri::command]
pub fn migrate_existing_products(db: State<Database>) -> Result<MigrationResult, String> {
    let conn = db.get_conn()?;

    // Start transaction
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let result = migrate_existing_products_internal(&conn);

    match result {
        Ok(migration_result) => {
            conn.execute("COMMIT", [])
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;
            Ok(migration_result)
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
}

fn migrate_existing_products_internal(conn: &Connection) -> Result<MigrationResult, String> {
    let mut result = MigrationResult {
        products_migrated: 0,
        purchase_orders_created: 0,
        batches_created: 0,
        transactions_created: 0,
        errors: Vec::new(),
        details: Vec::new(),
    };

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let migration_date = Utc::now().format("%Y-%m-%d").to_string();

    // Get all products that have stock but no batches yet
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.sku, p.stock_quantity, p.initial_stock, p.price, p.supplier_id
         FROM products p
         WHERE p.stock_quantity > 0
         AND NOT EXISTS (
             SELECT 1 FROM inventory_batches ib WHERE ib.product_id = p.id
         )"
    ).map_err(|e| format!("Failed to prepare product query: {}", e))?;

    let products: Vec<(i32, String, String, i32, Option<i32>, f64, Option<i32>)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .map_err(|e| format!("Failed to query products: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect products: {}", e))?;

    result.details.push(format!("Found {} products to migrate", products.len()));

    // Create a "Migration" supplier if it doesn't exist
    let migration_supplier_id = ensure_migration_supplier(conn)?;
    result.details.push(format!("Using migration supplier ID: {}", migration_supplier_id));

    for (product_id, name, sku, stock_qty, initial_stock, price, supplier_id) in products {
        match migrate_product(
            conn,
            product_id,
            &name,
            &sku,
            stock_qty,
            initial_stock,
            price,
            supplier_id,
            migration_supplier_id,
            &migration_date,
            &now,
        ) {
            Ok(detail) => {
                result.products_migrated += 1;
                result.purchase_orders_created += 1;
                result.batches_created += 1;
                result.transactions_created += 1;
                result.details.push(detail);
            }
            Err(e) => {
                result.errors.push(format!("Product {} ({}): {}", product_id, name, e));
            }
        }
    }

    Ok(result)
}

fn ensure_migration_supplier(conn: &Connection) -> Result<i32, String> {
    // Check if migration supplier exists
    let existing: Option<i32> = conn
        .query_row(
            "SELECT id FROM suppliers WHERE name = 'Data Migration'",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        return Ok(id);
    }

    // Create migration supplier
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO suppliers (name, comments, created_at, updated_at)
         VALUES (?, ?, ?, ?)",
        params![
            "Data Migration",
            "Auto-created supplier for migrating existing inventory to Purchase Order system",
            now,
            now
        ],
    )
    .map_err(|e| format!("Failed to create migration supplier: {}", e))?;

    Ok(conn.last_insert_rowid() as i32)
}

fn migrate_product(
    conn: &Connection,
    product_id: i32,
    name: &str,
    sku: &str,
    stock_qty: i32,
    initial_stock: Option<i32>,
    price: f64,
    supplier_id: Option<i32>,
    migration_supplier_id: i32,
    migration_date: &str,
    now: &str,
) -> Result<String, String> {
    let quantity = initial_stock.unwrap_or(stock_qty);
    let unit_cost = price; // Use the current price as historical cost

    // Use product's supplier if available, otherwise use migration supplier
    let po_supplier_id = supplier_id.unwrap_or(migration_supplier_id);

    // Generate migration PO number
    let po_number = format!("PO-MIGRATED-{:06}", product_id);

    // Check if this PO already exists (prevent duplicate migration)
    let existing: Option<i32> = conn
        .query_row(
            "SELECT id FROM purchase_orders WHERE po_number = ?",
            params![po_number],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return Err(format!("Already migrated (PO {} exists)", po_number));
    }

    let total_amount = quantity as f64 * unit_cost;

    // Create purchase order
    conn.execute(
        "INSERT INTO purchase_orders
         (po_number, supplier_id, order_date, received_date, status, total_amount, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?)",
        params![
            po_number,
            po_supplier_id,
            migration_date,
            migration_date,
            total_amount,
            format!("Auto-migrated from existing stock. Original SKU: {}", sku),
            now,
            now,
        ],
    )
    .map_err(|e| format!("Failed to create PO: {}", e))?;

    let po_id = conn.last_insert_rowid() as i32;

    // Create PO item
    conn.execute(
        "INSERT INTO purchase_order_items
         (po_id, product_id, quantity, unit_cost, total_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![po_id, product_id, quantity, unit_cost, total_amount, now],
    )
    .map_err(|e| format!("Failed to create PO item: {}", e))?;

    let po_item_id = conn.last_insert_rowid() as i32;

    // Create inventory batch using inventory service
    inventory_service::record_purchase(
        conn,
        product_id,
        quantity,
        unit_cost,
        Some(po_item_id),
        migration_date,
    )
    .map_err(|e| format!("Failed to create batch: {}", e))?;

    // Verify batch matches stock
    let batch_total: i32 = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity_remaining), 0)
             FROM inventory_batches
             WHERE product_id = ?",
            params![product_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if batch_total != stock_qty {
        return Err(format!(
            "Batch total ({}) doesn't match stock quantity ({})",
            batch_total, stock_qty
        ));
    }

    Ok(format!(
        "✓ {} ({}) - {} units @ ₹{:.2} = ₹{:.2} → {}",
        name, sku, quantity, unit_cost, total_amount, po_number
    ))
}

/// Check migration status - see which products need migration
#[tauri::command]
pub fn check_migration_status(db: State<Database>) -> Result<MigrationStatus, String> {
    let conn = db.get_conn()?;

    // Count products with stock but no batches
    let needs_migration: i32 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM products p
             WHERE p.stock_quantity > 0
             AND NOT EXISTS (
                 SELECT 1 FROM inventory_batches ib WHERE ib.product_id = p.id
             )",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Count products with batches
    let already_migrated: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT product_id)
             FROM inventory_batches",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Count total products
    let total_products: i32 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
        .unwrap_or(0);

    // Check if migration supplier exists
    let migration_supplier_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM suppliers WHERE name = 'Data Migration')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    Ok(MigrationStatus {
        total_products,
        products_with_batches: already_migrated,
        products_needing_migration: needs_migration,
        migration_supplier_exists,
        migration_required: needs_migration > 0,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub total_products: i32,
    pub products_with_batches: i32,
    pub products_needing_migration: i32,
    pub migration_supplier_exists: bool,
    pub migration_required: bool,
}

/// Validate data consistency after migration
#[tauri::command]
pub fn validate_migration(db: State<Database>) -> Result<ValidationResult, String> {
    let conn = db.get_conn()?;

    let mut result = ValidationResult {
        total_products_checked: 0,
        consistent_products: 0,
        inconsistent_products: Vec::new(),
    };

    // Get all products with stock
    let mut stmt = conn
        .prepare(
            "SELECT id, name, sku, stock_quantity
             FROM products
             WHERE stock_quantity > 0",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let products: Vec<(i32, String, String, i32)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| format!("Failed to query products: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect products: {}", e))?;

    result.total_products_checked = products.len() as i32;

    for (id, name, sku, stock_qty) in products {
        let batch_total: i32 = conn
            .query_row(
                "SELECT COALESCE(SUM(quantity_remaining), 0)
                 FROM inventory_batches
                 WHERE product_id = ?",
                params![id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if stock_qty == batch_total {
            result.consistent_products += 1;
        } else {
            result.inconsistent_products.push(InconsistentProduct {
                id,
                name,
                sku,
                stock_quantity: stock_qty,
                batch_total,
                difference: stock_qty - batch_total,
            });
        }
    }

    Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub total_products_checked: i32,
    pub consistent_products: i32,
    pub inconsistent_products: Vec<InconsistentProduct>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InconsistentProduct {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub stock_quantity: i32,
    pub batch_total: i32,
    pub difference: i32,
}
