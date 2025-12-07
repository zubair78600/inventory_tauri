use crate::db::{Database, User};
use sha2::{Sha256, Digest};
use tauri::State;
use uuid::Uuid;

/// Generate a secure token for biometric enrollment
/// Returns the raw token (to be stored in OS secure storage by frontend)
#[tauri::command]
pub fn generate_biometric_token(user_id: i32, db: State<Database>) -> Result<String, String> {
    log::info!("generate_biometric_token called for user_id: {}", user_id);

    let conn = db.get_conn()?;

    // Verify user exists
    let user_exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE id = ?1",
            [user_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if user_exists == 0 {
        return Err("User not found".to_string());
    }

    // Generate secure random token
    let token = Uuid::new_v4().to_string();

    // Hash the token for storage
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    // Store hash in database and enable biometric
    conn.execute(
        "UPDATE users SET biometric_token_hash = ?1, biometric_enabled = 1 WHERE id = ?2",
        (&token_hash, user_id),
    )
    .map_err(|e| format!("Failed to save biometric token: {}", e))?;

    log::info!("Biometric token generated and stored for user_id: {}", user_id);

    // Return raw token - frontend will store in OS secure storage
    Ok(token)
}

/// Verify biometric token and return user if valid
#[tauri::command]
pub fn verify_biometric_token(token: String, db: State<Database>) -> Result<User, String> {
    log::info!("verify_biometric_token called");

    let conn = db.get_conn()?;

    // Hash the provided token
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    let token_hash = hex::encode(hasher.finalize());

    // Find user with matching token hash
    let user = conn
        .query_row(
            "SELECT id, username, role, permissions, created_at FROM users
             WHERE biometric_token_hash = ?1 AND biometric_enabled = 1",
            [&token_hash],
            |row| {
                Ok(User {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    role: row.get(2)?,
                    permissions: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .map_err(|_| "Invalid biometric token".to_string())?;

    log::info!("Biometric login successful for user: {}", user.username);

    Ok(user)
}

/// Disable biometric authentication for a user
#[tauri::command]
pub fn disable_biometric(user_id: i32, db: State<Database>) -> Result<(), String> {
    log::info!("disable_biometric called for user_id: {}", user_id);

    let conn = db.get_conn()?;

    conn.execute(
        "UPDATE users SET biometric_enabled = 0, biometric_token_hash = NULL WHERE id = ?1",
        [user_id],
    )
    .map_err(|e| format!("Failed to disable biometric: {}", e))?;

    log::info!("Biometric disabled for user_id: {}", user_id);

    Ok(())
}

/// Check if biometric is enabled for a user
#[tauri::command]
pub fn get_biometric_status(user_id: i32, db: State<Database>) -> Result<bool, String> {
    log::info!("get_biometric_status called for user_id: {}", user_id);

    let conn = db.get_conn()?;

    let enabled: i32 = conn
        .query_row(
            "SELECT biometric_enabled FROM users WHERE id = ?1",
            [user_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(enabled == 1)
}

/// Check if biometric is enabled for a specific username
/// Used on login page to check if the entered user has biometric enabled
#[tauri::command]
pub fn get_biometric_status_by_username(username: String, db: State<Database>) -> Result<bool, String> {
    log::info!("get_biometric_status_by_username called for username: {}", username);

    let conn = db.get_conn()?;

    let enabled: i32 = conn
        .query_row(
            "SELECT biometric_enabled FROM users WHERE LOWER(username) = LOWER(?1)",
            [&username],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(enabled == 1)
}

/// Check if any user has biometric enabled on this device
/// Used on login page to show/hide fingerprint button
#[tauri::command]
pub fn has_any_biometric_enrollment(db: State<Database>) -> Result<bool, String> {
    log::info!("has_any_biometric_enrollment called");

    let conn = db.get_conn()?;

    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE biometric_enabled = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(count > 0)
}
