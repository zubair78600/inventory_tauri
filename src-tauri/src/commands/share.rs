use tauri::AppHandle;
use std::path::Path;

/// Open WhatsApp desktop with a specific phone number and optionally attach a file
/// Phone must be in international format without '+' (e.g., "919876543210")
#[tauri::command]
pub async fn open_whatsapp_with_file(
    app_handle: AppHandle,
    phone: String,
    file_path: Option<String>,
) -> Result<(), String> {
    // Clean phone number
    let cleaned_phone = phone.trim().replace("+", "").replace(" ", "").replace("-", "");

    if cleaned_phone.is_empty() {
        return Err("Phone number cannot be empty".to_string());
    }

    // Basic validation: should be digits only
    if !cleaned_phone.chars().all(|c| c.is_numeric()) {
        return Err("Phone number must contain only digits".to_string());
    }

    log::info!("Opening WhatsApp for phone: {}", cleaned_phone);

    // Use shell plugin to open URL
    use tauri_plugin_shell::ShellExt;

    let shell = app_handle.shell();

    // Platform-specific handling
    #[cfg(target_os = "macos")]
    {
        // Construct WhatsApp URL - use whatsapp:// protocol for desktop app
        let whatsapp_protocol = format!("whatsapp://send?phone={}", cleaned_phone);
        let whatsapp_web_url = format!("https://web.whatsapp.com/send?phone={}", cleaned_phone);

        // On macOS, open WhatsApp Desktop app with file if provided
        if let Some(file) = &file_path {
            let file_path_obj = Path::new(file);
            if file_path_obj.exists() {
                // Try whatsapp:// protocol first for desktop app
                match shell.command("open")
                    .args([&whatsapp_protocol])
                    .spawn()
                {
                    Ok(_) => {
                        log::info!("Opened WhatsApp Desktop app with protocol");
                        // Wait for WhatsApp to fully open and load the chat
                        tokio::time::sleep(tokio::time::Duration::from_millis(3500)).await;

                        // Simple approach: Open Finder with file and let user drag it
                        // But automatically select and prepare for quick drag
                        let applescript = format!(
                            r#"
                            tell application "Finder"
                                reveal POSIX file "{}"
                                activate
                            end tell

                            delay 1

                            tell application "System Events"
                                tell process "WhatsApp"
                                    set frontmost to true
                                end tell
                            end tell

                            tell application "System Events"
                                tell process "Finder"
                                    set frontmost to true
                                    delay 0.5

                                    -- Copy the file
                                    keystroke "c" using command down
                                    delay 0.3
                                end tell

                                -- Switch to WhatsApp
                                tell process "WhatsApp"
                                    set frontmost to true
                                    delay 0.5

                                    -- Paste the file into chat (this will attach it)
                                    keystroke "v" using command down
                                end tell
                            end tell
                            "#,
                            file
                        );

                        // Execute AppleScript to attach file
                        match shell.command("osascript")
                            .args(["-e", &applescript])
                            .spawn()
                        {
                            Ok(_) => {
                                log::info!("File attachment script executed");

                                // Schedule file deletion after 120 seconds (2 minutes)
                                let file_to_delete = file.clone();
                                tokio::spawn(async move {
                                    tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;
                                    let _ = std::fs::remove_file(&file_to_delete);
                                    log::info!("Deleted temporary PDF: {}", file_to_delete);
                                });
                            },
                            Err(e) => {
                                log::warn!("Failed to execute attachment script: {}", e);
                            }
                        }

                        Ok(())
                    },
                    Err(e) => {
                        log::warn!("WhatsApp protocol failed, trying web URL: {}", e);
                        // Fallback to web URL
                        shell.open(&whatsapp_web_url, None)
                            .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                    }
                }
            } else {
                // File doesn't exist, just open WhatsApp
                match shell.command("open")
                    .args([&whatsapp_protocol])
                    .spawn()
                {
                    Ok(_) => Ok(()),
                    Err(_) => {
                        shell.open(&whatsapp_web_url, None)
                            .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                    }
                }
            }
        } else {
            // No file, just open WhatsApp
            match shell.command("open")
                .args([&whatsapp_protocol])
                .spawn()
            {
                Ok(_) => Ok(()),
                Err(_) => {
                    shell.open(&whatsapp_web_url, None)
                        .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, try WhatsApp app, fallback to browser
        if let Some(file) = &file_path {
            let file_path_obj = Path::new(file);
            if file_path_obj.exists() {
                match shell.command("cmd")
                    .args(["/C", "start", "whatsapp://send", &format!("?phone={}", cleaned_phone)])
                    .spawn()
                {
                    Ok(_) => {
                        log::info!("Opened WhatsApp Desktop app");
                        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                        // Open file explorer to the file location
                        let _ = shell.command("explorer").args(["/select,", file]).spawn();
                        Ok(())
                    },
                    Err(e) => {
                        log::warn!("WhatsApp app not found, opening in browser: {}", e);
                        shell.open(&whatsapp_url, None)
                            .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                    }
                }
            } else {
                match shell.command("cmd")
                    .args(["/C", "start", "whatsapp://send", &format!("?phone={}", cleaned_phone)])
                    .spawn()
                {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        shell.open(&whatsapp_url, None)
                            .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                    }
                }
            }
        } else {
            match shell.command("cmd")
                .args(["/C", "start", "whatsapp://send", &format!("?phone={}", cleaned_phone)])
                .spawn()
            {
                Ok(_) => Ok(()),
                Err(e) => {
                    shell.open(&whatsapp_url, None)
                        .map_err(|e| format!("Failed to open WhatsApp: {}", e))
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, open in browser (WhatsApp Desktop support varies)
        shell.open(&whatsapp_url, None)
            .map_err(|e| format!("Failed to open WhatsApp: {}", e))
    }
}

/// Legacy function for backward compatibility
#[tauri::command]
pub async fn open_whatsapp_chat(
    app_handle: AppHandle,
    phone: String,
) -> Result<(), String> {
    open_whatsapp_with_file(app_handle, phone, None).await
}
