use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub products: Vec<SearchProduct>,
    pub customers: Vec<SearchCustomer>,
    pub suppliers: Vec<SearchSupplier>,
    pub invoices: Vec<SearchInvoice>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchProduct {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub stock_quantity: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchCustomer {
    pub id: i32,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchSupplier {
    pub id: i32,
    pub name: String,
    pub contact_info: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
    pub state: Option<String>,
    pub place: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchInvoice {
    pub id: i32,
    pub invoice_number: String,
    pub total_amount: f64,
    pub created_at: String,
}

/// OmniSearch: Search across all entities
#[tauri::command]
pub fn omnisearch(query: String, db: State<Database>) -> Result<SearchResult, String> {
    log::info!("omnisearch called with query: {}", query);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let search_pattern = format!("%{}%", query);

    // Search products
    let mut products = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, sku, price, stock_quantity FROM products WHERE name LIKE ?1 OR sku LIKE ?1 LIMIT 10")
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map([&search_pattern], |row| {
            Ok(SearchProduct {
                id: row.get(0)?,
                name: row.get(1)?,
                sku: row.get(2)?,
                price: row.get(3)?,
                stock_quantity: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for product in product_iter {
        products.push(product.map_err(|e| e.to_string())?);
    }

    // Search customers
    let mut customers = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, email, phone FROM customers WHERE name LIKE ?1 OR email LIKE ?1 OR phone LIKE ?1 LIMIT 10")
        .map_err(|e| e.to_string())?;

    let customer_iter = stmt
        .query_map([&search_pattern], |row| {
            Ok(SearchCustomer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for customer in customer_iter {
        customers.push(customer.map_err(|e| e.to_string())?);
    }

    // Search suppliers
    let mut suppliers = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, name, contact_info, address, email, comments, state, place FROM suppliers WHERE name LIKE ?1 OR contact_info LIKE ?1 OR email LIKE ?1 LIMIT 10")
        .map_err(|e| e.to_string())?;

    let supplier_iter = stmt
        .query_map([&search_pattern], |row| {
            Ok(SearchSupplier {
                id: row.get(0)?,
                name: row.get(1)?,
                contact_info: row.get(2)?,
                address: row.get(3)?,
                email: row.get(4)?,
                comments: row.get(5)?,
                state: row.get(6)?,
                place: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for supplier in supplier_iter {
        suppliers.push(supplier.map_err(|e| e.to_string())?);
    }

    // Search invoices
    let mut invoices = Vec::new();
    let mut stmt = conn
        .prepare("SELECT id, invoice_number, total_amount, created_at FROM invoices WHERE invoice_number LIKE ?1 LIMIT 10")
        .map_err(|e| e.to_string())?;

    let invoice_iter = stmt
        .query_map([&search_pattern], |row| {
            Ok(SearchInvoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                total_amount: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for invoice in invoice_iter {
        invoices.push(invoice.map_err(|e| e.to_string())?);
    }

    let result = SearchResult {
        products,
        customers,
        suppliers,
        invoices,
    };

    log::info!("omnisearch returning {} total results",
        result.products.len() + result.customers.len() + result.suppliers.len() + result.invoices.len());

    Ok(result)
}

/// Export products to CSV format
#[tauri::command]
pub fn export_products_csv(db: State<Database>) -> Result<String, String> {
    log::info!("export_products_csv called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut csv = String::from("ID,Name,SKU,Price,Stock Quantity,Supplier ID\n");

    let mut stmt = conn
        .prepare("SELECT id, name, sku, price, stock_quantity, supplier_id FROM products ORDER BY name")
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let name: String = row.get(1)?;
            let sku: String = row.get(2)?;
            let price: f64 = row.get(3)?;
            let stock_quantity: i32 = row.get(4)?;
            let supplier_id: Option<i32> = row.get(5)?;

            Ok((id, name, sku, price, stock_quantity, supplier_id))
        })
        .map_err(|e| e.to_string())?;

    for product in product_iter {
        let (id, name, sku, price, stock_quantity, supplier_id) = product.map_err(|e| e.to_string())?;
        let supplier_str = supplier_id.map(|s| s.to_string()).unwrap_or_default();
        csv.push_str(&format!("{},{},{},{},{},{}\n", id, name, sku, price, stock_quantity, supplier_str));
    }

    log::info!("export_products_csv completed");
    Ok(csv)
}

/// Export customers to CSV format
#[tauri::command]
pub fn export_customers_csv(db: State<Database>) -> Result<String, String> {
    log::info!("export_customers_csv called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut csv = String::from("ID,Name,Email,Phone,Address\n");

    let mut stmt = conn
        .prepare("SELECT id, name, email, phone, address FROM customers ORDER BY name")
        .map_err(|e| e.to_string())?;

    let customer_iter = stmt
        .query_map([], |row| {
            let id: i32 = row.get(0)?;
            let name: String = row.get(1)?;
            let email: Option<String> = row.get(2)?;
            let phone: Option<String> = row.get(3)?;
            let address: Option<String> = row.get(4)?;

            Ok((id, name, email, phone, address))
        })
        .map_err(|e| e.to_string())?;

    for customer in customer_iter {
        let (id, name, email, phone, address) = customer.map_err(|e| e.to_string())?;
        let email_str = email.unwrap_or_default();
        let phone_str = phone.unwrap_or_default();
        let address_str = address.unwrap_or_default();
        csv.push_str(&format!("{},{},{},{},{}\n", id, name, email_str, phone_str, address_str));
    }

    log::info!("export_customers_csv completed");
    Ok(csv)
}
