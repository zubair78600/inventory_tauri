use tauri::Manager;
use tauri::Emitter;
use std::sync::Mutex;
use std::path::PathBuf;
use std::io::Write;
use serde::Serialize;
use std::process::{Child, Command, Stdio};

/// Base GitHub release URL for sidecar downloads
const SIDECAR_RELEASE_BASE: &str = "https://github.com/zubair78600/inventory_tauri/releases/download/v1.0.2";

/// Get platform-specific binary name
fn get_sidecar_binary_name() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    { "db-ai-server-aarch64-apple-darwin" }
    
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    { "db-ai-server-x86_64-apple-darwin" }
    
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    { "db-ai-server-x86_64-pc-windows-msvc.exe" }
    
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    { "db-ai-server-x86_64-unknown-linux-gnu" }
    
    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64")
    )))]
    { "db-ai-server-unsupported" }
}

/// Get the download URL for current platform
fn get_sidecar_download_url() -> String {
    format!("{}/{}", SIDECAR_RELEASE_BASE, get_sidecar_binary_name())
}

/// State for managing the AI sidecar process
pub struct AiSidecarState {
    pub process: Mutex<Option<Child>>,
}

impl Default for AiSidecarState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}

/// Download progress info
#[derive(Clone, Serialize)]
pub struct SidecarDownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f32,
    pub speed_mbps: f32,
}

/// Get the path where sidecar should be stored
fn get_sidecar_path() -> PathBuf {
    let app_data = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.inventry.tauri")
        .join("bin");
    
    #[cfg(target_os = "windows")]
    { app_data.join("db-ai-server.exe") }
    
    #[cfg(not(target_os = "windows"))]
    { app_data.join("db-ai-server") }
}

/// Check if AI sidecar is downloaded
#[tauri::command]
pub async fn check_sidecar_downloaded() -> Result<bool, String> {
    let path = get_sidecar_path();
    Ok(path.exists())
}

/// Download the AI sidecar binary with progress events
#[tauri::command]
pub async fn download_ai_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    let sidecar_path = get_sidecar_path();
    
    // Create directory if needed
    if let Some(parent) = sidecar_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    log::info!("Downloading AI sidecar to: {:?}", sidecar_path);
    
    // Download with progress
    let download_url = get_sidecar_download_url();
    log::info!("Download URL: {}", download_url);
    
    let client = reqwest::Client::new();
    let response = client.get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;
    
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(&sidecar_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let start_time = std::time::Instant::now();
    let mut last_emit_time = start_time;
    let mut last_downloaded: u64 = 0;
    
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;
        
        // Emit progress every 500ms
        let now = std::time::Instant::now();
        if now.duration_since(last_emit_time).as_millis() >= 500 {
            let elapsed = now.duration_since(last_emit_time).as_secs_f32();
            let bytes_since = downloaded - last_downloaded;
            let speed_mbps = (bytes_since as f32 / elapsed) / (1024.0 * 1024.0);
            
            let progress = SidecarDownloadProgress {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: if total_size > 0 { (downloaded as f32 / total_size as f32) * 100.0 } else { 0.0 },
                speed_mbps,
            };
            
            let _ = app.emit("sidecar-download-progress", progress);
            last_emit_time = now;
            last_downloaded = downloaded;
        }
    }
    
    drop(file);
    
    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&sidecar_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }
    
    log::info!("AI sidecar downloaded successfully");
    Ok(())
}

/// Start the AI sidecar server from downloaded location
#[tauri::command]
pub async fn start_ai_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AiSidecarState>();
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    // Already running
    if process_guard.is_some() {
        log::info!("AI sidecar already running");
        return Ok(());
    }
    
    let sidecar_path = get_sidecar_path();
    if !sidecar_path.exists() {
        return Err("AI sidecar not downloaded. Please download first.".to_string());
    }

    log::info!("Starting AI sidecar from: {:?}", sidecar_path);

    // Spawn the process
    let mut child = Command::new(&sidecar_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;
    
    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        tauri::async_runtime::spawn(async move {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::info!("[Sidecar] {}", line);
                }
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        tauri::async_runtime::spawn(async move {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    log::error!("[Sidecar Error] {}", line);
                }
            }
        });
    }

    log::info!("AI sidecar started with PID: {}", child.id());
    *process_guard = Some(child);
    
    log::info!("AI sidecar started successfully");
    Ok(())
}

/// Stop the AI sidecar server
#[tauri::command]
pub async fn stop_ai_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AiSidecarState>();
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process_guard.take() {
        log::info!("Stopping AI sidecar...");
        child.kill().map_err(|e| format!("Failed to kill sidecar: {}", e))?;
        log::info!("AI sidecar stopped");
    }

    Ok(())
}

/// Check if the AI sidecar is running
#[tauri::command]
pub async fn check_ai_sidecar_status(app: tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<AiSidecarState>();
    let process_guard = state.process.lock().map_err(|e| e.to_string())?;
    Ok(process_guard.is_some())
}

