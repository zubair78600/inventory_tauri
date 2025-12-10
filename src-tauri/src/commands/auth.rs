use crate::db::{Database, User};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserInput {
    pub username: String,
    pub password: String,
    pub role: String,
    pub permissions: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateUserInput {
    pub id: i32,
    pub username: String,
    pub password: Option<String>,
    pub role: String,
    pub permissions: String,
}

/// Login user
#[tauri::command]
pub fn login(input: LoginInput, db: State<Database>) -> Result<User, String> {
    log::info!("login called for user: {}", input.username);

    let conn = db.get_conn()?;

    let user = conn
        .query_row(
            "SELECT id, username, role, permissions, created_at FROM users WHERE LOWER(username) = LOWER(?1) AND password = ?2",
            [&input.username, &input.password],
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
        .map_err(|_| "Invalid username or password".to_string())?;

    Ok(user)
}

/// Get all users
#[tauri::command]
pub fn get_users(db: State<Database>) -> Result<Vec<User>, String> {
    log::info!("get_users called");

    let conn = db.get_conn()?;

    let mut stmt = conn
        .prepare("SELECT id, username, role, permissions, created_at FROM users ORDER BY username")
        .map_err(|e| e.to_string())?;

    let user_iter = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                role: row.get(2)?,
                permissions: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    for user in user_iter {
        users.push(user.map_err(|e| e.to_string())?);
    }

    Ok(users)
}

/// Create a new user
#[tauri::command]
pub fn create_user(input: CreateUserInput, db: State<Database>) -> Result<User, String> {
    log::info!("create_user called for: {}", input.username);

    let conn = db.get_conn()?;

    // Check if user already exists (case-insensitive)
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE LOWER(username) = LOWER(?1)",
            [&input.username],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if exists > 0 {
        return Err(format!("User '{}' already exists", input.username));
    }

    conn.execute(
        "INSERT INTO users (username, password, role, permissions) VALUES (?1, ?2, ?3, ?4)",
        (&input.username, &input.password, &input.role, &input.permissions),
    )
    .map_err(|e| format!("Failed to create user: {}", e))?;

    let id = conn.last_insert_rowid() as i32;

    // Return the created user (without password)
    let user = User {
        id,
        username: input.username,
        role: input.role,
        permissions: input.permissions,
        created_at: chrono::Utc::now().to_rfc3339(), // Approximate, DB has real time
    };

    Ok(user)
}

/// Update a user
#[tauri::command]
pub fn update_user(input: UpdateUserInput, db: State<Database>) -> Result<User, String> {
    log::info!("update_user called for id: {}", input.id);

    let conn = db.get_conn()?;

    if let Some(password) = input.password {
        conn.execute(
            "UPDATE users SET username = ?1, password = ?2, role = ?3, permissions = ?4 WHERE id = ?5",
            (&input.username, &password, &input.role, &input.permissions, input.id),
        )
        .map_err(|e| format!("Failed to update user: {}", e))?;
    } else {
        conn.execute(
            "UPDATE users SET username = ?1, role = ?2, permissions = ?3 WHERE id = ?4",
            (&input.username, &input.role, &input.permissions, input.id),
        )
        .map_err(|e| format!("Failed to update user: {}", e))?;
    }

    let user = User {
        id: input.id,
        username: input.username,
        role: input.role,
        permissions: input.permissions,
        created_at: "".to_string(), // We don't need to fetch this for update return
    };

    Ok(user)
}

/// Delete a user
#[tauri::command]
pub fn delete_user(id: i32, deleted_by: Option<String>, db: State<Database>) -> Result<(), String> {
    log::info!("delete_user called for id: {}", id);

    let mut conn = db.get_conn()?;

    // Get user data before deletion for audit trail
    let user = conn.query_row(
        "SELECT id, username, role, permissions, created_at FROM users WHERE id = ?1",
        [id],
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
    .map_err(|e| format!("User with id {} not found: {}", id, e))?;

    let tx = conn.transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;

    // Archive user
    crate::db::archive::archive_entity(
        &tx,
        "user",
        id,
        &user,
        None,
        deleted_by,
    )?;

    // Delete user
    // Prevent deleting the last admin or specific protected users if needed
    // For now, just delete
    tx.execute("DELETE FROM users WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete user: {}", e))?;

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}
