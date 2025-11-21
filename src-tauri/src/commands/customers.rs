use crate::db::{Database, Customer};
use serde::{Deserialize, Serialize};
use tauri::State;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCustomerInput {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateCustomerInput {
    pub id: i32,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
}

/// Get all customers, optionally filtered by search query
#[tauri::command]
pub fn get_customers(search: Option<String>, db: State<Database>) -> Result<Vec<Customer>, String> {
    log::info!("get_customers called with search: {:?}", search);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let mut customers = Vec::new();

    if let Some(search_term) = search {
        let search_pattern = format!("%{}%", search_term);
        let mut stmt = conn
            .prepare("SELECT id, name, email, phone, address, created_at, updated_at FROM customers WHERE name LIKE ?1 OR email LIKE ?1 OR phone LIKE ?1 ORDER BY name")
            .map_err(|e| e.to_string())?;

        let customer_iter = stmt
            .query_map([&search_pattern], |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for customer in customer_iter {
            customers.push(customer.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare("SELECT id, name, email, phone, address, created_at, updated_at FROM customers ORDER BY name")
            .map_err(|e| e.to_string())?;

        let customer_iter = stmt
            .query_map([], |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for customer in customer_iter {
            customers.push(customer.map_err(|e| e.to_string())?);
        }
    }

    log::info!("Returning {} customers", customers.len());
    Ok(customers)
}

/// Get a single customer by ID
#[tauri::command]
pub fn get_customer(id: i32, db: State<Database>) -> Result<Customer, String> {
    log::info!("get_customer called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let customer = conn
        .query_row(
            "SELECT id, name, email, phone, address, created_at, updated_at FROM customers WHERE id = ?1",
            [id],
            |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    address: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| format!("Customer not found: {}", e))?;

    Ok(customer)
}

/// Create a new customer
#[tauri::command]
pub fn create_customer(input: CreateCustomerInput, db: State<Database>) -> Result<Customer, String> {
    log::info!("create_customer called with: {:?}", input);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO customers (name, email, phone, address, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&input.name, &input.email, &input.phone, &input.address, &now, &now),
    )
    .map_err(|e| format!("Failed to create customer: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let customer = Customer {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        created_at: now.clone(),
        updated_at: now,
    };

    log::info!("Created customer with id: {}", id);
    Ok(customer)
}

/// Update an existing customer
#[tauri::command]
pub fn update_customer(input: UpdateCustomerInput, db: State<Database>) -> Result<Customer, String> {
    log::info!("update_customer called with: {:?}", input);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let now = Utc::now().to_rfc3339();

    let rows_affected = conn
        .execute(
            "UPDATE customers SET name = ?1, email = ?2, phone = ?3, address = ?4, updated_at = ?5 WHERE id = ?6",
            (&input.name, &input.email, &input.phone, &input.address, &now, input.id),
        )
        .map_err(|e| format!("Failed to update customer: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Customer with id {} not found", input.id));
    }

    // Get created_at from database
    let created_at: String = conn
        .query_row(
            "SELECT created_at FROM customers WHERE id = ?1",
            [input.id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let customer = Customer {
        id: input.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        created_at,
        updated_at: now,
    };

    log::info!("Updated customer with id: {}", input.id);
    Ok(customer)
}

/// Delete a customer by ID
#[tauri::command]
pub fn delete_customer(id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("delete_customer called with id: {}", id);

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    // Check if customer has any invoices
    let invoice_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices WHERE customer_id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if invoice_count > 0 {
        return Err(format!(
            "Cannot delete customer: {} invoice(s) are linked to this customer",
            invoice_count
        ));
    }

    let rows_affected = conn
        .execute("DELETE FROM customers WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete customer: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Customer with id {} not found", id));
    }

    log::info!("Deleted customer with id: {}", id);
    Ok(())
}

/// Add mock customer data for testing
#[tauri::command]
pub fn add_mock_customers(db: State<Database>) -> Result<String, String> {
    log::info!("add_mock_customers called");

    let conn = db.conn();
    let conn = conn.lock().map_err(|e| format!("Failed to lock database: {}", e))?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(format!("Database already has {} customers. Skipping mock data.", count));
    }

    let now = Utc::now().to_rfc3339();

    let mock_customers = vec![
        ("Acme Corporation", Some("contact@acme.com"), Some("+1-555-0201"), Some("123 Business St, NYC")),
        ("Tech Startup Inc", Some("hello@techstartup.io"), Some("+1-555-0202"), Some("456 Innovation Ave, SF")),
        ("Global Retail Co", Some("orders@globalretail.com"), Some("+1-555-0203"), Some("789 Commerce Blvd, LA")),
        ("Local Small Business", Some("info@localsmb.com"), Some("+1-555-0204"), Some("321 Main St, Austin")),
        ("Enterprise Solutions Ltd", Some("sales@enterprise.com"), Some("+1-555-0205"), Some("654 Corporate Dr, Boston")),
    ];

    let mut inserted = 0;
    for (name, email, phone, address) in mock_customers {
        conn.execute(
            "INSERT INTO customers (name, email, phone, address, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (name, email, phone, address, &now, &now),
        )
        .map_err(|e| format!("Failed to insert mock customer: {}", e))?;
        inserted += 1;
    }

    log::info!("Added {} mock customers", inserted);
    Ok(format!("Successfully added {} mock customers", inserted))
}
