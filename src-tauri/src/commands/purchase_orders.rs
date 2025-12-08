/// Purchase Order Commands
/// Handles all purchase order operations including creation, retrieval, and status updates

use rusqlite::{params, Connection, OptionalExtension};
use chrono::Utc;
use tauri::State;
use serde::{Deserialize, Serialize};

use crate::db::models::{
    PurchaseOrder, PurchaseOrderWithDetails, PurchaseOrderItemWithProduct,
    CreatePurchaseOrderInput, PurchaseOrderComplete, Supplier, SupplierPayment,
};
use crate::db::Database;
use crate::services::inventory_service;

// =============================================
// HELPER FUNCTIONS
// =============================================

/// Generate next PO number (PO-YYYY-NNN format)
fn generate_po_number(conn: &Connection) -> Result<String, String> {
    let current_year = Utc::now().format("%Y").to_string();
    let po_prefix = format!("PO-{}-", current_year);

    // Get the highest sequence number for current year by checking all matching POs
    let max_seq: i32 = conn
        .prepare(&format!(
            "SELECT po_number FROM purchase_orders WHERE po_number LIKE '{}%'",
            po_prefix
        ))
        .map_err(|e| format!("Failed to prepare query: {}", e))?
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query: {}", e))?
        .filter_map(|result| result.ok())
        .filter_map(|po_number| {
            // Extract sequence from "PO-2025-001" -> "001" -> 1
            po_number.split('-').nth(2).and_then(|s| s.parse::<i32>().ok())
        })
        .max()
        .unwrap_or(0);

    let next_seq = max_seq + 1;
    Ok(format!("PO-{}-{:03}", current_year, next_seq))
}

// =============================================
// CREATE PURCHASE ORDER
// =============================================

#[tauri::command]
pub fn create_purchase_order(
    input: CreatePurchaseOrderInput,
    db: State<Database>,
) -> Result<PurchaseOrder, String> {
    let conn = db.get_conn()?;

    // Start transaction
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let result = create_purchase_order_internal(&conn, input);

    match result {
        Ok(po) => {
            conn.execute("COMMIT", [])
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;
            Ok(po)
        }
        Err(e) => {
            conn.execute("ROLLBACK", []).ok();
            Err(e)
        }
    }
}

