use crate::db::models::{CustomerCreditSummary, CustomerInvoiceCreditSummary, CustomerPayment};
use crate::db::Database;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateCustomerPaymentInput {
    pub customer_id: i32,
    pub invoice_id: i32,
    pub amount: f64,
    pub payment_method: Option<String>,
    pub note: Option<String>,
    pub paid_at: Option<String>,
}

/// Create a payment record for a customer invoice (credit payment)
#[tauri::command]
pub fn create_customer_payment(
    input: CreateCustomerPaymentInput,
    db: State<Database>,
) -> Result<CustomerPayment, String> {
    log::info!(
        "create_customer_payment called for customer_id: {}, invoice_id: {}, amount: {}",
        input.customer_id,
        input.invoice_id,
        input.amount
    );

    if input.amount <= 0.0 {
        return Err("Amount must be greater than zero".into());
    }

    let conn = db.get_conn()?;

    // Verify the invoice exists and belongs to this customer
    let invoice_check: Result<(i32, Option<i32>), _> = conn.query_row(
        "SELECT id, customer_id FROM invoices WHERE id = ?1",
        [input.invoice_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    match invoice_check {
        Ok((_, cust_id)) => {
            if cust_id != Some(input.customer_id) {
                return Err("Invoice does not belong to this customer".into());
            }
        }
        Err(_) => {
            return Err("Invoice not found".into());
        }
    }

    let paid_at = input.paid_at.unwrap_or_else(|| Utc::now().to_rfc3339());

    conn.execute(
        "INSERT INTO customer_payments (customer_id, invoice_id, amount, payment_method, note, paid_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
        (
            input.customer_id,
            input.invoice_id,
            input.amount,
            input.payment_method.as_deref(),
            input.note.as_deref(),
            &paid_at,
        ),
    )
    .map_err(|e| format!("Failed to create customer payment: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    let payment = conn
        .query_row(
            "SELECT cp.id, cp.customer_id, cp.invoice_id, i.invoice_number, cp.amount, cp.payment_method, cp.note, cp.paid_at, cp.created_at
             FROM customer_payments cp
             JOIN invoices i ON cp.invoice_id = i.id
             WHERE cp.id = ?1",
            [id],
            |row| {
                Ok(CustomerPayment {
                    id: row.get(0)?,
                    customer_id: row.get(1)?,
                    invoice_id: row.get(2)?,
                    invoice_number: row.get(3)?,
                    amount: row.get(4)?,
                    payment_method: row.get(5)?,
                    note: row.get(6)?,
                    paid_at: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created customer payment: {}", e))?;

    Ok(payment)
}

/// Get all payments for a customer
#[tauri::command]
pub fn get_customer_payments(
    customer_id: i32,
    db: State<Database>,
) -> Result<Vec<CustomerPayment>, String> {
    log::info!("get_customer_payments called for customer_id: {}", customer_id);

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT cp.id, cp.customer_id, cp.invoice_id, i.invoice_number, cp.amount, cp.payment_method, cp.note, cp.paid_at, cp.created_at
             FROM customer_payments cp
             JOIN invoices i ON cp.invoice_id = i.id
             WHERE cp.customer_id = ?1
             ORDER BY cp.paid_at DESC, cp.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let payment_iter = stmt
        .query_map([customer_id], |row| {
            Ok(CustomerPayment {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                invoice_id: row.get(2)?,
                invoice_number: row.get(3)?,
                amount: row.get(4)?,
                payment_method: row.get(5)?,
                note: row.get(6)?,
                paid_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for payment in payment_iter {
        payments.push(payment.map_err(|e| e.to_string())?);
    }

    Ok(payments)
}

/// Get payments for a specific invoice
#[tauri::command]
pub fn get_invoice_payments(
    invoice_id: i32,
    db: State<Database>,
) -> Result<Vec<CustomerPayment>, String> {
    log::info!("get_invoice_payments called for invoice_id: {}", invoice_id);

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT cp.id, cp.customer_id, cp.invoice_id, i.invoice_number, cp.amount, cp.payment_method, cp.note, cp.paid_at, cp.created_at
             FROM customer_payments cp
             JOIN invoices i ON cp.invoice_id = i.id
             WHERE cp.invoice_id = ?1
             ORDER BY cp.paid_at DESC, cp.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let payment_iter = stmt
        .query_map([invoice_id], |row| {
            Ok(CustomerPayment {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                invoice_id: row.get(2)?,
                invoice_number: row.get(3)?,
                amount: row.get(4)?,
                payment_method: row.get(5)?,
                note: row.get(6)?,
                paid_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut payments = Vec::new();
    for payment in payment_iter {
        payments.push(payment.map_err(|e| e.to_string())?);
    }

    Ok(payments)
}

/// Get credit history for a customer (all invoices with credit/partial payments)
#[tauri::command]
pub fn get_customer_credit_history(
    customer_id: i32,
    db: State<Database>,
) -> Result<Vec<CustomerInvoiceCreditSummary>, String> {
    log::info!(
        "get_customer_credit_history called for customer_id: {}",
        customer_id
    );

    let conn = db.get_conn()?;

    // Get all credit invoices (where credit_amount > 0 or payment_method = 'Credit')
    let mut stmt = conn
        .prepare(
            "SELECT
                i.id,
                i.invoice_number,
                i.created_at,
                i.total_amount,
                COALESCE(i.initial_paid, 0) as initial_paid,
                COALESCE(i.credit_amount, 0) as credit_amount,
                COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp WHERE cp.invoice_id = i.id), 0) as payments_sum
             FROM invoices i
             WHERE i.customer_id = ?1
               AND (i.credit_amount > 0 OR i.payment_method = 'Credit')
             ORDER BY i.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let history_iter = stmt
        .query_map([customer_id], |row| {
            let invoice_id: i32 = row.get(0)?;
            let invoice_number: String = row.get(1)?;
            let invoice_date: String = row.get(2)?;
            let bill_amount: f64 = row.get(3)?;
            let initial_paid: f64 = row.get(4)?;
            let credit_amount: f64 = row.get(5)?;
            let payments_sum: f64 = row.get(6)?;

            // Total paid = initial_paid + all subsequent payments
            let total_paid = initial_paid + payments_sum;

            // Balance remaining = credit_amount - payments_sum (only the payments after initial)
            let balance_remaining = (credit_amount - payments_sum).max(0.0);

            // Status
            let status = if balance_remaining <= 0.0 {
                "Clear".to_string()
            } else {
                "Pending".to_string()
            };

            Ok(CustomerInvoiceCreditSummary {
                invoice_id,
                invoice_number,
                invoice_date,
                bill_amount,
                initial_paid,
                credit_amount,
                total_paid,
                balance_remaining,
                status,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut history = Vec::new();
    for entry in history_iter {
        history.push(entry.map_err(|e| e.to_string())?);
    }

    Ok(history)
}

/// Get overall credit summary for a customer
#[tauri::command]
pub fn get_customer_credit_summary(
    customer_id: i32,
    db: State<Database>,
) -> Result<CustomerCreditSummary, String> {
    log::info!(
        "get_customer_credit_summary called for customer_id: {}",
        customer_id
    );

    let conn = db.get_conn()?;

    // Total credit amount (sum of all credit_amount from credit invoices)
    let total_credit_amount: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(credit_amount), 0)
             FROM invoices
             WHERE customer_id = ?1 AND (credit_amount > 0 OR payment_method = 'Credit')",
            [customer_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Total initial paid (sum of initial_paid from credit invoices)
    let total_initial_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(initial_paid), 0)
             FROM invoices
             WHERE customer_id = ?1 AND (credit_amount > 0 OR payment_method = 'Credit')",
            [customer_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Total payments made (from customer_payments table)
    let total_payments: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(cp.amount), 0)
             FROM customer_payments cp
             JOIN invoices i ON cp.invoice_id = i.id
             WHERE cp.customer_id = ?1 AND (i.credit_amount > 0 OR i.payment_method = 'Credit')",
            [customer_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_paid = total_initial_paid + total_payments;
    let pending_amount = (total_credit_amount - total_payments).max(0.0);

    Ok(CustomerCreditSummary {
        total_credit_amount,
        total_paid,
        pending_amount,
    })
}

/// Delete a customer payment
#[tauri::command]
pub fn delete_customer_payment(
    id: i32,
    deleted_by: Option<String>,
    db: State<Database>,
) -> Result<(), String> {
    log::info!(
        "delete_customer_payment called with id: {}, deleted_by: {:?}",
        id,
        deleted_by
    );

    let mut conn = db.get_conn()?;

    // Fetch payment details for audit
    let payment = conn
        .query_row(
            "SELECT cp.id, cp.customer_id, cp.invoice_id, i.invoice_number, cp.amount, cp.payment_method, cp.note, cp.paid_at, cp.created_at
             FROM customer_payments cp
             JOIN invoices i ON cp.invoice_id = i.id
             WHERE cp.id = ?1",
            [id],
            |row| {
                Ok(CustomerPayment {
                    id: row.get(0)?,
                    customer_id: row.get(1)?,
                    invoice_id: row.get(2)?,
                    invoice_number: row.get(3)?,
                    amount: row.get(4)?,
                    payment_method: row.get(5)?,
                    note: row.get(6)?,
                    paid_at: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| format!("Payment not found: {}", e))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Transaction failed: {}", e))?;

    // Archive
    crate::db::archive::archive_entity(&tx, "customer_payment", id, &payment, None, deleted_by)?;

    // Delete
    let rows_affected = tx
        .execute("DELETE FROM customer_payments WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete customer payment: {}", e))?;

    if rows_affected == 0 {
        return Err(format!("Customer payment with id {} not found", id));
    }

    tx.commit().map_err(|e| format!("Commit failed: {}", e))?;
    Ok(())
}
