use image::imageops::FilterType;

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

use crate::db::Database;

// Constants
const PICTURES_FOLDER: &str = "pictures-Inventry";
const THUMBNAIL_SIZE: u32 = 80;

/// Google Image Search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleImageResult {
    pub title: String,
    pub link: String,           // Full-size image URL
    pub thumbnail_link: String, // Small preview from Google
    pub display_link: String,   // Source website
}

/// Get the base pictures directory path
fn get_base_pictures_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let pictures_dir = app_data_dir.join(PICTURES_FOLDER);

    fs::create_dir_all(&pictures_dir)
        .map_err(|e| format!("Failed to create pictures directory: {}", e))?;

    Ok(pictures_dir)
}

/// Get the entity-specific pictures directory path, creating it if needed
fn get_entity_pictures_dir(app_handle: &AppHandle, entity_folder: &str) -> Result<PathBuf, String> {
    let base_dir = get_base_pictures_dir(app_handle)?;
    let entity_dir = base_dir.join(entity_folder);

    fs::create_dir_all(&entity_dir)
        .map_err(|e| format!("Failed to create {} directory: {}", entity_folder, e))?;

    Ok(entity_dir)
}

/// Generate a thumbnail from an image file
fn generate_thumbnail(source_path: &PathBuf, thumb_path: &PathBuf) -> Result<(), String> {
    let img = image::open(source_path).map_err(|e| format!("Failed to open image: {}", e))?;

    // Resize to thumbnail, maintaining aspect ratio
    let thumbnail = img.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, FilterType::Lanczos3);

    thumbnail
        .save(thumb_path)
        .map_err(|e| format!("Failed to save thumbnail: {}", e))?;

    Ok(())
}

/// Get the filename for an entity image
fn get_entity_filename(entity_id: i32, extension: &str, entity_prefix: &str) -> String {
    format!("{}_{}.{}", entity_prefix, entity_id, extension.to_lowercase())
}

/// Get the thumbnail filename for an entity image
fn get_entity_thumb_filename(entity_id: i32, extension: &str, entity_prefix: &str) -> String {
    format!("{}_{}_thumb.{}", entity_prefix, entity_id, extension.to_lowercase())
}

/// Get the original backup filename
fn get_entity_orig_filename(entity_id: i32, extension: &str, entity_prefix: &str) -> String {
    format!("{}_{}_orig.{}", entity_prefix, entity_id, extension)
}

// --- Generic Helper Functions ---

fn save_image_for_entity(
    entity_id: i32,
    file_data: Vec<u8>,
    file_extension: String,
    entity_folder: &str,
    entity_prefix: &str,
    table_name: &str,
    app_handle: &AppHandle,
    db: &State<Database>,
) -> Result<String, String> {
    let entity_dir = get_entity_pictures_dir(app_handle, entity_folder)?;

    // Clean extension
    let ext = file_extension.trim_start_matches('.').to_lowercase();
    if !["jpg", "jpeg", "png", "gif", "webp"].contains(&ext.as_str()) {
        return Err("Invalid image format. Supported: jpg, jpeg, png, gif, webp".to_string());
    }

    // Delete existing images for this entity (in the specific folder)
    // Note: This won't delete backward-compat images in root, but that's acceptable for now
    let _ = delete_image_internal(entity_id, &entity_dir, entity_folder, entity_prefix, table_name, db);

    // Generate filenames
    let image_filename = get_entity_filename(entity_id, &ext, entity_prefix);
    let thumb_filename = get_entity_thumb_filename(entity_id, &ext, entity_prefix);

    let image_path = entity_dir.join(&image_filename);
    let thumb_path = entity_dir.join(&thumb_filename);

    // Save full-size
    let mut file = fs::File::create(&image_path).map_err(|e| format!("Failed to create image file: {}", e))?;
    file.write_all(&file_data).map_err(|e| format!("Failed to write image data: {}", e))?;

    // Generate thumbnail
    generate_thumbnail(&image_path, &thumb_path)?;

    // Update DB
    let conn = db.get_conn()?;
    let query = format!(
        "UPDATE {} SET image_path = ?1, updated_at = datetime('now') WHERE id = ?2",
        table_name
    );
    conn.execute(&query, rusqlite::params![&image_filename, entity_id])
        .map_err(|e| format!("Failed to update {} image path: {}", table_name, e))?;

    log::info!("Saved image for {} {}: {}", table_name, entity_id, image_filename);

    Ok(image_filename)
}

