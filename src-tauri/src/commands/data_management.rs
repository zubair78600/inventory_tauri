use tauri::State;
use crate::db::Database;
use crate::commands::{get_products, get_customers, get_suppliers};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsertedItem {
    pub id: i32,
    pub name: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateItem {
    pub row_index: i32,
    pub name: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_rows: i32,
    pub duplicate_count: i32,
    pub new_count: i32,
    pub duplicates: Vec<DuplicateItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub processed: i32,
    pub success: i32,
    pub errors: Vec<String>,
    pub duplicate_found: bool,
    pub added_items: Vec<InsertedItem>,
}

/// Pre-scan ALL rows to identify duplicates before import
#[tauri::command]
pub fn scan_duplicates(
    entity_type: String,
    data: Vec<HashMap<String, String>>,
    db: State<Database>
) -> Result<ScanResult, String> {
    let conn = db.get_conn()?;
    
    let mut duplicate_count = 0;
    let mut new_count = 0;
    let mut duplicates: Vec<DuplicateItem> = Vec::new();
    
    for (index, row) in data.iter().enumerate() {
        let is_dup = match entity_type.as_str() {
            "customer" => check_customer_duplicate(
                row.get("phone").map(|s| s.as_str()), 
                row.get("name").map(|s| s.as_str()), 
                &conn
            )?,
            "inventory" => check_product_duplicate(
                row.get("sku").map(|s| s.as_str()), 
                &conn
            )?,
            "supplier" => check_supplier_duplicate(
                row.get("name").map(|s| s.as_str()), 
                &conn
            )?,
            _ => false,
        };
        
        if is_dup {
            duplicate_count += 1;
            duplicates.push(DuplicateItem {
                row_index: (index + 1) as i32,
                name: row.get("name").cloned().unwrap_or_default(),
                identifier: match entity_type.as_str() {
                    "customer" => row.get("phone").cloned(),
                    "inventory" => row.get("sku").cloned(),
                    "supplier" => row.get("contact_info").or(row.get("phone")).cloned(),
                    _ => None,
                },
            });
        } else {
            new_count += 1;
        }
    }
    
    Ok(ScanResult {
        total_rows: data.len() as i32,
        duplicate_count,
        new_count,
        duplicates,
    })
}



#[tauri::command]
pub fn export_csv(entity_type: String, db: State<Database>) -> Result<String, String> {
    let mut wtr = csv::Writer::from_writer(vec![]);

    match entity_type.as_str() {
        "customer" => {
            let result = get_customers(None, 1, 1000000, db.clone())?;
            for item in result.items {
                let export_item = ExportCustomer::from(item.customer);
                wtr.serialize(export_item).map_err(|e| e.to_string())?;
            }
        },
        "inventory" => {
            let result = get_products(None, 1, 1000000, db.clone())?;
            for item in result.items {
                 let export_item = ExportProduct::from(item);
                wtr.serialize(export_item).map_err(|e| e.to_string())?;
            }
        },
        "supplier" => {
            let result = get_suppliers(None, 1, 1000000, db.clone())?;
            for item in result.items {
                let export_item = ExportSupplier::from(item);
                wtr.serialize(export_item).map_err(|e| e.to_string())?;
            }
        },
        _ => return Err(format!("Unknown entity type: {}", entity_type)),
    }

    let data = String::from_utf8(wtr.into_inner().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
        
    Ok(data)
}

// Helper to convert UTC string to IST string
fn to_ist(date_str: &str) -> String {
    use chrono::{DateTime, FixedOffset, NaiveDateTime, Utc};
    
    // Try parsing as RFC3339 (e.g., 2023-10-27T10:00:00Z)
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        let ist_offset = FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap();
        return dt.with_timezone(&ist_offset).format("%Y-%m-%d %H:%M:%S").to_string();
    }
    
    // Try parsing as Naive (e.g., 2023-10-27 10:00:00) assuming UTC
    if let Ok(dt) = NaiveDateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S") {
         let dt_utc = DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc);
         let ist_offset = FixedOffset::east_opt(5 * 3600 + 30 * 60).unwrap();
         return dt_utc.with_timezone(&ist_offset).format("%Y-%m-%d %H:%M:%S").to_string();
    }

    // Return original if parsing fails
    date_str.to_string()
}

// Export Structs with IST conversion
#[derive(Debug, Serialize)]
struct ExportCustomer {
    id: i32,
    name: String,
    email: Option<String>,
    phone: Option<String>,
    address: Option<String>,
    place: Option<String>,
    state: Option<String>,
    district: Option<String>,
    town: Option<String>,
    created_at: String, // IST
    updated_at: String, // IST
}

