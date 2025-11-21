use crate::db::{Database, Invoice};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceItemInput {
    pub product_id: i32,
    pub quantity: i32,
    pub unit_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInvoiceInput {
    pub customer_id: Option<i32>,
    pub items: Vec<CreateInvoiceItemInput>,
    pub tax_amount: Option<f64>,
    pub discount_amount: Option<f64>,
    pub payment_method: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceItemWithProduct {
    pub id: i32,
    pub invoice_id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub product_sku: String,
    pub quantity: i32,
    pub unit_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceWithItems {
    pub invoice: Invoice,
    pub items: Vec<InvoiceItemWithProduct>,
}

/// Get all invoices, optionally filtered by customer
#[tauri::command]
pub fn get_invoices(customer_id: Option<i32>, db: State<Database>) -> Result<Vec<Invoice>, String> {
    log::info!("get_invoices called with customer_id: {:?}", customer_id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut invoices = Vec::new();

    if let Some(cust_id) = customer_id {
        let mut stmt = conn
            .prepare("SELECT id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, destination_state, fy_year, gst_rate, igst_amount, language, origin_state, sgst_amount FROM invoices WHERE customer_id = ?1 ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let invoice_iter = stmt
            .query_map([cust_id], |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    customer_id: row.get(2)?,
                    total_amount: row.get(3)?,
                    tax_amount: row.get(4)?,
                    discount_amount: row.get(5)?,
                    payment_method: row.get(6)?,
                    created_at: row.get(7)?,
                    cgst_amount: row.get(8)?,
                    destination_state: row.get(9)?,
                    fy_year: row.get(10)?,
                    gst_rate: row.get(11)?,
                    igst_amount: row.get(12)?,
                    language: row.get(13)?,
                    origin_state: row.get(14)?,
                    sgst_amount: row.get(15)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for invoice in invoice_iter {
            invoices.push(invoice.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, destination_state, fy_year, gst_rate, igst_amount, language, origin_state, sgst_amount FROM invoices ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let invoice_iter = stmt
            .query_map([], |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    customer_id: row.get(2)?,
                    total_amount: row.get(3)?,
                    tax_amount: row.get(4)?,
                    discount_amount: row.get(5)?,
                    payment_method: row.get(6)?,
                    created_at: row.get(7)?,
                    cgst_amount: row.get(8)?,
                    destination_state: row.get(9)?,
                    fy_year: row.get(10)?,
                    gst_rate: row.get(11)?,
                    igst_amount: row.get(12)?,
                    language: row.get(13)?,
                    origin_state: row.get(14)?,
                    sgst_amount: row.get(15)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for invoice in invoice_iter {
            invoices.push(invoice.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} invoices", invoices.len());
    Ok(invoices)
}

/// Get a single invoice with its items
#[tauri::command]
pub fn get_invoice(id: i32, db: State<Database>) -> Result<InvoiceWithItems, String> {
    log::info!("get_invoice called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get invoice
    let invoice = conn
        .query_row(
            "SELECT id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, destination_state, fy_year, gst_rate, igst_amount, language, origin_state, sgst_amount FROM invoices WHERE id = ?1",
            [id],
            |row| {
                Ok(Invoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    customer_id: row.get(2)?,
                    total_amount: row.get(3)?,
                    tax_amount: row.get(4)?,
                    discount_amount: row.get(5)?,
                    payment_method: row.get(6)?,
                    created_at: row.get(7)?,
                    cgst_amount: row.get(8)?,
                    destination_state: row.get(9)?,
                    fy_year: row.get(10)?,
                    gst_rate: row.get(11)?,
                    igst_amount: row.get(12)?,
                    language: row.get(13)?,
                    origin_state: row.get(14)?,
                    sgst_amount: row.get(15)?,
                })
            },
        )
        .map_err(|e| format!("Invoice not found: {}", e))?;

    // Get invoice items with product details
    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_id, p.name, p.sku, ii.quantity, ii.unit_price
             FROM invoice_items ii
             JOIN products p ON ii.product_id = p.id
             WHERE ii.invoice_id = ?1"
        )
        .map_err(|e| e.to_string())?;

    let item_iter = stmt
        .query_map([id], |row| {
            Ok(InvoiceItemWithProduct {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_sku: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item in item_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }

    Ok(InvoiceWithItems { invoice, items })
}

/// Create a new invoice with items and update stock
#[tauri::command]
pub fn create_invoice(input: CreateInvoiceInput, db: State<Database>) -> Result<Invoice, String> {
    log::info!("create_invoice called");

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Validate customer exists if provided
    if let Some(cid) = input.customer_id {
        let customer_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM customers WHERE id = ?1",
                [cid],
                |row| row.get(0),
            )
            .map(|count: i32| count > 0)
            .map_err(|e| e.to_string())?;

        if !customer_exists {
            return Err(format!("Customer with id {} not found", cid));
        }
    }

    // Validate all products exist and have sufficient stock
    for item in &input.items {
        let product: Result<(i32, String), _> = conn.query_row(
            "SELECT stock_quantity, name FROM products WHERE id = ?1",
            [item.product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );

        match product {
            Ok((stock, name)) => {
                if stock < item.quantity {
                    return Err(format!(
                        "Insufficient stock for product '{}'. Available: {}, Requested: {}",
                        name, stock, item.quantity
                    ));
                }
            }
            Err(_) => {
                return Err(format!("Product with id {} not found", item.product_id));
            }
        }
    }

    // Calculate total amount
    let total_amount: f64 = input.items.iter().map(|item| item.unit_price * item.quantity as f64).sum();
    let tax_amount = input.tax_amount.unwrap_or(0.0);
    let discount_amount = input.discount_amount.unwrap_or(0.0);

    // Generate invoice number
    let invoice_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let invoice_number = format!("INV-{:06}", invoice_count + 1);

    // Start transaction
    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Create invoice
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO invoices (invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (&invoice_number, input.customer_id, total_amount, tax_amount, discount_amount, &input.payment_method, &now),
    )
    .map_err(|e| format!("Failed to create invoice: {}", e))?;

    let invoice_id = tx.last_insert_rowid() as i32;

    // Create invoice items and update stock
    for item in &input.items {
        // Insert invoice item
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price) VALUES (?1, ?2, ?3, ?4)",
            (invoice_id, item.product_id, item.quantity, item.unit_price),
        )
        .map_err(|e| format!("Failed to create invoice item: {}", e))?;

        // Update product stock
        tx.execute(
            "UPDATE products SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
            (item.quantity, item.product_id),
        )
        .map_err(|e| format!("Failed to update product stock: {}", e))?;
    }

    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    let invoice = Invoice {
        id: invoice_id,
        invoice_number: invoice_number.clone(),
        customer_id: input.customer_id,
        total_amount,
        tax_amount,
        discount_amount,
        payment_method: input.payment_method.clone(),
        created_at: now,
        cgst_amount: None,
        destination_state: None,
        fy_year: None,
        gst_rate: None,
        igst_amount: None,
        language: None,
        origin_state: None,
        sgst_amount: None,
    };

    log::info!("Created invoice with id: {}", invoice_id);
    Ok(invoice)
}

/// Delete an invoice and restore stock
#[tauri::command]
pub fn delete_invoice(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_invoice called with id: {}", id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Get invoice items before deletion to restore stock
    let items = {
        let mut stmt = conn
            .prepare("SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ?1")
            .map_err(|e| e.to_string())?;

        let items_iter = stmt
            .query_map([id], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)))
            .map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        for item in items_iter {
            items.push(item.map_err(|e| e.to_string())?);
        }
        items
    };

    // Start transaction
    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Restore stock for each item
    for (product_id, quantity) in items {
        tx.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ?1 WHERE id = ?2",
            (quantity, product_id),
        )
        .map_err(|e| format!("Failed to restore product stock: {}", e))?;
    }

    // Delete invoice items (CASCADE will handle this, but being explicit)
    tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", [id])
        .map_err(|e| format!("Failed to delete invoice items: {}", e))?;

    // Delete invoice
    let rows_affected = tx
        .execute("DELETE FROM invoices WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete invoice: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Invoice with id {} not found", id));
    }

    // Commit transaction
    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Deleted invoice with id: {}", id);
    Ok(())
}
