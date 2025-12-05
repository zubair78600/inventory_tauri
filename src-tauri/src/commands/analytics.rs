use crate::db::{Database, Customer};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardSale {
    pub id: i32,
    pub invoice_number: String,
    pub total_amount: f64,
    pub created_at: String,
    pub customer_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_revenue: f64,
    pub total_orders: i32,
    pub low_stock_count: i32,
    pub total_valuation: f64,
    pub recent_sales: Vec<DashboardSale>,
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

    let conn = db.get_conn()?;

    // Total revenue
    let total_revenue: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Total orders (invoices)
    let total_orders: i32 = conn
        .query_row("SELECT COUNT(*) FROM invoices", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // Low stock count (stock < 10)
    let low_stock_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE stock_quantity < 10",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Total inventory valuation (sum of price * stock_quantity)
    let total_valuation: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(price * stock_quantity), 0.0) FROM products",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Recent sales (last 5 invoices)
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.total_amount, i.created_at, c.name
             FROM invoices i
             LEFT JOIN customers c ON i.customer_id = c.id
             ORDER BY i.created_at DESC
             LIMIT 5"
        )
        .map_err(|e| e.to_string())?;

    let recent_sales = stmt
        .query_map([], |row| {
            Ok(DashboardSale {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                total_amount: row.get(2)?,
                created_at: row.get(3)?,
                customer_name: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let stats = DashboardStats {
        total_revenue,
        total_orders,
        low_stock_count,
        total_valuation,
        recent_sales,
    };

    log::info!("Returning dashboard stats: {:?}", stats);
    Ok(stats)
}

/// Get low stock products (stock < 10)
#[tauri::command]
pub fn get_low_stock_products(db: State<Database>) -> Result<Vec<LowStockProduct>, String> {
    log::info!("get_low_stock_products called");

    let conn = db.get_conn()?;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerInvoice {
    pub id: i32,
    pub invoice_number: String,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub created_at: String,
    pub item_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerProductStat {
    pub name: String,
    pub total_qty: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerStats {
    pub total_spent: f64,
    pub total_discount: f64,
    pub invoice_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerReport {
    pub customer: Customer,
    pub invoices: Vec<CustomerInvoice>,
    pub products: Vec<CustomerProductStat>,
    pub stats: CustomerStats,
}

/// Search for customers and get detailed report
#[tauri::command]
pub fn customer_search(query: String, db: State<Database>) -> Result<Vec<CustomerReport>, String> {
    log::info!("customer_search called with query: {}", query);

    let conn = db.get_conn()?;

    let search_pattern = format!("%{}%", query);

    // Search for customers
    let mut stmt = conn
        .prepare(
            "SELECT id, name, email, phone, address, place, created_at, updated_at
             FROM customers
             WHERE name LIKE ?1 OR phone LIKE ?1
             ORDER BY name
             LIMIT 10"
        )
        .map_err(|e| e.to_string())?;

    let customer_iter = stmt
        .query_map([&search_pattern], |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                place: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut reports = Vec::new();

    for customer_result in customer_iter {
        let customer = customer_result.map_err(|e| e.to_string())?;
        let customer_id = customer.id;

        // Get invoices for this customer
        let mut invoice_stmt = conn
            .prepare(
                "SELECT i.id, i.invoice_number, i.total_amount, i.discount_amount, i.created_at,
                 (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
                 FROM invoices i
                 WHERE i.customer_id = ?1
                 ORDER BY i.created_at DESC"
            )
            .map_err(|e| e.to_string())?;

        let invoices: Vec<CustomerInvoice> = invoice_stmt
            .query_map([customer_id], |row| {
                Ok(CustomerInvoice {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    total_amount: row.get(2)?,
                    discount_amount: row.get(3)?,
                    created_at: row.get(4)?,
                    item_count: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        // Get product statistics for this customer
        let mut product_stmt = conn
            .prepare(
                "SELECT p.name, SUM(ii.quantity) as total_qty
                 FROM invoice_items ii
                 JOIN invoices i ON ii.invoice_id = i.id
                 JOIN products p ON ii.product_id = p.id
                 WHERE i.customer_id = ?1
                 GROUP BY p.id, p.name
                 ORDER BY total_qty DESC"
            )
            .map_err(|e| e.to_string())?;

        let products: Vec<CustomerProductStat> = product_stmt
            .query_map([customer_id], |row| {
                Ok(CustomerProductStat {
                    name: row.get(0)?,
                    total_qty: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        // Calculate stats
        let total_spent: f64 = invoices.iter().map(|i| i.total_amount).sum();
        let total_discount: f64 = invoices.iter().map(|i| i.discount_amount).sum();
        let invoice_count = invoices.len() as i32;

        reports.push(CustomerReport {
            customer,
            invoices,
            products,
            stats: CustomerStats {
                total_spent,
                total_discount,
                invoice_count,
            },
        });
    }

    log::info!("Returning {} customer reports", reports.len());
    Ok(reports)
}

/// Get detailed report for a single customer by ID
#[tauri::command]
pub fn get_customer_report(id: i32, db: State<Database>) -> Result<CustomerReport, String> {
    log::info!("get_customer_report called with id: {}", id);

    let conn = db.get_conn()?;

    // Get customer details
    let customer = conn
        .query_row(
            "SELECT id, name, email, phone, address, place, created_at, updated_at
             FROM customers
             WHERE id = ?1",
            [id],
            |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    place: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| format!("Customer not found: {}", e))?;

    // Get invoices for this customer
    let mut invoice_stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.total_amount, i.discount_amount, i.created_at,
             (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
             FROM invoices i
             WHERE i.customer_id = ?1
             ORDER BY i.created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let invoices: Vec<CustomerInvoice> = invoice_stmt
        .query_map([id], |row| {
            Ok(CustomerInvoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                total_amount: row.get(2)?,
                discount_amount: row.get(3)?,
                created_at: row.get(4)?,
                item_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Get product statistics for this customer
    let mut product_stmt = conn
        .prepare(
            "SELECT p.name, SUM(ii.quantity) as total_qty
             FROM invoice_items ii
             JOIN invoices i ON ii.invoice_id = i.id
             JOIN products p ON ii.product_id = p.id
             WHERE i.customer_id = ?1
             GROUP BY p.id, p.name
             ORDER BY total_qty DESC"
        )
        .map_err(|e| e.to_string())?;

    let products: Vec<CustomerProductStat> = product_stmt
        .query_map([id], |row| {
            Ok(CustomerProductStat {
                name: row.get(0)?,
                total_qty: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Calculate stats
    let total_spent: f64 = invoices.iter().map(|i| i.total_amount).sum();
    let total_discount: f64 = invoices.iter().map(|i| i.discount_amount).sum();
    let invoice_count = invoices.len() as i32;

    let report = CustomerReport {
        customer,
        invoices,
        products,
        stats: CustomerStats {
            total_spent,
            total_discount,
            invoice_count,
        },
    };

    log::info!("Returning report for customer id: {}", id);
    Ok(report)
}
