use crate::db::{Database, Customer, Product, Supplier, Invoice};
use serde::{Deserialize, Serialize};
use serde_json;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedItemDisplay {
    pub id: i32,
    pub entity_type: String,
    pub entity_id: i32,
    pub entity_name: String,
    pub deleted_at: String,
    pub can_restore: bool,
    pub restore_notes: Option<String>,
}

/// Get all deleted items
#[tauri::command]
pub fn get_deleted_items(db: State<Database>) -> Result<Vec<DeletedItemDisplay>, String> {
    log::info!("get_deleted_items called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, entity_type, entity_id, entity_data, deleted_at FROM deleted_items ORDER BY deleted_at DESC")
        .map_err(|e| e.to_string())?;

    let items_iter = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i32>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item in items_iter {
        let (id, entity_type, entity_id, entity_data, deleted_at) = item.map_err(|e| e.to_string())?;

        // Extract name from entity_data JSON
        let entity_name = match entity_type.as_str() {
            "customer" => {
                serde_json::from_str::<Customer>(&entity_data)
                    .map(|c| c.name)
                    .unwrap_or_else(|_| format!("Customer #{}", entity_id))
            },
            "product" => {
                serde_json::from_str::<Product>(&entity_data)
                    .map(|p| p.name)
                    .unwrap_or_else(|_| format!("Product #{}", entity_id))
            },
            "supplier" => {
                serde_json::from_str::<Supplier>(&entity_data)
                    .map(|s| s.name)
                    .unwrap_or_else(|_| format!("Supplier #{}", entity_id))
            },
            "invoice" => {
                serde_json::from_str::<Invoice>(&entity_data)
                    .map(|i| i.invoice_number)
                    .unwrap_or_else(|_| format!("Invoice #{}", entity_id))
            },
            _ => format!("Unknown #{}", entity_id),
        };

        items.push(DeletedItemDisplay {
            id,
            entity_type,
            entity_id,
            entity_name,
            deleted_at,
            can_restore: true,
            restore_notes: None,
        });
    }

    log::info!("Returning {} deleted items", items.len());
    Ok(items)
}