fn get_image_path_for_entity(
    entity_id: i32,
    thumbnail: bool,
    entity_folder: &str,
    _entity_prefix: &str, // Unused for lookup logic but kept for consistency
    table_name: &str,
    app_handle: &AppHandle,
    db: &State<Database>,
) -> Result<Option<String>, String> {
    let conn = db.get_conn()?;
    
        let query = format!("SELECT image_path FROM {} WHERE id = ?1", table_name);

    // Better error handling

    let image_filename: Option<String> = match conn.query_row(&query, [entity_id], |row| row.get(0)) {
        Ok(path) => path,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(format!("Failed to query {} image: {}", table_name, e)),
    };

    let filename: String = match image_filename {
        Some(f) if !f.is_empty() => f,
        _ => return Ok(None),
    };

    let base_dir = get_base_pictures_dir(app_handle)?;
    let entity_dir = base_dir.join(entity_folder);

    // Helper to check path
    let check_path = |dir: &Path, fname: &str| -> Option<PathBuf> {
        let p = dir.join(fname);
        if p.exists() { Some(p) } else { None }
    };

    // Construct target filename (thumbnail or full)
    let target_filename = if thumbnail {
        let parts: Vec<&str> = filename.rsplitn(2, '.').collect();
        if parts.len() == 2 {
            format!("{}_thumb.{}", parts[1], parts[0])
        } else {
            filename.clone() // Fallback
        }
    } else {
        filename.clone()
    };

    // 1. Check in entity subfolder
    if let Some(p) = check_path(&entity_dir, &target_filename) {
        return Ok(Some(p.to_str().ok_or("Invalid path")?.to_string()));
    }
    
    // 1b. If thumbnail requested but not found, try full in subfolder
    if thumbnail {
        if let Some(p) = check_path(&entity_dir, &filename) {
             return Ok(Some(p.to_str().ok_or("Invalid path")?.to_string()));
        }
    }

    // 2. Backward Compatibility: Check in base folder (only for "products" usually, but harmless for others)
    if let Some(p) = check_path(&base_dir, &target_filename) {
        return Ok(Some(p.to_str().ok_or("Invalid path")?.to_string()));
    }
    
    if thumbnail {
        if let Some(p) = check_path(&base_dir, &filename) {
             return Ok(Some(p.to_str().ok_or("Invalid path")?.to_string()));
        }
    }

    Ok(None)
}

fn delete_image_internal(
    entity_id: i32,
    entity_dir: &PathBuf, // We pass the primary dir, but we might need to check base too
    _entity_folder: &str,
    _entity_prefix: &str,
    table_name: &str,
    db: &State<Database>,
) -> Result<(), String> {
    let conn = db.get_conn()?;
    let query = format!("SELECT image_path FROM {} WHERE id = ?1", table_name);
    
    let filename: Option<String> = conn
        .query_row(&query, [entity_id], |row| row.get(0))
        .ok()
        .flatten();

    if let Some(fname) = filename {
         if !fname.is_empty() {
            // Delete from entity dir
            let p1 = entity_dir.join(&fname);
            let _ = fs::remove_file(&p1);
            
            // Delete thumb
            let parts: Vec<&str> = fname.rsplitn(2, '.').collect();
            if parts.len() == 2 {
                let thumb_n = format!("{}_thumb.{}", parts[1], parts[0]);
                let _ = fs::remove_file(entity_dir.join(thumb_n));
            }

            // Backward compat: Delete from base dir too if exists (just in case)
            if let Some(parent) = entity_dir.parent() {
                 let p2 = parent.join(&fname);
                 let _ = fs::remove_file(&p2);
                 if parts.len() == 2 {
                     let thumb_n = format!("{}_thumb.{}", parts[1], parts[0]);
                     let _ = fs::remove_file(parent.join(thumb_n));
                 }
            }
         }
    }
    Ok(())
}


