use crate::db::{Database, Invoice};
use crate::commands::PaginatedResult;
use crate::services::inventory_service;
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
    pub state: Option<String>,
    pub district: Option<String>,

    pub town: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInvoiceInput {
    pub id: i32,
    pub customer_id: Option<i32>,
    pub payment_method: Option<String>,
    pub created_at: Option<String>,
    pub status: Option<String>, // Reserved for future use (e.g., 'paid', 'void')
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductSalesSummary {
    pub total_quantity: i32,
    pub total_amount: f64,
    pub invoice_count: i32,
}

/// Get all invoices with pagination, search, and optional customer filter
#[tauri::command]
pub fn get_invoices(
    page: i32,
    page_size: i32,
    search: Option<String>,
    customer_id: Option<i32>,
    db: State<Database>
) -> Result<PaginatedResult<Invoice>, String> {
    log::info!("get_invoices called - page: {}, size: {}, search: {:?}, customer_id: {:?}", page, page_size, search, customer_id);

    let conn = db.get_conn()?;

    let offset = (page - 1) * page_size;
    let limit = page_size;

    let mut invoices = Vec::new();
    let total_count: i64;

    // Base query with JOIN to get customer details
    let base_select = "
        SELECT 
            i.id, i.invoice_number, i.customer_id, i.total_amount, i.tax_amount, 
            i.discount_amount, i.payment_method, i.created_at, 
            i.cgst_amount, i.fy_year, i.gst_rate, i.igst_amount, i.sgst_amount, 
            i.state, i.district, i.town,
            c.name as customer_name, c.phone as customer_phone,
            (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
    ";

    let count_select = "SELECT COUNT(*) FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id";

    let mut where_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(cust_id) = customer_id {
        where_clauses.push("i.customer_id = ?");
        params.push(Box::new(cust_id));
    }

    if let Some(search_term) = search {
        where_clauses.push("(i.invoice_number LIKE ? OR c.name LIKE ?)");
        let pattern = format!("%{}%", search_term);
        params.push(Box::new(pattern.clone()));
        params.push(Box::new(pattern));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Get total count
    let count_query = format!("{} {}", count_select, where_sql);
    let mut count_stmt = conn.prepare(&count_query).map_err(|e| e.to_string())?;
    
    // rusqlite requires params as a slice of references
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    total_count = count_stmt
        .query_row(rusqlite::params_from_iter(param_refs.iter()), |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // Get paginated items
    let query = format!("{} {} ORDER BY i.created_at DESC LIMIT ? OFFSET ?", base_select, where_sql);
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // Add limit and offset to params
    let mut query_params = params;
    query_params.push(Box::new(limit));
    query_params.push(Box::new(offset));
    
    let query_param_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();

    let invoice_iter = stmt
        .query_map(rusqlite::params_from_iter(query_param_refs.iter()), |row| {
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
                fy_year: row.get(9)?,
                gst_rate: row.get(10)?,
                igst_amount: row.get(11)?,
                sgst_amount: row.get(12)?,
                state: row.get(13)?,
                district: row.get(14)?,
                town: row.get(15)?,
                customer_name: row.get(16)?,
                customer_phone: row.get(17)?,
                item_count: row.get(18)?,
                quantity: None,
            })
        })
        .map_err(|e| e.to_string())?;

    for invoice in invoice_iter {
        invoices.push(invoice.map_err(|e| e.to_string())?);
    }

    log::info!("Returning {} invoices (page {}, size {}, total {})", invoices.len(), page, page_size, total_count);
    Ok(PaginatedResult {
        items: invoices,
        total_count,
    })
}


/// Get all invoices containing a specific product
#[tauri::command]
pub fn get_invoices_by_product(product_id: i32, db: State<Database>) -> Result<Vec<Invoice>, String> {
    log::info!("get_invoices_by_product called with product_id: {}", product_id);

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, i.total_amount, i.tax_amount, i.discount_amount, i.payment_method, i.created_at, i.cgst_amount, i.fy_year, i.gst_rate, i.igst_amount, i.sgst_amount, i.state, i.district, i.town, ii.quantity
             FROM invoices i
             JOIN invoice_items ii ON i.id = ii.invoice_id
             WHERE ii.product_id = ?1
             ORDER BY i.created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let invoice_iter = stmt
        .query_map([product_id], |row| {
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
                fy_year: row.get(9)?,
                gst_rate: row.get(10)?,
                igst_amount: row.get(11)?,
                sgst_amount: row.get(12)?,
                state: row.get(13)?,
                district: row.get(14)?,
                town: row.get(15)?,
                customer_name: None,
                customer_phone: None,
                item_count: None,
                quantity: Some(row.get(16)?),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut invoices = Vec::new();
    for invoice in invoice_iter {
        invoices.push(invoice.map_err(|e| e.to_string())?);
    }

    log::info!("Returning {} invoices for product {}", invoices.len(), product_id);
    Ok(invoices)
}

/// Get a single invoice with its items
#[tauri::command]
pub fn get_invoice(id: i32, db: State<Database>) -> Result<InvoiceWithItems, String> {
    log::info!("get_invoice called with id: {}", id);

    let conn = db.get_conn()?;

    // Get invoice
    let invoice = conn
        .query_row(
            "SELECT 
                i.id, i.invoice_number, i.customer_id, i.total_amount, i.tax_amount, 
                i.discount_amount, i.payment_method, i.created_at, 
                i.cgst_amount, i.fy_year, i.gst_rate, i.igst_amount, i.sgst_amount, 
                i.state, i.district, i.town,
                c.name as customer_name, c.phone as customer_phone,
                (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?1",
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
                    fy_year: row.get(9)?,
                    gst_rate: row.get(10)?,
                    igst_amount: row.get(11)?,
                    sgst_amount: row.get(12)?,
                    state: row.get(13)?,
                    district: row.get(14)?,
                    town: row.get(15)?,
                    customer_name: row.get(16)?,
                    customer_phone: row.get(17)?,
                    item_count: row.get(18)?,
                    quantity: None,
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

/// Get aggregated sales summary for a specific product
#[tauri::command]
pub fn get_product_sales_summary(
    product_id: i32,
    db: State<Database>,
) -> Result<ProductSalesSummary, String> {
    log::info!(
        "get_product_sales_summary called for product_id: {}",
        product_id
    );

    let conn = db.get_conn()?;

    // Total quantity and total amount for this product across all invoices
    let (total_qty, total_amount): (i64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(quantity), 0) AS total_qty,
                COALESCE(SUM(quantity * unit_price), 0.0) AS total_amount
             FROM invoice_items
             WHERE product_id = ?1",
            [product_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((0, 0.0));

    // Number of distinct invoices that contain this product
    let invoice_count: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT invoice_id) FROM invoice_items WHERE product_id = ?1",
            [product_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(ProductSalesSummary {
        total_quantity: total_qty as i32,
        total_amount,
        invoice_count,
    })
}

/// Create a new invoice with items and update stock
#[tauri::command]
pub fn create_invoice(input: CreateInvoiceInput, db: State<Database>) -> Result<Invoice, String> {
    log::info!("create_invoice called");

    let mut conn = db.get_conn()?;

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

    // Calculate total amount (Final Payable)
    let items_total: f64 = input.items.iter().map(|item| item.unit_price * item.quantity as f64).sum();
    let tax_amount = input.tax_amount.unwrap_or(0.0);
    let discount_amount = input.discount_amount.unwrap_or(0.0);
    
    // Final Amount = (Items Total + Tax) - Discount
    let total_amount = items_total + tax_amount - discount_amount;

    // Generate invoice number - get the highest number and increment
    let next_number: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number, 5) AS INTEGER)), 0) + 1 FROM invoices WHERE invoice_number LIKE 'INV-%'",
            [],
            |row| row.get(0)
        )
        .unwrap_or(1);
    let invoice_number = format!("INV-{:06}", next_number);

    // Start transaction
    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Create invoice
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO invoices (invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, state, district, town) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        (&invoice_number, input.customer_id, total_amount, tax_amount, discount_amount, &input.payment_method, &now, &input.state, &input.district, &input.town),
    )
    .map_err(|e| format!("Failed to create invoice: {}", e))?;

    let invoice_id = tx.last_insert_rowid() as i32;

    // Create invoice items, update stock, and record FIFO sales
    let sale_date = Utc::now().format("%Y-%m-%d").to_string();

    for item in &input.items {
        // Get product name for historical record
        let product_name: String = tx.query_row(
            "SELECT name FROM products WHERE id = ?1",
            [item.product_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get product name: {}", e))?;

        // Insert invoice item
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, product_name) VALUES (?1, ?2, ?3, ?4, ?5)",
            (invoice_id, item.product_id, item.quantity, item.unit_price, product_name),
        )
        .map_err(|e| format!("Failed to create invoice item: {}", e))?;

        // Update product stock
        tx.execute(
            "UPDATE products SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
            (item.quantity, item.product_id),
        )
        .map_err(|e| format!("Failed to update product stock: {}", e))?;

        // Record FIFO sale (updates batches and creates transaction)
        // This will calculate COGS automatically using FIFO
        inventory_service::record_sale_fifo(
            &tx,
            item.product_id,
            item.quantity,
            &sale_date,
            invoice_id,
        ).map_err(|e| format!("Failed to record FIFO sale: {}", e))?;
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
        fy_year: None,
        gst_rate: None,
        igst_amount: None,
        sgst_amount: None,
        state: input.state.clone(),
        district: input.district.clone(),
        town: input.town.clone(),
        customer_name: None,
        customer_phone: None,
        item_count: Some(input.items.len() as i32),
        quantity: None,
    };

    log::info!("Created invoice with id: {}", invoice_id);
    Ok(invoice)
}



/// Update an invoice (Metadata only)
#[tauri::command]
pub fn update_invoice(input: UpdateInvoiceInput, db: State<Database>) -> Result<Invoice, String> {
    log::info!("update_invoice called with id: {}", input.id);

    let mut conn = db.get_conn()?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Prepare update query dynamically based on inputs
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(cid) = input.customer_id {
        updates.push("customer_id = ?");
        params.push(Box::new(cid));
    }
    if let Some(pm) = input.payment_method {
        updates.push("payment_method = ?");
        params.push(Box::new(pm));
    }
    if let Some(created_at) = input.created_at {
        updates.push("created_at = ?");
        params.push(Box::new(created_at));
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    // Add ID to params
    params.push(Box::new(input.id));

    let query = format!("UPDATE invoices SET {} WHERE id = ?", updates.join(", "));
    
    // Rusqlite params
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows_affected = tx.execute(&query, rusqlite::params_from_iter(param_refs.iter()))
        .map_err(|e| format!("Failed to update invoice: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Invoice with id {} not found", input.id));
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // Fetch and return updated invoice (skipping extended details for simplicity, or reusing existing query)
    let invoice = get_invoice(input.id, db)?.invoice;
    Ok(invoice)
}

/// Delete an invoice and restore inventory
#[tauri::command]
pub fn delete_invoice(id: i32, deleted_by: Option<String>, db: State<Database>) -> Result<(), String> {
    log::info!("delete_invoice called with id: {}, deleted_by: {:?}", id, deleted_by);

    let mut conn = db.get_conn()?;

    // Get invoice data before deletion for audit trail
    // We fetch a simple Invoice struct
    let invoice = conn.query_row(
        "SELECT id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, fy_year, gst_rate, igst_amount, sgst_amount, state, district, town FROM invoices WHERE id = ?1",
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
                fy_year: row.get(9)?,
                gst_rate: row.get(10)?,
                igst_amount: row.get(11)?,
                sgst_amount: row.get(12)?,
                state: row.get(13)?,
                district: row.get(14)?,
                town: row.get(15)?,
                customer_name: None,
                customer_phone: None,
                item_count: None,
                quantity: None,
            })
        },
    )
    .map_err(|e| format!("Invoice with id {} not found: {}", id, e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 1. Get invoice items (full details for archive + restocking)
    let items_details: Vec<InvoiceItemWithProduct> = {
        let mut stmt = tx.prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_id, p.name, p.sku, ii.quantity, ii.unit_price
             FROM invoice_items ii
             JOIN products p ON ii.product_id = p.id
             WHERE ii.invoice_id = ?1"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([id], |row| {
             Ok(InvoiceItemWithProduct {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_sku: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
            })
        }).map_err(|e| e.to_string())?;
        
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    // 2. Save to deleted_items (Audit Trail)
    let items_json = serde_json::to_string(&items_details)
        .map_err(|e| format!("Failed to serialize invoice items: {}", e))?;

    crate::db::archive::archive_entity(
        &tx,
        "invoice",
        id,
        &invoice,
        Some(items_json),
        deleted_by,
    )?;

    // 3. Restore stock for each item using FIFO reversal
    for item in &items_details {
        inventory_service::restore_stock_from_invoice(&tx, item.product_id, item.quantity, id)?;
    }

    // 4. Delete invoice items
    tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?", [id])
        .map_err(|e| format!("Failed to delete invoice items: {}", e))?;

    // 5. Delete invoice
    let rows_affected = tx.execute("DELETE FROM invoices WHERE id = ?", [id])
        .map_err(|e| format!("Failed to delete invoice: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Invoice with id {} not found", id));
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;
    log::info!("Deleted invoice {} and restored inventory", id);
    Ok(())
}
