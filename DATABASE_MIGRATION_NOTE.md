# Database Migration - Important Note

## What Just Happened

The Purchase Order and FIFO inventory system tables have been added to the database migration system.

## Next Steps

**IMPORTANT: You need to restart the application for the database migration to run.**

### How to Apply the Migration:

1. **Close the current application** if it's running
2. **Start the application again** using:
   ```bash
   npm run tauri dev
   ```
   OR launch the bundled app at:
   ```
   src-tauri/target/debug/bundle/macos/Inventory System.app
   ```

3. **Check the console logs** - you should see:
   ```
   [INFO] Running Purchase Order and FIFO migration...
   [INFO] Purchase Order and FIFO migration completed successfully
   ```

4. **Verify the tables were created** by:
   - Going to Purchase Orders page (should load without errors)
   - Creating a test Purchase Order
   - Going to Settings → Migration to check status

## What Tables Were Created

The migration creates 5 new tables:

1. **purchase_orders** - Main PO records
2. **purchase_order_items** - Line items for each PO
3. **inventory_batches** - FIFO batch tracking
4. **inventory_transactions** - Complete audit trail
5. **product_suppliers** - Many-to-many product-supplier relationship

Plus 16 performance indexes for fast queries.

## If You See Errors

### Error: "no such table: purchase_orders"

**Solution**: The migration hasn't run yet. Close and restart the app.

### Error: "table already exists"

**Solution**: This is fine! The migration uses `CREATE TABLE IF NOT EXISTS`, so it won't duplicate tables.

### Error After Restart

If you still see errors after restarting:

1. Check the console logs for migration errors
2. The migration SQL is at: `src-tauri/src/db/migration_purchase_orders.sql`
3. You can manually check the database at: `~/Library/Application Support/com.inventory.system/inventory.db`

## Migration is Automatic

The migration runs automatically when the application starts, so you don't need to do anything special except restart the app once.

## After Migration

Once the migration is complete:

1. ✅ Purchase Orders page will work
2. ✅ You can create POs
3. ✅ FIFO calculations will work on invoices
4. ✅ You can run data migration for existing products (Settings → Migration)

## Database Location

Your database file is located at:
```
~/Library/Application Support/com.inventory.system/inventory.db
```

The migration is non-destructive - it only adds new tables and indexes, never deletes or modifies existing data.

---

**Status**: Migration code deployed ✅
**Next Action**: Restart the application
