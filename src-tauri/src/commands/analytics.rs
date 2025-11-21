use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_products: i32,
    pub total_suppliers: i32,
    pub total_customers: i32,
    pub total_invoices: i32,
    pub low_stock_products: i32,
    pub total_revenue: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LowStockProduct {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub stock_quantity: i32,
}

/// Get dashboard statistics
#[tauri::command]
pub fn get_dashboard_stats(db: State<Database>) -> Result<DashboardStats, String> {
    log::info!("get_dashboard_stats called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let total_products: i32 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_suppliers: i32 = conn
        .query_row("SELECT COUNT(*) FROM suppliers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_customers: i32 = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_invoices: i32 = conn
        .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let low_stock_products: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE stock_quantity < 10",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_revenue: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let stats = DashboardStats {
        total_products,
        total_suppliers,
        total_customers,
        total_invoices,
        low_stock_products,
        total_revenue,
    };

    log::info!("Returning dashboard stats: {:?}", stats);
    Ok(stats)
}

/// Get low stock products (stock < 10)
#[tauri::command]
pub fn get_low_stock_products(db: State<Database>) -> Result<Vec<LowStockProduct>, String> {
    log::info!("get_low_stock_products called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, name, sku, stock_quantity FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC")
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map([], |row| {
            Ok(LowStockProduct {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                stock_quantity: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut products = Vec::new();
    for product in product_iter {
        products.push(product.map_err(|e| e.to_string())?);
    }

    log::info!("Returning {} low stock products", products.len());
    Ok(products)
}
