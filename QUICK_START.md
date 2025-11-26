# Quick Start Guide - Purchase Orders & FIFO System

## First Time Setup (If You Have Existing Products)

### Step 1: Check If Migration Is Needed
```
1. Start the application
2. Go to Settings → Migration (new page)
3. Click "Check Status"
```

If you see products that need migration, continue to Step 2.
If all products are already migrated, skip to "Using the System" below.

### Step 2: Run Data Migration
```
1. Click "Migrate X Product(s)" button
2. Confirm the migration
3. Wait for completion (usually < 1 minute)
4. Review the results:
   - Products migrated
   - Purchase Orders created
   - Batches created
```

The migration will:
- Create a "Data Migration" supplier
- Create Purchase Orders like "PO-MIGRATED-000001" for each product
- Use your current product price as the historical cost
- Create inventory batches for FIFO tracking

### Step 3: Validate Data
```
1. Click "Validate Data" button
2. Check that all products show as "Consistent"
3. If any inconsistencies appear, note them down
```

You're now ready to use the system!

---

## Using the System

### Creating a Purchase Order

**Scenario**: You're buying 100 tablets of Albuterol from ABC Pharma at ₹98 each

```
1. Go to "Purchase Orders" in the sidebar
2. Click "Create Purchase Order"
3. Fill in the form:

   Supplier: Select "ABC Pharmaceuticals"
   Order Date: (Today's date - auto-filled)

   Items:
   - Product: Select "Albuterol"
   - Quantity: 100
   - Unit Cost: 98

   (Click "+ Add Item" if you're buying multiple products)

   Notes: "Monthly stock purchase" (optional)

4. Click "Create Purchase Order"
5. You'll see: "Purchase Order created successfully!"
```

The system creates:
- A new PO with number like "PO-2025-001"
- Stock is NOT yet updated (until you mark it received)

### Receiving Stock

**When the stock arrives:**

```
1. Go to Purchase Orders
2. Click on the PO you just created
3. Review the items
4. Click "Mark as Received"
5. Confirm
```

The system automatically:
- Updates product stock quantity (+100 tablets)
- Creates an inventory batch (100 tablets @ ₹98)
- Creates transaction records
- Updates PO status to "Received"

### Recording Payment

**When you pay the supplier:**

```
1. On the PO details page, scroll to "Payment Summary"
2. Click "+ Add Payment"
3. Fill in:
   - Amount: 9800 (or partial amount like 5000)
   - Payment Method: Cash/UPI/Bank Transfer
   - Payment Date: (Today's date - auto-filled)
   - Note: "Paid in cash" (optional)
4. Click "Record Payment"
```

The system tracks:
- Total amount (₹9,800)
- Total paid (₹9,800 or partial)
- Pending amount (₹0 or remaining)

You can record multiple partial payments!

### Selling Products (Creating Invoices)

**This works the same as before, but now with automatic profit calculation:**

```
1. Go to "Billing" as usual
2. Select customer
3. Add products
4. Click "Create Invoice"
```

**What's NEW:**
The system automatically:
1. Uses FIFO to calculate the Cost of Goods Sold (COGS)
2. Updates inventory batches (oldest first)
3. Records transaction history
4. Calculates: Profit = Revenue - COGS

**Example:**
```
Customer buys 50 tablets of Albuterol @ ₹150 each

Behind the scenes:
- Revenue: 50 × ₹150 = ₹7,500
- COGS: 50 × ₹98 = ₹4,900 (using oldest batch first)
- Profit: ₹7,500 - ₹4,900 = ₹2,600 ✓

Inventory updates:
- Batch #1: 100 → 50 remaining
- Stock: 100 → 50 tablets
```

### Viewing Purchase History

**To see all purchases for a product:**

```
1. Go to "Inventory"
2. Click on any product
3. Scroll down to "Purchase History" section
```

You'll see:
- All Purchase Orders for this product
- Date of each purchase
- Quantity and unit cost
- Total cost per purchase
- Link to view each PO

**Perfect for tracking price changes over time!**

---

## Common Workflows

### Monthly Stock Purchase of Same Product

```
January Purchase:
1. Create PO → Albuterol, 100 tablets @ ₹98
2. Mark as Received → Creates Batch #1
3. Record Payment → ₹9,800

February Purchase (Price increased):
1. Create PO → Albuterol, 150 tablets @ ₹105
2. Mark as Received → Creates Batch #2
3. Record Payment → ₹15,750

System tracks both batches separately!
When customer buys, oldest batch (₹98) is used first (FIFO).
```

### Partial Payments

```
Scenario: PO total is ₹50,000 but you can only pay ₹30,000 now

1. Create and receive the PO
2. Record first payment: ₹30,000
   - System shows: Paid: ₹30,000, Pending: ₹20,000
3. Later, record second payment: ₹20,000
   - System shows: Paid: ₹50,000, Pending: ₹0
```

### Multiple Suppliers for Same Product

```
You can buy the same product from different suppliers!

Purchase 1:
- Supplier: ABC Pharma
- Product: Albuterol
- Cost: ₹98

Purchase 2:
- Supplier: XYZ Medical
- Product: Albuterol (same SKU!)
- Cost: ₹105

System tracks which PO is from which supplier.
View purchase history to compare suppliers!
```

---

