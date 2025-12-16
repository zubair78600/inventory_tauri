use crate::db::{Database, Product};
use crate::commands::PaginatedResult;
use crate::services::inventory_service;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProductInput {
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub selling_price: Option<f64>,
    pub stock_quantity: i32,
    pub supplier_id: Option<i32>,
    pub amount_paid: Option<f64>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProductInput {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub selling_price: Option<f64>,
    pub stock_quantity: i32,
    pub supplier_id: Option<i32>,
    pub category: Option<String>,
}

/// Get all products, optionally filtered by search query
/// Get all products, optionally filtered by search query, with pagination
#[tauri::command]
pub fn get_products(
    search: Option<String>,
    page: i32,
    page_size: i32,
    db: State<Database>
) -> Result<PaginatedResult<Product>, String> {
    log::info!("get_products called with search: {:?}, page: {}, page_size: {}", search, page, page_size);

    let conn = db.get_conn()?;

    let offset = (page - 1) * page_size;
    let limit = page_size;

    let mut products = Vec::new();
    let total_count: i64;

    // Modified query to include total_sold, total_purchased_cost, and total_purchased_quantity
    let base_query = "
        SELECT p.id, p.name, p.sku, p.price, p.selling_price, p.initial_stock, p.stock_quantity, 
               p.supplier_id, p.created_at, p.updated_at, p.image_path, p.category,
               COALESCE(SUM(ii.quantity), 0) as total_sold,
               (
                   COALESCE(p.initial_stock * p.price, 0) + 
                   COALESCE((
                       SELECT SUM(poi.total_cost) 
                       FROM purchase_order_items poi 
                       JOIN purchase_orders po ON poi.po_id = po.id
                       WHERE poi.product_id = p.id AND po.status = 'received'
                   ), 0)
               ) as total_purchased_cost,
               (
                   COALESCE(p.initial_stock, 0) + 
                   COALESCE((
                       SELECT SUM(poi.quantity) 
                       FROM purchase_order_items poi 
                       JOIN purchase_orders po ON poi.po_id = po.id
                       WHERE poi.product_id = p.id AND po.status = 'received'
                   ), 0)
               ) as total_purchased_quantity
        FROM products p
        LEFT JOIN invoice_items ii ON p.id = ii.product_id
    ";
    
    // We need to GROUP BY p.id to get correct SUM
    let group_by = "GROUP BY p.id";

    let count_query = "SELECT COUNT(DISTINCT p.id) FROM products p";

    if let Some(search_term) = search {
        // Search by name or SKU
        let search_pattern = format!("%{}%", search_term);
        let where_clause = "WHERE p.name LIKE ?1 OR p.sku LIKE ?1";
        
        // Get total count
        let count_sql = format!("{} {}", count_query, where_clause);
        total_count = conn
            .query_row(&count_sql, [&search_pattern], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        // Note: ORDER BY name is standard for search
        let query = format!("{} {} {} ORDER BY p.name LIMIT ?2 OFFSET ?3", base_query, where_clause, group_by);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map(rusqlite::params![&search_pattern, limit, offset], |row| {
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    selling_price: row.get(4)?,
                    initial_stock: row.get(5)?,
                    stock_quantity: row.get(6)?,
                    supplier_id: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    image_path: row.get(10)?,
                    category: row.get(11)?,
                    total_sold: {
                        let sold: i64 = row.get(12)?;
                        if sold > 0 { Some(sold) } else { None } 
                    },
                    initial_stock_sold: None,
                    total_purchased_cost: row.get(13)?,
                    total_purchased_quantity: row.get(14)?,
                    quantity_sold: None,
                    sold_revenue: None,
                })
            })
            .map_err(|e| e.to_string())?;

        for product in product_iter {
            products.push(product.map_err(|e| e.to_string())?);
        }
    } else {
        // Get total count
        total_count = conn
            .query_row(count_query, [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        let query = format!("{} {} ORDER BY p.name LIMIT ?1 OFFSET ?2", base_query, group_by);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map([limit, offset], |row| {
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    selling_price: row.get(4)?,
                    initial_stock: row.get(5)?,
                    stock_quantity: row.get(6)?,
                    supplier_id: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    image_path: row.get(10)?,
                    category: row.get(11)?,
                    total_sold: {
                        let sold: i64 = row.get(12)?;
                        if sold > 0 { Some(sold) } else { None }
                    },
                    initial_stock_sold: None,
                    total_purchased_cost: row.get(13)?,
                    total_purchased_quantity: row.get(14)?,
                    quantity_sold: None,
                    sold_revenue: None,
                })
            })
            .map_err(|e| e.to_string())?;

        for product in product_iter {
            products.push(product.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} products (page {}, size {}, total {})", products.len(), page, page_size, total_count);
    Ok(PaginatedResult {
        items: products,
        total_count,
    })
}

/// Get a single product by ID
#[tauri::command]
pub fn get_product(id: i32, db: State<Database>) -> Result<Product, String> {
    log::info!("get_product called with id: {}", id);

    let conn = db.get_conn()?;

    let product = conn
        .query_row(
            "SELECT p.id, p.name, p.sku, p.price, p.selling_price, p.initial_stock, p.stock_quantity, 
                    p.supplier_id, p.created_at, p.updated_at, p.image_path, p.category,
                    COALESCE(SUM(ii.quantity), 0) as total_sold,
                    (SELECT quantity_remaining FROM inventory_batches WHERE product_id = p.id AND po_item_id IS NULL LIMIT 1) as initial_remaining
             FROM products p
             LEFT JOIN invoice_items ii ON p.id = ii.product_id
             WHERE p.id = ?1
             GROUP BY p.id",
            [id],
            |row| {
                let initial_stock: Option<i32> = row.get(5)?;
                let initial_remaining: Option<i32> = row.get(13)?;
                
                let initial_stock_sold = match (initial_stock, initial_remaining) {
                    (Some(stock), Some(remaining)) => Some(stock - remaining),
                    (Some(stock), None) => {
                        // If no batch found but we have initial stock, it means the batch was fully depleted and deleted.
                        if stock > 0 { 
                             Some(stock) 
                         } else { 
                             None 
                         }
                    },
                    _ => None
                };

                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    selling_price: row.get(4)?,
                    initial_stock,
                    stock_quantity: row.get(6)?,
                    supplier_id: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    image_path: row.get(10)?,
                    category: row.get(11)?,
                    total_sold: {
                        let sold: i64 = row.get(12)?;
                        if sold > 0 { Some(sold) } else { None }
                    },
                    initial_stock_sold,
                    quantity_sold: None,
                    sold_revenue: None,
                    total_purchased_cost: None,
                    total_purchased_quantity: None,
                })
            },
        )
        .map_err(|e| format!("Product not found: {}", e))?;

    Ok(product)
}