impl From<crate::db::Customer> for ExportCustomer {
    fn from(c: crate::db::Customer) -> Self {
        Self {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            address: c.address,
            place: c.place,
            state: c.state,
            district: c.district,
            town: c.town,
            created_at: to_ist(&c.created_at),
            updated_at: to_ist(&c.updated_at),
        }
    }
}

#[derive(Debug, Serialize)]
struct ExportProduct {
    id: i32,
    name: String,
    sku: String,
    price: f64,
    selling_price: Option<f64>,
    initial_stock: Option<i32>,
    stock_quantity: i32,
    supplier_id: Option<i32>,
    category: Option<String>,
    created_at: String, // IST
    updated_at: String, // IST
}

impl From<crate::db::Product> for ExportProduct {
    fn from(p: crate::db::Product) -> Self {
        Self {
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            selling_price: p.selling_price,
            initial_stock: p.initial_stock,
            stock_quantity: p.stock_quantity,
            supplier_id: p.supplier_id,
            category: p.category,
            created_at: to_ist(&p.created_at),
            updated_at: to_ist(&p.updated_at),
        }
    }
}

#[derive(Debug, Serialize)]
struct ExportSupplier {
    id: i32,
    name: String,
    contact_info: Option<String>,
    address: Option<String>,
    email: Option<String>,
    comments: Option<String>,
    state: Option<String>,
    district: Option<String>,
    town: Option<String>,
    created_at: String, // IST
    updated_at: String, // IST
}

impl From<crate::db::Supplier> for ExportSupplier {
    fn from(s: crate::db::Supplier) -> Self {
        Self {
            id: s.id,
            name: s.name,
            contact_info: s.contact_info,
            address: s.address,
            email: s.email,
            comments: s.comments,
            state: s.state,
            district: s.district,
            town: s.town,
            created_at: to_ist(&s.created_at),
            updated_at: to_ist(&s.updated_at),
        }
    }
}


#[tauri::command]
pub fn import_csv_chunk(
    entity_type: String,
    data: Vec<HashMap<String, String>>,
    db: State<Database>
) -> Result<ImportResult, String> {
    let mut processed = 0;
    let mut success = 0;
    let mut errors = Vec::new();
    let mut added_items: Vec<InsertedItem> = Vec::new();

    let conn = db.get_conn()?;

    // Begin transaction for the chunk
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    for row in data {
        processed += 1;
        
        // Always check and skip duplicates
        let is_dup = match entity_type.as_str() {
            "customer" => check_customer_duplicate(row.get("phone").map(|s| s.as_str()), row.get("name").map(|s| s.as_str()), &conn)?,
            "inventory" => check_product_duplicate(row.get("sku").map(|s| s.as_str()), &conn)?,
            "supplier" => check_supplier_duplicate(row.get("name").map(|s| s.as_str()), &conn)?,
            _ => false,
        };

        // Skip duplicates - never add them
        if is_dup {
            continue;
        }

        let result = match entity_type.as_str() {
            "customer" => import_customer_row(&row, &conn),
            "inventory" => import_product_row(&row, &conn),
            "supplier" => import_supplier_row(&row, &conn),
            _ => Err(format!("Unknown entity type")),
        };

        match result {
            Ok(_) => {
                success += 1;
                let last_id = conn.last_insert_rowid() as i32;
                let name = row.get("name").cloned().unwrap_or_default();
                let identifier = match entity_type.as_str() {
                    "customer" => row.get("phone").cloned(),
                    "inventory" => row.get("sku").cloned(),
                    "supplier" => row.get("contact_info").or(row.get("phone")).cloned(),
                    _ => None,
                };
                added_items.push(InsertedItem { id: last_id, name, identifier });
            },
            Err(e) => {
                errors.push(format!("Row {}: {}", processed, e));
            },
        }
    }

    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;


    Ok(ImportResult {
        processed,
        success,
        errors,
        duplicate_found: false,
        added_items,
    })
}

// Check Helpers
fn check_customer_duplicate(phone: Option<&str>, name: Option<&str>, conn: &rusqlite::Connection) -> Result<bool, String> {
    if let Some(p) = phone {
        if !p.is_empty() {
             let count: i32 = conn.query_row(
                "SELECT COUNT(*) FROM customers WHERE phone = ?",
                [p],
                |row| row.get(0)
            ).unwrap_or(0);
            if count > 0 { return Ok(true); }
        }
    }
    // Optional: Check name if phone empty?
    if let Some(n) = name {
         let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM customers WHERE name = ? COLLATE NOCASE",
            [n],
            |row| row.get(0)
        ).unwrap_or(0);
        if count > 0 { return Ok(true); }
    }
    Ok(false)
}

