use crate::db::{Database, Product};
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
}

/// Get all products, optionally filtered by search query
#[tauri::command]
pub fn get_products(search: Option<String>, db: State<Database>) -> Result<Vec<Product>, String> {
    log::info!("get_products called with search: {:?}", search);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut products = Vec::new();

    if let Some(search_term) = search {
        // Search by name or SKU
        let search_pattern = format!("%{}%", search_term);
        let mut stmt = conn
            .prepare("SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE name LIKE ?1 OR sku LIKE ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map([&search_pattern], |row| {
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
                })
            })
            .map_err(|e| e.to_string())?;

        for product in product_iter {
            products.push(product.map_err(|e| e.to_string())?);
        }
    } else {
        // Get all products
        let mut stmt = conn
            .prepare("SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products ORDER BY name")
            .map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map([], |row| {
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
                })
            })
            .map_err(|e| e.to_string())?;

        for product in product_iter {
            products.push(product.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} products", products.len());
    Ok(products)
}

/// Get a single product by ID
#[tauri::command]
pub fn get_product(id: i32, db: State<Database>) -> Result<Product, String> {
    log::info!("get_product called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let product = conn
        .query_row(
            "SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE id = ?1",
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

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE supplier_id = ?1 ORDER BY name")
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
                supplier_id: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
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

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

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
        "INSERT INTO products (name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))",
        (
            &input.name,
            &input.sku,
            input.price,
            input.selling_price,
            input.stock_quantity, // initial_stock is same as stock_quantity on creation
            input.stock_quantity,
            input.supplier_id,
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

    // Fetch the created product to get timestamps
    let product = conn.query_row(
        "SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE id = ?1",
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
            })
        },
    ).map_err(|e| format!("Failed to fetch created product: {}", e))?;

    log::info!("Created product with id: {}", id);
    Ok(product)
}

/// Update an existing product
#[tauri::command]
pub fn update_product(input: UpdateProductInput, db: State<Database>) -> Result<Product, String> {
    log::info!("update_product called with: {:?}", input);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

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

    let rows_affected = conn
        .execute(
            "UPDATE products SET name = ?1, sku = ?2, price = ?3, selling_price = ?4, stock_quantity = ?5, supplier_id = ?6, updated_at = datetime('now') WHERE id = ?7",
            (
                &input.name,
                &input.sku,
                input.price,
                input.selling_price,
                input.stock_quantity,
                input.supplier_id,
                input.id,
            ),
        )
        .map_err(|e| format!("Failed to update product: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Product with id {} not found", input.id));
    }

    // Fetch updated product to get new timestamp
    let product = conn.query_row(
        "SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE id = ?1",
        [input.id],
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
            })
        },
    ).map_err(|e| format!("Failed to fetch updated product: {}", e))?;

    log::info!("Updated product with id: {}", input.id);
    Ok(product)
}

/// Delete a product by ID
#[tauri::command]
pub fn delete_product(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_product called with id: {}", id);

    let conn = db.conn();
    let mut conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

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
    let product = conn.query_row(
        "SELECT id, name, sku, price, selling_price, initial_stock, stock_quantity, supplier_id, created_at, updated_at FROM products WHERE id = ?1",
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
            })
        },
    )
    .map_err(|e| format!("Product with id {} not found: {}", id, e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Save to deleted_items
    let product_json = serde_json::to_string(&product).map_err(|e| format!("Failed to serialize product: {}", e))?;
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO deleted_items (entity_type, entity_id, entity_data, deleted_at) VALUES (?1, ?2, ?3, ?4)",
        ("product", id, &product_json, &now),
    )
    .map_err(|e| format!("Failed to save to trash: {}", e))?;

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

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

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
