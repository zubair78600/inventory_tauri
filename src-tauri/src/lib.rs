mod commands;
mod db;

use db::Database;
use tauri::{Manager, menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder}};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
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

      // Create Settings menu item
      let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;

      // Create Application submenu (appears under app name on macOS)
      let app_submenu = SubmenuBuilder::new(app, "Inventory System")
        .item(&settings_item)
        .quit()
        .build()?;

      // Create Edit submenu
      let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

      // Create the menu bar
      let menu = MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&edit_submenu)
        .build()?;

      app.set_menu(menu)?;

      // Handle menu events
      let app_handle_clone = app.handle().clone();
      app.on_menu_event(move |_app, event| {
        if event.id() == "settings" {
          if let Some(window) = app_handle_clone.get_webview_window("main") {
            let _ = window.eval("window.location.href = '/settings'");
          }
        }
      });

      log::info!("Application initialized successfully");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::get_products,
      commands::get_product,
      commands::get_products_by_supplier,
      commands::create_product,
      commands::update_product,
      commands::delete_product,
      commands::add_mock_products,
      commands::get_suppliers,
      commands::get_supplier,
      commands::create_supplier,
      commands::update_supplier,
      commands::delete_supplier,
      commands::add_mock_suppliers,
      commands::create_supplier_payment,
      commands::get_supplier_payments,
      commands::get_supplier_payment_summary,
      commands::delete_supplier_payment,
      commands::get_customers,
      commands::get_customer,
      commands::create_customer,
      commands::update_customer,
      commands::delete_customer,
      commands::add_mock_customers,
      commands::get_dashboard_stats,
      commands::get_low_stock_products,
      commands::customer_search,
      commands::get_customer_report,
      commands::get_invoices,
      commands::get_invoices_by_product,
      commands::get_invoice,
      commands::get_product_sales_summary,
      commands::create_invoice,
      commands::delete_invoice,
      commands::omnisearch,
      commands::export_products_csv,
      commands::export_customers_csv,
      commands::get_deleted_items,
      commands::restore_customer,
      commands::restore_product,
      commands::restore_supplier,
      commands::permanently_delete_item,
      commands::restore_supplier,
      commands::permanently_delete_item,
      commands::clear_trash,
      commands::login,
      commands::get_users,
      commands::create_user,
      commands::update_user,
      commands::delete_user,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
