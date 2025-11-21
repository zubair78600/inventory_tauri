mod commands;
mod db;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .setup(|app| {
      // Initialize database
      let app_handle = app.handle();
      let app_data_dir = app_handle.path().app_data_dir()
        .expect("Failed to get app data directory");

      std::fs::create_dir_all(&app_data_dir)
        .expect("Failed to create app data directory");

      let db_path = app_data_dir.join("inventory.db");
      log::info!("Database path: {:?}", db_path);

      let db = Database::new(db_path)
        .expect("Failed to initialize database");

      // Store database in app state
      app.manage(db);

      log::info!("Application initialized successfully");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::get_products,
      commands::get_product,
      commands::create_product,
      commands::update_product,
      commands::delete_product,
      commands::add_mock_products,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
