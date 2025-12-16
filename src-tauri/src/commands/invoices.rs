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
    pub discount_amount: Option<f64>, // Per-item weighted discount
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
    // Credit payment fields
    pub initial_paid: Option<f64>,
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
    pub discount_amount: f64, // Per-item weighted discount
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

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInvoiceItemsInput {
    pub invoice_id: i32,
    pub items: Vec<CreateInvoiceItemInput>, // New list of items
    pub modified_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceModification {
    pub id: i32,
    pub invoice_id: i32,
    pub action: String,
    pub modified_by: Option<String>,
    pub modified_at: String,
    pub original_data: Option<String>,
    pub new_data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletedInvoice {
    pub id: i32,
    pub entity_type: String,
    pub entity_id: i32,
    pub entity_data: String,
    pub related_data: Option<String>,
    pub deleted_at: String,
    pub deleted_by: Option<String>,
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
                product_amount: None,
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

    // Query now fetches necessary fields to calculate weighted discount
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.customer_id, i.total_amount, i.tax_amount, i.discount_amount, i.payment_method, i.created_at, i.cgst_amount, i.fy_year, i.gst_rate, i.igst_amount, i.sgst_amount, i.state, i.district, i.town, ii.quantity, ii.unit_price, ii.discount_amount
             FROM invoices i
             JOIN invoice_items ii ON i.id = ii.invoice_id
             WHERE ii.product_id = ?1
             ORDER BY i.created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let invoice_iter = stmt
        .query_map([product_id], |row| {
            let total_amount: f64 = row.get(3)?;
            let tax_amount: f64 = row.get(4)?;
            let global_discount: f64 = row.get(5)?;
            let qty: i32 = row.get(16)?;
            let unit_price: f64 = row.get(17)?;
            let item_discount: f64 = row.get::<_, Option<f64>>(18)?.unwrap_or(0.0);

            // Calculate Net Product Amount applying both item and weighted global discount
            let item_gross = qty as f64 * unit_price;
            
            // Reconstruct Invoice Gross Subtotal to calculate weight
            // Invoice Total = Subtotal + Tax - Discount
            // Subtotal = Invoice Total - Tax + Discount
            let invoice_subtotal = total_amount - tax_amount + global_discount;

            let weighted_global_discount = if invoice_subtotal > 0.0 && global_discount > 0.0 {
                (item_gross / invoice_subtotal) * global_discount
            } else {
                0.0
            };

            let net_product_amount = item_gross - item_discount - weighted_global_discount;

            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                customer_id: row.get(2)?,
                total_amount,
                tax_amount,
                discount_amount: global_discount,
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
                quantity: Some(qty),
                product_amount: Some(net_product_amount), // Corrected Net Amount
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
                    product_amount: None,
                })
            },
        )
        .map_err(|e| format!("Invoice not found: {}", e))?;

    // Get invoice items with product details
    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_id, p.name, p.sku, ii.quantity, ii.unit_price, COALESCE(ii.discount_amount, 0)
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
                discount_amount: row.get(7)?,
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

    // Fetch individual item details to calculate correct weighted net amount
    let mut stmt = conn.prepare(
        "SELECT ii.quantity, ii.unit_price, ii.discount_amount,
                i.total_amount, i.tax_amount, i.discount_amount, i.id
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE ii.product_id = ?1"
    ).map_err(|e| e.to_string())?;

    let sales_data = stmt.query_map([product_id], |row| {
        let qty: i32 = row.get(0)?;
        let unit_price: f64 = row.get(1)?;
        let item_discount: f64 = row.get::<_, Option<f64>>(2)?.unwrap_or(0.0);
        let invoice_total: f64 = row.get(3)?;
        let invoice_tax: f64 = row.get(4)?;
        let invoice_global_discount: f64 = row.get(5)?;
        let invoice_id: i32 = row.get(6)?;

        let item_gross = qty as f64 * unit_price;
        let invoice_subtotal = invoice_total - invoice_tax + invoice_global_discount;

        let weighted_global_discount = if invoice_subtotal > 0.0 && invoice_global_discount > 0.0 {
            (item_gross / invoice_subtotal) * invoice_global_discount
        } else {
            0.0
        };

        let net_amount = item_gross - item_discount - weighted_global_discount;

        Ok((qty, net_amount, invoice_id))
    }).map_err(|e| e.to_string())?;

    let mut total_qty = 0;
    let mut total_amount = 0.0;
    let mut invoice_ids = std::collections::HashSet::new();

    for result in sales_data {
        let (qty, amount, inv_id) = result.map_err(|e| e.to_string())?;
        total_qty += qty;
        total_amount += amount;
        invoice_ids.insert(inv_id);
    }

    Ok(ProductSalesSummary {
        total_quantity: total_qty,
        total_amount,
        invoice_count: invoice_ids.len() as i32,
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

    // Handle credit payment calculations
    let is_credit = input.payment_method.as_deref() == Some("Credit");
    let initial_paid = if is_credit {
        input.initial_paid.unwrap_or(0.0)
    } else {
        total_amount // Non-credit payments are fully paid
    };
    let credit_amount = if is_credit {
        (total_amount - initial_paid).max(0.0)
    } else {
        0.0
    };

    // Create invoice
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO invoices (invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, state, district, town, initial_paid, credit_amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        (&invoice_number, input.customer_id, total_amount, tax_amount, discount_amount, &input.payment_method, &now, &input.state, &input.district, &input.town, initial_paid, credit_amount),
    )
    .map_err(|e| format!("Failed to create invoice: {}", e))?;

    let invoice_id = tx.last_insert_rowid() as i32;

    // If credit payment with initial amount, create initial payment record
    if is_credit && initial_paid > 0.0 {
        if let Some(customer_id) = input.customer_id {
            tx.execute(
                "INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, note, paid_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
                (customer_id, invoice_id, initial_paid, "Cash", "Initial payment at invoice creation", &now),
            )
            .map_err(|e| format!("Failed to create initial payment record: {}", e))?;
        }
    }

    // Create invoice items, update stock, and record FIFO sales
    let sale_date = Utc::now().format("%Y-%m-%d").to_string();

    for item in &input.items {
        // Get product name for historical record
        let product_name: String = tx.query_row(
            "SELECT name FROM products WHERE id = ?1",
            [item.product_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get product name: {}", e))?;

        // Insert invoice item with per-item discount
        let item_discount = item.discount_amount.unwrap_or(0.0);
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, product_name, discount_amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (invoice_id, item.product_id, item.quantity, item.unit_price, product_name, item_discount),
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
        product_amount: None,
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
                product_amount: None,
            })
        },
    )
    .map_err(|e| format!("Invoice with id {} not found: {}", id, e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 1. Get invoice items (full details for archive + restocking)
    let items_details: Vec<InvoiceItemWithProduct> = {
        let mut stmt = tx.prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_id, p.name, p.sku, ii.quantity, ii.unit_price, COALESCE(ii.discount_amount, 0)
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
                discount_amount: row.get(7)?,
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

/// Update invoice items (add/remove items with stock adjustments)
#[tauri::command]
pub fn update_invoice_items(input: UpdateInvoiceItemsInput, db: State<Database>) -> Result<Invoice, String> {
    log::info!("update_invoice_items called for invoice_id: {}", input.invoice_id);

    let mut conn = db.get_conn()?;

    // Get current invoice and items for history
    let current_invoice = conn.query_row(
        "SELECT id, invoice_number, total_amount FROM invoices WHERE id = ?1",
        [input.invoice_id],
        |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?)),
    ).map_err(|e| format!("Invoice not found: {}", e))?;

    // Get current items
    let current_items: Vec<InvoiceItemWithProduct> = {
        let mut stmt = conn.prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_id, p.name, p.sku, ii.quantity, ii.unit_price, COALESCE(ii.discount_amount, 0)
             FROM invoice_items ii
             JOIN products p ON ii.product_id = p.id
             WHERE ii.invoice_id = ?1"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([input.invoice_id], |row| {
            Ok(InvoiceItemWithProduct {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_sku: row.get(4)?,
                quantity: row.get(5)?,
                unit_price: row.get(6)?,
                discount_amount: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    // Serialize for history
    let original_data = serde_json::to_string(&current_items).unwrap_or_default();

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 1. Restore stock for all existing items
    for item in &current_items {
        tx.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ?1 WHERE id = ?2",
            (item.quantity, item.product_id),
        ).map_err(|e| format!("Failed to restore stock: {}", e))?;
    }

    // 2. Delete all existing invoice items
    tx.execute("DELETE FROM invoice_items WHERE invoice_id = ?1", [input.invoice_id])
        .map_err(|e| format!("Failed to delete items: {}", e))?;

    // 3. Add new items and deduct stock
    let mut new_total: f64 = 0.0;
    let sale_date = Utc::now().format("%Y-%m-%d").to_string();

    for item in &input.items {
        // Get product name
        let product_name: String = tx.query_row(
            "SELECT name FROM products WHERE id = ?1",
            [item.product_id],
            |row| row.get(0),
        ).map_err(|e| format!("Product not found: {}", e))?;

        // Check stock
        let stock: i32 = tx.query_row(
            "SELECT stock_quantity FROM products WHERE id = ?1",
            [item.product_id],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get stock: {}", e))?;

        if stock < item.quantity {
            return Err(format!("Insufficient stock for product '{}'. Available: {}, Requested: {}", product_name, stock, item.quantity));
        }

        // Insert new item with per-item discount
        let item_discount = item.discount_amount.unwrap_or(0.0);
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, product_name, discount_amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (input.invoice_id, item.product_id, item.quantity, item.unit_price, &product_name, item_discount),
        ).map_err(|e| format!("Failed to insert item: {}", e))?;

        // Deduct stock
        tx.execute(
            "UPDATE products SET stock_quantity = stock_quantity - ?1 WHERE id = ?2",
            (item.quantity, item.product_id),
        ).map_err(|e| format!("Failed to deduct stock: {}", e))?;

        // Record FIFO sale
        inventory_service::record_sale_fifo(&tx, item.product_id, item.quantity, &sale_date, input.invoice_id)
            .map_err(|e| format!("Failed to record FIFO: {}", e))?;

        new_total += item.unit_price * item.quantity as f64;
    }

    // 4. Update invoice total
    tx.execute(
        "UPDATE invoices SET total_amount = ?1 WHERE id = ?2",
        (new_total, input.invoice_id),
    ).map_err(|e| format!("Failed to update invoice total: {}", e))?;

    // 5. Record modification history (legacy table)
    let new_data = serde_json::to_string(&input.items).unwrap_or_default();
    tx.execute(
        "INSERT INTO invoice_modifications (invoice_id, action, modified_by, original_data, new_data) VALUES (?1, ?2, ?3, ?4, ?5)",
        (input.invoice_id, "items_modified", &input.modified_by, &original_data, &new_data),
    ).map_err(|e| format!("Failed to record modification: {}", e))?;

    // 6. Also record in unified entity_modifications table for Settings UI
    // Build field changes showing item count diff
    let old_items_count = current_items.len();
    let new_items_count = input.items.len();
    let mut field_changes: Vec<serde_json::Value> = Vec::new();
    
    // Detect removed items
    for old_item in &current_items {
        let still_exists = input.items.iter().any(|new_item| new_item.product_id == old_item.product_id);
        if !still_exists {
            field_changes.push(serde_json::json!({
                "field": format!("Item: {}", old_item.product_name),
                "old": format!("{} x Rs.{}", old_item.quantity, old_item.unit_price),
                "new": "(removed)"
            }));
        }
    }
    
    // Detect added/changed items
    for new_item in &input.items {
        if let Some(old_item) = current_items.iter().find(|o| o.product_id == new_item.product_id) {
            // Item exists - check if qty/price changed
            if old_item.quantity != new_item.quantity || (old_item.unit_price - new_item.unit_price).abs() > 0.01 {
                field_changes.push(serde_json::json!({
                    "field": format!("Item: {}", old_item.product_name),
                    "old": format!("{} x Rs.{}", old_item.quantity, old_item.unit_price),
                    "new": format!("{} x Rs.{}", new_item.quantity, new_item.unit_price)
                }));
            }
        } else {
            // New item added
            let product_name: String = tx.query_row("SELECT name FROM products WHERE id = ?1", [new_item.product_id], |row| row.get(0)).unwrap_or_else(|_| format!("Product #{}", new_item.product_id));
            field_changes.push(serde_json::json!({
                "field": format!("Item: {}", product_name),
                "old": "(none)",
                "new": format!("{} x Rs.{}", new_item.quantity, new_item.unit_price)
            }));
        }
    }

    // Also log total change
    if (current_invoice.2 - new_total).abs() > 0.01 {
        field_changes.push(serde_json::json!({
            "field": "Total Amount",
            "old": format!("Rs.{:.2}", current_invoice.2),
            "new": format!("Rs.{:.2}", new_total)
        }));
    }

    if !field_changes.is_empty() {
        let changes_json = serde_json::to_string(&field_changes).unwrap_or_default();
        tx.execute(
            "INSERT INTO entity_modifications (entity_type, entity_id, entity_name, action, field_changes, modified_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            ("invoice", input.invoice_id, &current_invoice.1, "items_modified", &changes_json, &input.modified_by),
        ).map_err(|e| format!("Failed to log entity modification: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Failed to commit: {}", e))?;

    // Return updated invoice
    let invoice = get_invoice(input.invoice_id, db)?.invoice;
    log::info!("Updated invoice {} items", input.invoice_id);
    Ok(invoice)
}

/// Get deleted invoices from audit trail
#[tauri::command]
pub fn get_deleted_invoices(db: State<Database>) -> Result<Vec<DeletedInvoice>, String> {
    log::info!("get_deleted_invoices called");

    let conn = db.get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT id, entity_type, entity_id, entity_data, related_data, deleted_at, deleted_by 
         FROM deleted_items 
         WHERE entity_type = 'invoice' 
         ORDER BY deleted_at DESC 
         LIMIT 100"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(DeletedInvoice {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            entity_data: row.get(3)?,
            related_data: row.get(4)?,
            deleted_at: row.get(5)?,
            deleted_by: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let deleted: Vec<DeletedInvoice> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    log::info!("Returning {} deleted invoices", deleted.len());
    Ok(deleted)
}

/// Get invoice modification history
#[tauri::command]
pub fn get_invoice_modifications(invoice_id: Option<i32>, db: State<Database>) -> Result<Vec<InvoiceModification>, String> {
    log::info!("get_invoice_modifications called for invoice_id: {:?}", invoice_id);

    let conn = db.get_conn()?;

    let query = if invoice_id.is_some() {
        "SELECT id, invoice_id, action, modified_by, modified_at, original_data, new_data 
         FROM invoice_modifications 
         WHERE invoice_id = ?1 
         ORDER BY modified_at DESC"
    } else {
        "SELECT id, invoice_id, action, modified_by, modified_at, original_data, new_data 
         FROM invoice_modifications 
         ORDER BY modified_at DESC 
         LIMIT 100"
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let modifications: Vec<InvoiceModification> = if let Some(id) = invoice_id {
        let rows = stmt.query_map([id], |row| {
            Ok(InvoiceModification {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                action: row.get(2)?,
                modified_by: row.get(3)?,
                modified_at: row.get(4)?,
                original_data: row.get(5)?,
                new_data: row.get(6)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let rows = stmt.query_map([], |row| {
            Ok(InvoiceModification {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                action: row.get(2)?,
                modified_by: row.get(3)?,
                modified_at: row.get(4)?,
                original_data: row.get(5)?,
                new_data: row.get(6)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    log::info!("Returning {} modifications", modifications.len());
    Ok(modifications)
}
