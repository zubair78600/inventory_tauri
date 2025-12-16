/// FIFO Inventory Service
/// Handles FIFO cost calculation, batch management, and inventory transactions

use rusqlite::{Connection, params, OptionalExtension};
use chrono::Utc;

use crate::db::models::{
    InventoryBatch, InventoryTransaction, FifoCostBreakdown, FifoSaleResult,
};

// =============================================
// FIFO COST CALCULATION
// =============================================

/// Calculate FIFO COGS for a sale without modifying batches
/// Returns total cost and breakdown by batch
pub fn calculate_fifo_cogs(
    conn: &Connection,
    product_id: i32,
    quantity: i32,
) -> Result<FifoSaleResult, String> {
    // Get all batches for this product, ordered by purchase date (FIFO)
    let mut stmt = conn.prepare(
        "SELECT id, quantity_remaining, unit_cost, purchase_date
         FROM inventory_batches
         WHERE product_id = ? AND quantity_remaining > 0
         ORDER BY purchase_date ASC, id ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let batches = stmt.query_map(params![product_id], |row| {
        Ok(InventoryBatch {
            id: row.get(0)?,
            product_id,
            po_item_id: None,
            quantity_remaining: row.get(1)?,
            unit_cost: row.get(2)?,
            purchase_date: row.get(3)?,
            created_at: String::new(),
        })
    }).map_err(|e| format!("Failed to query batches: {}", e))?;

    let mut remaining_to_deduct = quantity;
    let mut total_cogs = 0.0;
    let mut breakdown: Vec<FifoCostBreakdown> = Vec::new();
    let mut batches_depleted: Vec<i32> = Vec::new();

    for batch_result in batches {
        if remaining_to_deduct <= 0 {
            break;
        }

        let batch = batch_result.map_err(|e| format!("Failed to process batch: {}", e))?;

        let quantity_to_use = remaining_to_deduct.min(batch.quantity_remaining);
        let subtotal = quantity_to_use as f64 * batch.unit_cost;

        breakdown.push(FifoCostBreakdown {
            batch_id: batch.id,
            quantity_used: quantity_to_use,
            unit_cost: batch.unit_cost,
            subtotal,
        });

        total_cogs += subtotal;
        remaining_to_deduct -= quantity_to_use;

        // Track if batch will be fully depleted
        if quantity_to_use >= batch.quantity_remaining {
            batches_depleted.push(batch.id);
        }
    }

    if remaining_to_deduct > 0 {
        log::warn!("Insufficient inventory batches for product {}. calculated partial COGS. Missing: {}", product_id, remaining_to_deduct);
    }

    Ok(FifoSaleResult {
        total_cogs,
        breakdown,
        batches_depleted,
    })
}

/// Record a sale and update batches using FIFO
/// Returns the total COGS
pub fn record_sale_fifo(
    conn: &Connection,
    product_id: i32,
    quantity_sold: i32,
    sale_date: &str,
    invoice_id: i32,
) -> Result<f64, String> {
    // Calculate FIFO cost first
    let fifo_result = calculate_fifo_cogs(conn, product_id, quantity_sold)?;

    // Now actually update the batches
    for breakdown in &fifo_result.breakdown {
        let new_quantity = conn.query_row(
            "SELECT quantity_remaining FROM inventory_batches WHERE id = ?",
            params![breakdown.batch_id],
            |row| row.get::<_, i32>(0),
        ).map_err(|e| format!("Failed to get batch quantity: {}", e))?;

        let updated_quantity = new_quantity - breakdown.quantity_used;

        if updated_quantity <= 0 {
            // Delete fully depleted batch
            conn.execute(
                "DELETE FROM inventory_batches WHERE id = ?",
                params![breakdown.batch_id],
            ).map_err(|e| format!("Failed to delete batch: {}", e))?;
        } else {
            // Update remaining quantity
            conn.execute(
                "UPDATE inventory_batches SET quantity_remaining = ? WHERE id = ?",
                params![updated_quantity, breakdown.batch_id],
            ).map_err(|e| format!("Failed to update batch: {}", e))?;
        }
    }

    // Get updated stock quantity
    let current_stock: i32 = conn.query_row(
        "SELECT stock_quantity FROM products WHERE id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get stock quantity: {}", e))?;

    let balance_after = current_stock;

    // Create inventory transaction record
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO inventory_transactions
         (product_id, transaction_type, quantity_change, unit_cost, reference_type,
          reference_id, balance_after, transaction_date, created_at)
         VALUES (?, 'sale', ?, ?, 'invoice', ?, ?, ?, ?)",
        params![
            product_id,
            -quantity_sold, // Negative for sales
            fifo_result.total_cogs / quantity_sold as f64, // Average cost
            invoice_id,
            balance_after,
            sale_date,
            now,
        ],
    ).map_err(|e| format!("Failed to create transaction: {}", e))?;

    Ok(fifo_result.total_cogs)
}

