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

// ============== New Analytics Types ==============

#[derive(Debug, Serialize, Deserialize)]
pub struct SalesAnalytics {
    pub total_revenue: f64,
    pub total_orders: i32,
    pub avg_order_value: f64,
    pub total_tax: f64,
    pub total_discount: f64,
    pub gross_profit: f64,
    pub previous_period_revenue: f64,
    pub previous_period_orders: i32,
    pub revenue_change_percent: f64,
    pub orders_change_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RevenueTrendPoint {
    pub date: String,
    pub revenue: f64,
    pub order_count: i32,
    pub avg_order_value: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopProduct {
    pub product_id: i32,
    pub product_name: String,
    pub sku: String,
    pub revenue: f64,
    pub quantity_sold: i32,
    pub order_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentMethodBreakdown {
    pub payment_method: String,
    pub total_amount: f64,
    pub order_count: i32,
    pub percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegionSales {
    pub state: String,
    pub district: Option<String>,
    pub town: Option<String>,
    pub revenue: f64,
    pub order_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerAnalytics {
    pub total_customers: i32,
    pub new_customers: i32,
    pub repeat_customers: i32,
    pub repeat_rate: f64,
    pub avg_lifetime_value: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopCustomer {
    pub customer_id: i32,
    pub customer_name: String,
    pub phone: Option<String>,
    pub total_spent: f64,
    pub order_count: i32,
    pub avg_order_value: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerTrendPoint {
    pub date: String,
    pub new_customers: i32,
    pub cumulative_customers: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InventoryHealth {
    pub total_products: i32,
    pub low_stock_count: i32,
    pub out_of_stock_count: i32,
    pub healthy_stock_count: i32,
    pub total_valuation: f64,
    pub avg_stock_level: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseAnalytics {
    pub total_purchases: f64,
    pub total_paid: f64,
    pub pending_payments: f64,
    pub active_suppliers: i32,
    pub purchase_order_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CashflowPoint {
    pub date: String,
    pub sales: f64,
    pub purchases: f64,
    pub net: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TopSupplier {
    pub supplier_id: i32,
    pub supplier_name: String,
    pub total_spent: f64,
    pub products_count: i32,
    pub orders_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StateTax {
    pub state: String,
    pub tax_amount: f64,
    pub invoice_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaxSummary {
    pub total_tax: f64,
    pub cgst_total: f64,
    pub sgst_total: f64,
    pub igst_total: f64,
    pub by_state: Vec<StateTax>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscountAnalysis {
    pub total_discounts: f64,
    pub discount_percentage: f64,
    pub orders_with_discount: i32,
    pub avg_discount_per_order: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LowStockAlert {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub stock_quantity: i32,
    pub selling_price: Option<f64>,
    pub avg_daily_sales: f64,
    pub days_until_stockout: Option<i32>,
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
                state: None, // Not fetched in this query
                district: None,
                town: None,
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
                state: None,
                district: None,
                town: None,
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

// ============== New Analytics Commands ==============

/// Get sales analytics with date filtering and comparison
#[tauri::command]
pub fn get_sales_analytics(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<SalesAnalytics, String> {
    log::info!("get_sales_analytics called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    // Current period stats
    let (total_revenue, total_orders, total_tax, total_discount): (f64, i32, f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(total_amount), 0.0),
                COUNT(*),
                COALESCE(SUM(tax_amount), 0.0),
                COALESCE(SUM(discount_amount), 0.0)
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    let avg_order_value = if total_orders > 0 {
        total_revenue / total_orders as f64
    } else {
        0.0
    };

    // Calculate previous period (same duration before start_date)
    let (prev_revenue, prev_orders): (f64, i32) = conn
        .query_row(
            "WITH date_diff AS (
                SELECT julianday(?2) - julianday(?1) AS days
            )
            SELECT
                COALESCE(SUM(total_amount), 0.0),
                COUNT(*)
             FROM invoices, date_diff
             WHERE created_at >= datetime(?1, '-' || (days + 1) || ' days')
               AND created_at < datetime(?1)",
            [&start_date, &end_date],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let revenue_change = if prev_revenue > 0.0 {
        ((total_revenue - prev_revenue) / prev_revenue) * 100.0
    } else if total_revenue > 0.0 {
        100.0
    } else {
        0.0
    };

    let orders_change = if prev_orders > 0 {
        ((total_orders as f64 - prev_orders as f64) / prev_orders as f64) * 100.0
    } else if total_orders > 0 {
        100.0
    } else {
        0.0
    };

    // Gross profit = Revenue - Cost (using FIFO batches if available, else product price)
    let gross_profit: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(ii.quantity * (ii.unit_price - COALESCE(p.price, 0))), 0.0)
             FROM invoice_items ii
             JOIN invoices i ON ii.invoice_id = i.id
             JOIN products p ON ii.product_id = p.id
             WHERE i.created_at >= datetime(?1)
               AND i.created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    Ok(SalesAnalytics {
        total_revenue,
        total_orders,
        avg_order_value,
        total_tax,
        total_discount,
        gross_profit,
        previous_period_revenue: prev_revenue,
        previous_period_orders: prev_orders,
        revenue_change_percent: revenue_change,
        orders_change_percent: orders_change,
    })
}

/// Get revenue trend data for charts
#[tauri::command]
pub fn get_revenue_trend(
    start_date: String,
    end_date: String,
    granularity: String, // "daily", "weekly", "monthly"
    db: State<Database>,
) -> Result<Vec<RevenueTrendPoint>, String> {
    log::info!("get_revenue_trend called: {} to {} ({})", start_date, end_date, granularity);

    let conn = db.get_conn()?;

    let date_format = match granularity.as_str() {
        "weekly" => "%Y-W%W",
        "monthly" => "%Y-%m",
        _ => "%Y-%m-%d", // daily
    };

    let mut stmt = conn
        .prepare(&format!(
            "SELECT
                strftime('{}', created_at) as period,
                COALESCE(SUM(total_amount), 0.0) as revenue,
                COUNT(*) as order_count
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')
             GROUP BY period
             ORDER BY period ASC",
            date_format
        ))
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            let revenue: f64 = row.get(1)?;
            let order_count: i32 = row.get(2)?;
            Ok(RevenueTrendPoint {
                date: row.get(0)?,
                revenue,
                order_count,
                avg_order_value: if order_count > 0 { revenue / order_count as f64 } else { 0.0 },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get top products by revenue
#[tauri::command]
pub fn get_top_products(
    start_date: String,
    end_date: String,
    limit: i32,
    db: State<Database>,
) -> Result<Vec<TopProduct>, String> {
    log::info!("get_top_products called: {} to {}, limit {}", start_date, end_date, limit);

    let conn = db.get_conn()?;

    let query = format!(
        "SELECT
            p.id,
            p.name,
            p.sku,
            COALESCE(SUM(ii.quantity * ii.unit_price), 0.0) as revenue,
            COALESCE(SUM(ii.quantity), 0) as quantity_sold,
            COUNT(DISTINCT ii.invoice_id) as order_count
         FROM products p
         JOIN invoice_items ii ON p.id = ii.product_id
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE i.created_at >= datetime(?1)
           AND i.created_at < datetime(?2, '+1 day')
         GROUP BY p.id
         ORDER BY revenue DESC
         LIMIT {}",
        limit
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok(TopProduct {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                sku: row.get(2)?,
                revenue: row.get(3)?,
                quantity_sold: row.get(4)?,
                order_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    log::info!("get_top_products returning {} products", results.len());
    Ok(results)
}

/// Get sales by payment method
#[tauri::command]
pub fn get_sales_by_payment_method(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<Vec<PaymentMethodBreakdown>, String> {
    log::info!("get_sales_by_payment_method called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    // Get total for percentage calculation
    let total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0.0) FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(payment_method, 'Unknown') as method,
                COALESCE(SUM(total_amount), 0.0) as total,
                COUNT(*) as count
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')
             GROUP BY payment_method
             ORDER BY total DESC"
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            let amount: f64 = row.get(1)?;
            Ok(PaymentMethodBreakdown {
                payment_method: row.get(0)?,
                total_amount: amount,
                order_count: row.get(2)?,
                percentage: if total > 0.0 { (amount / total) * 100.0 } else { 0.0 },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get sales by region (grouped by town)
#[tauri::command]
pub fn get_sales_by_region(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<Vec<RegionSales>, String> {
    log::info!("get_sales_by_region called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(state, 'Unknown') as state,
                district,
                COALESCE(town, 'Unknown') as town,
                COALESCE(SUM(total_amount), 0.0) as revenue,
                COUNT(*) as order_count
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')
               AND town IS NOT NULL AND town != ''
             GROUP BY town
             ORDER BY revenue DESC"
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok(RegionSales {
                state: row.get(0)?,
                district: row.get(1)?,
                town: row.get(2)?,
                revenue: row.get(3)?,
                order_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get customer analytics
#[tauri::command]
pub fn get_customer_analytics(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<CustomerAnalytics, String> {
    log::info!("get_customer_analytics called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    // Total customers with orders in period
    let total_customers: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT customer_id) FROM invoices
             WHERE customer_id IS NOT NULL
               AND created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // New customers (first order in this period)
    let new_customers: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT customer_id) FROM invoices i1
             WHERE customer_id IS NOT NULL
               AND created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')
               AND NOT EXISTS (
                   SELECT 1 FROM invoices i2
                   WHERE i2.customer_id = i1.customer_id
                     AND i2.created_at < datetime(?1)
               )",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Repeat customers (more than 1 order ever)
    let repeat_customers: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM (
                SELECT customer_id FROM invoices
                WHERE customer_id IS NOT NULL
                  AND created_at >= datetime(?1)
                  AND created_at < datetime(?2, '+1 day')
                GROUP BY customer_id
                HAVING COUNT(*) > 1
             )",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let repeat_rate = if total_customers > 0 {
        (repeat_customers as f64 / total_customers as f64) * 100.0
    } else {
        0.0
    };

    // Average lifetime value
    let avg_lifetime_value: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(total), 0.0) FROM (
                SELECT SUM(total_amount) as total
                FROM invoices
                WHERE customer_id IS NOT NULL
                GROUP BY customer_id
             )",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    Ok(CustomerAnalytics {
        total_customers,
        new_customers,
        repeat_customers,
        repeat_rate,
        avg_lifetime_value,
    })
}

/// Get top customers by spend
#[tauri::command]
pub fn get_top_customers(
    start_date: String,
    end_date: String,
    limit: i32,
    db: State<Database>,
) -> Result<Vec<TopCustomer>, String> {
    log::info!("get_top_customers called: {} to {}, limit {}", start_date, end_date, limit);

    let conn = db.get_conn()?;

    let query = format!(
        "SELECT
            c.id,
            c.name,
            c.phone,
            COALESCE(SUM(i.total_amount), 0.0) as total_spent,
            COUNT(i.id) as order_count
         FROM customers c
         JOIN invoices i ON c.id = i.customer_id
         WHERE i.created_at >= datetime(?1)
           AND i.created_at < datetime(?2, '+1 day')
         GROUP BY c.id
         ORDER BY total_spent DESC
         LIMIT {}",
        limit
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            let total_spent: f64 = row.get(3)?;
            let order_count: i32 = row.get(4)?;
            Ok(TopCustomer {
                customer_id: row.get(0)?,
                customer_name: row.get(1)?,
                phone: row.get(2)?,
                total_spent,
                order_count,
                avg_order_value: if order_count > 0 { total_spent / order_count as f64 } else { 0.0 },
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get customer acquisition trend
#[tauri::command]
pub fn get_customer_trend(
    start_date: String,
    end_date: String,
    granularity: String,
    db: State<Database>,
) -> Result<Vec<CustomerTrendPoint>, String> {
    log::info!("get_customer_trend called: {} to {} ({})", start_date, end_date, granularity);

    let conn = db.get_conn()?;

    let date_format = match granularity.as_str() {
        "weekly" => "%Y-W%W",
        "monthly" => "%Y-%m",
        _ => "%Y-%m-%d",
    };

    let mut stmt = conn
        .prepare(&format!(
            "WITH first_orders AS (
                SELECT customer_id, MIN(created_at) as first_order_date
                FROM invoices
                WHERE customer_id IS NOT NULL
                GROUP BY customer_id
            )
            SELECT
                strftime('{}', first_order_date) as period,
                COUNT(*) as new_customers
            FROM first_orders
            WHERE first_order_date >= datetime(?1)
              AND first_order_date < datetime(?2, '+1 day')
            GROUP BY period
            ORDER BY period ASC",
            date_format
        ))
        .map_err(|e| e.to_string())?;

    let mut cumulative = 0;
    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(date, new_count)| {
            cumulative += new_count;
            CustomerTrendPoint {
                date,
                new_customers: new_count,
                cumulative_customers: cumulative,
            }
        })
        .collect();

    Ok(results)
}

/// Get inventory health metrics
#[tauri::command]
pub fn get_inventory_health(db: State<Database>) -> Result<InventoryHealth, String> {
    log::info!("get_inventory_health called");

    let conn = db.get_conn()?;

    let (total, low, out, valuation, avg): (i32, i32, i32, f64, f64) = conn
        .query_row(
            "SELECT
                COUNT(*),
                SUM(CASE WHEN stock_quantity > 0 AND stock_quantity < 10 THEN 1 ELSE 0 END),
                SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END),
                COALESCE(SUM(price * stock_quantity), 0.0),
                COALESCE(AVG(stock_quantity), 0.0)
             FROM products",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(InventoryHealth {
        total_products: total,
        low_stock_count: low,
        out_of_stock_count: out,
        healthy_stock_count: total - low - out,
        total_valuation: valuation,
        avg_stock_level: avg,
    })
}

/// Get low stock alerts with sales velocity
#[tauri::command]
pub fn get_low_stock_alerts(db: State<Database>) -> Result<Vec<LowStockAlert>, String> {
    log::info!("get_low_stock_alerts called");

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT
                p.id,
                p.name,
                p.sku,
                p.stock_quantity,
                p.selling_price,
                COALESCE(
                    (SELECT SUM(ii.quantity) * 1.0 / 30
                     FROM invoice_items ii
                     JOIN invoices i ON ii.invoice_id = i.id
                     WHERE ii.product_id = p.id
                       AND i.created_at >= datetime('now', '-30 days')
                    ), 0.0
                ) as avg_daily_sales
             FROM products p
             WHERE p.stock_quantity < 10
             ORDER BY p.stock_quantity ASC"
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| {
            let stock: i32 = row.get(3)?;
            let avg_sales: f64 = row.get(5)?;
            let days_until = if avg_sales > 0.0 {
                Some((stock as f64 / avg_sales).floor() as i32)
            } else {
                None
            };
            Ok(LowStockAlert {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                stock_quantity: stock,
                selling_price: row.get(4)?,
                avg_daily_sales: avg_sales,
                days_until_stockout: days_until,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get purchase analytics
/// Total Purchases = Sum of "Stock Amount" from inventory page = SUM(initial_stock * price) + SUM(received PO items cost)
/// Amount Paid = Sum of all supplier payments
/// Pending = Total Purchases - Amount Paid
#[tauri::command]
pub fn get_purchase_analytics(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<PurchaseAnalytics, String> {
    log::info!("get_purchase_analytics called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    // Total Purchases = Sum of "Stock Amount" from inventory page
    // This matches the total_purchased_cost calculation in products.rs:
    // COALESCE(initial_stock * price, 0) + COALESCE(SUM(received PO items cost), 0)

    // Part 1: Initial stock value for all products
    let initial_stock_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(COALESCE(initial_stock, 0) * price), 0.0) FROM products",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Part 2: Sum of all received PO items cost (Purchase Order Item * Unit Cost)
    let po_received_cost: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(poi.quantity * poi.unit_cost), 0.0)
             FROM purchase_order_items poi
             JOIN purchase_orders po ON poi.po_id = po.id
             WHERE po.status = 'received'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Total Purchases = initial stock value + received PO items cost
    let total_purchases = initial_stock_total + po_received_cost;

    // Amount Paid = Sum of all supplier payments
    let total_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0.0) FROM supplier_payments",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Pending = Total Purchases - Amount Paid
    let pending_payments = (total_purchases - total_paid).max(0.0);

    log::info!("Dashboard: TotalPurchases={} (initial={}, po={}), TotalPaid={}, Pending={}",
               total_purchases, initial_stock_total, po_received_cost, total_paid, pending_payments);

    // Active suppliers is still filtered by date range
    let active_suppliers: i32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT supplier_id) FROM purchase_orders
             WHERE order_date >= ?1 AND order_date <= ?2",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // PO count also filtered by date range
    let po_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM purchase_orders
             WHERE order_date >= ?1 AND order_date <= ?2",
            [&start_date, &end_date],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(PurchaseAnalytics {
        total_purchases,
        total_paid,
        pending_payments,
        active_suppliers,
        purchase_order_count: po_count,
    })
}

/// Get cashflow trend (sales vs purchases)
#[tauri::command]
pub fn get_cashflow_trend(
    start_date: String,
    end_date: String,
    granularity: String,
    db: State<Database>,
) -> Result<Vec<CashflowPoint>, String> {
    log::info!("get_cashflow_trend called: {} to {} ({})", start_date, end_date, granularity);

    let conn = db.get_conn()?;

    let date_format = match granularity.as_str() {
        "weekly" => "%Y-W%W",
        "monthly" => "%Y-%m",
        _ => "%Y-%m-%d",
    };

    let mut stmt = conn
        .prepare(&format!(
            "WITH sales_data AS (
                SELECT strftime('{}', created_at) as period, SUM(total_amount) as amount
                FROM invoices
                WHERE created_at >= datetime(?1)
                  AND created_at < datetime(?2, '+1 day')
                GROUP BY period
            ),
            purchase_data AS (
                SELECT strftime('{}', order_date) as period, SUM(total_amount) as amount
                FROM purchase_orders
                WHERE order_date >= ?1 AND order_date <= ?2
                GROUP BY period
            ),
            all_periods AS (
                SELECT period FROM sales_data
                UNION
                SELECT period FROM purchase_data
            )
            SELECT
                ap.period,
                COALESCE(s.amount, 0.0) as sales,
                COALESCE(p.amount, 0.0) as purchases
            FROM all_periods ap
            LEFT JOIN sales_data s ON ap.period = s.period
            LEFT JOIN purchase_data p ON ap.period = p.period
            ORDER BY ap.period ASC",
            date_format, date_format
        ))
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            let sales: f64 = row.get(1)?;
            let purchases: f64 = row.get(2)?;
            Ok(CashflowPoint {
                date: row.get(0)?,
                sales,
                purchases,
                net: sales - purchases,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get top suppliers by spend
#[tauri::command]
pub fn get_top_suppliers(
    start_date: String,
    end_date: String,
    limit: i32,
    db: State<Database>,
) -> Result<Vec<TopSupplier>, String> {
    log::info!("get_top_suppliers called: {} to {}, limit {}", start_date, end_date, limit);

    let conn = db.get_conn()?;

    let query = format!(
        "SELECT
            s.id,
            s.name,
            COALESCE(SUM(po.total_amount), 0.0) as total_spent,
            COUNT(DISTINCT poi.product_id) as products_count,
            COUNT(DISTINCT po.id) as orders_count
         FROM suppliers s
         JOIN purchase_orders po ON s.id = po.supplier_id
         LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
         WHERE po.order_date >= ?1 AND po.order_date <= ?2
         GROUP BY s.id
         ORDER BY total_spent DESC
         LIMIT {}",
        limit
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok(TopSupplier {
                supplier_id: row.get(0)?,
                supplier_name: row.get(1)?,
                total_spent: row.get(2)?,
                products_count: row.get(3)?,
                orders_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get tax summary
#[tauri::command]
pub fn get_tax_summary(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<TaxSummary, String> {
    log::info!("get_tax_summary called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    let (total_tax, cgst, sgst, igst): (f64, f64, f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(tax_amount), 0.0),
                COALESCE(SUM(cgst_amount), 0.0),
                COALESCE(SUM(sgst_amount), 0.0),
                COALESCE(SUM(igst_amount), 0.0)
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(state, 'Unknown'),
                COALESCE(SUM(tax_amount), 0.0),
                COUNT(*)
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')
             GROUP BY state
             ORDER BY SUM(tax_amount) DESC"
        )
        .map_err(|e| e.to_string())?;

    let by_state = stmt
        .query_map([&start_date, &end_date], |row| {
            Ok(StateTax {
                state: row.get(0)?,
                tax_amount: row.get(1)?,
                invoice_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(TaxSummary {
        total_tax,
        cgst_total: cgst,
        sgst_total: sgst,
        igst_total: igst,
        by_state,
    })
}

/// Get discount analysis
#[tauri::command]
pub fn get_discount_analysis(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<DiscountAnalysis, String> {
    log::info!("get_discount_analysis called: {} to {}", start_date, end_date);

    let conn = db.get_conn()?;

    let (total_discounts, total_revenue, orders_with_discount): (f64, f64, i32) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(discount_amount), 0.0),
                COALESCE(SUM(total_amount), 0.0),
                SUM(CASE WHEN discount_amount > 0 THEN 1 ELSE 0 END)
             FROM invoices
             WHERE created_at >= datetime(?1)
               AND created_at < datetime(?2, '+1 day')",
            [&start_date, &end_date],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let discount_percentage = if total_revenue > 0.0 {
        (total_discounts / (total_revenue + total_discounts)) * 100.0
    } else {
        0.0
    };

    let avg_discount = if orders_with_discount > 0 {
        total_discounts / orders_with_discount as f64
    } else {
        0.0
    };

    Ok(DiscountAnalysis {
        total_discounts,
        discount_percentage,
        orders_with_discount,
        avg_discount_per_order: avg_discount,
    })
}