/// Get all products for a specific supplier
#[tauri::command]
pub fn get_products_by_supplier(
    supplier_id: i32,
    db: State<Database>
) -> Result<Vec<Product>, String> {
    log::info!("get_products_by_supplier called with supplier_id: {}", supplier_id);

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT 
                p.id, p.name, p.sku, p.price, p.selling_price, 
                NULL as initial_stock,
                (
                    COALESCE((
                        SELECT SUM(ib.quantity_remaining)
                        FROM inventory_batches ib
                        JOIN purchase_order_items poi ON ib.po_item_id = poi.id
                        JOIN purchase_orders po ON poi.po_id = po.id
                        WHERE ib.product_id = p.id AND po.supplier_id = ?1
                    ), 0)
                    +
                    CASE WHEN p.supplier_id = ?1 THEN
                        COALESCE((SELECT quantity_remaining FROM inventory_batches WHERE product_id = p.id AND po_item_id IS NULL LIMIT 1), 0)
                    ELSE 0 END
                ) as stock_quantity,
                (
                    COALESCE((
                        SELECT SUM(poi.total_cost)
                        FROM purchase_order_items poi
                        JOIN purchase_orders po ON poi.po_id = po.id
                        WHERE poi.product_id = p.id AND po.supplier_id = ?1 AND po.status = 'received'
                    ), 0)
                    +
                    CASE WHEN p.supplier_id = ?1 THEN
                        COALESCE(p.initial_stock * p.price, 0)
                    ELSE 0 END
                ) as total_purchased_cost,
                p.supplier_id, p.created_at, p.updated_at, p.image_path, p.category 
             FROM products p 
             WHERE p.supplier_id = ?1
                OR p.id IN (
                    SELECT DISTINCT poi.product_id 
                    FROM purchase_order_items poi
                    JOIN purchase_orders po ON poi.po_id = po.id
                    WHERE po.supplier_id = ?1
                )
             ORDER BY p.name"
        )
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map([supplier_id], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                price: row.get(3)?,
                selling_price: row.get(4)?,
                initial_stock: row.get(5)?,
                stock_quantity: row.get(6)?,
                supplier_id: row.get(8)?, // Shifted due to new column
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                image_path: row.get(11)?,
                category: row.get(12)?,
                total_sold: None,
                initial_stock_sold: None,
                quantity_sold: None,
                sold_revenue: None,
                total_purchased_cost: row.get(7)?,
                total_purchased_quantity: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut products = Vec::new();
    for product in product_iter {
        products.push(product.map_err(|e| e.to_string())?);
    }

    log::info!("Returning {} products for supplier {}", products.len(), supplier_id);
    Ok(products)
}