// =============================================
// PURCHASE RECORDING
// =============================================

/// Record a purchase and create inventory batch
pub fn record_purchase(
    conn: &Connection,
    product_id: i32,
    quantity: i32,
    unit_cost: f64,
    po_item_id: Option<i32>,
    purchase_date: &str,
) -> Result<i32, String> {
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Create inventory batch
    conn.execute(
        "INSERT INTO inventory_batches
         (product_id, po_item_id, quantity_remaining, unit_cost, purchase_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![product_id, po_item_id, quantity, unit_cost, purchase_date, now],
    ).map_err(|e| format!("Failed to create batch: {}", e))?;

    let batch_id = conn.last_insert_rowid() as i32;

    // Get current stock
    let current_stock: i32 = conn.query_row(
        "SELECT stock_quantity FROM products WHERE id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get stock quantity: {}", e))?;

    let balance_after = current_stock + quantity;

    // Create inventory transaction
    conn.execute(
        "INSERT INTO inventory_transactions
         (product_id, transaction_type, quantity_change, unit_cost, reference_type,
          reference_id, balance_after, transaction_date, created_at)
         VALUES (?, 'purchase', ?, ?, 'purchase_order', ?, ?, ?, ?)",
        params![
            product_id,
            quantity,
            unit_cost,
            po_item_id,
            balance_after,
            purchase_date,
            now,
        ],
    ).map_err(|e| format!("Failed to create transaction: {}", e))?;

    Ok(batch_id)
}

