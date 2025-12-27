use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, NaiveTime, Utc};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken,
    PkceCodeChallenge, RedirectUrl, Scope, TokenResponse, TokenUrl,
    basic::BasicClient, reqwest::async_http_client,
};
// Removed unused imports Form, Part
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter, State};
use tokio::sync::RwLock;
use zip::write::FileOptions;
use zip::CompressionMethod;
use futures_util::StreamExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use rusqlite::Row;

use crate::db::Database;

// ============================================================================
// Types and Structs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleDriveTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupStatus {
    pub is_authenticated: bool,
    pub last_backup_time: Option<String>,
    pub last_backup_status: String,
    pub last_error: Option<String>,
    pub next_scheduled: Option<String>,
    pub backup_size_mb: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub backup_time: String,
    pub custom_folders: Vec<String>,
    pub retention_days: i32,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            backup_time: "02:00".to_string(),
            custom_folders: vec![],
            retention_days: 7,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveBackupFile {
    pub id: String,
    pub name: String,
    pub created_time: String,
    pub size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleCredentials {
    installed: InstalledCredentials,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InstalledCredentials {
    client_id: String,
    client_secret: String,
    auth_uri: Option<String>,
    token_uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DriveFileList {
    files: Option<Vec<DriveFile>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveFile {
    id: String,
    name: String,
    created_time: Option<String>,
    size: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DriveFolder {
    id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BackupNotification {
    pub notification_type: String,
    pub title: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransferProgress {
    pub processed_bytes: u64,
    pub total_bytes: u64,
}

// Global state for backup scheduler
pub struct BackupSchedulerState {
    pub cancel_flag: Arc<RwLock<bool>>,
    pub is_running: Arc<RwLock<bool>>,
}

impl Default for BackupSchedulerState {
    fn default() -> Self {
        Self {
            cancel_flag: Arc::new(RwLock::new(false)),
            is_running: Arc::new(RwLock::new(false)),
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_app_data_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

fn get_setting(db: &Database, key: &str) -> Option<String> {
    let conn = db.get_conn().ok()?;
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        [key],
        |row: &Row| row.get(0),
    ).ok()
}

fn set_setting(db: &Database, key: &str, value: &str) -> Result<(), String> {
    let conn = db.get_conn()?;
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
        [key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_tokens_from_keyring(username: &str) -> Option<GoogleDriveTokens> {
    let entry = keyring::Entry::new("inventory-app-gdrive", username).ok()?;
    let token_json = entry.get_password().ok()?;
    serde_json::from_str(&token_json).ok()
}

fn save_tokens_to_keyring(username: &str, tokens: &GoogleDriveTokens) -> Result<(), String> {
    let entry = keyring::Entry::new("inventory-app-gdrive", username)
        .map_err(|e| format!("Keyring error: {}", e))?;
    let token_json = serde_json::to_string(tokens)
        .map_err(|e| format!("Serialization error: {}", e))?;
    entry.set_password(&token_json)
        .map_err(|e| format!("Failed to save tokens: {}", e))
}

fn delete_tokens_from_keyring(username: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("inventory-app-gdrive", username)
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.delete_password().ok(); // Ignore errors if not exists
    Ok(())
}

async fn refresh_access_token(tokens: &GoogleDriveTokens, credentials: &GoogleCredentials) -> Result<GoogleDriveTokens, String> {
    let client = reqwest::Client::new();

    let params = [
        ("client_id", credentials.installed.client_id.as_str()),
        ("client_secret", credentials.installed.client_secret.as_str()),
        ("refresh_token", tokens.refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ];

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let error_text: String = response.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed: {}", error_text));
    }

    #[derive(Deserialize)]
    struct RefreshResponse {
        access_token: String,
        expires_in: i64,
    }

    let refresh_resp: RefreshResponse = response.json::<RefreshResponse>().await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    Ok(GoogleDriveTokens {
        access_token: refresh_resp.access_token,
        refresh_token: tokens.refresh_token.clone(),
        expires_at: Utc::now().timestamp() + refresh_resp.expires_in,
    })
}

async fn get_valid_tokens(db: &Database) -> Result<(GoogleDriveTokens, GoogleCredentials), String> {
    let creds_json = get_setting(db, "gdrive_credentials_json")
        .ok_or("Google Drive credentials not configured")?;

    let credentials: GoogleCredentials = serde_json::from_str(&creds_json)
        .map_err(|e| format!("Invalid credentials JSON: {}", e))?;

    let mut tokens = get_tokens_from_keyring("default")
        .ok_or("Not authenticated with Google Drive")?;

    // Check if token needs refresh (with 60 second buffer)
    if Utc::now().timestamp() > tokens.expires_at - 60 {
        tokens = refresh_access_token(&tokens, &credentials).await?;
        save_tokens_to_keyring("default", &tokens)?;
    }

    Ok((tokens, credentials))
}

// ============================================================================
// ZIP Compression
// ============================================================================

fn create_backup_zip(
    app_data_dir: &Path,
    custom_folders: &[String],
) -> Result<PathBuf, String> {
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let zip_name = format!("inventory_backup_{}.zip", timestamp);
    let zip_path = app_data_dir.join(&zip_name);

    let file = File::create(&zip_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(CompressionMethod::Deflated);

    // Add database file
    let db_path = app_data_dir.join("inventory.db");
    if db_path.exists() {
        add_file_to_zip(&mut zip, &db_path, "data/inventory.db", options)?;
    }

    // Add pictures-Inventry folder
    let pictures_dir = app_data_dir.join("pictures-Inventry");
    if pictures_dir.exists() {
        add_directory_to_zip(&mut zip, &pictures_dir, "pictures-Inventry", options)?;
    }

    // Add AI folder
    let ai_dir = app_data_dir.join("AI");
    if ai_dir.exists() {
        add_directory_to_zip(&mut zip, &ai_dir, "AI", options)?;
    }

    // Add custom folders
    for folder_path in custom_folders {
        let folder = Path::new(folder_path);
        if folder.exists() && folder.is_dir() {
            let folder_name = folder.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("custom");
            add_directory_to_zip(&mut zip, folder, &format!("custom/{}", folder_name), options)?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

    Ok(zip_path)
}

fn add_file_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    file_path: &Path,
    archive_path: &str,
    options: FileOptions,
) -> Result<(), String> {
    let mut file = File::open(file_path)
        .map_err(|e| format!("Failed to open file {:?}: {}", file_path, e))?;

    zip.start_file(archive_path, options)
        .map_err(|e| format!("Failed to start file in ZIP: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    zip.write_all(&buffer)
        .map_err(|e| format!("Failed to write to ZIP: {}", e))?;

    Ok(())
}

fn add_directory_to_zip<W: Write + std::io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir_path: &Path,
    archive_prefix: &str,
    options: FileOptions,
) -> Result<(), String> {
    for entry in walkdir(dir_path)? {
        let path = entry;
        if path.is_file() {
            let relative = path.strip_prefix(dir_path)
                .map_err(|e| format!("Path error: {}", e))?;
            let archive_path = format!("{}/{}", archive_prefix, relative.display());
            add_file_to_zip(zip, &path, &archive_path, options)?;
        }
    }
    Ok(())
}

fn walkdir(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))? {
            let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir(&path)?);
            } else {
                files.push(path);
            }
        }
    }
    Ok(files)
}

// ============================================================================
// Google Drive API Operations
// ============================================================================

async fn ensure_backup_folder(access_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Search for existing folder
    let search_url = "https://www.googleapis.com/drive/v3/files";
    let response = client
        .get(search_url)
        .bearer_auth(access_token)
        .query(&[
            ("q", "name='Inventory_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false"),
            ("fields", "files(id,name)"),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Drive API error: {}", response.status()));
    }

    let file_list: DriveFileList = response.json::<DriveFileList>().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(files) = file_list.files {
        if let Some(folder) = files.first() {
            return Ok(folder.id.clone());
        }
    }

    // Create folder if not exists
    let metadata = serde_json::json!({
        "name": "Inventory_Backups",
        "mimeType": "application/vnd.google-apps.folder"
    });

    let create_response = client
        .post(search_url)
        .bearer_auth(access_token)
        .json(&metadata)
        .send()
        .await
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    if !create_response.status().is_success() {
        return Err(format!("Failed to create backup folder: {}", create_response.status()));
    }

    let folder: DriveFolder = create_response.json::<DriveFolder>().await
        .map_err(|e| format!("Failed to parse folder response: {}", e))?;

    Ok(folder.id)
}

async fn upload_to_drive(
    app_handle: &AppHandle,
    access_token: &str,
    folder_id: &str,
    file_path: &Path,
) -> Result<DriveBackupFile, String> {
    let client = reqwest::Client::new();

    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?;

    let file_metadata = fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let total_bytes = file_metadata.len();

    // 1. Initial request to get resumable upload URL
    let metadata = serde_json::json!({
        "name": file_name,
        "parents": [folder_id]
    });

    let init_res = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable")
        .bearer_auth(access_token)
        .header("Content-Type", "application/json; charset=UTF-8")
        .header("X-Upload-Content-Type", "application/zip")
        .header("X-Upload-Content-Length", total_bytes.to_string())
        .json(&metadata)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate upload: {}", e))?;

    if !init_res.status().is_success() {
        let error_text = init_res.text().await.unwrap_or_default();
        return Err(format!("Failed to initiate resumable upload: {}", error_text));
    }

    let upload_url = init_res.headers()
        .get("Location")
        .ok_or("No upload URL received from Google Drive")?
        .to_str()
        .map_err(|e| e.to_string())?;

    // 2. Perform resumable upload with progress tracking
    // Wrap the stream to emit progress
    let mut processed_bytes = 0u64;
    let app_for_unfold = app_handle.clone();
    let app_for_inspect = app_handle.clone();
    
    let stream = futures_util::stream::unfold(tokio::fs::File::open(file_path).await.map_err(|e| e.to_string())?, move |mut file| {
        let _app = app_for_unfold.clone();
        async move {
            let mut buffer = vec![0u8; 256 * 1024]; // Heap-allocated to prevent stack overflow
            match file.read(&mut buffer).await {
                Ok(0) => None,
                Ok(n) => {
                    let chunk = buffer[..n].to_vec();
                    Some((Ok::<_, std::io::Error>(chunk), file))
                }
                Err(e) => Some((Err(e), file)),
            }
        }
    }).inspect(move |chunk| {
        if let Ok(data) = chunk {
            processed_bytes += data.len() as u64;
            app_for_inspect.emit("backup_progress", TransferProgress {
                processed_bytes,
                total_bytes,
            }).ok();
        }
    });

    let upload_res = client
        .put(upload_url)
        .body(reqwest::Body::wrap_stream(stream))
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    if !upload_res.status().is_success() {
        let error_text = upload_res.text().await.unwrap_or_default();
        return Err(format!("Upload failed: {}", error_text));
    }

    let drive_file: DriveFile = upload_res.json::<DriveFile>().await
        .map_err(|e| format!("Failed to parse upload response: {}", e))?;

    Ok(DriveBackupFile {
        id: drive_file.id,
        name: drive_file.name,
        created_time: drive_file.created_time.unwrap_or_default(),
        size: total_bytes as i64,
    })
}

async fn list_drive_backups(access_token: &str, folder_id: &str) -> Result<Vec<DriveBackupFile>, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(access_token)
        .query(&[
            ("q", &format!("'{}' in parents and trashed=false", folder_id)),
            ("orderBy", &"createdTime desc".to_string()),
            ("fields", &"files(id,name,createdTime,size)".to_string()),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to list backups: {}", response.status()));
    }

    let file_list: DriveFileList = response.json::<DriveFileList>().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let backups = file_list.files.unwrap_or_default()
        .into_iter()
        .map(|f| DriveBackupFile {
            id: f.id,
            name: f.name,
            created_time: f.created_time.unwrap_or_default(),
            size: f.size.and_then(|s| s.parse().ok()).unwrap_or(0),
        })
        .collect();

    Ok(backups)
}

async fn delete_drive_file(access_token: &str, file_id: &str) -> Result<(), String> {
    let client = reqwest::Client::new();

    let response = client
        .delete(&format!("https://www.googleapis.com/drive/v3/files/{}", file_id))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
        return Err(format!("Failed to delete file: {}", response.status()));
    }

    Ok(())
}

async fn download_drive_file(
    app_handle: &AppHandle,
    access_token: &str,
    file_id: &str,
    dest_path: &Path,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // First get file metadata to know the total size
    let metadata_res = client
        .get(&format!("https://www.googleapis.com/drive/v3/files/{}?fields=size", file_id))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;
    
    let total_bytes = if metadata_res.status().is_success() {
        metadata_res.json::<DriveFile>().await.ok()
            .and_then(|f| f.size)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
    } else {
        0
    };

    let response = client
        .get(&format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download: {}", response.status()));
    }

    let mut file = tokio::fs::File::create(dest_path).await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut processed_bytes = 0u64;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk).await
            .map_err(|e| format!("Write error: {}", e))?;

        processed_bytes += chunk.len() as u64;
        app_handle.emit("restore_progress", TransferProgress {
            processed_bytes,
            total_bytes,
        }).ok();
    }

    Ok(())
}

async fn cleanup_old_backups(access_token: &str, folder_id: &str, keep_count: usize) -> Result<usize, String> {
    let backups = list_drive_backups(access_token, folder_id).await?;

    if backups.len() <= keep_count {
        return Ok(0);
    }

    let mut deleted = 0;
    for backup in backups.iter().skip(keep_count) {
        if delete_drive_file(access_token, &backup.id).await.is_ok() {
            deleted += 1;
        }
    }

    Ok(deleted)
}

// ============================================================================
// Restore Functions
// ============================================================================

fn extract_backup_zip(zip_path: &Path, app_data_dir: &Path) -> Result<(), String> {
    let file = File::open(zip_path)
        .map_err(|e| format!("Failed to open ZIP: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        let outpath = match file.enclosed_name() {
            Some(path) => {
                // Map archive paths to actual paths
                let path_str = path.to_string_lossy();
                if path_str.starts_with("data/") {
                    app_data_dir.join(path_str.strip_prefix("data/").unwrap())
                } else if path_str.starts_with("pictures-Inventry/") ||
                          path_str.starts_with("AI/") ||
                          path_str.starts_with("custom/") {
                    app_data_dir.join(&*path_str)
                } else {
                    continue;
                }
            }
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
    }

    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn start_google_auth(
    credentials_json: String,
    app_handle: AppHandle,
    db: State<'_, Database>,
) -> Result<(), String> {
    // Parse and validate credentials
    let credentials: GoogleCredentials = serde_json::from_str(&credentials_json)
        .map_err(|e| format!("Invalid credentials JSON: {}", e))?;

    // Save credentials to settings
    set_setting(&db, "gdrive_credentials_json", &credentials_json)?;

    // Create OAuth2 client
    let client = BasicClient::new(
        ClientId::new(credentials.installed.client_id.clone()),
        Some(ClientSecret::new(credentials.installed.client_secret.clone())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
            .map_err(|e| e.to_string())?,
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
            .map_err(|e| e.to_string())?),
    );

    // Find available port for callback
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind callback server: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    let redirect_url = format!("http://127.0.0.1:{}/callback", port);

    let client = client.set_redirect_uri(
        RedirectUrl::new(redirect_url.clone()).map_err(|e| e.to_string())?
    );

    // Generate PKCE challenge
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    // Generate auth URL
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("https://www.googleapis.com/auth/drive.file".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Open browser using platform-specific command
    let auth_url_str = auth_url.to_string();
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&auth_url_str)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &auth_url_str])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&auth_url_str)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    // Accept one connection for the callback
    let (mut stream, _) = listener.accept()
        .map_err(|e| format!("Failed to accept callback: {}", e))?;

    // Read the request
    let mut buffer = [0; 4096];
    stream.read(&mut buffer)
        .map_err(|e| format!("Failed to read callback: {}", e))?;

    let request = String::from_utf8_lossy(&buffer);

    // Extract authorization code from request
    let code = request
        .lines()
        .next()
        .and_then(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            parts.get(1).map(|s| *s)
        })
        .and_then(|path| {
            url::Url::parse(&format!("http://localhost{}", path)).ok()
        })
        .and_then(|url| {
            url.query_pairs()
                .find(|(key, _)| key == "code")
                .map(|(_, value)| value.to_string())
        })
        .ok_or("Failed to extract authorization code")?;

    // Send success response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body><h1>Authentication Successful!</h1>\
        <p>You can close this window and return to the application.</p>\
        <script>window.close();</script></body></html>";
    stream.write_all(response.as_bytes()).ok();

    // Exchange code for tokens
    let token_result = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(async_http_client)
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    // Save tokens
    let tokens = GoogleDriveTokens {
        access_token: token_result.access_token().secret().clone(),
        refresh_token: token_result.refresh_token()
            .map(|t| t.secret().clone())
            .unwrap_or_default(),
        expires_at: Utc::now().timestamp() +
            token_result.expires_in().map(|d| d.as_secs() as i64).unwrap_or(3600),
    };

    save_tokens_to_keyring("default", &tokens)?;

    // Emit success notification
    app_handle.emit("backup_notification", BackupNotification {
        notification_type: "success".to_string(),
        title: "Connected to Google Drive".to_string(),
        message: "You can now configure automatic backups.".to_string(),
    }).ok();

    Ok(())
}

#[tauri::command]
pub async fn check_google_auth_status(db: State<'_, Database>) -> Result<bool, String> {
    // Check if we have credentials
    if get_setting(&db, "gdrive_credentials_json").is_none() {
        return Ok(false);
    }

    // Check if we have valid tokens
    match get_tokens_from_keyring("default") {
        Some(_tokens) => {
            // Try to validate/refresh tokens
            match get_valid_tokens(&db).await {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn disconnect_google_drive(db: State<'_, Database>) -> Result<(), String> {
    delete_tokens_from_keyring("default")?;
    set_setting(&db, "gdrive_backup_enabled", "false")?;
    Ok(())
}

#[tauri::command]
pub async fn run_backup_now(
    app_handle: AppHandle,
    db: State<'_, Database>,
) -> Result<String, String> {
    // Update status
    set_setting(&db, "gdrive_last_backup_status", "in_progress")?;

    // Get valid tokens
    let (tokens, _) = get_valid_tokens(&db).await.map_err(|e| {
        set_setting(&db, "gdrive_last_backup_status", "failed").ok();
        set_setting(&db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Get config
    let config = get_backup_config_internal(&db)?;

    // Get app data directory
    let app_data_dir = get_app_data_dir(&app_handle)?;

    // Create ZIP backup
    let zip_path = create_backup_zip(&app_data_dir, &config.custom_folders).map_err(|e| {
        set_setting(&db, "gdrive_last_backup_status", "failed").ok();
        set_setting(&db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Get file size
    let file_size = fs::metadata(&zip_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Ensure backup folder exists
    let folder_id = ensure_backup_folder(&tokens.access_token).await.map_err(|e| {
        fs::remove_file(&zip_path).ok();
        set_setting(&db, "gdrive_last_backup_status", "failed").ok();
        set_setting(&db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Save folder ID for future use
    set_setting(&db, "gdrive_folder_id", &folder_id)?;

    // Upload to Drive
    let uploaded = upload_to_drive(&app_handle, &tokens.access_token, &folder_id, &zip_path).await.map_err(|e| {
        fs::remove_file(&zip_path).ok();
        set_setting(&db, "gdrive_last_backup_status", "failed").ok();
        set_setting(&db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Delete local ZIP
    fs::remove_file(&zip_path).ok();

    // Cleanup old backups
    cleanup_old_backups(&tokens.access_token, &folder_id, config.retention_days as usize).await.ok();

    // Update status
    let now = Utc::now().to_rfc3339();
    set_setting(&db, "gdrive_last_backup_time", &now)?;
    set_setting(&db, "gdrive_last_backup_status", "success")?;
    set_setting(&db, "gdrive_last_backup_error", "")?;
    set_setting(&db, "gdrive_last_backup_size", &file_size.to_string())?;

    // Emit success notification
    app_handle.emit("backup_notification", BackupNotification {
        notification_type: "success".to_string(),
        title: "Backup Complete".to_string(),
        message: format!("Backup uploaded successfully ({:.1} MB)", file_size as f64 / 1_048_576.0),
    }).ok();

    Ok(uploaded.id)
}

#[tauri::command]
pub async fn get_backup_status(db: State<'_, Database>) -> Result<BackupStatus, String> {
    let is_authenticated = match get_valid_tokens(&db).await {
        Ok(_) => true,
        Err(_) => false,
    };

    let config = get_backup_config_internal(&db)?;

    // Calculate next scheduled time
    let next_scheduled = if config.enabled && is_authenticated {
        if let Ok(time) = NaiveTime::parse_from_str(&config.backup_time, "%H:%M") {
            let now = Local::now();
            let today_backup = now.date_naive().and_time(time);
            let next = if today_backup > now.naive_local() {
                today_backup
            } else {
                today_backup + chrono::Duration::days(1)
            };
            Some(next.format("%Y-%m-%d %H:%M").to_string())
        } else {
            None
        }
    } else {
        None
    };

    Ok(BackupStatus {
        is_authenticated,
        last_backup_time: get_setting(&db, "gdrive_last_backup_time"),
        last_backup_status: get_setting(&db, "gdrive_last_backup_status")
            .unwrap_or_else(|| "never".to_string()),
        last_error: get_setting(&db, "gdrive_last_backup_error")
            .filter(|s| !s.is_empty()),
        next_scheduled,
        backup_size_mb: get_setting(&db, "gdrive_last_backup_size")
            .and_then(|s| s.parse::<f64>().ok())
            .map(|b| b / 1_048_576.0),
    })
}

#[tauri::command]
pub async fn get_drive_backups(db: State<'_, Database>) -> Result<Vec<DriveBackupFile>, String> {
    let (tokens, _) = get_valid_tokens(&db).await?;

    let folder_id = get_setting(&db, "gdrive_folder_id")
        .ok_or("Backup folder not set up. Run a backup first.")?;

    list_drive_backups(&tokens.access_token, &folder_id).await
}

#[tauri::command]
pub async fn restore_from_backup(
    backup_id: String,
    app_handle: AppHandle,
    db: State<'_, Database>,
) -> Result<String, String> {
    let (tokens, _) = get_valid_tokens(&db).await?;
    let app_data_dir = get_app_data_dir(&app_handle)?;

    // Create temp path for download
    let temp_zip = app_data_dir.join("restore_temp.zip");

    // Download backup
    download_drive_file(&app_handle, &tokens.access_token, &backup_id, &temp_zip).await?;

    // Create pre-restore backup (safety)
    let pre_restore_backup = create_backup_zip(&app_data_dir, &[])?;

    // Extract backup
    match extract_backup_zip(&temp_zip, &app_data_dir) {
        Ok(_) => {
            fs::remove_file(&temp_zip).ok();
            fs::remove_file(&pre_restore_backup).ok();

            app_handle.emit("backup_notification", BackupNotification {
                notification_type: "success".to_string(),
                title: "Restore Complete".to_string(),
                message: "Backup restored successfully. Please restart the application.".to_string(),
            }).ok();

            Ok("Restore completed successfully".to_string())
        }
        Err(e) => {
            // Restore from pre-restore backup
            extract_backup_zip(&pre_restore_backup, &app_data_dir).ok();
            fs::remove_file(&temp_zip).ok();
            fs::remove_file(&pre_restore_backup).ok();
            Err(format!("Restore failed: {}. Previous state restored.", e))
        }
    }
}

#[tauri::command]
pub async fn delete_drive_backup(
    backup_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let (tokens, _) = get_valid_tokens(&db).await?;
    delete_drive_file(&tokens.access_token, &backup_id).await
}

#[tauri::command]
pub fn save_backup_config(
    config: BackupConfig,
    db: State<'_, Database>,
) -> Result<(), String> {
    set_setting(&db, "gdrive_backup_enabled", &config.enabled.to_string())?;
    set_setting(&db, "gdrive_backup_time", &config.backup_time)?;
    set_setting(&db, "gdrive_custom_folders", &serde_json::to_string(&config.custom_folders)
        .map_err(|e| e.to_string())?)?;
    set_setting(&db, "gdrive_retention_days", &config.retention_days.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_backup_config(db: State<'_, Database>) -> Result<BackupConfig, String> {
    get_backup_config_internal(&db)
}

fn get_backup_config_internal(db: &Database) -> Result<BackupConfig, String> {
    Ok(BackupConfig {
        enabled: get_setting(db, "gdrive_backup_enabled")
            .map(|s| s == "true")
            .unwrap_or(false),
        backup_time: get_setting(db, "gdrive_backup_time")
            .unwrap_or_else(|| "02:00".to_string()),
        custom_folders: get_setting(db, "gdrive_custom_folders")
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default(),
        retention_days: get_setting(db, "gdrive_retention_days")
            .and_then(|s| s.parse().ok())
            .unwrap_or(7),
    })
}

#[tauri::command]
pub async fn restart_backup_scheduler(
    app_handle: AppHandle,
    db: State<'_, Database>,
    scheduler_state: State<'_, BackupSchedulerState>,
) -> Result<(), String> {
    // Signal existing scheduler to stop
    {
        let mut cancel = scheduler_state.cancel_flag.write().await;
        *cancel = true;
    }

    // Wait a bit for it to stop
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Reset cancel flag
    {
        let mut cancel = scheduler_state.cancel_flag.write().await;
        *cancel = false;
    }

    let config = get_backup_config_internal(&db)?;

    if !config.enabled {
        return Ok(());
    }

    // Start new scheduler
    let cancel_flag = scheduler_state.cancel_flag.clone();
    let is_running = scheduler_state.is_running.clone();
    let app = app_handle.clone();

    tokio::spawn(async move {
        run_backup_scheduler(app, config.backup_time, cancel_flag, is_running).await;
    });

    Ok(())
}

async fn run_backup_scheduler(
    app_handle: AppHandle,
    backup_time: String,
    cancel_flag: Arc<RwLock<bool>>,
    is_running: Arc<RwLock<bool>>,
) {
    // Parse backup time
    let target_time = match NaiveTime::parse_from_str(&backup_time, "%H:%M") {
        Ok(t) => t,
        Err(_) => return,
    };

    loop {
        // Check cancel flag
        if *cancel_flag.read().await {
            break;
        }

        // Calculate time until next backup
        let now = Local::now();
        let today_target = now.date_naive().and_time(target_time);

        let next_backup = if today_target > now.naive_local() {
            today_target
        } else {
            today_target + chrono::Duration::days(1)
        };

        let duration_until = next_backup.signed_duration_since(now.naive_local());
        let sleep_duration = Duration::from_secs(duration_until.num_seconds().max(0) as u64);

        // Sleep until backup time (check cancel every minute)
        let mut remaining = sleep_duration;
        while remaining > Duration::ZERO {
            if *cancel_flag.read().await {
                return;
            }
            let sleep_chunk = remaining.min(Duration::from_secs(60));
            tokio::time::sleep(sleep_chunk).await;
            remaining = remaining.saturating_sub(sleep_chunk);
        }

        // Check cancel flag again
        if *cancel_flag.read().await {
            break;
        }

        // Check if already running
        {
            let running = is_running.read().await;
            if *running {
                continue;
            }
        }

        // Mark as running
        {
            let mut running = is_running.write().await;
            *running = true;
        }

        // Run backup
        let db = match app_handle.try_state::<Database>() {
            Some(db) => db,
            None => {
                let mut running = is_running.write().await;
                *running = false;
                continue;
            }
        };

        // Check if still enabled
        let config = match get_backup_config_internal(&db) {
            Ok(c) => c,
            Err(_) => {
                let mut running = is_running.write().await;
                *running = false;
                continue;
            }
        };

        if !config.enabled {
            let mut running = is_running.write().await;
            *running = false;
            break;
        }

        // Run the backup
        match run_backup_internal(&app_handle, &db).await {
            Ok(_) => {
                app_handle.emit("backup_notification", BackupNotification {
                    notification_type: "success".to_string(),
                    title: "Scheduled Backup Complete".to_string(),
                    message: "Daily backup completed successfully.".to_string(),
                }).ok();
            }
            Err(e) => {
                app_handle.emit("backup_notification", BackupNotification {
                    notification_type: "error".to_string(),
                    title: "Backup Failed".to_string(),
                    message: e.clone(),
                }).ok();
            }
        }

        // Mark as not running
        {
            let mut running = is_running.write().await;
            *running = false;
        }
    }
}

async fn run_backup_internal(app_handle: &AppHandle, db: &Database) -> Result<String, String> {
    // Update status
    set_setting(db, "gdrive_last_backup_status", "in_progress")?;

    // Get valid tokens
    let (tokens, _) = get_valid_tokens(db).await.map_err(|e| {
        set_setting(db, "gdrive_last_backup_status", "failed").ok();
        set_setting(db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Get config
    let config = get_backup_config_internal(db)?;

    // Get app data directory
    let app_data_dir = get_app_data_dir(app_handle)?;

    // Create ZIP backup
    let zip_path = create_backup_zip(&app_data_dir, &config.custom_folders).map_err(|e| {
        set_setting(db, "gdrive_last_backup_status", "failed").ok();
        set_setting(db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Get file size
    let file_size = fs::metadata(&zip_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Ensure backup folder exists
    let folder_id = ensure_backup_folder(&tokens.access_token).await.map_err(|e| {
        fs::remove_file(&zip_path).ok();
        set_setting(db, "gdrive_last_backup_status", "failed").ok();
        set_setting(db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Save folder ID
    set_setting(db, "gdrive_folder_id", &folder_id)?;

    // Upload to Drive
    let uploaded = upload_to_drive(app_handle, &tokens.access_token, &folder_id, &zip_path).await.map_err(|e| {
        fs::remove_file(&zip_path).ok();
        set_setting(db, "gdrive_last_backup_status", "failed").ok();
        set_setting(db, "gdrive_last_backup_error", &e).ok();
        e
    })?;

    // Delete local ZIP
    fs::remove_file(&zip_path).ok();

    // Cleanup old backups
    cleanup_old_backups(&tokens.access_token, &folder_id, config.retention_days as usize).await.ok();

    // Update status
    let now = Utc::now().to_rfc3339();
    set_setting(db, "gdrive_last_backup_time", &now)?;
    set_setting(db, "gdrive_last_backup_status", "success")?;
    set_setting(db, "gdrive_last_backup_error", "")?;
    set_setting(db, "gdrive_last_backup_size", &file_size.to_string())?;

    Ok(uploaded.id)
}

// Initialize scheduler on app startup
pub async fn init_backup_scheduler(app_handle: AppHandle) {
    let db = match app_handle.try_state::<Database>() {
        Some(db) => db,
        None => return,
    };

    let config = match get_backup_config_internal(&db) {
        Ok(c) => c,
        Err(_) => return,
    };

    if !config.enabled {
        return;
    }

    // Check if authenticated
    if get_valid_tokens(&db).await.is_err() {
        return;
    }

    let scheduler_state = match app_handle.try_state::<BackupSchedulerState>() {
        Some(s) => s,
        None => return,
    };

    let cancel_flag = scheduler_state.cancel_flag.clone();
    let is_running = scheduler_state.is_running.clone();

    tokio::spawn(async move {
        run_backup_scheduler(app_handle, config.backup_time, cancel_flag, is_running).await;
    });
}
