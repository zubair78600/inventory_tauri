# Test Plan - Inventory System Backend

**Version:** 1.0
**Date:** November 21, 2024
**Status:** Ready for Testing

---

## Test Environment Setup

### Prerequisites
- [x] Rust toolchain installed
- [x] Node.js and npm installed
- [x] Tauri CLI installed
- [x] All dependencies installed (`npm install`, `cargo build`)

### Database Location
- **macOS:** `~/Library/Application Support/com.inventry.tauri/inventory.db`
- **Reset Database:** Delete the file to start fresh

---

## Phase 11: Comprehensive Testing Checklist

### 1. Products Module (6 commands)

#### Test: Load Mock Products
```typescript
const result = await productCommands.addMockData();
// Expected: "Successfully added 10 mock products"
```

#### Test: Get All Products
```typescript
const products = await productCommands.getAll();
// Expected: Array of 10 products
// Verify: Dell XPS, LG Monitor, etc.
```

#### Test: Search Products
```typescript
const results = await productCommands.getAll("laptop");
// Expected: Products matching "laptop" (Dell XPS, Laptop Stand)
```

#### Test: Get Single Product
```typescript
const product = await productCommands.getById(1);
// Expected: Product with id 1
// Verify: Has name, sku, price, stock_quantity
```

#### Test: Create Product
```typescript
const newProduct = await productCommands.create({
  name: "Test Product",
  sku: "TEST-001",
  price: 99.99,
  stock_quantity: 100,
  supplier_id: null
});
// Expected: Product created with generated ID
// Verify: Can retrieve it with getById
```

#### Test: Create Duplicate SKU (Should Fail)
```typescript
try {
  await productCommands.create({
    name: "Duplicate",
    sku: "TEST-001", // Same SKU
    price: 50.00,
    stock_quantity: 10,
    supplier_id: null
  });
} catch (error) {
  // Expected: Error "Product with SKU 'TEST-001' already exists"
}
```

#### Test: Update Product
```typescript
const updated = await productCommands.update({
  id: 1,
  name: "Updated Product Name",
  sku: "DELL-XPS-15",
  price: 1399.99,
  stock_quantity: 20,
  supplier_id: null
});
// Expected: Product updated successfully
// Verify: Changes persisted
```

#### Test: Delete Product
```typescript
await productCommands.delete(11); // Delete test product
const products = await productCommands.getAll();
// Expected: Product removed
// Verify: Count reduced by 1
```

**Products Module: ✅ PASS / ❌ FAIL**

---

### 2. Suppliers Module (6 commands)

#### Test: Load Mock Suppliers
```typescript
const result = await supplierCommands.addMockData();
// Expected: "Successfully added 5 mock suppliers"
```

#### Test: Get All Suppliers
```typescript
const suppliers = await supplierCommands.getAll();
// Expected: Array of 5 suppliers
```

#### Test: Create Supplier
```typescript
const supplier = await supplierCommands.create({
  name: "Test Supplier Inc",
  contact_info: "test@example.com"
});
// Expected: Supplier created
```

#### Test: Update Supplier
```typescript
const updated = await supplierCommands.update({
  id: 1,
  name: "Updated Supplier Name",
  contact_info: "updated@example.com"
});
// Expected: Supplier updated
```

#### Test: Delete Supplier (Should Fail if Products Exist)
```typescript
// First, create a product with supplier_id = 1
await productCommands.create({
  name: "Product with Supplier",
  sku: "SUPP-TEST-001",
  price: 100.00,
  stock_quantity: 10,
  supplier_id: 1
});

// Try to delete supplier
try {
  await supplierCommands.delete(1);
} catch (error) {
  // Expected: Error about products being linked
}
```

#### Test: Delete Supplier (Should Succeed)
```typescript
await supplierCommands.delete(6); // Delete test supplier with no products
// Expected: Success
```

**Suppliers Module: ✅ PASS / ❌ FAIL**

---

### 3. Customers Module (6 commands)

