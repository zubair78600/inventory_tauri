# How to Fix "Checkout failed: Insufficient inventory" Error

## Why This Happens

Your products have `stock_quantity` but no **inventory batches**. The FIFO system requires batches to track costs accurately.

**Example:**
- Product: Albuterol
- Stock Quantity: 100 (shows in inventory)
- Inventory Batches: 0 (no cost tracking data)
- Result: Can't create invoice ❌

## Solution: Run Data Migration

### Option 1: Use the Migration UI (Recommended)

1. **Go to Settings → Migration** (you may need to add this route)
2. Click **"Check Status"**
3. You'll see how many products need migration
4. Click **"Migrate X Product(s)"**
5. Wait for completion
6. Click **"Validate Data"** to verify

### Option 2: Create Migration Page

If Settings → Migration doesn't exist yet, create it:

**File: `app/settings/page.tsx`**

Add a link to the migration page:

```tsx
import Link from 'next/link';

export default function Settings() {
  return (
    <div className="space-y-5">
      <h1 className="page-title">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/settings/migration"
          className="p-4 border rounded-lg hover:bg-gray-50"
        >
          <h3 className="font-semibold">Data Migration</h3>
          <p className="text-sm text-gray-600">
            Migrate existing products to Purchase Order system
          </p>
        </Link>
      </div>
    </div>
  );
}
```

The migration page already exists at: `app/settings/migration/page.tsx`

### Option 3: Quick Fix - Create a Test PO

If you just want to test, create a Purchase Order for a product:

1. **Go to Purchase Orders**
2. **Click "Create Purchase Order"**
3. Fill in:
   - Supplier: (Select or create one)
   - Product: Select the product you want to sell
   - Quantity: 100 (or whatever quantity you need)
   - Unit Cost: ₹98 (the actual cost you paid)
4. **Click "Create Purchase Order"**
5. **Click "Mark as Received"** on the PO details page

This creates inventory batches for that product!

## What the Migration Does

The migration will:

1. ✅ Find all products with `stock_quantity > 0`
2. ✅ Create a "Data Migration" supplier
3. ✅ Create Purchase Orders like "PO-MIGRATED-000001"
4. ✅ Create inventory batches for each product
5. ✅ Use current product price as historical cost
6. ✅ Validate that batch totals match stock quantities

After migration:
- Products keep the same stock quantity
- Now have inventory batches for FIFO tracking
- You can create invoices normally
- Automatic profit calculation works

## Verify Migration Worked

After running migration:

1. **Go to Inventory → Click a product**
2. **Scroll to "Purchase History"**
3. You should see a migration PO
4. Try creating an invoice again
5. ✅ It should work!

## Understanding the System

### Before FIFO (Your Old System):
```
Product: Albuterol
Stock: 100
Price: ₹98
---
When customer buys:
- Deduct stock manually
- Calculate profit manually
```

### After FIFO (New System):
```
Product: Albuterol
Stock: 100
Batches:
  - Batch #1: 100 units @ ₹98 (from PO-2025-001)

When customer buys 50 units:
- System uses Batch #1 (oldest first)
- COGS: 50 × ₹98 = ₹4,900
- Batch #1: 50 units remaining
- Automatic profit: Revenue - COGS
```

### When Price Changes:
```
February: Buy 150 more @ ₹105
Stock: 150 (total now 200)
Batches:
  - Batch #1: 50 units @ ₹98 (remaining from January)
  - Batch #2: 150 units @ ₹105 (new purchase)

Customer buys 100 units:
- Uses Batch #1 first: 50 × ₹98 = ₹4,900
- Then Batch #2: 50 × ₹105 = ₹5,250
- Total COGS: ₹10,150
- Accurate profit calculation!
```

## Common Questions

**Q: Will migration change my stock quantities?**
A: No! Stock quantities stay the same. We only add batch tracking.

**Q: What cost will be used for existing stock?**
A: The current product price will be used as the historical cost.

**Q: Can I still create POs after migration?**
A: Yes! The system works normally. Migration is just a one-time setup.

**Q: What if I don't want to migrate everything?**
A: You can create POs manually for specific products instead.

## Error Messages Explained

- **"Insufficient inventory! Need 20 more units"**
  → Product has stock but no batches. Run migration or create PO.

- **"UNIQUE constraint failed: purchase_orders.po_number"**
  → PO number already exists. Fixed in latest version.

- **"no such table: purchase_orders"**
  → Database migration didn't run. Restart the app.

---

**Quick Start: Go to Settings → Migration and click "Migrate Products"** ✅
