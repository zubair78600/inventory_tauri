mod commands;
mod db;
mod services;

use db::Database;
use tauri::{Manager, Emitter, menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder}};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_biometry::init())
    .plugin(tauri_plugin_shell::init())
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

      // Initialize AI sidecar state
      app.manage(commands::AiSidecarState::default());

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
          // Emit an event to the frontend to show password prompt before navigating
          let _ = app_handle_clone.emit("open-settings-menu", ());
        }
      });

      log::info!("Application initialized successfully");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
            commands::products::get_products,
            commands::products::get_product,
            commands::products::get_products_by_supplier,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::delete_product,
            commands::products::add_mock_products,
            commands::products::get_top_selling_products,
            commands::products::get_products_by_ids,
            commands::products::get_unique_categories,
      commands::get_suppliers,
      commands::get_supplier,
      commands::create_supplier,
      commands::update_supplier,
      commands::delete_supplier,
      commands::add_mock_suppliers,
      commands::create_supplier_payment,
      commands::get_supplier_payments,
      commands::get_all_product_payments,
      commands::get_supplier_payment_summary,
      commands::get_all_product_payment_summary,
      commands::get_supplier_product_purchase_history,
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
      // New analytics commands
      commands::get_sales_analytics,
      commands::get_revenue_trend,
      commands::get_top_products,
      commands::get_sales_by_payment_method,
      commands::get_sales_by_region,
      commands::get_customer_analytics,
      commands::get_top_customers,
      commands::get_customer_trend,
      commands::get_inventory_health,
      commands::get_low_stock_alerts,
      commands::get_purchase_analytics,
      commands::get_cashflow_trend,
      commands::get_top_suppliers,
      commands::get_tax_summary,
      commands::get_discount_analysis,
      commands::get_invoices,
      commands::get_invoices_by_product,
      commands::get_invoice,
      commands::get_product_sales_summary,
      commands::create_invoice,
      commands::delete_invoice,
      commands::update_invoice,
      commands::update_invoice_items,
      commands::get_deleted_invoices,
      commands::get_invoice_modifications,
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
      commands::get_all_modifications,
      commands::restore_modification,
      commands::permanently_delete_modification,
      commands::clear_modifications_history,
      commands::login,
      commands::get_users,
      commands::create_user,
      commands::update_user,
      commands::delete_user,
      commands::create_purchase_order,
      commands::get_purchase_orders,
      commands::get_purchase_order_by_id,
      commands::update_purchase_order_status,
      commands::add_payment_to_purchase_order,
      commands::get_product_purchase_summary,
      commands::get_product_purchase_history,
      commands::migrate_existing_products,
      commands::check_migration_status,
      commands::validate_migration,
      // Settings commands
      commands::get_app_setting,
      commands::set_app_setting,
      commands::get_all_settings,
      commands::delete_app_setting,
      commands::export_settings_json,
      commands::import_settings_json,
      // Image commands
      commands::save_product_image,
      commands::download_product_image,
      commands::get_product_image_path,
      commands::delete_product_image,
      commands::search_google_images,
      commands::get_pictures_directory,
      commands::migrate_images,
      // Supplier & Customer Image commands
      commands::save_supplier_image,
      commands::get_supplier_image_path,
      commands::delete_supplier_image,
      commands::save_customer_image,
      commands::get_customer_image_path,
      commands::delete_customer_image,
      // Biometric authentication commands
      commands::generate_biometric_token,
      commands::verify_biometric_token,
      commands::disable_biometric,
      commands::get_biometric_status,
      commands::get_biometric_status_by_username,
      commands::has_any_biometric_enrollment,
      // Customer payment/credit commands
      commands::create_customer_payment,
      commands::get_customer_payments,
      commands::get_invoice_payments,
      commands::get_customer_credit_history,
      commands::get_customer_credit_summary,
      commands::delete_customer_payment,
      // AI Chat commands
      commands::start_ai_sidecar,
      commands::stop_ai_sidecar,
      commands::check_ai_sidecar_status,
      commands::check_sidecar_downloaded,
      commands::download_ai_sidecar,
      commands::export_csv,
      commands::import_csv_chunk,
      commands::scan_duplicates,
      // Share commands
      commands::open_whatsapp_chat,
      commands::open_whatsapp_with_file,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
