pub mod products;
pub mod suppliers;
pub mod customers;
pub mod analytics;
pub mod invoices;
pub mod search;
pub mod deleted_items;
pub mod auth;
pub mod purchase_orders;
pub mod migration;
pub mod settings;
pub mod images;
pub mod biometric;
pub mod customer_payments;
pub mod ai_chat;
pub mod data_management;


use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total_count: i64,
}

pub use products::*;
pub use suppliers::*;
pub use customers::*;
pub use analytics::*;
pub use invoices::*;
pub use search::*;
pub use deleted_items::*;
pub use auth::*;
pub use purchase_orders::*;
pub use migration::*;
pub use settings::*;
pub use images::*;
pub use biometric::*;
pub use customer_payments::*;
pub use ai_chat::*;
pub use data_management::*;

