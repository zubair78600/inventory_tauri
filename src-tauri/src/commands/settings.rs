use std::collections::HashMap;
use tauri::State;
use crate::db::Database;

/// Get a single app setting by key
#[tauri::command]
pub fn get_app_setting(key: String, db: State<Database>) -> Result<Option<String>, String> {
    let conn = db.get_conn()?;

    let result = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [&key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to get setting: {}", e))?;

    Ok(result)
}

/// Set an app setting (insert or update)
#[tauri::command]
pub fn set_app_setting(key: String, value: String, db: State<Database>) -> Result<(), String> {
    let conn = db.get_conn()?;

    conn.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        [&key, &value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;

    Ok(())
}

/// Get all app settings as a key-value map
#[tauri::command]
pub fn get_all_settings(db: State<Database>) -> Result<HashMap<String, String>, String> {
    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM app_settings")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let settings_iter = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?;

    let mut settings = HashMap::new();
    for setting in settings_iter {
        if let Ok((key, value)) = setting {
            settings.insert(key, value);
        }
    }

    Ok(settings)
}

/// Delete an app setting by key
#[tauri::command]
pub fn delete_app_setting(key: String, db: State<Database>) -> Result<(), String> {
    let conn = db.get_conn()?;

    conn.execute("DELETE FROM app_settings WHERE key = ?1", [&key])
        .map_err(|e| format!("Failed to delete setting: {}", e))?;

    Ok(())
}

/// Export all settings as a JSON string
#[tauri::command]
pub fn export_settings_json(db: State<Database>) -> Result<String, String> {
    let settings = get_all_settings(db)?;
    serde_json::to_string_pretty(&settings).map_err(|e| format!("Failed to serialize settings: {}", e))
}

/// Import settings from a JSON string
#[tauri::command]
pub fn import_settings_json(json_content: String, db: State<Database>) -> Result<usize, String> {
    let settings: HashMap<String, String> = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let conn = db.get_conn()?;
    let mut count = 0;

    // Use a transaction to ensure all or nothing
    conn.execute_batch("BEGIN TRANSACTION;")
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for (key, value) in settings {
        // We use set_app_setting logic inline or call it if we could, but let's just do the insert/update here
        // to avoid borrowing issues if we reused the public fn which takes State
        let result = conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
            [&key, &value],
        );

        if let Err(e) = result {
            let _ = conn.execute_batch("ROLLBACK;");
            return Err(format!("Failed to save setting '{}': {}", key, e));
        }
        count += 1;
    }

    conn.execute_batch("COMMIT;")
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(count)
}

// Add the optional extension trait for rusqlite queries
trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