/// Create a new product
#[tauri::command]
pub fn create_product(input: CreateProductInput, db: State<Database>) -> Result<Product, String> {
    log::info!("create_product called with: {:?}", input);

    let conn = db.get_conn()?;

    let initial_qty = input.stock_quantity;
    let purchase_date = Utc::now().format("%Y-%m-%d").to_string();

    // Check if SKU already exists
    let sku_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE sku = ?1",
            [&input.sku],
            |row| row.get(0),
        )
        .map(|count: i32| count > 0)
        .map_err(|e| e.to_string())?;

    if sku_exists {
        return Err(format!("Product with SKU '{}' already exists", input.sku));
    }

    conn.execute(
        "INSERT INTO products (name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at, category) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'), ?8)",
        (
            &input.name,
            &input.sku,
            input.price,
            input.selling_price,
            initial_qty, // capture the intended purchased stock
            0,           // start at 0 to avoid double-counting; batch will set real stock
            input.supplier_id,
            input.category,
        ),
    )
    .map_err(|e| format!("Failed to create product: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    // If an amount_paid was provided and supplier exists, record an initial payment
    if let (Some(supplier_id), Some(amount_paid)) = (input.supplier_id, input.amount_paid) {
        if amount_paid > 0.0 {
            log::info!(
                "Recording initial supplier payment of {} for product {} to supplier {}",
                amount_paid,
                id,
                supplier_id
            );

            conn.execute(
                "INSERT INTO supplier_payments (supplier_id, product_id, amount, payment_method, note, paid_at, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))",
                (
                    supplier_id,
                    id,
                    amount_paid,
                    Some(String::from("Initial Stock")),
                    Option::<String>::None,
                ),
            )
            .map_err(|e| format!("Failed to record initial supplier payment: {}", e))?;
        }
    }

    // Create an initial FIFO batch if starting stock > 0
    if initial_qty > 0 {
        inventory_service::record_purchase(
            &conn,
            id,
            initial_qty,
            input.price,
            None,
            &purchase_date,
        )?;

        // Update product stock to match the created batch
        conn.execute(
            "UPDATE products SET stock_quantity = ?, updated_at = datetime('now') WHERE id = ?",
            (initial_qty, id),
        )
        .map_err(|e| format!("Failed to update product stock after batch creation: {}", e))?;
    }

    // Fetch the created product to get timestamps
    let product_res = get_product(id, db.clone());
    
    match product_res {
        Ok(p) => {
             log::info!("Created product with id: {}", id);
             Ok(p)
        },
        Err(e) => Err(format!("Failed to fetch created product: {}", e))
    }
}

/// Update an existing product
#[tauri::command]
pub fn update_product(input: UpdateProductInput, modified_by: Option<String>, db: State<Database>) -> Result<Product, String> {
    log::info!("update_product called with: {:?}", input);

    let conn = db.get_conn()?;

    // Get old values first
    let old_product: (String, String, f64, Option<f64>, i32, Option<i32>, Option<String>) = conn
        .query_row(
            "SELECT name, sku, price, selling_price, stock_quantity, supplier_id, category FROM products WHERE id = ?1",
            [input.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
        )
        .map_err(|e| format!("Product with id {} not found: {}", input.id, e))?;

    // Check if SKU is already used by another product
    let sku_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE sku = ?1 AND id != ?2",
            (&input.sku, input.id),
            |row| row.get(0),
        )
        .map(|count: i32| count > 0)
        .map_err(|e| e.to_string())?;

    if sku_exists {
        return Err(format!("Product with SKU '{}' already exists", input.sku));
    }

    // Build field changes array
    let mut field_changes: Vec<serde_json::Value> = Vec::new();
    
    if old_product.0 != input.name {
        field_changes.push(serde_json::json!({"field": "name", "old": old_product.0, "new": input.name}));
    }
    if old_product.1 != input.sku {
        field_changes.push(serde_json::json!({"field": "sku", "old": old_product.1, "new": input.sku}));
    }
    if (old_product.2 - input.price).abs() > 0.001 {
        field_changes.push(serde_json::json!({"field": "price", "old": old_product.2, "new": input.price}));
    }
    if old_product.3 != input.selling_price {
        field_changes.push(serde_json::json!({"field": "selling_price", "old": old_product.3, "new": input.selling_price}));
    }
    if old_product.4 != input.stock_quantity {
        field_changes.push(serde_json::json!({"field": "stock_quantity", "old": old_product.4, "new": input.stock_quantity}));
    }
    if old_product.5 != input.supplier_id {
        field_changes.push(serde_json::json!({"field": "supplier_id", "old": old_product.5, "new": input.supplier_id}));
    }
    if old_product.6 != input.category {
        field_changes.push(serde_json::json!({"field": "category", "old": old_product.6, "new": input.category}));
    }

    let rows_affected = conn
        .execute(
            "UPDATE products SET name = ?1, sku = ?2, price = ?3, selling_price = ?4, stock_quantity = ?5, supplier_id = ?6, updated_at = datetime('now'), category = ?7 WHERE id = ?8",
            (
                &input.name,
                &input.sku,
                input.price,
                input.selling_price,
                input.stock_quantity,
                input.supplier_id,
                input.category,
                input.id,
            ),
        )
        .map_err(|e| format!("Failed to update product: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Product with id {} not found", input.id));
    }

    // Log modification if there were actual changes
    if !field_changes.is_empty() {
        let changes_json = serde_json::to_string(&field_changes).unwrap_or_default();
        conn.execute(
            "INSERT INTO entity_modifications (entity_type, entity_id, entity_name, action, field_changes, modified_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            ("product", input.id, &input.name, "updated", &changes_json, &modified_by),
        ).map_err(|e| format!("Failed to log modification: {}", e))?;
        log::info!("Logged {} field changes for product {}", field_changes.len(), input.id);
    }

    // Fetch updated product
    let product_res = get_product(input.id, db.clone());
    product_res
}