fn check_product_duplicate(sku: Option<&str>, conn: &rusqlite::Connection) -> Result<bool, String> {
    if let Some(s) = sku {
         let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM products WHERE sku = ?",
            [s],
            |row| row.get(0)
        ).unwrap_or(0);
        if count > 0 { return Ok(true); }
    }
    Ok(false)
}

fn check_supplier_duplicate(name: Option<&str>, conn: &rusqlite::Connection) -> Result<bool, String> {
    if let Some(n) = name {
         let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM suppliers WHERE name = ? COLLATE NOCASE",
            [n],
            |row| row.get(0)
        ).unwrap_or(0);
        if count > 0 { return Ok(true); }
    }
    Ok(false)
}


fn import_customer_row(row: &HashMap<String, String>, conn: &rusqlite::Connection) -> Result<(), String> {
    let name = row.get("name").ok_or("Missing name")?.to_string();
    let phone = row.get("phone").ok_or("Missing phone")?.to_string();
    
    if name.is_empty() { return Err("Name is required".into()); }
    if phone.is_empty() { return Err("Phone is required".into()); }
    
    let phone_opt = Some(phone);
    let email = row.get("email").filter(|s| !s.is_empty()).cloned();
    let address = row.get("address").filter(|s| !s.is_empty()).cloned();
    let place = row.get("place").filter(|s| !s.is_empty()).cloned();
    let state = row.get("state").filter(|s| !s.is_empty()).cloned();
    let district = row.get("district").filter(|s| !s.is_empty()).cloned();
    let town = row.get("town").filter(|s| !s.is_empty()).cloned();

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customers (name, email, phone, address, place, state, district, town, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![&name, &email, &phone_opt, &address, &place, &state, &district, &town, &now, &now],
    ).map_err(|e| format!("Failed to insert customer: {}", e))?;

    Ok(())
}

fn import_product_row(row: &HashMap<String, String>, conn: &rusqlite::Connection) -> Result<(), String> {
    let name = row.get("name").ok_or("Missing name")?.to_string();
    let sku = row.get("sku").ok_or("Missing sku")?.to_string();
    
    if name.is_empty() { return Err("Name is required".into()); }
    if sku.is_empty() { return Err("SKU is required".into()); }

    let price: f64 = row.get("price")
        .and_then(|s| s.parse().ok())
        .ok_or("Invalid or missing price")?;
    
    let selling_price: f64 = row.get("selling_price")
        .and_then(|s| s.parse().ok())
        .ok_or("Invalid or missing selling_price")?;
        
    let initial_stock: i32 = row.get("initial_stock")
        .and_then(|s| s.parse().ok())
        .ok_or("Invalid or missing initial_stock")?;
        
    let stock_quantity: i32 = row.get("stock_quantity")
        .and_then(|s| s.parse().ok())
        .ok_or("Invalid or missing stock_quantity")?;

    // Optional fields
    let supplier_id: Option<i32> = row.get("supplier_id")
        .filter(|s| !s.is_empty())
        .and_then(|s| s.parse().ok());
    let category = row.get("category").filter(|s| !s.is_empty()).cloned();

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO products (name, sku, price, selling_price, stock_quantity, initial_stock, supplier_id, category, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![&name, &sku, price, selling_price, stock_quantity, initial_stock, &supplier_id, &category, &now, &now],
    ).map_err(|e| format!("Failed to insert product: {}", e))?;

    Ok(())
}

fn import_supplier_row(row: &HashMap<String, String>, conn: &rusqlite::Connection) -> Result<(), String> {
    let name = row.get("name").ok_or("Missing name")?.to_string();
    let contact_info = row.get("contact_info").ok_or("Missing contact_info")?.to_string();
    
    if name.is_empty() { return Err("Name is required".into()); }
    if contact_info.is_empty() { return Err("Contact info is required".into()); }

    // Optional fields
    let email = row.get("email").filter(|s| !s.is_empty()).cloned();
    let address = row.get("address").filter(|s| !s.is_empty()).cloned();
    let comments = row.get("comments").filter(|s| !s.is_empty()).cloned();
    let state = row.get("state").filter(|s| !s.is_empty()).cloned();
    let district = row.get("district").filter(|s| !s.is_empty()).cloned();
    let town = row.get("town").filter(|s| !s.is_empty()).cloned();

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO suppliers (name, contact_info, address, email, comments, state, district, town, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![&name, &contact_info, &address, &email, &comments, &state, &district, &town, &now, &now],
    ).map_err(|e| format!("Failed to insert supplier: {}", e))?;

    Ok(())
}


