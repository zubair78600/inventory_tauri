use rusqlite::{params, Transaction};
use serde::Serialize;
use chrono::Utc;

/// Archive an entity to the deleted_items table.
/// This function should be called within a transaction just before the DELETE operation.
pub fn archive_entity<T: Serialize>(
    tx: &Transaction,
    entity_type: &str,
    entity_id: i32,
    entity_data: &T,
    related_data: Option<String>,
    deleted_by: Option<String>,
) -> Result<(), String> {
    let entity_json = serde_json::to_string(entity_data)
        .map_err(|e| format!("Failed to serialize {} data: {}", entity_type, e))?;

    let now = Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO deleted_items (entity_type, entity_id, entity_data, related_data, deleted_at, deleted_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            entity_type,
            entity_id,
            entity_json,
            related_data,
            now,
            deleted_by
        ],
    )
    .map_err(|e| format!("Failed to archive {}: {}", entity_type, e))?;

    Ok(())
}
