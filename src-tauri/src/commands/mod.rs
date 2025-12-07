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
