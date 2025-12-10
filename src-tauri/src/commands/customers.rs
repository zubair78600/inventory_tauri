use crate::db::{Database, Customer};
use crate::commands::PaginatedResult;
use serde::{Deserialize, Serialize};
use tauri::State;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCustomerInput {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub place: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCustomerInput {
    pub id: i32,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub place: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerWithStats {
    #[serde(flatten)]
    pub customer: Customer,
    pub invoice_count: i32,
    pub last_billed: Option<String>,
}

/// Get all customers, optionally filtered by search query, with pagination
#[tauri::command]
pub fn get_customers(
    search: Option<String>,
    page: i32,
    page_size: i32,
    db: State<Database>
) -> Result<PaginatedResult<CustomerWithStats>, String> {
    log::info!("get_customers called with search: {:?}, page: {}, page_size: {}", search, page, page_size);

    let conn = db.get_conn()?;

    let offset = (page - 1) * page_size;
    let limit = page_size;

    let mut customers = Vec::new();
    let total_count: i64;

    let base_query = "
        SELECT c.id, c.name, c.email, c.phone, c.address, c.place, c.state, c.district, c.town, c.created_at, c.updated_at,
               COUNT(i.id) as invoice_count,
               MAX(i.created_at) as last_billed
        FROM customers c
        LEFT JOIN invoices i ON c.id = i.customer_id
    ";

    let count_query = "SELECT COUNT(*) FROM customers c";

    let group_by = "GROUP BY c.id ORDER BY c.name";

    if let Some(search_term) = search {
        let search_pattern = format!("%{}%", search_term);
        let where_clause = "WHERE c.name LIKE ?1 OR c.email LIKE ?1 OR c.phone LIKE ?1 OR c.place LIKE ?1";
        
        // Get total count
        let count_sql = format!("{} {}", count_query, where_clause);
        total_count = conn
            .query_row(&count_sql, [&search_pattern], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        let query = format!("{} {} {} LIMIT ?2 OFFSET ?3", base_query, where_clause, group_by);
        
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let customer_iter = stmt
            .query_map(rusqlite::params![&search_pattern, limit, offset], |row| {
                Ok(CustomerWithStats {
                    customer: Customer {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        email: row.get(2)?,
                        phone: row.get(3)?,
                        address: row.get(4)?,
                        place: row.get(5)?,
                        state: row.get(6)?,
                        district: row.get(7)?,
                        town: row.get(8)?,
                        created_at: row.get(9)?,
                        updated_at: row.get(10)?,
                    },
                    invoice_count: row.get(11)?,
                    last_billed: row.get(12)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for customer in customer_iter {
            customers.push(customer.map_err(|e| e.to_string())?);
        }
    } else {
        // Get total count
        total_count = conn
            .query_row(count_query, [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // Get paginated items
        let query = format!("{} {} LIMIT ?1 OFFSET ?2", base_query, group_by);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let customer_iter = stmt
            .query_map([limit, offset], |row| {
                Ok(CustomerWithStats {
                    customer: Customer {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        email: row.get(2)?,
                        phone: row.get(3)?,
                        address: row.get(4)?,
                        place: row.get(5)?,
                        state: row.get(6)?,
                        district: row.get(7)?,
                        town: row.get(8)?,
                        created_at: row.get(9)?,
                        updated_at: row.get(10)?,
                    },
                    invoice_count: row.get(11)?,
                    last_billed: row.get(12)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for customer in customer_iter {
            customers.push(customer.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} customers (page {}, size {}, total {})", customers.len(), page, page_size, total_count);
    Ok(PaginatedResult {
        items: customers,
        total_count,
    })
}

/// Get a single customer by ID
#[tauri::command]
pub fn get_customer(id: i32, db: State<Database>) -> Result<Customer, String> {
    log::info!("get_customer called with id: {}", id);

    let conn = db.get_conn()?;

    let customer = conn
        .query_row(
            "SELECT id, name, email, phone, address, place, state, district, town, created_at, updated_at FROM customers WHERE id = ?1",
            [id],
            |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    place: row.get(5)?,
                    state: row.get(6)?,
                    district: row.get(7)?,
                    town: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Customer not found: {}", e))?;

    Ok(customer)
}

/// Helper to validate phone number (must be 10 digits)
fn validate_phone(phone: &Option<String>) -> Result<(), String> {
    if let Some(p) = phone {
        // Remove spaces/dashes just in case, though frontend sends clean strings usually.
        // Actually, let's strict validate exactly what we receive to match frontend "10 digits" rule.
        // Frontend Regex: ^\d{10}$
        
        // Check length and numeric
        let is_valid = p.len() == 10 && p.chars().all(|c| c.is_digit(10));
        
        if !is_valid {
            return Err("Phone number must be exactly 10 digits".to_string());
        }
    }
    Ok(())
}

/// Create a new customer
#[tauri::command]
pub fn create_customer(input: CreateCustomerInput, db: State<Database>) -> Result<Customer, String> {
    log::info!("create_customer called with: {:?}", input);

    validate_phone(&input.phone)?;

    let conn = db.get_conn()?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customers (name, email, phone, address, place, state, district, town, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        (&input.name, &input.email, &input.phone, &input.address, &input.place, &input.state, &input.district, &input.town, &now, &now),
    )
    .map_err(|e| format!("Failed to create customer: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let customer = Customer {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        place: input.place,
        state: input.state,
        district: input.district,
        town: input.town,
        created_at: now.clone(),
        updated_at: now,
    };

    log::info!("Created customer with id: {}", id);
    Ok(customer)
}

/// Update an existing customer
#[tauri::command]
pub fn update_customer(input: UpdateCustomerInput, modified_by: Option<String>, db: State<Database>) -> Result<Customer, String> {
    log::info!("update_customer called with: {:?}", input);

    validate_phone(&input.phone)?;

    let conn = db.get_conn()?;

    // Get old values for modification logging
    let old_customer: Customer = conn
        .query_row(
            "SELECT id, name, email, phone, address, place, state, district, town, created_at, updated_at FROM customers WHERE id = ?1",
            [input.id],
            |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    place: row.get(5)?,
                    state: row.get(6)?,
                    district: row.get(7)?,
                    town: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Customer with id {} not found: {}", input.id, e))?;

    let now = Utc::now().to_rfc3339();

    // Build field changes array
    let mut field_changes: Vec<serde_json::Value> = Vec::new();
    
    if old_customer.name != input.name {
        field_changes.push(serde_json::json!({"field": "name", "old": old_customer.name, "new": input.name}));
    }
    if old_customer.email != input.email {
        field_changes.push(serde_json::json!({"field": "email", "old": old_customer.email, "new": input.email}));
    }
    if old_customer.phone != input.phone {
        field_changes.push(serde_json::json!({"field": "phone", "old": old_customer.phone, "new": input.phone}));
    }
    if old_customer.address != input.address {
        field_changes.push(serde_json::json!({"field": "address", "old": old_customer.address, "new": input.address}));
    }
    if old_customer.place != input.place {
        field_changes.push(serde_json::json!({"field": "place", "old": old_customer.place, "new": input.place}));
    }
    if old_customer.state != input.state {
        field_changes.push(serde_json::json!({"field": "state", "old": old_customer.state, "new": input.state}));
    }
    if old_customer.district != input.district {
        field_changes.push(serde_json::json!({"field": "district", "old": old_customer.district, "new": input.district}));
    }
    if old_customer.town != input.town {
        field_changes.push(serde_json::json!({"field": "town", "old": old_customer.town, "new": input.town}));
    }

    let rows_affected = conn
        .execute(
            "UPDATE customers SET name = ?1, email = ?2, phone = ?3, address = ?4, place = ?5, state = ?6, district = ?7, town = ?8, updated_at = ?9 WHERE id = ?10",
            (&input.name, &input.email, &input.phone, &input.address, &input.place, &input.state, &input.district, &input.town, &now, input.id),
        )
        .map_err(|e| format!("Failed to update customer: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Customer with id {} not found", input.id));
    }

    // Log modification if there were actual changes
    if !field_changes.is_empty() {
        let changes_json = serde_json::to_string(&field_changes).unwrap_or_default();
        conn.execute(
            "INSERT INTO entity_modifications (entity_type, entity_id, entity_name, action, field_changes, modified_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            ("customer", input.id, &input.name, "updated", &changes_json, &modified_by),
        ).map_err(|e| format!("Failed to log modification: {}", e))?;
        log::info!("Logged {} field changes for customer {}", field_changes.len(), input.id);
    }

    let customer = Customer {
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        place: input.place,
        state: input.state,
        district: input.district,
        town: input.town,
        created_at: old_customer.created_at,
        updated_at: now,
    };

    log::info!("Updated customer with id: {}", input.id);
    Ok(customer)
}

/// Delete a customer by ID
#[tauri::command]
pub fn delete_customer(id: i32, deleted_by: Option<String>, db: State<Database>) -> Result<(), String> {
    log::info!("delete_customer called with id: {}", id);

    let mut conn = db.get_conn()?;

    // Get customer data before deletion for audit trail
    let customer = conn.query_row(
        "SELECT id, name, email, phone, address, place, state, district, town, created_at, updated_at FROM customers WHERE id = ?1",
        [id],
        |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                place: row.get(5)?,
                state: row.get(6)?,
                district: row.get(7)?,
                town: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| format!("Customer with id {} not found: {}", id, e))?;

    // Get related invoices (scoped to release borrow before transaction)
    let invoices = {
        let mut stmt = conn.prepare("SELECT id, invoice_number, customer_id, total_amount, tax_amount, discount_amount, payment_method, created_at, cgst_amount, fy_year, gst_rate, igst_amount, sgst_amount, state, district, town FROM invoices WHERE customer_id = ?1").map_err(|e| e.to_string())?;
        let invoices_iter = stmt.query_map([id], |row| {
            Ok(crate::db::Invoice {
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
            })
        }).map_err(|e| e.to_string())?;

        let mut invoices = Vec::new();
        for invoice in invoices_iter {
            invoices.push(invoice.map_err(|e| e.to_string())?);
        }
        invoices
    };

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Save to deleted_items
    let invoices_json = if invoices.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&invoices).map_err(|e| format!("Failed to serialize invoices: {}", e))?)
    };

    crate::db::archive::archive_entity(
        &tx,
        "customer",
        id,
        &customer,
        invoices_json,
        deleted_by,
    )?;

    // Delete linked invoices first (invoice_items will cascade delete due to FK)
    tx.execute("DELETE FROM invoices WHERE customer_id = ?1", [id])
        .map_err(|e| format!("Failed to delete customer invoices: {}", e))?;

    // Delete the customer
    let rows_affected = tx.execute("DELETE FROM customers WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete customer: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Customer with id {} not found", id));
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    log::info!("Deleted customer with id: {} and saved to trash", id);
    Ok(())
}

/// Add mock customer data for testing
#[tauri::command]
pub fn add_mock_customers(db: State<Database>) -> Result<String, String> {
    log::info!("add_mock_customers called");

    let conn = db.get_conn()?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(format!("Database already has {} customers. Skipping mock data.", count));
    }

    let now = Utc::now().to_rfc3339();

    let mock_customers = vec![
        ("Acme Corporation", Some("contact@acme.com"), Some("+1-555-0201"), Some("123 Business St, NYC"), Some("NYC")),
        ("Tech Startup Inc", Some("hello@techstartup.io"), Some("+1-555-0202"), Some("456 Innovation Ave, SF"), Some("SF")),
        ("Global Retail Co", Some("orders@globalretail.com"), Some("+1-555-0203"), Some("789 Commerce Blvd, LA"), Some("LA")),
        ("Local Small Business", Some("info@localsmb.com"), Some("+1-555-0204"), Some("321 Main St, Austin"), Some("Austin")),
        ("Enterprise Solutions Ltd", Some("sales@enterprise.com"), Some("+1-555-0205"), Some("654 Corporate Dr, Boston"), Some("Boston")),
    ];

    let mut inserted = 0;
    for (name, email, phone, address, place) in mock_customers {
        conn.execute(
            "INSERT INTO customers (name, email, phone, address, place, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (name, email, phone, address, place, &now, &now),
        )
        .map_err(|e| format!("Failed to insert mock customer: {}", e))?;
        inserted += 1;
    }

    log::info!("Added {} mock customers", inserted);
    Ok(format!("Successfully added {} mock customers", inserted))
}