/// Delete a product by ID
#[tauri::command]
pub fn delete_product(id: i32, deleted_by: Option<String>, db: State<Database>) -> Result<(), String> {
    log::info!("delete_product called with id: {}, deleted_by: {:?}", id, deleted_by);

    let mut conn = db.get_conn()?;

    // Check if product is used in any invoices
    let usage_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoice_items WHERE product_id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if usage_count > 0 {
        return Err(format!(
            "Cannot delete product: It is included in {} invoice(s). Delete the invoices first.",
            usage_count
        ));
    }

    // Get product data before deletion for audit trail
    // We can use simple query here as we don't strictly need total_sold for audit
    let product = conn.query_row(
        "SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at, image_path, category FROM products WHERE id = ?1",
        [id],
        |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                price: row.get(3)?,
                selling_price: row.get(4)?,
                initial_stock: row.get(5)?,
                stock_quantity: row.get(6)?,
                supplier_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                image_path: row.get(10)?,
                category: row.get(11)?,
                total_sold: None,
                initial_stock_sold: None,
                quantity_sold: None,
                sold_revenue: None,
                total_purchased_cost: None,
                total_purchased_quantity: None,
            })
        },
    )
    .map_err(|e| format!("Product with id {} not found: {}", id, e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Save to deleted_items
    crate::db::archive::archive_entity(
        &tx,
        "product",
        id,
        &product,
        None,
        deleted_by,
    )?;

    // Delete the product
    let rows_affected = tx.execute("DELETE FROM products WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete product: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Product with id {} not found", id));
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Deleted product with id: {} and saved to trash", id);
    Ok(())
}