// --- Exported Command Wrappers ---

// 1. PRODUCTS (folder: "products", prefix: "product")

#[tauri::command]
pub fn save_product_image(
    product_id: i32,
    file_data: Vec<u8>,
    file_extension: String,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<String, String> {
    save_image_for_entity(
        product_id, file_data, file_extension, "products", "product", "products", &app_handle, &db
    )
}

#[tauri::command]
pub fn get_product_image_path(
    product_id: i32,
    thumbnail: bool,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<Option<String>, String> {
    get_image_path_for_entity(
        product_id, thumbnail, "products", "product", "products", &app_handle, &db
    )
}

#[tauri::command]
pub fn delete_product_image(
    product_id: i32,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<(), String> {
    let entity_dir = get_entity_pictures_dir(&app_handle, "products")?;
    delete_image_internal(product_id, &entity_dir, "products", "product", "products", &db)?;
    
    // Clear DB
    let conn = db.get_conn()?;
    conn.execute(
        "UPDATE products SET image_path = NULL, updated_at = datetime('now') WHERE id = ?1",
        [product_id],
    ).map_err(|e| format!("Failed to update product: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn download_product_image(
    product_id: i32,
    image_url: String,
    app_handle: AppHandle,
    db: State<'_, Database>,
) -> Result<String, String> {
    // Download logic is still specific, but saving can reuse generic
    // Actually, I can replicate the download logic or just inline it here as it was.
    // For brevity, I'll keep it inline but call `save_image_for_entity` at the end ?? 
    // No, `save_image_for_entity` takes bytes. So yes.
    
    log::info!("Downloading image from URL: {}", image_url);
    let client = reqwest::Client::new();
    let response = client.get(&image_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send().await.map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download: HTTP {}", response.status()));
    }

    let content_type = response.headers().get("content-type")
        .and_then(|v| v.to_str().ok()).unwrap_or("image/jpeg");
    
    let ext = match content_type {
        t if t.contains("png") => "png",
        t if t.contains("gif") => "gif",
        t if t.contains("webp") => "webp",
        _ => "jpg",
    }.to_string();

    let image_data = response.bytes().await.map_err(|e| format!("Failed to read data: {}", e))?.to_vec();

    save_image_for_entity(
        product_id, image_data, ext, "products", "product", "products", &app_handle, &db
    )
}

// 2. SUPPLIERS (folder: "suppliers", prefix: "supplier")

#[tauri::command]
pub fn save_supplier_image(
    supplier_id: i32,
    file_data: Vec<u8>,
    file_extension: String,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<String, String> {
    save_image_for_entity(
        supplier_id, file_data, file_extension, "suppliers", "supplier", "suppliers", &app_handle, &db
    )
}

#[tauri::command]
pub fn get_supplier_image_path(
    supplier_id: i32,
    thumbnail: bool,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<Option<String>, String> {
    get_image_path_for_entity(
        supplier_id, thumbnail, "suppliers", "supplier", "suppliers", &app_handle, &db
    )
}

#[tauri::command]
pub fn delete_supplier_image(
    supplier_id: i32,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<(), String> {
    let entity_dir = get_entity_pictures_dir(&app_handle, "suppliers")?;
    delete_image_internal(supplier_id, &entity_dir, "suppliers", "supplier", "suppliers", &db)?;
    
    let conn = db.get_conn()?;
    conn.execute(
        "UPDATE suppliers SET image_path = NULL, updated_at = datetime('now') WHERE id = ?1",
        [supplier_id],
    ).map_err(|e| format!("Failed to update supplier: {}", e))?;
    
    Ok(())
}

// 3. CUSTOMERS (folder: "customers", prefix: "customer")

#[tauri::command]
pub fn save_customer_image(
    customer_id: i32,
    file_data: Vec<u8>,
    file_extension: String,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<String, String> {
    save_image_for_entity(
        customer_id, file_data, file_extension, "customers", "customer", "customers", &app_handle, &db
    )
}

#[tauri::command]
pub fn get_customer_image_path(
    customer_id: i32,
    thumbnail: bool,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<Option<String>, String> {
    get_image_path_for_entity(
        customer_id, thumbnail, "customers", "customer", "customers", &app_handle, &db
    )
}

#[tauri::command]
pub fn delete_customer_image(
    customer_id: i32,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<(), String> {
    let entity_dir = get_entity_pictures_dir(&app_handle, "customers")?;
    delete_image_internal(customer_id, &entity_dir, "customers", "customer", "customers", &db)?;
    
    let conn = db.get_conn()?;
    conn.execute(
        "UPDATE customers SET image_path = NULL, updated_at = datetime('now') WHERE id = ?1",
        [customer_id],
    ).map_err(|e| format!("Failed to update customer: {}", e))?;
    
    Ok(())
}


// --- Other Existing Commands (search, get_directory, crop) ---

#[tauri::command]
pub async fn search_google_images(
    query: String,
    limit: i32,
    db: State<'_, Database>,
) -> Result<Vec<GoogleImageResult>, String> {
    // (Implementation similar to original, omitted for brevity but I need to include it!)
    // RE-IMPLEMENTING FULL CODE to ensure it works.
    let conn = db.get_conn()?;
    let api_key: Option<String> = conn.query_row("SELECT value FROM app_settings WHERE key = 'google_api_key'", [], |row| row.get(0)).ok();
    let cx_id: Option<String> = conn.query_row("SELECT value FROM app_settings WHERE key = 'google_cx_id'", [], |row| row.get(0)).ok();

    let api_key = api_key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()).ok_or("Google API Key not configured.")?;
    let cx_id = cx_id.map(|c| c.trim().to_string()).filter(|c| !c.is_empty()).ok_or("Google CX ID not configured.")?;

    let num = limit.min(10).max(1);
    let url = format!(
        "https://www.googleapis.com/customsearch/v1?key={}&cx={}&q={}&searchType=image&num={}",
        api_key, cx_id, urlencoding::encode(&query), num
    );

    let client = reqwest::Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Google API error: {}", response.status()));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let items = json["items"].as_array();

    let results: Vec<GoogleImageResult> = match items {
        Some(items) => items.iter().filter_map(|item| {
            Some(GoogleImageResult {
                title: item["title"].as_str()?.to_string(),
                link: item["link"].as_str()?.to_string(),
                thumbnail_link: item["image"]["thumbnailLink"].as_str().unwrap_or("").to_string(),
                display_link: item["displayLink"].as_str().unwrap_or("").to_string(),
            })
        }).collect(),
        None => Vec::new(),
    };
    Ok(results)
}

#[tauri::command]
pub fn get_pictures_directory(app_handle: AppHandle) -> Result<String, String> {
    let pictures_dir = get_base_pictures_dir(&app_handle)?;
    pictures_dir.to_str().map(|s| s.to_string()).ok_or("Invalid path".to_string())
}

#[tauri::command]
pub fn save_cropped_image(
    product_id: i32,
    file_data: Vec<u8>,
    file_extension: String,
    app_handle: AppHandle,
    db: State<Database>,
) -> Result<String, String> {
    // IMPORTANT: This was previously specific to products.
    // Ideally it should be generic: save_cropped_entity_image(entity_type, entity_id...)
    // But since the frontend Cropper is likely calling this, I'll keep it as `save_cropped_image` (Product specific for now)
    // Or I can make it Generic internally but the command signature is fixed.
    // User only asked for Supplier/Customer images, not necessarily cropper support for them yet tasks implied full image support.
    // For now, I'll keep `save_cropped_image` restricted to PRODUCTS to match existing frontend calls.
    // If I need to support cropping for suppliers, I'll add `save_cropped_supplier_image`.

    // LOGIC for preserving original:
    // This logic relies on `pictures-Products` now? Or Base?
    // `save_product_image` logic now defaults to `products` folder.
    // So we should check `products` folder.

    let entity_dir = get_entity_pictures_dir(&app_handle, "products")?;
    // BUT caution: old images might be in base.
    // If we can't find image in `products`, check base. 
    // And if we find it in base, maybe we should move it to `products` as 'original'?
    
    // For simplicity, let's look in `products` folder first.
    let _ext = file_extension.trim_start_matches('.').to_lowercase();
    let prefix = "product";
    
    // 1. Check if original backup exists in `products` folder
    let mut original_exists = false;
    let read_dir = fs::read_dir(&entity_dir).map_err(|e| e.to_string())?;
    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with(&format!("{}_{}_orig.", prefix, product_id)) {
                    original_exists = true;
                    break;
                }
            }
        }
    }

    // 2. If NO original exists, rename current -> original
    if !original_exists {
        let conn = db.get_conn()?;
        let current_image_filename: Option<String> = conn.query_row(
            "SELECT image_path FROM products WHERE id = ?1", [product_id], |row| row.get(0)
        ).ok().flatten();

        if let Some(filename) = current_image_filename {
             if !filename.is_empty() {
                 // Check where this file is. `products` or `base`?
                 let p_sub = entity_dir.join(&filename);
                 let base_dir = get_base_pictures_dir(&app_handle)?;
                 let p_base = base_dir.join(&filename);
                 
                 let (source_path, target_dir) = if p_sub.exists() {
                     (p_sub, &entity_dir)
                 } else if p_base.exists() {
                     // It's in base. We should move/copy it to `products` as original
                      (p_base, &entity_dir)
                 } else {
                     // Can't find file??
                     return Err("Current image file not found on disk".to_string());
                 };
                 
                 let current_ext = source_path.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                 let orig_filename = get_entity_orig_filename(product_id, current_ext, prefix);
                 let orig_path = target_dir.join(&orig_filename);
                 
                 fs::copy(&source_path, &orig_path).map_err(|e| format!("Backup failed: {}", e))?;
             }
        }
    }

    // 3. Save new crop
    save_image_for_entity(
        product_id, file_data, file_extension, "products", "product", "products", &app_handle, &db
    )
}

#[tauri::command]
pub fn get_original_image_path(
    product_id: i32,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    // Check `products` folder first
    let entity_dir = get_entity_pictures_dir(&app_handle, "products")?;
    
    // Helper
    let find_orig = |dir: PathBuf| -> Result<Option<String>, String> {
        let read_dir = fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in read_dir {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                     if name.starts_with(&format!("product_{}_orig.", product_id)) {
                         return Ok(Some(path.to_str().ok_or("Invalid path")?.to_string()));
                     }
                }
            }
        }
        Ok(None)
    };

    if let Some(p) = find_orig(entity_dir.clone())? {
        return Ok(Some(p));
    }

    // Check base folder
    let base_dir = get_base_pictures_dir(&app_handle)?;
    if let Some(p) = find_orig(base_dir.clone())? {
        return Ok(Some(p));
    }
    
    // Fallback: Return current image if no specific original found (Standard practice in previous code)
    // But previous code checked for current image as fallback.
    // Generic `get_product_image_path` calls `get_image_path_for_entity` which checks both folders.
    // So we can just call that? Actually `get_original_image_path` implies we want the *source* for editing.
    // If no explicit `_orig` file, the current `image_path` IS the original.
    // But `get_image_path_for_entity` requires DB access (State<Database>) which this fn signature DOES NOT HAVE (in previous version).
    // Wait, previous version `get_original_image_path` did NOT take `db` state?
    // Let's check previous code... Yes: `pub fn get_original_image_path(product_id: i32, app_handle: AppHandle)`.
    // It scanned the directory for `product_{id}.*`.
    
    // So I will replicate that scanning logic in `products` then `base`.
    
    // Scan for `product_{id}.*` (excluding `_thumb`, `_orig`)
    let scan_current = |dir: PathBuf| -> Result<Option<String>, String> {
        let read_dir = fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in read_dir {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let prefix = format!("product_{}.", product_id);
                     if name.starts_with(&prefix) && !name.contains("_thumb") && !name.contains("_orig") {
                         return Ok(Some(path.to_str().ok_or("Invalid path")?.to_string()));
                     }
                }
            }
        }
        Ok(None)
    };

     if let Some(p) = scan_current(entity_dir)? { return Ok(Some(p)); }
     if let Some(p) = scan_current(base_dir)? { return Ok(Some(p)); }

    Ok(None)
}