## Quick Navigation

### Sidebar Links
- **Purchase Orders** - Create and manage POs
- **Inventory** - View products and purchase history
- **Suppliers** - Manage suppliers
- **Billing** - Create invoices (now with FIFO)
- **Settings** → **Migration** - Data migration tools

### Key Pages

**Purchase Orders List** (`/purchase-orders`)
- Create new PO
- View all POs
- Filter by status
- Search by PO number or supplier

**Purchase Order Details** (`/purchase-orders/details?id=X`)
- View PO details
- Update status
- Record payments
- View payment history

**Inventory Details** (`/inventory/details?id=X`)
- View product details
- See purchase history ← NEW!
- View current stock

**Migration Tools** (`/settings/migration`)
- Check migration status
- Run migration
- Validate data

---

## Understanding FIFO

**What is FIFO?**
First In, First Out - The oldest stock is sold first.

**Example:**

```
Your Inventory:
- Batch 1: 100 tablets @ ₹98 (purchased Jan 1)
- Batch 2: 150 tablets @ ₹105 (purchased Feb 1)

Customer buys 120 tablets:

System uses FIFO:
1. Take 100 from Batch 1 (₹98) = ₹9,800
2. Take 20 from Batch 2 (₹105) = ₹2,100
3. Total COGS = ₹11,900

Remaining:
- Batch 1: DELETED (empty)
- Batch 2: 130 tablets @ ₹105
```

**Why FIFO?**
- Industry standard (60-70% of businesses)
- Accurate profit calculation
- Prevents old stock from sitting
- Clear audit trail

---

## Keyboard Shortcuts & Tips

### Quick Tips

1. **Filter POs by status**
   - Use the status dropdown on PO list page
   - Great for seeing only "ordered" or "pending" POs

2. **Search POs**
   - Type in the search box to find by PO number or supplier
   - Instant filtering

3. **Partial payments**
   - No limit on number of payments
   - Track exactly what you paid and when

4. **Purchase history**
   - Click any product in inventory
   - Scroll down to see all purchases
   - Click "View PO" to see details

5. **Payment methods**
   - Cash, UPI, Bank Transfer, Cheque, Other
   - Add notes for reference numbers

---

## Troubleshooting

### "Stock quantity doesn't match batch total"

**Solution:**
```
1. Go to Settings → Migration
2. Click "Validate Data"
3. Check the inconsistencies table
4. Note which products are inconsistent
```

Usually caused by:
- Products created before migration
- Manual stock adjustments

**Fix:** Run migration again or adjust stock manually

### "Can't create invoice - insufficient stock"

**Check:**
```
1. Go to Inventory
2. Check the product's stock quantity
3. Make sure you have enough stock
```

If stock is incorrect:
- Check purchase history
- Verify POs are marked as "Received"
- Validate batches exist

### "Payment exceeds pending amount"

The system prevents overpayment automatically.

**If you see this:**
```
1. Check the PO total amount
2. Check total paid so far
3. Verify payment amount = pending amount
```

---

## Reports & Analytics

### Available Reports

1. **Purchase History per Product**
   - Go to Inventory → Click product
   - See all purchases with dates and costs

2. **PO Status Report**
   - Go to Purchase Orders
   - Filter by status to see:
     - Draft (not ordered yet)
     - Ordered (waiting for delivery)
     - Received (stock added)
     - Cancelled

3. **Pending Payments**
   - Go to Purchase Orders
   - Look at "Pending" column
   - Shows what you owe suppliers

4. **Supplier Payments**
   - Go to Suppliers → Click supplier
   - See all payments made

---

## Best Practices

### 1. Always Mark POs as Received
```
❌ Don't: Leave POs in "Ordered" status forever
✓ Do: Mark as "Received" when stock arrives

Why: Stock and batches only update when marked received
```

### 2. Record Payments Promptly
```
❌ Don't: Forget to record payments
✓ Do: Record each payment as you make it

Why: Track exactly what you owe suppliers
```

### 3. Use Descriptive Notes
```
❌ Don't: Leave notes blank
✓ Do: Add useful notes like:
  - "Urgent order for high demand"
  - "Paid via UPI - Ref #123456"
  - "Delivered 2 days early"

Why: Helps you remember details later
```

### 4. Check Purchase History
```
✓ Before creating new PO:
  - Check product's purchase history
  - Compare previous costs
  - Choose best supplier
```

### 5. Validate After Migration
```
✓ After first migration:
  - Run data validation
  - Check for inconsistencies
  - Fix any issues before going live
```

---

## Support

### Need Help?

1. **Check the full documentation**
   - `USER_GUIDE.md` - Complete user manual (1,034 lines)
   - `IMPLEMENTATION_COMPLETE.md` - Technical details

2. **Common Questions**
   - Migration issues → See "Troubleshooting" above
   - FIFO calculation → See "Understanding FIFO" above
   - PO workflow → See "Creating a Purchase Order" above

3. **Data Validation**
   - Go to Settings → Migration → Validate Data
   - Check for any inconsistencies

---

**That's it! You're ready to use the new Purchase Order and FIFO system!** 🎉

Start by:
1. Running migration (if needed)
2. Creating your first Purchase Order
3. Marking it as received
4. Recording payment
5. Selling products and seeing automatic profit calculation!
