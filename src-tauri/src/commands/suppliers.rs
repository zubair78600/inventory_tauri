use crate::db::{Database, Supplier, SupplierPayment};
use crate::commands::PaginatedResult;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSupplierInput {
    pub name: String,
    pub contact_info: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSupplierInput {
    pub id: i32,
    pub name: String,
    pub contact_info: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSupplierPaymentInput {
    pub supplier_id: i32,
    pub product_id: Option<i32>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub note: Option<String>,
    /// Optional explicit paid_at timestamp (RFC3339). If None, current time is used.
    pub paid_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupplierPaymentSummary {
    pub total_payable: f64,
    pub total_paid: f64,
    pub pending_amount: f64,
}

/// Get all suppliers, optionally filtered by search query
/// Get all suppliers, optionally filtered by search query, with pagination
#[tauri::command]
pub fn get_suppliers(
    search: Option<String>,
    page: i32,
    page_size: i32,
    db: State<Database>
) -> Result<PaginatedResult<Supplier>, String> {
    log::info!("get_suppliers called with search: {:?}, page: {}, page_size: {}", search, page, page_size);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let offset = (page - 1) * page_size;
    let limit = page_size;

    let mut suppliers = Vec::new();
    let total_count: i64;

    let base_query = "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at FROM suppliers";
    let count_query = "SELECT COUNT(*) FROM suppliers";

    if let Some(search_term) = search {
        // Search by name or contact info
        let search_pattern = format!("%{}%", search_term);
        let where_clause = "WHERE name LIKE ?1 OR contact_info LIKE ?1";
        
        // Get total count
        let count_sql = format!("{} {}", count_query, where_clause);
        total_count = conn
            .query_row(&count_sql, [&search_pattern], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        let query = format!("{} {} ORDER BY name LIMIT ?2 OFFSET ?3", base_query, where_clause);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let supplier_iter = stmt
            .query_map(rusqlite::params![&search_pattern, limit, offset], |row| {
                Ok(Supplier {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    contact_info: row.get(2)?,
                    address: row.get(3)?,
                    email: row.get(4)?,
                    comments: row.get(5)?,
                    state: row.get(6)?,
                    district: row.get(7)?,
                    town: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for supplier in supplier_iter {
            suppliers.push(supplier.map_err(|e| e.to_string())?);
        }
    } else {
        // Get total count
        total_count = conn
            .query_row(count_query, [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        let query = format!("{} ORDER BY name LIMIT ?1 OFFSET ?2", base_query);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let supplier_iter = stmt
            .query_map([limit, offset], |row| {
                Ok(Supplier {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    contact_info: row.get(2)?,
                    address: row.get(3)?,
                    email: row.get(4)?,
                    comments: row.get(5)?,
                    state: row.get(6)?,
                    district: row.get(7)?,
                    town: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for supplier in supplier_iter {
            suppliers.push(supplier.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} suppliers (page {}, size {}, total {})", suppliers.len(), page, page_size, total_count);
    Ok(PaginatedResult {
        items: suppliers,
        total_count,
    })
}

/// Get a single supplier by ID
#[tauri::command]
pub fn get_supplier(id: i32, db: State<Database>) -> Result<Supplier, String> {
    log::info!("get_supplier called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let supplier = conn
        .query_row(
            "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at FROM suppliers WHERE id = ?1",
            [id],
            |row| {
                Ok(Supplier {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    contact_info: row.get(2)?,
                    address: row.get(3)?,
                    email: row.get(4)?,
                    comments: row.get(5)?,
                    state: row.get(6)?,
                    district: row.get(7)?,
                    town: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Supplier not found: {}", e))?;

    Ok(supplier)
}

/// Create a new supplier
#[tauri::command]
pub fn create_supplier(input: CreateSupplierInput, db: State<Database>) -> Result<Supplier, String> {
    log::info!("create_supplier called with: {:?}", input);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    conn.execute(
        "INSERT INTO suppliers (name, contact_info, address, email, comments, state, district, town, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        (&input.name, &input.contact_info, &input.address, &input.email, &input.comments, &input.state, &input.district, &input.town),
    )
    .map_err(|e| format!("Failed to create supplier: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    // Fetch the created supplier to get timestamps
    let supplier = conn.query_row(
        "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at FROM suppliers WHERE id = ?1",
        [id],
        |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                contact_info: row.get(2)?,
                address: row.get(3)?,
                email: row.get(4)?,
                comments: row.get(5)?,
                state: row.get(6)?,
                district: row.get(7)?,
                town: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    ).map_err(|e| format!("Failed to fetch created supplier: {}", e))?;

    log::info!("Created supplier with id: {}", id);
    Ok(supplier)
}

/// Update an existing supplier
#[tauri::command]
pub fn update_supplier(input: UpdateSupplierInput, db: State<Database>) -> Result<Supplier, String> {
    log::info!("update_supplier called with: {:?}", input);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let rows_affected = conn
        .execute(
            "UPDATE suppliers SET name = ?1, contact_info = ?2, address = ?3, email = ?4, comments = ?5, state = ?6, district = ?7, town = ?8, updated_at = datetime('now') WHERE id = ?9",
            (&input.name, &input.contact_info, &input.address, &input.email, &input.comments, &input.state, &input.district, &input.town, input.id),
        )
        .map_err(|e| format!("Failed to update supplier: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Supplier with id {} not found", input.id));
    }

    // Fetch updated supplier to get new timestamp
    let supplier = conn.query_row(
        "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at FROM suppliers WHERE id = ?1",
        [input.id],
        |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                contact_info: row.get(2)?,
                address: row.get(3)?,
                email: row.get(4)?,
                comments: row.get(5)?,
                state: row.get(6)?,
                district: row.get(7)?,
                town: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    ).map_err(|e| format!("Failed to fetch updated supplier: {}", e))?;

    log::info!("Updated supplier with id: {}", input.id);
    Ok(supplier)
}

/// Delete a supplier by ID
#[tauri::command]
pub fn delete_supplier(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_supplier called with id: {}", id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get supplier data before deletion for audit trail
    let supplier = conn.query_row(
        "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at FROM suppliers WHERE id = ?1",
        [id],
        |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                contact_info: row.get(2)?,
                address: row.get(3)?,
                email: row.get(4)?,
                comments: row.get(5)?,
                state: row.get(6)?,
                district: row.get(7)?,
                town: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| format!("Supplier with id {} not found: {}", id, e))?;

    // Get related product IDs (scoped to release borrow before transaction)
    let product_ids = {
        let mut stmt = conn.prepare("SELECT id FROM products WHERE supplier_id = ?1").map_err(|e| e.to_string())?;
        let product_ids_iter = stmt.query_map([id], |row| row.get::<_, i32>(0)).map_err(|e| e.to_string())?;

        let mut product_ids = Vec::new();
        for product_id in product_ids_iter {
            product_ids.push(product_id.map_err(|e| e.to_string())?);
        }
        product_ids
    };

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Save to deleted_items
    let supplier_json = serde_json::to_string(&supplier).map_err(|e| format!("Failed to serialize supplier: {}", e))?;
    let product_ids_json = if product_ids.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&product_ids).map_err(|e| format!("Failed to serialize product IDs: {}", e))?)
    };

    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO deleted_items (entity_type, entity_id, entity_data, related_data, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ("supplier", id, &supplier_json, product_ids_json.as_deref(), &now),
    )
    .map_err(|e| format!("Failed to save to trash: {}", e))?;

    // Unlink products from this supplier (set supplier_id to NULL)
    tx.execute(
        "UPDATE products SET supplier_id = NULL WHERE supplier_id = ?1",
        [id],
    )
    .map_err(|e| format!("Failed to unlink products from supplier: {}", e))?;

    // Delete the supplier
    let rows_affected = tx.execute("DELETE FROM suppliers WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete supplier: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Supplier with id {} not found", id));
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Deleted supplier with id: {} and saved to trash", id);
    Ok(())
}

/// Create a payment record for a supplier
#[tauri::command]
pub fn create_supplier_payment(
    input: CreateSupplierPaymentInput,
    db: State<Database>,
) -> Result<SupplierPayment, String> {
    log::info!(
        "create_supplier_payment called for supplier_id: {}, amount: {}",
        input.supplier_id,
        input.amount
    );

    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".into());
    }

    let conn = db.conn();
    let conn = conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let paid_at = input
        .paid_at
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    conn.execute(
        "INSERT INTO supplier_payments (supplier_id, product_id, amount, payment_method, note, paid_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
        (
            input.supplier_id,
            input.product_id,
            input.amount,
            input.payment_method.as_deref(),
            input.note.as_deref(),
            &paid_at,
        ),
    )
    .map_err(|e| format!("Failed to create supplier payment: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let payment = conn
        .query_row(
            "SELECT id, supplier_id, product_id, amount, payment_method, note, paid_at, created_at FROM supplier_payments WHERE id = ?1",
            [id],
            |row| {
                Ok(SupplierPayment {
                    id: row.get(0)?,
                    supplier_id: row.get(1)?,
                    product_id: row.get(2)?,
                    amount: row.get(3)?,
                    payment_method: row.get(4)?,
                    note: row.get(5)?,
                    paid_at: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created supplier payment: {}", e))?;

    Ok(payment)
}

/// Get all payments for a supplier
#[tauri::command]
pub fn get_supplier_payments(
    supplier_id: i32,
    product_id: i32,
    db: State<Database>,
) -> Result<Vec<SupplierPayment>, String> {
    log::info!(
        "get_supplier_payments called for supplier_id: {}",
        supplier_id
    );

    let conn = db.conn();
    let conn = conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, supplier_id, product_id, amount, payment_method, note, paid_at, created_at
             FROM supplier_payments
             WHERE supplier_id = ?1 AND product_id = ?2
             ORDER BY paid_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let payment_iter = stmt
        .query_map((supplier_id, product_id), |row| {
            Ok(SupplierPayment {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                product_id: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                note: row.get(5)?,
                paid_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for payment in payment_iter {
        payments.push(payment.map_err(|e| e.to_string())?);
    }

    Ok(payments)
}

/// Delete a single supplier payment by ID
#[tauri::command]
pub fn delete_supplier_payment(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_supplier_payment called with id: {}", id);

    let conn = db.conn();
    let conn = conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM supplier_payments WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete supplier payment: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Supplier payment with id {} not found", id));
    }

    Ok(())
}

/// Get payment summary for a supplier (total payable, total paid, pending)
#[tauri::command]
pub fn get_supplier_payment_summary(
    supplier_id: i32,
    product_id: i32,
    db: State<Database>,
) -> Result<SupplierPaymentSummary, String> {
    log::info!(
        "get_supplier_payment_summary called for supplier_id: {}, product_id: {}",
        supplier_id, product_id
    );

    let conn = db.conn();
    let conn = conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Total payable is the purchase value for this specific product from this supplier.
    // Use purchase_order_items to sum actual quantities and costs, plus initial stock value.
    let (po_total_value, _po_total_qty): (f64, i64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(poi.quantity * poi.unit_cost), 0.0),
                COALESCE(SUM(poi.quantity), 0)
             FROM purchase_order_items poi
             JOIN purchase_orders po ON po.id = poi.po_id
             WHERE poi.product_id = ?1 AND po.supplier_id = ?2",
            (product_id, supplier_id),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((0.0, 0));

    let (initial_stock, price): (i64, f64) = conn
        .query_row(
            "SELECT COALESCE(initial_stock, 0), price FROM products WHERE id = ?1",
            [product_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?)),
        )
        .unwrap_or((0, 0.0));

    let total_payable: f64 = po_total_value + (initial_stock as f64 * price);

    let total_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = ?1 AND product_id = ?2",
            (supplier_id, product_id),
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let pending = (total_payable - total_paid).max(0.0);

    Ok(SupplierPaymentSummary {
        total_payable,
        total_paid,
        pending_amount: pending,
    })
}

/// Add mock supplier data for testing
#[tauri::command]
pub fn add_mock_suppliers(db: State<Database>) -> Result<String, String> {
    log::info!("add_mock_suppliers called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Check if suppliers already exist
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM suppliers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(format!("Database already has {} suppliers. Skipping mock data.", count));
    }

    let mock_suppliers = vec![
        ("Tech Distributors Inc", Some("contact@techdist.com | +1-555-0101")),
        ("Global Electronics Supply", Some("sales@globales.com | +1-555-0102")),
        ("Premium Components Ltd", Some("info@premcomp.com | +1-555-0103")),
        ("Office Essentials Co", Some("orders@officeess.com | +1-555-0104")),
        ("Digital Hardware Partners", Some("support@digihard.com | +1-555-0105")),
    ];

    let mut inserted = 0;
    for (name, contact) in mock_suppliers {
        conn.execute(
            "INSERT INTO suppliers (name, contact_info) VALUES (?1, ?2)",
            (name, contact),
        )
        .map_err(|e| format!("Failed to insert mock supplier: {}", e))?;
        inserted += 1;
    }

    log::info!("Added {} mock suppliers", inserted);
    Ok(format!("Successfully added {} mock suppliers", inserted))
}