/// Add mock product data for testing
#[tauri::command]
pub fn add_mock_products(db: State<Database>) -> Result<String, String> {
    log::info!("add_mock_products called");

    let conn = db.get_conn()?;

    // Check if products already exist
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(format!("Database already has {} products. Skipping mock data.", count));
    }

    let mock_products = vec![
        ("Laptop Dell XPS 15", "DELL-XPS-15", 1299.99, 15),
        ("Monitor LG 27\" 4K", "LG-27-4K", 449.99, 25),
        ("Keyboard Mechanical RGB", "KB-MECH-RGB", 89.99, 50),
        ("Mouse Wireless Gaming", "MOUSE-WG-01", 59.99, 40),
        ("Headset Noise Cancelling", "HS-NC-PRO", 199.99, 30),
        ("Webcam HD 1080p", "WC-HD-1080", 79.99, 35),
        ("USB Hub 7-Port", "USB-HUB-7P", 29.99, 60),
        ("External SSD 1TB", "SSD-EXT-1TB", 119.99, 20),
        ("Laptop Stand Aluminum", "LS-ALU-01", 39.99, 45),
        ("Cable Management Box", "CMB-DESK-01", 24.99, 55),
    ];

    let mut inserted = 0;
    for (name, sku, price, stock) in mock_products {
        conn.execute(
            "INSERT INTO products (name, sku, price, stock_quantity, supplier_id) VALUES (?1, ?2, ?3, ?4, NULL)",
            (name, sku, price, stock),
        )
        .map_err(|e| format!("Failed to insert mock product: {}", e))?;
        inserted += 1;
    }

    log::info!("Added {} mock products", inserted);
    Ok(format!("Successfully added {} mock products", inserted))
}