fn create_purchase_order_internal(
    conn: &Connection,
    input: CreatePurchaseOrderInput,
) -> Result<PurchaseOrder, String> {
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let order_date = input.order_date.unwrap_or_else(|| {
        Utc::now().format("%Y-%m-%d").to_string()
    });

    // Validate supplier exists
    let supplier_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM suppliers WHERE id = ?)",
            params![input.supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to verify supplier: {}", e))?;

    if !supplier_exists {
        return Err(format!("Supplier with ID {} not found", input.supplier_id));
    }

    // Validate all products exist and calculate total
    let mut total_amount = 0.0;
    for item in &input.items {
        let product_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM products WHERE id = ?)",
                params![item.product_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to verify product: {}", e))?;

        if !product_exists {
            return Err(format!("Product with ID {} not found", item.product_id));
        }

        if item.quantity <= 0 {
            return Err("Item quantity must be greater than 0".to_string());
        }

        if item.unit_cost < 0.0 {
            return Err("Item unit cost cannot be negative".to_string());
        }

        total_amount += item.quantity as f64 * item.unit_cost;
    }

    // Generate PO number
    let po_number = generate_po_number(conn)?;

    // Create purchase order
    conn.execute(
        "INSERT INTO purchase_orders
         (po_number, supplier_id, order_date, expected_delivery_date, status, total_amount, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?)",
        params![
            po_number,
            input.supplier_id,
            order_date,
            input.expected_delivery_date,
            total_amount,
            input.notes,
            now,
            now,
        ],
    )
    .map_err(|e| format!("Failed to create purchase order: {}", e))?;

    let po_id = conn.last_insert_rowid() as i32;

    // Create PO items and update inventory
    for item in &input.items {
        let total_cost = item.quantity as f64 * item.unit_cost;

        // Create PO item
        conn.execute(
            "INSERT INTO purchase_order_items
             (po_id, product_id, quantity, unit_cost, total_cost, created_at)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![po_id, item.product_id, item.quantity, item.unit_cost, total_cost, now],
        )
        .map_err(|e| format!("Failed to create PO item: {}", e))?;

        let po_item_id = conn.last_insert_rowid() as i32;

        // Update product stock
        conn.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?",
            params![item.quantity, now, item.product_id],
        )
        .map_err(|e| format!("Failed to update product stock: {}", e))?;

        // Create inventory batch and transaction using inventory service
        inventory_service::record_purchase(
            conn,
            item.product_id,
            item.quantity,
            item.unit_cost,
            Some(po_item_id),
            &order_date,
        )?;
    }

    // Retrieve and return the created PO
    let po = conn
        .query_row(
            "SELECT id, po_number, supplier_id, order_date, expected_delivery_date,
                    received_date, status, total_amount, notes, created_at, updated_at
             FROM purchase_orders WHERE id = ?",
            params![po_id],
            |row| {
                Ok(PurchaseOrder {
                    id: row.get(0)?,
                    po_number: row.get(1)?,
                    supplier_id: row.get(2)?,
                    order_date: row.get(3)?,
                    expected_delivery_date: row.get(4)?,
                    received_date: row.get(5)?,
                    status: row.get(6)?,
                    total_amount: row.get(7)?,
                    notes: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Failed to retrieve created PO: {}", e))?;

    Ok(po)
}

// =============================================
// PURCHASE SUMMARY PER PRODUCT
// =============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductPurchaseSummary {
    pub total_quantity: i64,
    pub total_value: f64,
    pub purchase_orders: i64,
}

/// Get total purchased quantity/value for a product (all suppliers)
/// Includes:
/// - Initial stock (initial_stock * product price)
/// - All purchase order items for this product
#[tauri::command]
pub fn get_product_purchase_summary(
    product_id: i32,
    db: State<Database>,
) -> Result<ProductPurchaseSummary, String> {
    let conn = db.get_conn()?;

    let (initial_stock, price): (i64, f64) = conn
        .query_row(
            "SELECT COALESCE(initial_stock, 0), price FROM products WHERE id = ?1",
            params![product_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?)),
        )
        .unwrap_or((0, 0.0));

    let (po_qty, po_value, po_count): (i64, f64, i64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(poi.quantity), 0) AS qty,
                COALESCE(SUM(poi.quantity * poi.unit_cost), 0.0) AS value,
                COUNT(DISTINCT poi.po_id) AS po_count
             FROM purchase_order_items poi
             WHERE poi.product_id = ?1",
            params![product_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap_or((0, 0.0, 0));

    let total_quantity = initial_stock + po_qty;
    let total_value = (initial_stock as f64 * price) + po_value;

    Ok(ProductPurchaseSummary {
        total_quantity,
        total_value,
        purchase_orders: po_count,
    })
}

// =============================================
// GET PURCHASE ORDERS (LIST)
// =============================================

#[tauri::command]
pub fn get_purchase_orders(
    supplier_id: Option<i32>,
    status: Option<String>,
    db: State<Database>,
) -> Result<Vec<PurchaseOrderWithDetails>, String> {
    let conn = db.get_conn()?;

    let mut query = String::from(
        "SELECT
            po.id, po.po_number, po.supplier_id, s.name as supplier_name,
            po.order_date, po.expected_delivery_date, po.received_date,
            po.status, po.total_amount, po.notes, po.created_at, po.updated_at,
            COUNT(DISTINCT poi.id) as items_count,
            COALESCE(SUM(sp.amount), 0) as total_paid
         FROM purchase_orders po
         JOIN suppliers s ON po.supplier_id = s.id
         LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
         LEFT JOIN supplier_payments sp ON sp.po_id = po.id
         WHERE 1=1"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(sid) = supplier_id {
        query.push_str(" AND po.supplier_id = ?");
        params_vec.push(Box::new(sid));
    }

    if let Some(ref st) = status {
        query.push_str(" AND po.status = ?");
        params_vec.push(Box::new(st.clone()));
    }

    query.push_str(" GROUP BY po.id ORDER BY po.order_date DESC, po.id DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let pos = stmt
        .query_map(params_refs.as_slice(), |row| {
            let total_amount: f64 = row.get(8)?;
            let total_paid: f64 = row.get(13)?;
            let total_pending = total_amount - total_paid;

            Ok(PurchaseOrderWithDetails {
                id: row.get(0)?,
                po_number: row.get(1)?,
                supplier_id: row.get(2)?,
                supplier_name: row.get(3)?,
                order_date: row.get(4)?,
                expected_delivery_date: row.get(5)?,
                received_date: row.get(6)?,
                status: row.get(7)?,
                total_amount,
                notes: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                items_count: row.get(12)?,
                total_paid,
                total_pending,
            })
        })
        .map_err(|e| format!("Failed to query purchase orders: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect purchase orders: {}", e))?;

    Ok(pos)
}

// =============================================
// GET PURCHASE ORDER BY ID (COMPLETE DETAILS)
// =============================================

#[tauri::command]
pub fn get_purchase_order_by_id(
    po_id: i32,
    db: State<Database>,
) -> Result<PurchaseOrderComplete, String> {
    let conn = db.get_conn()?;

    // Get purchase order
    let po: PurchaseOrder = conn
        .query_row(
            "SELECT id, po_number, supplier_id, order_date, expected_delivery_date,
                    received_date, status, total_amount, notes, created_at, updated_at
             FROM purchase_orders WHERE id = ?",
            params![po_id],
            |row| {
                Ok(PurchaseOrder {
                    id: row.get(0)?,
                    po_number: row.get(1)?,
                    supplier_id: row.get(2)?,
                    order_date: row.get(3)?,
                    expected_delivery_date: row.get(4)?,
                    received_date: row.get(5)?,
                    status: row.get(6)?,
                    total_amount: row.get(7)?,
                    notes: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Purchase order not found: {}", e))?;

    // Get supplier
    let supplier: Supplier = conn
        .query_row(
            "SELECT id, name, contact_info, address, email, comments, state, district, town, created_at, updated_at
             FROM suppliers WHERE id = ?",
            params![po.supplier_id],
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

    // Get PO items with product details
    let mut stmt = conn
        .prepare(
            "SELECT poi.id, poi.po_id, poi.product_id, p.name, p.sku,
                    poi.quantity, poi.unit_cost, poi.total_cost, poi.created_at
             FROM purchase_order_items poi
             JOIN products p ON poi.product_id = p.id
             WHERE poi.po_id = ?
             ORDER BY poi.id ASC",
        )
        .map_err(|e| format!("Failed to prepare items statement: {}", e))?;

    let items = stmt
        .query_map(params![po_id], |row| {
            Ok(PurchaseOrderItemWithProduct {
                id: row.get(0)?,
                po_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                sku: row.get(4)?,
                quantity: row.get(5)?,
                unit_cost: row.get(6)?,
                total_cost: row.get(7)?,
                selling_price: None, // Not needed for creating PO item context
                quantity_sold: None,
                sold_revenue: None,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query items: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect items: {}", e))?;

    // Get payments for this PO
    let mut stmt = conn
        .prepare(
            "SELECT id, supplier_id, product_id, amount, payment_method, note, paid_at, created_at
             FROM supplier_payments
             WHERE po_id = ?
             ORDER BY paid_at DESC",
        )
        .map_err(|e| format!("Failed to prepare payments statement: {}", e))?;

    let payments = stmt
        .query_map(params![po_id], |row| {
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
        .map_err(|e| format!("Failed to query payments: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect payments: {}", e))?;

    let total_paid: f64 = payments.iter().map(|p| p.amount).sum();
    let total_pending = po.total_amount - total_paid;

    Ok(PurchaseOrderComplete {
        purchase_order: po,
        supplier,
        items,
        payments,
        total_paid,
        total_pending,
    })
}

// =============================================
// UPDATE PURCHASE ORDER STATUS
// =============================================

#[tauri::command]
pub fn update_purchase_order_status(
    po_id: i32,
    status: String,
    received_date: Option<String>,
    db: State<Database>,
) -> Result<PurchaseOrder, String> {
    let conn = db.get_conn()?;

    // Validate status
    let valid_statuses = ["draft", "ordered", "received", "cancelled"];
    if !valid_statuses.contains(&status.as_str()) {
        return Err(format!(
            "Invalid status. Must be one of: {}",
            valid_statuses.join(", ")
        ));
    }

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Update PO status
    conn.execute(
        "UPDATE purchase_orders
         SET status = ?, received_date = ?, updated_at = ?
         WHERE id = ?",
        params![status, received_date, now, po_id],
    )
    .map_err(|e| format!("Failed to update purchase order status: {}", e))?;

    // Retrieve and return updated PO
    let po = conn
        .query_row(
            "SELECT id, po_number, supplier_id, order_date, expected_delivery_date,
                    received_date, status, total_amount, notes, created_at, updated_at
             FROM purchase_orders WHERE id = ?",
            params![po_id],
            |row| {
                Ok(PurchaseOrder {
                    id: row.get(0)?,
                    po_number: row.get(1)?,
                    supplier_id: row.get(2)?,
                    order_date: row.get(3)?,
                    expected_delivery_date: row.get(4)?,
                    received_date: row.get(5)?,
                    status: row.get(6)?,
                    total_amount: row.get(7)?,
                    notes: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Failed to retrieve updated PO: {}", e))?;

    Ok(po)
}

// =============================================
// ADD PAYMENT TO PURCHASE ORDER
// =============================================

#[tauri::command]
pub fn add_payment_to_purchase_order(
    po_id: i32,
    amount: f64,
    payment_method: Option<String>,
    note: Option<String>,
    paid_at: Option<String>,
    db: State<Database>,
) -> Result<i32, String> {
    let conn = db.get_conn()?;

    if amount <= 0.0 {
        return Err("Payment amount must be greater than 0".to_string());
    }

    // Get PO details to validate
    let (supplier_id, total_amount): (i32, f64) = conn
        .query_row(
            "SELECT supplier_id, total_amount FROM purchase_orders WHERE id = ?",
            params![po_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Purchase order not found: {}", e))?;

    // Check total paid so far
    let total_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE po_id = ?",
            params![po_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    if total_paid + amount > total_amount {
        return Err(format!(
            "Payment amount exceeds remaining balance. Total: ₹{:.2}, Paid: ₹{:.2}, Remaining: ₹{:.2}",
            total_amount,
            total_paid,
            total_amount - total_paid
        ));
    }

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let payment_date = paid_at.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Add po_id column to supplier_payments if it doesn't exist
    // This is a migration step - will fail silently if column exists
    let _ = conn.execute(
        "ALTER TABLE supplier_payments ADD COLUMN po_id INTEGER REFERENCES purchase_orders(id)",
        [],
    );

    // Create payment record
    conn.execute(
        "INSERT INTO supplier_payments
         (supplier_id, po_id, amount, payment_method, note, paid_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![supplier_id, po_id, amount, payment_method, note, payment_date, now],
    )
    .map_err(|e| format!("Failed to create payment: {}", e))?;

    let payment_id = conn.last_insert_rowid() as i32;

    Ok(payment_id)
}

// =============================================
// GET PURCHASE HISTORY FOR PRODUCT
// =============================================

#[tauri::command]
pub fn get_product_purchase_history(
    product_id: i32,
    db: State<Database>,
) -> Result<Vec<PurchaseOrderItemWithProduct>, String> {
    let conn = db.get_conn()?;

    // 1. Get Initial Stock info
    let initial_stock_info: Option<(i32, f64, String, f64)> = conn.query_row(
        "SELECT initial_stock, price, created_at, selling_price FROM products WHERE id = ?",
        params![product_id],
        |row| Ok((
            row.get::<_, Option<i32>>(0)?.unwrap_or(0),
            row.get::<_, f64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
        )),
    ).optional().map_err(|e| format!("Failed to get product info: {}", e))?;

    // 2. Get Purchase Order Items (Batches)
    let mut po_items_stmt = conn.prepare(
        "SELECT poi.id, poi.po_id, poi.quantity, poi.unit_cost, poi.total_cost, poi.created_at, p.name, p.sku, p.selling_price
         FROM purchase_order_items poi
         JOIN products p ON poi.product_id = p.id
         WHERE poi.product_id = ?
         ORDER BY poi.created_at ASC"
    ).map_err(|e| format!("Failed to prepare PO items stmt: {}", e))?;

    let po_batches = po_items_stmt.query_map(params![product_id], |row| {
        Ok(PurchaseOrderItemWithProduct {
            id: row.get(0)?,
            po_id: row.get(1)?,
            product_id,
            product_name: row.get(6)?,
            sku: row.get(7)?,
            quantity: row.get(2)?,
            unit_cost: row.get(3)?,
            total_cost: row.get(4)?,
            selling_price: row.get(8)?,
            quantity_sold: Some(0), // Will calculate
            sold_revenue: Some(0.0), // Will calculate
            created_at: row.get(5)?,
        })
    }).map_err(|e| format!("Failed to query PO items: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect PO items: {}", e))?;

    // 3. Get Sales (Invoice Items) with proportional discount
    // Discount is distributed proportionally: item_discount = (item_value / invoice_subtotal) * invoice_discount
    let mut sales_stmt = conn.prepare(
        "SELECT ii.quantity, ii.unit_price,
                COALESCE(i.discount_amount, 0) as invoice_discount,
                (SELECT SUM(ii2.quantity * ii2.unit_price) FROM invoice_items ii2 WHERE ii2.invoice_id = i.id) as invoice_subtotal
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE ii.product_id = ?
         ORDER BY i.created_at ASC"
    ).map_err(|e| format!("Failed to prepare sales stmt: {}", e))?;

    // (quantity, unit_price, item_discount_share)
    let sales: Vec<(i32, f64, f64)> = sales_stmt.query_map(params![product_id], |row| {
        let qty: i32 = row.get(0)?;
        let unit_price: f64 = row.get(1)?;
        let invoice_discount: f64 = row.get(2)?;
        let invoice_subtotal: f64 = row.get::<_, Option<f64>>(3)?.unwrap_or(1.0); // Avoid div by 0
        
        let item_value = qty as f64 * unit_price;
        let discount_share = if invoice_subtotal > 0.0 {
            (item_value / invoice_subtotal) * invoice_discount
        } else {
            0.0
        };
        
        Ok((qty, unit_price, discount_share))
    }).map_err(|e| format!("Failed to query sales: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect sales: {}", e))?;

    // 4. Combine Initial Stock + PO Batches into a tracking list
    struct BatchTracker {
        item: PurchaseOrderItemWithProduct,
        is_initial: bool,
        remaining_qty: i32,
    }

    let mut trackers: Vec<BatchTracker> = Vec::new();

    // Add Initial Stock if it exists
    if let Some((qty, cost, date, selling_price)) = initial_stock_info {
        if qty > 0 {
            // Create a pseudo-PO item for Initial Stock
            // We use id=-1 or similar to mark it, but frontend uses logic to identify it?
            // Actually, we don't return this in the PO list usually?
            // Wait, the frontend grid handles "Initial Stock" separately via get_product?
            // No, the previous logic relied on inventory_batches which might have covered it.
            // But get_product_purchase_history usually returns PO items.
            // Let's create a tracker for it but we might not return it in the result list 
            // if this function is strictly for "Purchase Orders".
            // HOWEVER, if we consume sales against it, we must track it first.
            // AND the user wants "Initial Stock" in the table.
            // Previously, `get_product` returned initial stock info and `get_product_purchase_history` returned POs.
            // The frontend merged them.
            // PROBLEM: If we do FIFO here, we need to return the "Initial Stock" sold stats too?
            // Yes, but `get_product_purchase_history` signature returns `Vec<PurchaseOrderItemWithProduct>`.
            // We can treat Initial Stock as a `PurchaseOrderItemWithProduct` with po_id=None (or logic).
            // But `get_product` ALREADY returns `initial_stock_sold`.
            // Use that? No, we need precise revenue now.
            // FIX: We will do the calculation for ALL batches including Initial, 
            // BUT we can only update the PO items in the return list.
            // For Initial Stock, we might need a separate way to return it? 
            // OR: We return it here as a dummy PO item? 
            // The frontend:
            /*
                const displayPurchaseHistory: PurchaseRow[] = [
                ...(product?.initial_stock ? [...] : []),
                ...purchases.map(...)
            */
            // So frontend constructs Initial Stock row itself.
            // If I calculate `sold_revenue` for initial stock here, I verify it, but I can't easily pass it back 
            // unless I change the return type or add it to the list.
            // IF I add it to the list, I should remove the frontend `product.initial_stock` mapping to avoid dupe.
            // Let's add it to the list! `po_id: None` works.
            
            trackers.push(BatchTracker {
                item: PurchaseOrderItemWithProduct {
                    id: 0, // Placeholder
                    po_id: None,
                    product_id,
                    product_name: po_batches.first().map(|b| b.product_name.clone()).unwrap_or_default(),
                    sku: po_batches.first().map(|b| b.sku.clone()).unwrap_or_default(),
                    quantity: qty,
                    unit_cost: cost,
                    total_cost: cost * qty as f64,
                    selling_price: Some(selling_price),
                    quantity_sold: Some(0),
                    sold_revenue: Some(0.0),
                    created_at: date,
                },
                is_initial: true,
                remaining_qty: qty,
            });
        }
    }

    // Add PO Batches
    for batch in po_batches {
        trackers.push(BatchTracker {
            remaining_qty: batch.quantity, // Init with full quantity
            is_initial: false,
            item: batch,
        });
    }

    // 5. Run FIFO Simulation
    // Sales: (sale_qty, sale_price, discount_share for entire item)
    for (mut sale_qty, sale_price, discount_share) in sales {
        // Calculate discount per unit for this sale
        let discount_per_unit = if sale_qty > 0 { discount_share / sale_qty as f64 } else { 0.0 };
        
        for tracker in &mut trackers {
            if sale_qty <= 0 { break; }
            if tracker.remaining_qty > 0 {
                let take = sale_qty.min(tracker.remaining_qty);
                tracker.remaining_qty -= take;
                sale_qty -= take;
                
                // Update stats: revenue = (price - discount_per_unit) * qty
                let effective_price = sale_price - discount_per_unit;
                tracker.item.quantity_sold = Some(tracker.item.quantity_sold.unwrap_or(0) + take);
                tracker.item.sold_revenue = Some(tracker.item.sold_revenue.unwrap_or(0.0) + (take as f64 * effective_price));
            }
        }
    }

    // 6. Return values
    // We want to return ALL items, including the Initial Stock one if we added it.
    // Frontend expects "Initial Stock" to be handled.
    // If I return it here, frontend will duplicate it if I don't remove the frontend logic.
    // The user's goal is to fix the numbers.
    // If I return the Initial Stock item here, I must instruct frontend to NOT construct it from `product` info manually.
    // OR: I only return PO items, but how do I update Initial Stock stats? 
    // `get_product` is called separately. 
    // Ideally, `get_product` should return `initial_stock_sold_revenue` too.
    // This implies `get_product` needs this simulation too? Expensive to run twice.
    // DECISION: Return `Initial Stock` as a `PurchaseOrderItem` in this list. 
    // And I will Update Frontend to REMOVE the manual Initial Stock row and rely on this list.
    // This unifies the logic.
    
    // Sort descending by date (newest first) for UI
    trackers.sort_by(|a, b| b.item.created_at.cmp(&a.item.created_at));

    Ok(trackers.into_iter().map(|t| t.item).collect())
}
