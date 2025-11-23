use crate::db::{Database, Supplier};
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

/// Get all suppliers, optionally filtered by search query
#[tauri::command]
pub fn get_suppliers(search: Option<String>, db: State<Database>) -> Result<Vec<Supplier>, String> {
    log::info!("get_suppliers called with search: {:?}", search);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut suppliers = Vec::new();

    if let Some(search_term) = search {
        // Search by name or contact info
        let search_pattern = format!("%{}%", search_term);
        let mut stmt = conn
            .prepare("SELECT id, name, contact_info, address, email, comments, state, district, town FROM suppliers WHERE name LIKE ?1 OR contact_info LIKE ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let supplier_iter = stmt
            .query_map([&search_pattern], |row| {
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
                })
            })
            .map_err(|e| e.to_string())?;

        for supplier in supplier_iter {
            suppliers.push(supplier.map_err(|e| e.to_string())?);
        }
    } else {
        // Get all suppliers
        let mut stmt = conn
            .prepare("SELECT id, name, contact_info, address, email, comments, state, district, town FROM suppliers ORDER BY name")
            .map_err(|e| e.to_string())?;

        let supplier_iter = stmt
            .query_map([], |row| {
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
                })
            })
            .map_err(|e| e.to_string())?;

        for supplier in supplier_iter {
            suppliers.push(supplier.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} suppliers", suppliers.len());
    Ok(suppliers)
}

/// Get a single supplier by ID
#[tauri::command]
pub fn get_supplier(id: i32, db: State<Database>) -> Result<Supplier, String> {
    log::info!("get_supplier called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let supplier = conn
        .query_row(
            "SELECT id, name, contact_info, address, email, comments, state, district, town FROM suppliers WHERE id = ?1",
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
        "INSERT INTO suppliers (name, contact_info, address, email, comments, state, district, town) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        (&input.name, &input.contact_info, &input.address, &input.email, &input.comments, &input.state, &input.district, &input.town),
    )
    .map_err(|e| format!("Failed to create supplier: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let supplier = Supplier {
        id,
        name: input.name,
        contact_info: input.contact_info,
        address: input.address,
        email: input.email,
        comments: input.comments,
        state: input.state,
        district: input.district,
        town: input.town,
    };

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
            "UPDATE suppliers SET name = ?1, contact_info = ?2, address = ?3, email = ?4, comments = ?5, state = ?6, district = ?7, town = ?8 WHERE id = ?9",
            (&input.name, &input.contact_info, &input.address, &input.email, &input.comments, &input.state, &input.district, &input.town, input.id),
        )
        .map_err(|e| format!("Failed to update supplier: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Supplier with id {} not found", input.id));
    }

    let supplier = Supplier {
        id: input.id,
        name: input.name,
        contact_info: input.contact_info,
        address: input.address,
        email: input.email,
        comments: input.comments,
        state: input.state,
        district: input.district,
        town: input.town,
    };

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
        "SELECT id, name, contact_info, address, email, comments, state, district, town FROM suppliers WHERE id = ?1",
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
