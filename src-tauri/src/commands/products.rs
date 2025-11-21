use crate::db::{Database, Product};
use tauri::State;

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