/// Restore stock from a deleted invoice (Reverse FIFO Sale)
pub fn restore_stock_from_invoice(
    conn: &Connection,
    product_id: i32,
    quantity: i32,
    invoice_id: i32,
) -> Result<(), String> {
    // 1. Find the original 'sale' transaction for this invoice to get the unit cost (COGS)
    // We expect one 'sale' transaction per product per invoice usually.
    // If there are multiple (split transactions?), we aggregate?
    // Usually record_sale_fifo creates ONE 'sale' transaction per product line item.
    let transaction: Option<(i32, f64)> = conn.query_row(
        "SELECT id, unit_cost FROM inventory_transactions 
         WHERE reference_type = 'invoice' AND reference_id = ? AND product_id = ? AND transaction_type = 'sale'",
        params![invoice_id, product_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|e| format!("Failed to find transaction: {}", e))?;

    let (transaction_id, unit_cost) = match transaction {
        Some(t) => t,
        None => {
            // Fallback: If no transaction found (maybe legacy data?), use current average cost or 0?
            // Safer to use 0 or current stock cost?
            // Let's use 0 ensures we don't inflate value artificially if unknown.
            // But this effectively "gifts" stock back.
            (0, 0.0)
        }
    };

    // 2. Create a "Restock" batch using the original cost
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let purchase_date = Utc::now().format("%Y-%m-%d").to_string();

    conn.execute(
        "INSERT INTO inventory_batches
         (product_id, po_item_id, quantity_remaining, unit_cost, purchase_date, created_at)
         VALUES (?, NULL, ?, ?, ?, ?)",
        params![product_id, quantity, unit_cost, purchase_date, now],
    ).map_err(|e| format!("Failed to create restock batch: {}", e))?;

    // 3. Update Product Stock Quantity
    conn.execute(
        "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
        params![quantity, product_id],
    ).map_err(|e| format!("Failed to restock product: {}", e))?;

    // 4. Delete the original 'sale' transaction to clean up history
    // We do NOT add a new 'restock' transaction because we prefer to void the 'sale'.
    if transaction_id > 0 {
        conn.execute(
            "DELETE FROM inventory_transactions WHERE id = ?",
            params![transaction_id],
        ).map_err(|e| format!("Failed to delete transaction: {}", e))?;
    }

    Ok(())
}

// =============================================
// INVENTORY VALUATION
// =============================================

/// Get current inventory value for a product using FIFO
pub fn get_product_inventory_value(
    conn: &Connection,
    product_id: i32,
) -> Result<f64, String> {
    let value: f64 = conn.query_row(
        "SELECT COALESCE(SUM(quantity_remaining * unit_cost), 0.0)
         FROM inventory_batches
         WHERE product_id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to calculate inventory value: {}", e))?;

    Ok(value)
}

/// Get total inventory value for all products or specific product
pub fn get_inventory_value(
    conn: &Connection,
    product_id: Option<i32>,
) -> Result<f64, String> {
    let value: f64 = match product_id {
        Some(pid) => get_product_inventory_value(conn, pid)?,
        None => conn.query_row(
            "SELECT COALESCE(SUM(quantity_remaining * unit_cost), 0.0)
             FROM inventory_batches",
            [],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to calculate total inventory value: {}", e))?,
    };

    Ok(value)
}

/// Get average cost per unit for a product
pub fn get_average_cost(
    conn: &Connection,
    product_id: i32,
) -> Result<f64, String> {
    let result: (Option<f64>, Option<i32>) = conn.query_row(
        "SELECT SUM(quantity_remaining * unit_cost), SUM(quantity_remaining)
         FROM inventory_batches
         WHERE product_id = ?",
        params![product_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Failed to calculate average cost: {}", e))?;

    match result {
        (Some(total_value), Some(total_qty)) if total_qty > 0 => {
            Ok(total_value / total_qty as f64)
        }
        _ => Ok(0.0),
    }
}

// =============================================
// BATCH MANAGEMENT
// =============================================

/// Get all active batches for a product
pub fn get_product_batches(
    conn: &Connection,
    product_id: i32,
) -> Result<Vec<InventoryBatch>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, product_id, po_item_id, quantity_remaining, unit_cost,
                purchase_date, created_at
         FROM inventory_batches
         WHERE product_id = ? AND quantity_remaining > 0
         ORDER BY purchase_date ASC, id ASC"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let batches = stmt.query_map(params![product_id], |row| {
        Ok(InventoryBatch {
            id: row.get(0)?,
            product_id: row.get(1)?,
            po_item_id: row.get(2)?,
            quantity_remaining: row.get(3)?,
            unit_cost: row.get(4)?,
            purchase_date: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| format!("Failed to query batches: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect batches: {}", e))?;

    Ok(batches)
}

/// Get inventory transactions for a product
pub fn get_product_transactions(
    conn: &Connection,
    product_id: i32,
    limit: Option<i32>,
) -> Result<Vec<InventoryTransaction>, String> {
    let query = if let Some(lim) = limit {
        format!(
            "SELECT id, product_id, transaction_type, quantity_change, unit_cost,
                    reference_type, reference_id, balance_after, transaction_date,
                    notes, created_at
             FROM inventory_transactions
             WHERE product_id = ?
             ORDER BY transaction_date DESC, id DESC
             LIMIT {}",
            lim
        )
    } else {
        "SELECT id, product_id, transaction_type, quantity_change, unit_cost,
                reference_type, reference_id, balance_after, transaction_date,
                notes, created_at
         FROM inventory_transactions
         WHERE product_id = ?
         ORDER BY transaction_date DESC, id DESC".to_string()
    };

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let transactions = stmt.query_map(params![product_id], |row| {
        Ok(InventoryTransaction {
            id: row.get(0)?,
            product_id: row.get(1)?,
            transaction_type: row.get(2)?,
            quantity_change: row.get(3)?,
            unit_cost: row.get(4)?,
            reference_type: row.get(5)?,
            reference_id: row.get(6)?,
            balance_after: row.get(7)?,
            transaction_date: row.get(8)?,
            notes: row.get(9)?,
            created_at: row.get(10)?,
        })
    }).map_err(|e| format!("Failed to query transactions: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect transactions: {}", e))?;

    Ok(transactions)
}

// =============================================
// INVENTORY ADJUSTMENTS
// =============================================

/// Record an inventory adjustment (e.g., damaged goods, theft, corrections)
pub fn record_adjustment(
    conn: &Connection,
    product_id: i32,
    quantity_change: i32, // Can be positive or negative
    reason: &str,
    adjustment_date: &str,
) -> Result<(), String> {
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get current stock
    let current_stock: i32 = conn.query_row(
        "SELECT stock_quantity FROM products WHERE id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get stock quantity: {}", e))?;

    let balance_after = current_stock + quantity_change;

    if balance_after < 0 {
        return Err("Adjustment would result in negative stock".to_string());
    }

    // Create transaction record
    conn.execute(
        "INSERT INTO inventory_transactions
         (product_id, transaction_type, quantity_change, reference_type,
          balance_after, transaction_date, notes, created_at)
         VALUES (?, 'adjustment', ?, 'manual', ?, ?, ?, ?)",
        params![
            product_id,
            quantity_change,
            balance_after,
            adjustment_date,
            reason,
            now,
        ],
    ).map_err(|e| format!("Failed to create adjustment transaction: {}", e))?;

    // Update product stock
    conn.execute(
        "UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?",
        params![balance_after, now, product_id],
    ).map_err(|e| format!("Failed to update product stock: {}", e))?;

    // If it's a positive adjustment, create a batch
    if quantity_change > 0 {
        let avg_cost = get_average_cost(conn, product_id).unwrap_or(0.0);
        record_purchase(conn, product_id, quantity_change, avg_cost, None, adjustment_date)?;
    }

    Ok(())
}

// =============================================
// VALIDATION HELPERS
// =============================================

/// Validate that stock_quantity matches sum of batch quantities
pub fn validate_stock_consistency(
    conn: &Connection,
    product_id: i32,
) -> Result<bool, String> {
    let product_stock: i32 = conn.query_row(
        "SELECT stock_quantity FROM products WHERE id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get product stock: {}", e))?;

    let batch_total: i32 = conn.query_row(
        "SELECT COALESCE(SUM(quantity_remaining), 0)
         FROM inventory_batches
         WHERE product_id = ?",
        params![product_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get batch total: {}", e))?;

    Ok(product_stock == batch_total)
}

/// Get products with stock inconsistencies
pub fn get_inconsistent_products(conn: &Connection) -> Result<Vec<i32>, String> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.stock_quantity, COALESCE(SUM(ib.quantity_remaining), 0) as batch_total
         FROM products p
         LEFT JOIN inventory_batches ib ON p.id = ib.product_id
         GROUP BY p.id
         HAVING p.stock_quantity != batch_total"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let product_ids = stmt.query_map([], |row| row.get::<_, i32>(0))
        .map_err(|e| format!("Failed to query inconsistent products: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect product IDs: {}", e))?;

    Ok(product_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fifo_calculation() {
        // TODO: Add unit tests for FIFO logic
    }
}