/// Get top selling products based on invoice items, optionally filtered by category
#[tauri::command]
pub fn get_top_selling_products(page: i32, limit: i32, category: Option<String>, db: State<Database>) -> Result<Vec<Product>, String> {
    log::info!("get_top_selling_products called with page: {}, limit: {}", page, limit);

    let conn = db.get_conn()?;
    let offset = (page - 1) * limit;
    
    let category_filter = if let Some(cat) = &category {
        format!("AND p.category = '{}'", cat.replace("'", "''")) 
    } else {
        String::new()
    };

    let query = format!("
        SELECT p.id, p.name, p.sku, p.price, p.selling_price, p.initial_stock, p.stock_quantity, 
               p.supplier_id, p.created_at, p.updated_at, p.image_path, p.category,
               COALESCE(SUM(ii.quantity), 0) as total_sold
        FROM products p
        LEFT JOIN invoice_items ii ON p.id = ii.product_id
        WHERE p.stock_quantity > 0
        {}
        GROUP BY p.id
        ORDER BY total_sold DESC, p.name ASC
        LIMIT ?1 OFFSET ?2
    ", category_filter);

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let product_iter = stmt.query_map([limit, offset], |row| {
        Ok(Product {
            id: row.get(0)?,
            name: row.get(1)?,
            sku: row.get(2)?,
            price: row.get(3)?,
            selling_price: row.get(4)?,
            initial_stock: row.get(5)?,
            stock_quantity: row.get(6)?,
            supplier_id: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            image_path: row.get(10)?,
            category: row.get(11)?,
            total_sold: {
                let sold: i64 = row.get(12)?;
                if sold > 0 { Some(sold) } else { None }
            },
            initial_stock_sold: None,
            quantity_sold: None,
            sold_revenue: None,
            total_purchased_cost: None,
            total_purchased_quantity: None,
        })
    }).map_err(|e| e.to_string())?;

    let mut products = Vec::new();
    for product in product_iter {
        products.push(product.map_err(|e| e.to_string())?);
    }

    Ok(products)
}

/// Get products by a list of IDs
#[tauri::command]
pub fn get_products_by_ids(ids: Vec<i32>, db: State<Database>) -> Result<Vec<Product>, String> {
    log::info!("get_products_by_ids called with {} ids", ids.len());

    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let conn = db.get_conn()?;

    // Dynamic query building involves repeat '?,', strictly safe for ints
    let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!("
        SELECT p.id, p.name, p.sku, p.price, p.selling_price, p.initial_stock, p.stock_quantity, 
               p.supplier_id, p.created_at, p.updated_at, p.image_path, p.category,
               COALESCE(SUM(ii.quantity), 0) as total_sold
        FROM products p
        LEFT JOIN invoice_items ii ON p.id = ii.product_id
        WHERE p.id IN ({})
        GROUP BY p.id
    ", placeholders);

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    // Rusqlite with dynamic params using params_from_iter
    let params = rusqlite::params_from_iter(ids.iter());
    
    let product_iter = stmt.query_map(params, |row| {
        Ok(Product {
            id: row.get(0)?,
            name: row.get(1)?,
            sku: row.get(2)?,
            price: row.get(3)?,
            selling_price: row.get(4)?,
            initial_stock: row.get(5)?,
            stock_quantity: row.get(6)?,
            supplier_id: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            image_path: row.get(10)?,
            category: row.get(11)?,
            total_sold: {
                let sold: i64 = row.get(12)?;
                if sold > 0 { Some(sold) } else { None }
            },
            initial_stock_sold: None,
            quantity_sold: None,
            sold_revenue: None,
            total_purchased_cost: None,
            total_purchased_quantity: None,
        })
    }).map_err(|e| e.to_string())?;

    let mut products_map = std::collections::HashMap::new();
    for p in product_iter {
        let product = p.map_err(|e| e.to_string())?;
        products_map.insert(product.id, product);
    }

    // Return in the order of requested IDs
    let mut ordered_products = Vec::new();
    for id in ids {
        if let Some(p) = products_map.get(&id) {
            ordered_products.push(p.clone());
        }
    }

    Ok(ordered_products)
}

/// Get all unique categories
#[tauri::command]
pub fn get_unique_categories(db: State<Database>) -> Result<Vec<String>, String> {
    log::info!("get_unique_categories called");
    let conn = db.get_conn()?;
    
    let mut stmt = conn
        .prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category")
        .map_err(|e| e.to_string())?;

    let cat_iter = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let mut categories = Vec::new();
    for cat in cat_iter {
        categories.push(cat.map_err(|e| e.to_string())?);
    }

    Ok(categories)
}
