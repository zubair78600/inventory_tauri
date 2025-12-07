use serde::{Deserialize, Serialize};

/// Product model matching Prisma schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub price: f64,
    pub selling_price: Option<f64>,
    pub initial_stock: Option<i32>,
    pub stock_quantity: i32,
    pub supplier_id: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
    pub image_path: Option<String>,
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
    // Display fields (fetched via JOINs)
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub item_count: Option<i32>,
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

/// Supplier payment tracking for amounts paid to suppliers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPayment {
    pub id: i32,
    pub supplier_id: i32,
    pub product_id: Option<i32>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub note: Option<String>,
    pub paid_at: String,
    pub created_at: String,
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

// =============================================
// PURCHASE ORDER MODELS
// =============================================

/// Purchase Order model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: i32,
    pub po_number: String,
    pub supplier_id: i32,
    pub order_date: String,
    pub expected_delivery_date: Option<String>,
    pub received_date: Option<String>,
    pub status: String, // 'draft', 'ordered', 'received', 'cancelled'
    pub total_amount: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Purchase Order with supplier details (for display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderWithDetails {
    pub id: i32,
    pub po_number: String,
    pub supplier_id: i32,
    pub supplier_name: String,
    pub order_date: String,
    pub expected_delivery_date: Option<String>,
    pub received_date: Option<String>,
    pub status: String,
    pub total_amount: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub items_count: i32,
    pub total_paid: f64,
    pub total_pending: f64,
}

/// Purchase Order Item model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderItem {
    pub id: i32,
    pub po_id: i32,
    pub product_id: i32,
    pub quantity: i32,
    pub unit_cost: f64,
    pub total_cost: f64,
    pub created_at: String,
}

/// Purchase Order Item with product details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderItemWithProduct {
    pub id: i32,
    pub po_id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub sku: String,
    pub quantity: i32,
    pub unit_cost: f64,
    pub total_cost: f64,
    pub created_at: String,
}

/// Input model for creating purchase orders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseOrderInput {
    pub supplier_id: i32,
    pub items: Vec<PurchaseOrderItemInput>,
    pub order_date: Option<String>,
    pub expected_delivery_date: Option<String>,
    pub notes: Option<String>,
}

/// Input model for purchase order items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderItemInput {
    pub product_id: i32,
    pub quantity: i32,
    pub unit_cost: f64,
}

/// Complete Purchase Order with items and supplier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderComplete {
    pub purchase_order: PurchaseOrder,
    pub supplier: Supplier,
    pub items: Vec<PurchaseOrderItemWithProduct>,
    pub payments: Vec<SupplierPayment>,
    pub total_paid: f64,
    pub total_pending: f64,
}

// =============================================
// FIFO INVENTORY MODELS
// =============================================

/// Inventory Batch model (for FIFO tracking)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryBatch {
    pub id: i32,
    pub product_id: i32,
    pub po_item_id: Option<i32>,
    pub quantity_remaining: i32,
    pub unit_cost: f64,
    pub purchase_date: String,
    pub created_at: String,
}

/// Inventory Batch with PO details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryBatchWithDetails {
    pub id: i32,
    pub product_id: i32,
    pub po_item_id: Option<i32>,
    pub po_number: Option<String>,
    pub quantity_remaining: i32,
    pub unit_cost: f64,
    pub batch_value: f64, // quantity_remaining * unit_cost
    pub purchase_date: String,
    pub created_at: String,
}

/// Inventory Transaction model (audit trail)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryTransaction {
    pub id: i32,
    pub product_id: i32,
    pub transaction_type: String, // 'purchase', 'sale', 'adjustment'
    pub quantity_change: i32,    // positive for purchases, negative for sales
    pub unit_cost: Option<f64>,
    pub reference_type: Option<String>, // 'purchase_order', 'invoice', 'adjustment'
    pub reference_id: Option<i32>,
    pub balance_after: i32,
    pub transaction_date: String,
    pub notes: Option<String>,
    pub created_at: String,
}

/// FIFO Cost Breakdown (for display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoCostBreakdown {
    pub batch_id: i32,
    pub quantity_used: i32,
    pub unit_cost: f64,
    pub subtotal: f64,
}

/// FIFO Sale Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FifoSaleResult {
    pub total_cogs: f64,
    pub breakdown: Vec<FifoCostBreakdown>,
    pub batches_depleted: Vec<i32>,
}

// =============================================
// PRODUCT-SUPPLIER RELATIONSHIP
// =============================================

/// Product Supplier model (many-to-many relationship)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSupplier {
    pub id: i32,
    pub product_id: i32,
    pub supplier_id: i32,
    pub supplier_sku: Option<String>,
    pub unit_cost: Option<f64>,
    pub lead_time_days: Option<i32>,
    pub minimum_order_quantity: Option<i32>,
    pub is_preferred: bool,
    pub last_purchase_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Product Supplier with full details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSupplierWithDetails {
    pub id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub product_sku: String,
    pub supplier_id: i32,
    pub supplier_name: String,
    pub supplier_sku: Option<String>,
    pub unit_cost: Option<f64>,
    pub lead_time_days: Option<i32>,
    pub minimum_order_quantity: Option<i32>,
    pub is_preferred: bool,
    pub last_purchase_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// =============================================
// ENHANCED MODELS
// =============================================

/// Enhanced Supplier Payment with PO details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplierPaymentEnhanced {
    pub id: i32,
    pub supplier_id: i32,
    pub product_id: Option<i32>,
    pub po_id: Option<i32>,
    pub po_number: Option<String>,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub note: Option<String>,
    pub paid_at: String,
    pub created_at: String,
}

/// Product with inventory valuation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductWithInventoryValue {
    pub id: i32,
    pub name: String,
    pub sku: String,
    pub stock_quantity: i32,
    pub fifo_value: f64,
    pub average_cost: f64,
    pub batches_count: i32,
}
