use serde::{Deserialize, Serialize};

/// Product model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub stock_quantity: i32,
    pub supplier_id: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

/// Supplier model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i32,
    pub name: String,
    pub contact_info: Option<String>,
    pub address: Option<String>,
    pub email: Option<String>,
    pub comments: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Customer model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: i32,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub place: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Invoice model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: i32,
    pub invoice_number: String,
    pub customer_id: Option<i32>,
    pub total_amount: f64,
    pub tax_amount: f64,
    pub discount_amount: f64,
    pub payment_method: Option<String>,
    pub created_at: String,
    // GST fields
    pub cgst_amount: Option<f64>,
    pub fy_year: Option<String>,
    pub gst_rate: Option<f64>,
    pub igst_amount: Option<f64>,
    pub sgst_amount: Option<f64>,
    // Location fields
    pub state: Option<String>,
    pub district: Option<String>,
    pub town: Option<String>,
}

/// InvoiceItem model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub id: i32,
    pub invoice_id: i32,
    pub product_id: i32,
    pub quantity: i32,
    pub unit_price: f64,
}

/// InvoiceItem with product details (for frontend display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItemWithProduct {
    pub id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub sku: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub total: f64,
}

/// Deleted Item model for audit trail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeletedItem {
    pub id: i32,
    pub entity_type: String,
    pub entity_id: i32,
    pub entity_data: String,
    pub related_data: Option<String>,
    pub deleted_at: String,
    pub deleted_by: Option<String>,
}

/// User model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub role: String,
    pub permissions: String, // JSON string
    pub created_at: String,
}
