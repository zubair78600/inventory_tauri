# Quick Migration Guide - Fix "Insufficient inventory" Error

## The Problem

You're seeing: **"Checkout failed: Failed to record FIFO sale: Insufficient inventory!"**

This means your products have stock quantities but no inventory batches for FIFO cost tracking.

## Quick Fix (2 minutes)

### Step 1: Navigate to Migration Page

**Option A: Direct URL**
Type in browser: `/settings/migration`

**Option B: Manual navigation**
1. Click on "Settings" in the sidebar
2. Add `/migration` to the URL manually
3. Or create a bookmark to: `http://localhost:3000/settings/migration`

### Step 2: Run Migration

1. Click **"Check Status"** button
2. You'll see:
   ```
   Total Products: X
   Already Migrated: 0
   Need Migration: X  ← This shows how many need migration
   ```

3. Click **"Migrate X Product(s)"** button

4. Wait for completion (usually < 10 seconds)

5. You'll see results:
   ```
   Products Migrated: X
   Purchase Orders Created: X
   Batches Created: X
   ```

### Step 3: Verify

1. Click **"Validate Data"** button
2. Should show: **"All data is consistent! ✓"**

### Step 4: Try Checkout Again

1. Go back to Billing
2. Create an invoice
3. ✅ It should work now!

## What Just Happened?

The migration:
- Created a "Data Migration" supplier
- Created Purchase Orders (PO-MIGRATED-XXXXXX) for each product
- Created inventory batches using your current stock
- Used your current product prices as historical costs

Your products now have:
- ✅ Same stock quantities (unchanged)
- ✅ Inventory batches for FIFO tracking
- ✅ Automatic cost calculation
- ✅ Profit tracking

## Alternative: Create a PO Manually

If you only want to test with one product:

1. Go to **Purchase Orders**
2. Click **"Create Purchase Order"**
3. Select:
   - Supplier: Any supplier
   - Product: The product you want to sell
   - Quantity: 100
   - Unit Cost: ₹98 (actual cost you paid)
4. Save and **"Mark as Received"**
5. Now you can create invoices for that product

## Understanding the Error

**Before Migration:**
```
Product: Albuterol
Stock Quantity: 100  ← Shows in inventory
Inventory Batches: 0  ← No cost tracking!
---
Try to sell → ❌ Error: "Insufficient inventory!"
```

**After Migration:**
```
Product: Albuterol
Stock Quantity: 100  ← Same as before
Inventory Batches: 1  ← Now has batch tracking!
  - Batch #1: 100 units @ ₹98
---
Try to sell → ✅ Works! FIFO deducts from batch
```

## Still Need Help?

1. Make sure the app is restarted after the fix
2. Check console for any errors
3. Go to Settings → Migration → "Validate Data"
4. Look for inconsistencies

---

**TL;DR**: Go to `/settings/migration` and click "Migrate Products" ✅