#### Test: Load Mock Customers
```typescript
const result = await customerCommands.addMockData();
// Expected: "Successfully added 5 mock customers"
```

#### Test: Get All Customers
```typescript
const customers = await customerCommands.getAll();
// Expected: Array of 5 customers
// Verify: Each has created_at and updated_at timestamps
```

#### Test: Search Customers
```typescript
const results = await customerCommands.getAll("acme");
// Expected: Customers matching "acme"
```

#### Test: Create Customer
```typescript
const customer = await customerCommands.create({
  name: "Test Customer",
  email: "test@customer.com",
  phone: "555-0123",
  address: "123 Test St"
});
// Expected: Customer created with timestamps
// Verify: created_at === updated_at
```

#### Test: Update Customer (Timestamps)
```typescript
const original = await customerCommands.getById(1);
await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

const updated = await customerCommands.update({
  id: 1,
  name: "Updated Customer",
  email: original.email,
  phone: original.phone,
  address: original.address
});
// Expected: updated_at > created_at
```

#### Test: Delete Customer
```typescript
await customerCommands.delete(6); // Delete test customer
// Expected: Success
```

**Customers Module: ✅ PASS / ❌ FAIL**

---

### 4. Analytics Module (2 commands)

#### Test: Dashboard Stats
```typescript
const stats = await analyticsCommands.getDashboardStats();
// Expected: {
//   total_products: 10+,
//   total_suppliers: 5+,
//   total_customers: 5+,
//   total_invoices: 0 (before invoice tests),
//   low_stock_products: count of products with stock < 10,
//   total_revenue: 0.0 (before invoices)
// }
```

#### Test: Low Stock Products
```typescript
// First, create a low stock product
await productCommands.create({
  name: "Low Stock Item",
  sku: "LOW-STOCK-001",
  price: 10.00,
  stock_quantity: 5, // < 10
  supplier_id: null
});

const lowStock = await analyticsCommands.getLowStockProducts();
// Expected: Array including "Low Stock Item"
// Verify: All have stock_quantity < 10
```

**Analytics Module: ✅ PASS / ❌ FAIL**

---

### 5. Invoices Module (4 commands)

#### Test: Create Invoice (Stock Updates)
```typescript
// Get initial stock
const productBefore = await productCommands.getById(1);
const initialStock = productBefore.stock_quantity;

// Create invoice
const invoice = await invoiceCommands.create({
  customer_id: 1,
  items: [
    { product_id: 1, quantity: 2, unit_price: 1299.99 },
    { product_id: 2, quantity: 1, unit_price: 449.99 }
  ],
  tax_amount: 175.00,
  discount_amount: 0,
  payment_method: "Credit Card"
});

// Verify invoice created
// Expected: invoice_number like "INV-000001"
// Expected: total_amount = (2 * 1299.99 + 1 * 449.99) = 3049.97

// Verify stock updated
const productAfter = await productCommands.getById(1);
// Expected: productAfter.stock_quantity === initialStock - 2
```

#### Test: Create Invoice (Insufficient Stock - Should Fail)
```typescript
try {
  await invoiceCommands.create({
    customer_id: 1,
    items: [
      { product_id: 1, quantity: 1000, unit_price: 100 } // More than available
    ]
  });
} catch (error) {
  // Expected: Error about insufficient stock
}
```

#### Test: Create Invoice (Invalid Customer - Should Fail)
```typescript
try {
  await invoiceCommands.create({
    customer_id: 9999, // Non-existent
    items: [
      { product_id: 1, quantity: 1, unit_price: 100 }
    ]
  });
} catch (error) {
  // Expected: Error "Customer with id 9999 not found"
}
```

#### Test: Get All Invoices
```typescript
const invoices = await invoiceCommands.getAll();
// Expected: Array with at least 1 invoice
```

#### Test: Get Invoice with Items
```typescript
const invoiceWithItems = await invoiceCommands.getById(1);
// Expected: {
//   invoice: { id, invoice_number, customer_id, total_amount, ... },
//   items: [
//     { product_id, product_name, product_sku, quantity, unit_price }
//   ]
// }
// Verify: Items include product details
```

