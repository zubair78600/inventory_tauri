# Inventory Management System - User Guide
## Step-by-Step Guide for Purchase Order Tracking with FIFO

---

## 📖 Table of Contents

1. [Understanding the System](#understanding-the-system)
2. [Daily Operations Guide](#daily-operations-guide)
3. [Scenario 1: Buying Stock (Same Supplier Monthly)](#scenario-1-buying-stock-same-supplier-monthly)
4. [Scenario 2: Buying from Different Suppliers](#scenario-2-buying-from-different-suppliers)
5. [Scenario 3: Selling Products](#scenario-3-selling-products)
6. [Scenario 4: Making Payments](#scenario-4-making-payments)
7. [Viewing Reports](#viewing-reports)
8. [Common Questions](#common-questions)

---

## Understanding the System

### 🎯 Core Concepts

#### 1. **SKU (Stock Keeping Unit)**
- **One SKU per supplier-product combination**
- Example: Paracetamol from Supplier A = SKU "PARA-SUPPA"
- Example: Paracetamol from Supplier B = SKU "PARA-SUPPB"

#### 2. **Purchase Orders (PO)**
- Every time you buy stock, create a **new Purchase Order**
- Purchase Orders track: Date, Quantity, Cost per unit, Supplier
- Multiple POs can exist for the same product (same SKU)

#### 3. **FIFO (First In First Out)**
- System automatically uses **oldest stock first** when selling
- You don't need to do anything - it's automatic!
- Ensures accurate profit calculation

#### 4. **Batches**
- Each Purchase Order creates a **batch** of inventory
- System tracks how much is left in each batch
- When selling, oldest batch is used first

### 📊 Simple Rule

```
┌──────────────────────────────────────────────────────┐
│ SAME SUPPLIER + MONTHLY PURCHASE = SAME SKU + NEW PO │
│                                                       │
│ DIFFERENT SUPPLIER = DIFFERENT SKU + NEW PO          │
└──────────────────────────────────────────────────────┘
```

---

## Daily Operations Guide

### Your Daily Tasks

1. **Receiving Stock** → Create Purchase Order
2. **Selling Products** → Create Invoice (FIFO automatic)
3. **Making Payments** → Record payment against Purchase Order
4. **Checking Stock** → View Inventory with batch details

---

## Scenario 1: Buying Stock (Same Supplier Monthly)

### 📋 When to Use This
- You buy from the same supplier every month
- The product already exists in your system
- Price may be different each month

### 📝 Step-by-Step Process

#### **Step 1: Navigate to Purchase Orders**
```
Main Menu → Purchase Orders → Create New PO
```

#### **Step 2: Select Supplier**
```
Supplier Dropdown: Select "ABC Medical Supply"
Order Date: [Today's date auto-fills]
Expected Delivery: [Optional]
```

#### **Step 3: Add Products**
```
Click "Add Product"
- Product: Select "Paracetamol 500mg" (existing product with SKU PARA-ABC)
- Quantity: 150
- Unit Cost: ₹6.00 (enter current price)
- Total: ₹900 (auto-calculated)
```

**💡 TIP**: The SKU stays the SAME even if price changed from last month!

#### **Step 4: Add More Products (Optional)**
```
Click "+ Add More" to add multiple products to same PO
- Product: Select "Amoxicillin 250mg"
- Quantity: 200
- Unit Cost: ₹10.00
- Total: ₹2,000
```

#### **Step 5: Add Notes (Optional)**
```
Notes: "Monthly stock replenishment - November 2025"
```

#### **Step 6: Review and Create**
```
Grand Total: ₹2,900
Click "Create PO" button
```

### ✅ What Happens Automatically

1. **PO Number Generated**: PO-2025-045
2. **Stock Increased**: Paracetamol 150 → 300 (if you had 150 before)
3. **Batch Created**: System creates Batch #2 with 150 @ ₹6
4. **Transaction Logged**: Inventory transaction recorded
5. **Ready for Payment**: Can now record payments

### 📱 Real Example

**January Purchase**
```
PO-2025-001
- Paracetamol: 100 tablets @ ₹5 = ₹500
- Supplier: MedSupply Ltd
- Stock: 0 → 100
```

**February Purchase (Price Increased)**
```
PO-2025-015
- Paracetamol: 150 tablets @ ₹6 = ₹900
- Supplier: MedSupply Ltd (SAME supplier)
- SKU: PARA-MEDSUPPLY (SAME SKU!)
- Stock: 100 → 250
```

**Result**:
- Total Stock: 250 tablets
- Batch #1: 100 @ ₹5 (January)
- Batch #2: 150 @ ₹6 (February)

---

## Scenario 2: Buying from Different Suppliers

### 📋 When to Use This
- First time buying from a new supplier
- Same medicine but different supplier
- Want to compare supplier prices

### 📝 Step-by-Step Process

#### **Step 1: Create New Product for New Supplier**
```
Main Menu → Inventory → Add Product

Product Details:
- Name: Paracetamol 500mg (Supplier B)
- SKU: PARA-SUPPB (different from existing PARA-SUPPA)
- Supplier: Select "XYZ Pharma" (new supplier)
- Price: ₹4.50 (purchase cost)
- Selling Price: ₹10.00
- Initial Stock: 0 (don't add stock here)
```

**💡 TIP**: Use naming convention: "ProductName (Supplier Name)" for clarity

#### **Step 2: Create Purchase Order**
```
Main Menu → Purchase Orders → Create New PO

- Supplier: XYZ Pharma
- Product: Paracetamol 500mg (Supplier B)
- SKU: PARA-SUPPB
- Quantity: 200
- Unit Cost: ₹4.50
- Total: ₹900
```

#### **Step 3: Save and Review**
```
Click "Create PO"
PO-2025-046 created
Stock: 0 → 200
```

### 📊 Result

Now you have TWO Paracetamol products:
```
Product 1: Paracetamol (Supplier A)
- SKU: PARA-SUPPA
- Stock: 250 tablets
- Cost: ₹5-₹6 (multiple batches)

Product 2: Paracetamol (Supplier B)
- SKU: PARA-SUPPB
- Stock: 200 tablets
- Cost: ₹4.50

Total Paracetamol: 450 tablets
```

### 💡 When to Sell Which One?

**Option 1: Sell cheaper supplier product (higher profit)**
```
Sell PARA-SUPPB
Cost: ₹4.50
Sell: ₹10.00
Profit: ₹5.50 per tablet
```

**Option 2: Sell better quality/brand**
```
Sell PARA-SUPPA
Cost: ₹5-₹6
Sell: ₹10.00
Profit: ₹4-₹5 per tablet
```

---

## Scenario 3: Selling Products

### 📋 When Customer Buys

### 📝 Step-by-Step Process

#### **Step 1: Create Invoice (Normal Process)**
```
Main Menu → Billing → Create Invoice

Customer Name: "Rahul Pharmacy"
Phone: 9876543210
```

#### **Step 2: Add Products**
```
Click on product card or search:
- Product: Paracetamol 500mg (PARA-MEDSUPPLY)
- Quantity: 120 tablets
- Selling Price: ₹10 per tablet (auto-fills from product)
```

#### **Step 3: Review and Generate**
```
Subtotal: ₹1,200
Tax: ₹0 (if applicable)
Discount: ₹0 (if applicable)
Total: ₹1,200

Click "Generate Invoice"
```

### ✅ What Happens Automatically (FIFO Magic!)

**Your Stock Before Sale:**
```
Batch #1: 100 tablets @ ₹5 (oldest)
Batch #2: 150 tablets @ ₹6 (newest)
Total: 250 tablets
```

**System FIFO Calculation (Automatic):**
```
Customer wants: 120 tablets

🤖 Step 1: Take from Batch #1 (oldest)
   - 100 tablets @ ₹5 = ₹500
   - Batch #1 fully depleted ✗

🤖 Step 2: Still need 20 tablets
   - Take 20 from Batch #2 @ ₹6 = ₹120
   - Batch #2 now has 130 left

Total Cost (COGS): ₹620
Revenue: ₹1,200
Profit: ₹580 💰
```

**Your Stock After Sale:**
```
Batch #1: DELETED (used up)
Batch #2: 130 tablets @ ₹6
Total: 130 tablets
```

### 📱 Invoice Shows:

```
┌──────────────────────────────────────┐
│ Invoice #INV-2025-123                │
├──────────────────────────────────────┤
│ Customer: Rahul Pharmacy             │
│ Date: Nov 26, 2025                   │
│                                      │
│ Paracetamol 500mg × 120              │
│ @ ₹10.00 each         ₹1,200.00     │
│                                      │
│ Subtotal:             ₹1,200.00     │
│ Total:                ₹1,200.00     │
│                                      │
│ Cost (FIFO):          ₹620.00       │
│ Profit:               ₹580.00       │
└──────────────────────────────────────┘
```

**💡 KEY POINT**: You don't do anything special! Just create invoice normally. System automatically:
- Uses oldest stock first
- Calculates exact cost
- Shows you the profit
- Updates inventory

---

## Scenario 4: Making Payments

### 📋 When to Use This
- Paying supplier for a purchase order
- Partial payments (advance + balance)
- Full payment

### 📝 Step-by-Step Process

#### **Step 1: Find Purchase Order**
```
Main Menu → Purchase Orders → View All POs

Search or filter:
- By Supplier: "ABC Medical Supply"
- By Date: November 2025
- By Status: "Pending Payment"

Click on: PO-2025-045
```

#### **Step 2: View Payment Status**
```
┌──────────────────────────────────────┐
│ Purchase Order #PO-2025-045          │
├──────────────────────────────────────┤
│ Supplier: ABC Medical Supply         │
│ Date: Nov 1, 2025                    │
│ Total: ₹10,500                       │
│                                      │
│ Payment Status:                      │
│ Total Payable:  ₹10,500             │
│ Total Paid:     ₹5,000 (50%)        │
│ Pending:        ₹5,500              │
│                                      │
│ Payment History:                     │
│ • Nov 1 - ₹5,000 (Cash) - Advance  │
└──────────────────────────────────────┘
```

#### **Step 3: Add New Payment**
```
Click "Add Payment" button

Payment Amount: ₹5,500
Payment Method: Bank Transfer
Date: Nov 26, 2025
Note: "Final payment for PO-2025-045"

Click "Record Payment"
```

### ✅ What Happens

```
Updated Payment Status:
Total Payable:  ₹10,500
Total Paid:     ₹10,500 (100%)
Pending:        ₹0

Status: ✓ FULLY PAID
```

### 💡 Partial Payments Example

**Month 1: Advance Payment**
```
PO Total: ₹10,500
Payment: ₹5,000 (advance)
Pending: ₹5,500
```

**Month 2: Second Payment**
```
Payment: ₹3,000
Total Paid: ₹8,000
Pending: ₹2,500
```

**Month 3: Final Payment**
```
Payment: ₹2,500
Total Paid: ₹10,500
Status: FULLY PAID ✓
```

---

## Viewing Reports

### 📊 1. Purchase History (Per Product)

```
Main Menu → Inventory → Click on Product → Purchase History Tab

┌───────────────────────────────────────────────┐
│ Paracetamol 500mg                             │
│ SKU: PARA-MEDSUPPLY                           │
├───────────────────────────────────────────────┤
│ Current Stock: 330 tablets                    │
│ Current Value: ₹1,980 (FIFO)                  │
│                                               │
│ Purchase History:                             │
├────────┬──────┬─────┬────────┬───────────────┤
│   PO   │ Date │ Qty │  Cost  │  Total        │
├────────┼──────┼─────┼────────┼───────────────┤
│ PO-035 │ 03/30│ 200 │  ₹5.50 │  ₹1,100      │
│ PO-015 │ 02/08│ 150 │  ₹6.00 │  ₹900  (sold)│
│ PO-001 │ 01/05│ 100 │  ₹5.00 │  ₹500  (sold)│
└────────┴──────┴─────┴────────┴───────────────┘
```

### 📦 2. Current Batches (FIFO View)

```
Main Menu → Inventory → Click on Product → Batches Tab

┌───────────────────────────────────────────────┐
│ Current Inventory Batches (FIFO Order)       │
├───────────────────────────────────────────────┤
│ Batch #2: 130 tablets @ ₹6.00 = ₹780         │
│ ├─ PO: PO-2025-015                           │
│ ├─ Date: Feb 8, 2025                         │
│ └─ Status: Next to sell                      │
│                                               │
│ Batch #3: 200 tablets @ ₹5.50 = ₹1,100      │
│ ├─ PO: PO-2025-035                           │
│ ├─ Date: Mar 30, 2025                        │
│ └─ Status: Will sell after Batch #2          │
│                                               │
│ Total Stock: 330 tablets                     │
│ Total Value: ₹1,880 (FIFO)                   │
└───────────────────────────────────────────────┘
```

### 🧾 3. Supplier Purchase Orders

```
Main Menu → Suppliers → Click on Supplier → Purchase Orders Tab

┌───────────────────────────────────────────────┐
│ ABC Medical Supply                            │
│ Purchase Orders                               │
├───────────────────────────────────────────────┤
│ PO-2025-045 │ Nov 26 │ ₹10,500 │ PAID       │
│ PO-2025-023 │ Oct 15 │  ₹4,750 │ PENDING    │
│ PO-2025-001 │ Oct 1  │  ₹4,900 │ PAID       │
├───────────────────────────────────────────────┤
│ Total Purchases: ₹20,150                      │
│ Total Paid: ₹15,400                           │
│ Total Pending: ₹4,750                         │
└───────────────────────────────────────────────┘
```

### 💰 4. Profit Report (Per Invoice)

```
Main Menu → Invoices → Click on Invoice

┌──────────────────────────────────────┐
│ Invoice #INV-2025-123                │
├──────────────────────────────────────┤
│ Customer: Rahul Pharmacy             │
│ Date: Nov 26, 2025                   │
│                                      │
│ Items Sold:                          │
│ Paracetamol × 120                    │
│                                      │
│ Revenue:        ₹1,200.00           │
│ Cost (FIFO):    ₹620.00             │
│ Gross Profit:   ₹580.00             │
│ Profit Margin:  48.3%               │
│                                      │
│ FIFO Breakdown:                      │
│ • 100 tablets @ ₹5 = ₹500           │
│ • 20 tablets @ ₹6 = ₹120            │
└──────────────────────────────────────┘
```

---

## Common Questions

### ❓ Q1: "I bought 100 units in January at ₹5, then 100 in February at ₹6. Customer wants 150. What happens?"

**Answer**: FIFO automatic calculation:
```
Sale: 150 units

System takes:
1. All 100 @ ₹5 from January batch = ₹500
2. Then 50 @ ₹6 from February batch = ₹300
Total Cost = ₹800

Remaining: 50 units @ ₹6 from February
```

---

### ❓ Q2: "Should I create a new product every month when I buy stock?"

**Answer**: **NO!**
- Same supplier? Use SAME SKU, create NEW Purchase Order
- Different supplier? Create NEW product with different SKU

**Example**:
```
❌ WRONG:
Jan: Create "Paracetamol-Jan" SKU-001
Feb: Create "Paracetamol-Feb" SKU-002

✅ CORRECT:
Jan: Create PO-001 for SKU "PARA-MED" (100 @ ₹5)
Feb: Create PO-002 for SKU "PARA-MED" (100 @ ₹6)
```

---

### ❓ Q3: "I have Albuterol from Supplier A (₹98) and Supplier B (₹88). Same product or different?"

**Answer**: **Different SKUs**

```
Product 1:
- Name: Albuterol (Supplier A)
- SKU: ALBU-SUPPA
- Cost: ₹98

Product 2:
- Name: Albuterol (Supplier B)
- SKU: ALBU-SUPPB
- Cost: ₹88

When selling, YOU decide which one to use:
- Sell ALBU-SUPPB for higher profit (cheaper cost)
- Sell ALBU-SUPPA for quality/brand reasons
```

---

### ❓ Q4: "Do I need to manually calculate FIFO when selling?"

**Answer**: **NO!** System does it automatically!

```
You do: Create invoice → Select product → Enter quantity
System does:
✓ Find oldest batches
✓ Calculate exact cost
✓ Deduct from batches in order
✓ Show you the profit
✓ Update inventory
```

---

### ❓ Q5: "Can I see which batch stock came from?"

**Answer**: **YES!**

```
Go to: Inventory → Product Details → Batches Tab

You'll see:
Batch #1: 50 tablets @ ₹5 from PO-001 (Jan 5)
Batch #2: 100 tablets @ ₹6 from PO-015 (Feb 8)
Batch #3: 200 tablets @ ₹5.50 from PO-035 (Mar 30)

Next sale will use Batch #1 first!
```

---

### ❓ Q6: "How do I track payments per purchase?"

**Answer**:

```
Step 1: Go to Purchase Orders → View PO
Step 2: See payment status:
        Total: ₹10,000
        Paid: ₹5,000
        Pending: ₹5,000
Step 3: Click "Add Payment"
Step 4: Enter amount, method, date
Step 5: System updates pending automatically
```

---

### ❓ Q7: "What if price changes every month?"

**Answer**: **That's normal!** System handles it:

```
Month 1: PO-001, SKU "PARA", 100 @ ₹5 = ₹500
Month 2: PO-002, SKU "PARA", 100 @ ₹6 = ₹600 ← Price changed!
Month 3: PO-003, SKU "PARA", 100 @ ₹5.50 = ₹550 ← Price changed again!

Same SKU, different prices tracked in batches.
FIFO ensures accurate profit calculation.
```

---

### ❓ Q8: "Can I add multiple products to one Purchase Order?"

**Answer**: **YES!**

```
PO-2025-050
Supplier: ABC Medical

Items:
- Paracetamol 100 @ ₹5 = ₹500
- Amoxicillin 200 @ ₹10 = ₹2,000
- Ibuprofen 150 @ ₹8 = ₹1,200

Total: ₹3,700

One payment can cover all items!
```

---

## Quick Reference Card

### 📋 Monthly Stock Purchase Checklist

```
□ Step 1: Purchase Orders → Create New PO
□ Step 2: Select Supplier
□ Step 3: Add Product (use existing SKU if same supplier)
□ Step 4: Enter Quantity and Current Price
□ Step 5: Click "Create PO"
□ Step 6: Record Payment (if paying now)
□ Done! Stock updated automatically ✓
```

### 🔑 Key Reminders

```
✓ Same supplier monthly = SAME SKU, NEW PO
✓ Different supplier = DIFFERENT SKU, NEW PO
✓ FIFO is automatic when selling
✓ System calculates profit for you
✓ View purchase history anytime
✓ Track payments per PO
```

---

## Need Help?

### Common Issues

**Issue**: "Can't create product with same SKU"
- **Solution**: Don't create new product! Create new Purchase Order for existing product.

**Issue**: "Don't know which supplier a product came from"
- **Solution**: Check Product Details → Purchase History tab

**Issue**: "Profit seems wrong"
- **Solution**: System uses FIFO. Check Batches tab to see cost breakdown.

**Issue**: "Stock not updating after PO"
- **Solution**: Check if PO status is "Received". Update status if needed.

---

## Congratulations! 🎉

You now know how to:
- ✅ Create Purchase Orders for stock purchases
- ✅ Handle same supplier monthly (same SKU)
- ✅ Handle different suppliers (different SKUs)
- ✅ Let system calculate FIFO automatically
- ✅ Track payments per purchase
- ✅ View complete purchase history
- ✅ Know exact profit per sale

**Remember**: The system does the hard work. You just:
1. Create PO when buying
2. Create invoice when selling
3. System handles FIFO automatically!

---

**Last Updated**: November 2025
**Version**: 1.0