/// Restore a deleted customer
#[tauri::command]
pub fn restore_customer(deleted_item_id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("restore_customer called with deleted_item_id: {}", deleted_item_id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get deleted item
    let (entity_data, related_data): (String, Option<String>) = conn
        .query_row(
            "SELECT entity_data, related_data FROM deleted_items WHERE id = ?1 AND entity_type = 'customer'",
            [deleted_item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Deleted customer not found: {}", e))?;

    let customer: Customer = serde_json::from_str(&entity_data)
        .map_err(|e| format!("Failed to parse customer data: {}", e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Restore customer
    tx.execute(
        "INSERT INTO customers (id, name, email, phone, address, place, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        (
            customer.id,
            &customer.name,
            &customer.email,
            &customer.phone,
            &customer.address,
            &customer.place,
            &customer.created_at,
            &customer.updated_at,
        ),
    )
    .map_err(|e| format!("Failed to restore customer: {}", e))?;

    // Restore related invoices if any
    if let Some(invoices_json) = related_data {
        if let Ok(invoices) = serde_json::from_str::<Vec<Invoice>>(&invoices_json) {
            for invoice in invoices {
                tx.execute(
                    "INSERT INTO invoices (id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, destination_state, fy_year, gst_rate, igst_amount, language, origin_state, sgst_amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                    (
                        invoice.id,
                        &invoice.invoice_number,
                        invoice.customer_id,
                        invoice.total_amount,
                        invoice.tax_amount,
                        invoice.discount_amount,
                        &invoice.payment_method,
                        &invoice.created_at,
                        invoice.cgst_amount,
                        &invoice.destination_state,
                        &invoice.fy_year,
                        invoice.gst_rate,
                        invoice.igst_amount,
                        &invoice.language,
                        &invoice.origin_state,
                        invoice.sgst_amount,
                    ),
                )
                .map_err(|e| format!("Failed to restore invoice: {}", e))?;
            }
        }
    }

    // Remove from deleted_items
    tx.execute("DELETE FROM deleted_items WHERE id = ?1", [deleted_item_id])
        .map_err(|e| format!("Failed to remove from trash: {}", e))?;

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Restored customer successfully");
    Ok(())
}

/// Restore a deleted product
#[tauri::command]
pub fn restore_product(deleted_item_id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("restore_product called with deleted_item_id: {}", deleted_item_id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get deleted item
    let entity_data: String = conn
        .query_row(
            "SELECT entity_data FROM deleted_items WHERE id = ?1 AND entity_type = 'product'",
            [deleted_item_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Deleted product not found: {}", e))?;

    let product: Product = serde_json::from_str(&entity_data)
        .map_err(|e| format!("Failed to parse product data: {}", e))?;

    // Check for SKU conflict
    let sku_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE sku = ?1",
            [&product.sku],
            |row| row.get(0),
        )
        .map(|count: i32| count > 0)
        .map_err(|e| e.to_string())?;

    if sku_exists {
        return Err(format!("Cannot restore: Product with SKU '{}' already exists", product.sku));
    }

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Restore product
    tx.execute(
        "INSERT INTO products (id, name, sku, price, stock_quantity, supplier_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (
            product.id,
            &product.name,
            &product.sku,
            product.price,
            product.stock_quantity,
            product.supplier_id,
        ),
    )
    .map_err(|e| format!("Failed to restore product: {}", e))?;

    // Remove from deleted_items
    tx.execute("DELETE FROM deleted_items WHERE id = ?1", [deleted_item_id])
        .map_err(|e| format!("Failed to remove from trash: {}", e))?;

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Restored product successfully");
    Ok(())
}

/// Restore a deleted supplier
#[tauri::command]
pub fn restore_supplier(deleted_item_id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("restore_supplier called with deleted_item_id: {}", deleted_item_id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get deleted item
    let (entity_data, related_data): (String, Option<String>) = conn
        .query_row(
            "SELECT entity_data, related_data FROM deleted_items WHERE id = ?1 AND entity_type = 'supplier'",
            [deleted_item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Deleted supplier not found: {}", e))?;

    let supplier: Supplier = serde_json::from_str(&entity_data)
        .map_err(|e| format!("Failed to parse supplier data: {}", e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Restore supplier
    tx.execute(
        "INSERT INTO suppliers (id, name, contact_info) VALUES (?1, ?2, ?3)",
        (supplier.id, &supplier.name, &supplier.contact_info),
    )
    .map_err(|e| format!("Failed to restore supplier: {}", e))?;

    // Re-link products if any
    if let Some(product_ids_json) = related_data {
        if let Ok(product_ids) = serde_json::from_str::<Vec<i32>>(&product_ids_json) {
            for product_id in product_ids {
                tx.execute(
                    "UPDATE products SET supplier_id = ?1 WHERE id = ?2",
                    (supplier.id, product_id),
                )
                .map_err(|e| format!("Failed to re-link product: {}", e))?;
            }
        }
    }

    // Remove from deleted_items
    tx.execute("DELETE FROM deleted_items WHERE id = ?1", [deleted_item_id])
        .map_err(|e| format!("Failed to remove from trash: {}", e))?;

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Restored supplier successfully");
    Ok(())
}

/// Permanently delete an item from trash
#[tauri::command]
pub fn permanently_delete_item(deleted_item_id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("permanently_delete_item called with id: {}", deleted_item_id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM deleted_items WHERE id = ?1", [deleted_item_id])
        .map_err(|e| format!("Failed to delete item: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Deleted item with id {} not found", deleted_item_id));
    }

    log::info!("Permanently deleted item with id: {}", deleted_item_id);
    Ok(())
}

/// Clear all items from trash
#[tauri::command]
pub fn clear_trash(db: State<Database>) -> Result<usize, String> {
    log::info!("clear_trash called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM deleted_items", [])
        .map_err(|e| format!("Failed to clear trash: {}", e))?;

    log::info!("Cleared {} items from trash", rows_affected);
    Ok(rows_affected)
}