#### Test: Filter Invoices by Customer
```typescript
const customerInvoices = await invoiceCommands.getAll(1);
// Expected: Only invoices for customer_id = 1
```

#### Test: Delete Invoice (Stock Restoration)
```typescript
// Get product stock before delete
const productBefore = await productCommands.getById(1);
const stockBefore = productBefore.stock_quantity;

// Delete invoice
await invoiceCommands.delete(1);

// Verify stock restored
const productAfter = await productCommands.getById(1);
// Expected: productAfter.stock_quantity > stockBefore
// Expected: Stock increased by quantity from deleted invoice
```

#### Test: Dashboard Stats After Invoices
```typescript
const stats = await analyticsCommands.getDashboardStats();
// Verify: total_invoices updated
// Verify: total_revenue reflects invoice totals
```

**Invoices Module: ✅ PASS / ❌ FAIL**

---

### 6. Search Module (3 commands)

#### Test: OmniSearch
```typescript
const results = await searchCommands.omnisearch("Dell");
// Expected: {
//   products: [results matching "Dell"],
//   customers: [],
//   suppliers: [],
//   invoices: []
// }
```

#### Test: OmniSearch Multiple Entities
```typescript
const results = await searchCommands.omnisearch("Inc");
// Expected: Results in suppliers and possibly customers
// Verify: Max 10 results per entity type
```

#### Test: Export Products CSV
```typescript
const csv = await searchCommands.exportProductsCSV();
// Expected: CSV string starting with "ID,Name,SKU,Price,Stock Quantity,Supplier ID\n"
// Verify: Contains all products
// Verify: Proper CSV formatting
```

#### Test: Export Customers CSV
```typescript
const csv = await searchCommands.exportCustomersCSV();
// Expected: CSV string starting with "ID,Name,Email,Phone,Address\n"
// Verify: Contains all customers
// Verify: Null values handled correctly
```

**Search Module: ✅ PASS / ❌ FAIL**

---

## Edge Cases & Error Handling

### Test: Empty Database
- [ ] Start with fresh database
- [ ] Call getAll on each entity
- [ ] Expected: Empty arrays, no errors

### Test: Large Dataset Performance
- [ ] Create 100+ products
- [ ] Create 50+ customers
- [ ] Create 20+ invoices
- [ ] Measure response times
- [ ] Expected: < 1 second for all operations

### Test: Special Characters
- [ ] Create product with name containing quotes, commas
- [ ] Create customer with special chars in email
- [ ] Expected: Properly handled/escaped

### Test: Concurrent Operations
- [ ] Create invoice while reading products
- [ ] Expected: No race conditions, transactions work correctly

---

## Performance Benchmarks

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Get 100 products | < 100ms | | |
| Create product | < 50ms | | |
| Create invoice (5 items) | < 200ms | | |
| OmniSearch | < 150ms | | |
| Export CSV (100 records) | < 200ms | | |
| Dashboard stats | < 100ms | | |

---

## Bug Log

| # | Severity | Description | Status | Fix |
|---|----------|-------------|--------|-----|
| | | | | |

---

## Test Results Summary

**Date Tested:** ___________
**Tested By:** ___________

**Modules:**
- [ ] Products Module: PASS / FAIL
- [ ] Suppliers Module: PASS / FAIL
- [ ] Customers Module: PASS / FAIL
- [ ] Analytics Module: PASS / FAIL
- [ ] Invoices Module: PASS / FAIL
- [ ] Search Module: PASS / FAIL

**Edge Cases:**
- [ ] Empty Database: PASS / FAIL
- [ ] Large Dataset: PASS / FAIL
- [ ] Special Characters: PASS / FAIL
- [ ] Concurrent Operations: PASS / FAIL

**Overall Status:** ✅ READY FOR PRODUCTION / ❌ NEEDS FIXES

---

## Notes

_Add testing notes, observations, and recommendations here_
