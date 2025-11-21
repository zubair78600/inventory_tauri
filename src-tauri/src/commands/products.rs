use crate::db::{Database, Product};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProductInput {
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub stock_quantity: i32,
    pub supplier_id: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProductInput {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub price: f64,
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
            .prepare("SELECT id, name, sku, price, stock_quantity, supplier_id FROM products WHERE name LIKE ?1 OR sku LIKE ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map([&search_pattern], |row| {
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    stock_quantity: row.get(4)?,
                    supplier_id: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for product in product_iter {
            products.push(product.map_err(|e| e.to_string())?);
        }
    } else {
        // Get all products
        let mut stmt = conn
            .prepare("SELECT id, name, sku, price, stock_quantity, supplier_id FROM products ORDER BY name")
            .map_err(|e| e.to_string())?;

        let product_iter = stmt
            .query_map([], |row| {
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    stock_quantity: row.get(4)?,
                    supplier_id: row.get(5)?,
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
            "SELECT id, name, sku, price, stock_quantity, supplier_id FROM products WHERE id = ?1",
            [id],
            |row| {
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sku: row.get(2)?,
                    price: row.get(3)?,
                    stock_quantity: row.get(4)?,
                    supplier_id: row.get(5)?,
                })
            },
        )
        .map_err(|e| format!("Product not found: {}", e))?;

    Ok(product)
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
        "INSERT INTO products (name, sku, price, stock_quantity, supplier_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        (
            &input.name,
            &input.sku,
            input.price,
            input.stock_quantity,
            input.supplier_id,
        ),
    )
    .map_err(|e| format!("Failed to create product: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let product = Product {
        id,
        name: input.name,
        sku: input.sku,
        price: input.price,
        stock_quantity: input.stock_quantity,
        supplier_id: input.supplier_id,
    };

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
            "UPDATE products SET name = ?1, sku = ?2, price = ?3, stock_quantity = ?4, supplier_id = ?5 WHERE id = ?6",
            (
                &input.name,
                &input.sku,
                input.price,
                input.stock_quantity,
                input.supplier_id,
                input.id,
            ),
        )
        .map_err(|e| format!("Failed to update product: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Product with id {} not found", input.id));
    }

    let product = Product {
        id: input.id,
        name: input.name,
        sku: input.sku,
        price: input.price,
        stock_quantity: input.stock_quantity,
        supplier_id: input.supplier_id,
    };

    log::info!("Updated product with id: {}", input.id);
    Ok(product)
}

/// Delete a product by ID
#[tauri::command]
pub fn delete_product(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_product called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let rows_affected = conn
        .execute("DELETE FROM products WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete product: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Product with id {} not found", id));
    }

    log::info!("Deleted product with id: {}", id);
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
