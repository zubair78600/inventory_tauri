# Inventory Management System - Complete Project Documentation

> **Version**: 1.0.5
> **Tech Stack**: Tauri 2.9 + Next.js 16 + React 19 + Rust + SQLite
> **Platform**: Cross-platform Desktop (macOS, Windows)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-complete-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Core Features](#5-core-features)
6. [API Commands Reference](#6-api-commands-reference)
7. [UI Components & Pages](#7-ui-components--pages)
8. [State Management](#8-state-management)
9. [AI Integration](#9-ai-integration)
10. [Configuration Files](#10-configuration-files)
11. [Build & Deployment](#11-build--deployment)
12. [Security Features](#12-security-features)
13. [Performance Optimizations](#13-performance-optimizations)
14. [Key Files Reference](#14-key-files-reference)

---

## 1. Project Overview

### What is this Project?

A **modern desktop Inventory & Billing Management System** built with Tauri, featuring:
- Real-time analytics dashboard
- AI-powered natural language queries
- Comprehensive inventory tracking with FIFO valuation
- GST-compliant invoicing
- Customer & Supplier CRM
- Biometric authentication

### Key Highlights

| Feature | Description |
|---------|-------------|
| **Offline-First** | SQLite database, no internet required |
| **Cross-Platform** | macOS (ARM64 + Intel) & Windows (x64) |
| **AI-Powered** | Natural language database queries via Vanna.AI |
| **GST Compliant** | CGST, SGST, IGST calculations |
| **Secure** | Biometric auth, role-based access, audit trails |

---

## 2. Complete Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.2.0 | UI library |
| TypeScript | 5.9.3 | Type safety |
| Tailwind CSS | 3.4.14 | Styling |
| Radix UI | Latest | Accessible UI primitives |
| TanStack Query | 5.90.10 | Data fetching & caching |
| Recharts | 3.5.1 | Analytics charts |
| Framer Motion | 12.23.24 | Animations |
| jsPDF | 3.0.4 | PDF generation |
| Zod | 4.1.12 | Schema validation |
| Lucide React | Latest | 554+ icons |

### Backend (Rust)

| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2.9.2 | Desktop framework |
| rusqlite | 0.31 | SQLite bindings |
| r2d2 | 0.8 | Connection pooling |
| Tokio | 1.x | Async runtime |
| Serde | 1.0 | Serialization |
| reqwest | 0.11 | HTTP client |
| chrono | 0.4 | Date/time handling |
| sha2 | 0.10 | Biometric token hashing |

### Tauri Plugins

| Plugin | Purpose |
|--------|---------|
| @tauri-apps/plugin-fs | File system access |
| @tauri-apps/plugin-sql | Database operations |
| @tauri-apps/plugin-dialog | Native dialogs |
| @tauri-apps/plugin-biometric | Touch ID / Windows Hello |
| tauri-plugin-log | Logging |

### AI Sidecar (Python)

| Technology | Purpose |
|------------|---------|
| FastAPI | API server |
| Vanna.AI | Natural language to SQL |
| PyInstaller | Standalone binary builds |
| SQLite3 | Query execution |

---

## 3. Directory Structure

```
Inventry_tauri/
├── app/                           # Next.js App Router pages
│   ├── page.tsx                  # Dashboard (analytics home)
│   ├── layout.tsx                # Root layout with providers
│   ├── globals.css               # Global styles
│   ├── login/page.tsx            # Authentication
│   ├── inventory/                # Product management
│   │   ├── page.tsx             # Product list
│   │   └── details/[id]/        # Product detail
│   ├── customers/                # Customer CRM
│   │   ├── page.tsx             # Customer list
│   │   └── details/[id]/        # Customer detail
│   ├── suppliers/                # Supplier management
│   │   ├── page.tsx             # Supplier list
│   │   └── details/[id]/        # Supplier detail
│   ├── sales/page.tsx            # Invoice management
│   ├── purchase-orders/          # PO tracking
│   │   ├── page.tsx             # PO list
│   │   └── details/[id]/        # PO detail
│   ├── billing/page.tsx          # Point-of-sale
│   ├── reports/page.tsx          # Analytics reports
│   └── settings/                 # Configuration
│       ├── page.tsx             # Settings form
│       └── migration/           # Data migration tools
│
├── components/                   # React components
│   ├── ui/                      # Base UI primitives (50+)
│   │   ├── button.tsx, input.tsx, card.tsx
│   │   ├── select.tsx, dialog.tsx, sheet.tsx
│   │   ├── table.tsx, virtualized-table.tsx
│   │   └── AnimatedBackground.tsx
│   ├── dashboard/               # Analytics charts (10)
│   │   ├── KPICard.tsx
│   │   ├── RevenueChart.tsx
│   │   ├── TopProductsChart.tsx
│   │   └── ...more charts
│   ├── layout/                  # App shell
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── shared/                  # Shared components (30+)
│   │   ├── InvoicePreview.tsx
│   │   ├── PDFPreviewDialog.tsx
│   │   ├── EntityThumbnail.tsx
│   │   └── LocationSelector.tsx
│   ├── features/                # Feature-specific
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── inventory/
│   │   └── billing/
│   ├── settings/                # Settings components
│   │   └── PdfConfiguration.tsx
│   ├── ai-chat/                 # AI chat interface
│   │   ├── AIChatButton.tsx
│   │   └── AIChatPanel.tsx
│   ├── theme-provider.tsx       # Dark mode
│   └── providers.tsx            # Query client setup
│
├── contexts/                    # React contexts
│   └── AuthContext.tsx          # Authentication state
│
├── hooks/                       # Custom hooks
│   ├── use-debounce.ts
│   ├── use-local-storage.ts
│   └── use-location-defaults.ts
│
├── lib/                         # Utilities
│   ├── tauri.ts                 # Tauri command wrappers (800+ lines)
│   ├── pdf-generator.ts         # PDF generation logic
│   ├── ai-chat.ts              # AI chat API client
│   ├── biometric.ts            # Biometric helpers
│   ├── validation.ts           # Zod schemas
│   ├── utils.ts                # Utility functions
│   ├── india.ts                # India-specific data
│   └── constants/              # App constants
│
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── main.rs             # Entry point
│   │   ├── lib.rs              # Tauri setup
│   │   ├── db/                 # Database layer
│   │   │   ├── mod.rs          # Pool setup
│   │   │   ├── connection.rs   # Connection config
│   │   │   ├── schema.rs       # CREATE TABLE SQL
│   │   │   ├── models.rs       # Rust structs
│   │   │   └── archive.rs      # Soft delete
│   │   ├── services/           # Business logic
│   │   │   └── inventory_service.rs
│   │   └── commands/           # Tauri commands (17 modules)
│   │       ├── mod.rs
│   │       ├── products.rs
│   │       ├── suppliers.rs
│   │       ├── customers.rs
│   │       ├── invoices.rs
│   │       ├── purchase_orders.rs
│   │       ├── analytics.rs    # 20+ queries
│   │       ├── search.rs
│   │       ├── payments.rs
│   │       ├── auth.rs
│   │       ├── biometric.rs
│   │       ├── ai_chat.rs
│   │       ├── settings.rs
│   │       ├── migration.rs
│   │       └── data_management.rs
│   ├── tauri.conf.json         # Tauri config
│   └── Cargo.toml              # Rust dependencies
│
├── DB_AI/                       # AI Sidecar
│   ├── main.py                 # FastAPI server
│   ├── config.py               # Configuration
│   ├── core/                   # AI modules
│   │   ├── vanna_setup.py
│   │   └── sql_executor.py
│   ├── training/               # Training data
│   ├── vectordb/               # Vector database
│   └── requirements.txt        # Python deps
│
├── public/                      # Static assets
├── types/                       # TypeScript types
│
├── Configuration Files
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.js
│   └── components.json
│
└── Documentation
    ├── README.md
    ├── CHANGELOG.md
    └── PROJECT_DOCUMENTATION.md  # This file
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  SUPPLIERS  │───┬───│  PRODUCTS   │───────│  INVOICES   │
└─────────────┘   │   └─────────────┘       └─────────────┘
                  │         │                     │
                  │         │                     │
┌─────────────────┴─────────┴───────────┐         │
│        PURCHASE_ORDERS                │         │
│        PURCHASE_ORDER_ITEMS           │         │
└───────────────────────────────────────┘         │
                                                  │
┌─────────────┐                           ┌───────┴───────┐
│  CUSTOMERS  │───────────────────────────│ INVOICE_ITEMS │
└─────────────┘                           └───────────────┘
      │
      │
┌─────┴───────────┐     ┌─────────────────┐
│CUSTOMER_PAYMENTS│     │SUPPLIER_PAYMENTS│
└─────────────────┘     └─────────────────┘
```

### Core Tables

#### Products Table
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price REAL NOT NULL,              -- Cost price
  selling_price REAL,               -- Selling price
  initial_stock INTEGER,            -- For FIFO tracking
  stock_quantity INTEGER NOT NULL,  -- Current stock
  quantity_sold INTEGER,            -- Total units sold
  sold_revenue REAL,                -- Revenue after discounts
  supplier_id INTEGER REFERENCES suppliers(id),
  category TEXT,
  image_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Customers Table
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  state TEXT,
  district TEXT,
  town TEXT,
  image_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Suppliers Table
```sql
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_info TEXT,
  address TEXT,
  email TEXT,
  comments TEXT,
  state TEXT,
  district TEXT,
  town TEXT,
  image_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Invoices Table
```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  total_amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  payment_method TEXT,
  cgst_amount REAL,                 -- Central GST
  sgst_amount REAL,                 -- State GST
  igst_amount REAL,                 -- Integrated GST
  gst_rate REAL,
  fy_year TEXT,                     -- Financial year
  state TEXT,
  district TEXT,
  town TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### Invoice Items Table
```sql
CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  product_name TEXT                 -- Denormalized for display
);
```

#### Purchase Orders Table
```sql
CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL UNIQUE,   -- Format: PO-2025-001
  supplier_id INTEGER REFERENCES suppliers(id),
  order_date TEXT,
  expected_delivery_date TEXT,
  status TEXT,
  total_amount REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### Purchase Order Items (Batches)
```sql
CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  received_quantity INTEGER,
  batch_number TEXT
);
```

#### Payments Tables
```sql
-- Supplier Payments
CREATE TABLE supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id INTEGER,
  amount REAL NOT NULL,
  payment_method TEXT,
  note TEXT,
  paid_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Customer Payments (Accounts Receivable)
CREATE TABLE customer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  payment_method TEXT,
  note TEXT,
  paid_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### Audit Trail Tables
```sql
-- Soft Deleted Items
CREATE TABLE deleted_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,        -- 'products', 'customers', 'invoices'
  entity_id INTEGER NOT NULL,
  entity_data TEXT NOT NULL,        -- JSON of deleted record
  related_data TEXT,                -- JSON of related items
  deleted_at TEXT DEFAULT (datetime('now')),
  deleted_by TEXT
);

-- Invoice Modification History
CREATE TABLE invoice_modifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,             -- 'created', 'updated', 'deleted'
  modified_by TEXT,
  modified_at TEXT DEFAULT (datetime('now')),
  original_data TEXT,               -- JSON before state
  new_data TEXT                     -- JSON after state
);

-- Universal Entity Modifications
CREATE TABLE entity_modifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_name TEXT,
  action TEXT DEFAULT 'updated',
  field_changes TEXT,               -- JSON of {field: [old, new]}
  modified_by TEXT,
  modified_at TEXT DEFAULT (datetime('now'))
);
```

#### Users & Settings Tables
```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'admin', 'staff'
  permissions TEXT NOT NULL,        -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Key Indexes

```sql
-- Product lookups
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_supplier ON products(supplier_id);

-- Customer lookups
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- Invoice sorting
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX idx_invoices_customer_created ON invoices(customer_id, created_at DESC);

-- Low stock alerts (partial index)
CREATE INDEX idx_products_low_stock ON products(stock_quantity)
  WHERE stock_quantity < 10;
```

---

## 5. Core Features

### 5.1 Inventory Management

#### Product Tracking
- **SKU-based identification** - Unique product codes
- **Dual pricing** - Cost price vs selling price
- **Stock monitoring** - Real-time quantity tracking
- **Category organization** - Custom, extensible categories
- **Image attachments** - Product photos
- **Supplier relationships** - Link products to suppliers
- **FIFO valuation** - First-In-First-Out inventory costing

#### Purchase Orders
- **Auto-numbering** - Format: `PO-YYYY-NNN`
- **Batch tracking** - Per supplier, per product
- **Payment tracking** - Per-item payment status
- **Inventory batches** - Created on PO completion
- **Status workflow** - Draft → Ordered → Received → Completed

### 5.2 Sales & Invoicing

#### Invoice Management
- **Full CRUD** - Create, read, update, delete
- **Auto-increment numbering** - Customizable series
- **Line item management** - Per-item discounts
- **Modification history** - Full audit trail
- **Soft delete** - Recoverable invoices
- **Credit support** - Partial/credit payments

#### Invoice Features
- **GST calculations** - CGST, SGST, IGST
- **Financial year tracking** - FY reference
- **Tax & discount tracking** - Per-invoice totals
- **Payment methods** - Cash, Check, UPI, Card, Credit
- **Regional tracking** - State, District, Town
- **Customer credits** - A/R tracking

### 5.3 Customer Management

#### Customer Database
- **Contact information** - Phone, email, address
- **Regional data** - State, district, town
- **Image/avatar support** - Customer photos
- **Purchase history** - All invoices per customer

#### Customer Analytics
- **Total spending** - Lifetime value
- **Order count** - Purchase frequency
- **Average order value** - Per-customer AOV
- **Credit balance** - Outstanding payments
- **Payment history** - All payments

### 5.4 Supplier Management

#### Supplier Profiles
- **Contact management** - Phone, email, address
- **Regional information** - Location tracking
- **Product relationships** - Linked products
- **Notes/comments** - Supplier-specific info
- **Image support** - Supplier logos

#### Supplier Transactions
- **Payment tracking** - Per-supplier payments
- **Per-product payments** - Itemized tracking
- **PO linking** - Purchase order history
- **Payment history** - Complete timeline

### 5.5 Analytics & Reporting

#### Dashboard KPIs (Real-time with 5-second polling)
| KPI | Description |
|-----|-------------|
| Total Revenue | Period vs previous period comparison |
| Order Count | Number of invoices |
| Average Order Value | Revenue / Order count |
| Gross Profit | Revenue - Cost of goods sold |
| New Customers | First-time buyers in period |
| Repeat Customer Rate | % returning customers |
| Inventory Valuation | Total stock value |

#### Available Analytics
- **Revenue Trends** - Daily/weekly/monthly line charts
- **Top Products** - Top 10 by sales (bar chart)
- **Top Customers** - By lifetime value
- **Payment Methods** - Distribution (pie chart)
- **Sales by Region** - Geographic breakdown
- **Inventory Health** - Stock status (donut chart)
- **Low Stock Alerts** - Products below threshold
- **Cashflow Trends** - Income/expense tracking
- **Tax Summary** - GST collected
- **Discount Analysis** - Discount impact

### 5.6 Advanced Features

#### OmniSearch
Full-text search across:
- Products (name, SKU, category)
- Customers (name, phone, email)
- Suppliers (name, contact, email)
- Invoices (number, customer name)

#### Data Management
- **CSV export** - Products, customers
- **CSV import** - Bulk creation
- **Duplicate detection** - On import
- **Data migration** - Legacy to FIFO

#### Audit Trail
- **Soft deletes** - Recoverable deletions
- **Modification history** - All changes tracked
- **User tracking** - Who made changes
- **Restore capability** - Undo deletions

#### PDF Generation
- **Customizable layout** - Drag-and-drop builder
- **Company branding** - Logo, company info
- **Dynamic tables** - Product line items
- **GST breakdown** - Tax details
- **Terms & conditions** - Custom footer

### 5.7 Authentication & Security

#### Multi-Factor Authentication
- **Username/password** - Primary auth
- **Biometric login** - Touch ID / Windows Hello
- **Per-user enrollment** - Biometric setup
- **Token hashing** - SHA-256 secured

#### Authorization
- **Role-based access** - Admin, Staff roles
- **Permission system** - Module-level access
- **Password-protected settings** - Secure admin area

---

## 6. API Commands Reference

### Product Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_products` | page, page_size, search?, category? | PaginatedResult<Product> |
| `get_product` | id | Product |
| `get_products_by_supplier` | supplier_id | Product[] |
| `get_products_by_ids` | ids[] | Product[] |
| `create_product` | ProductInput | Product |
| `update_product` | id, ProductInput | Product |
| `delete_product` | id | void |
| `get_top_selling_products` | limit, offset, category? | Product[] |
| `get_unique_categories` | - | string[] |

### Customer Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_customers` | page, page_size, search? | PaginatedResult<Customer> |
| `get_customer` | id | Customer |
| `create_customer` | CustomerInput | Customer |
| `update_customer` | id, CustomerInput | Customer |
| `delete_customer` | id | void |
| `customer_search` | query | Customer[] |

### Supplier Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_suppliers` | page, page_size, search? | PaginatedResult<Supplier> |
| `get_supplier` | id | Supplier |
| `create_supplier` | SupplierInput | Supplier |
| `update_supplier` | id, SupplierInput | Supplier |
| `delete_supplier` | id | void |
| `get_supplier_product_purchase_history` | supplier_id, product_id | PurchaseHistory[] |

### Invoice Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_invoices` | page, page_size, search?, customer_id? | PaginatedResult<Invoice> |
| `get_invoice` | id | InvoiceWithItems |
| `get_invoices_by_product` | product_id | Invoice[] |
| `get_product_sales_summary` | product_id | SalesSummary |
| `create_invoice` | InvoiceInput | Invoice |
| `update_invoice` | id, InvoiceInput | Invoice |
| `update_invoice_items` | invoice_id, items[] | void |
| `delete_invoice` | id | void |
| `get_deleted_invoices` | - | DeletedInvoice[] |
| `get_invoice_modifications` | invoice_id | Modification[] |

### Analytics Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_dashboard_stats` | - | DashboardStats |
| `get_sales_analytics` | start_date, end_date | SalesAnalytics |
| `get_revenue_trend` | start_date, end_date, granularity | TrendData[] |
| `get_top_products` | start_date, end_date, limit | TopProduct[] |
| `get_sales_by_payment_method` | start_date, end_date | PaymentBreakdown[] |
| `get_sales_by_region` | start_date, end_date | RegionSales[] |
| `get_customer_analytics` | start_date, end_date | CustomerAnalytics |
| `get_top_customers` | start_date, end_date, limit | TopCustomer[] |
| `get_customer_trend` | start_date, end_date, granularity | TrendData[] |
| `get_inventory_health` | - | InventoryHealth |
| `get_low_stock_alerts` | - | LowStockProduct[] |
| `get_purchase_analytics` | start_date, end_date | PurchaseAnalytics |
| `get_cashflow_trend` | start_date, end_date, granularity | CashflowData[] |
| `get_tax_summary` | start_date, end_date | TaxSummary |
| `get_discount_analysis` | start_date, end_date | DiscountAnalysis |

### Payment Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `create_supplier_payment` | PaymentInput | Payment |
| `get_supplier_payments` | supplier_id, page, page_size | PaginatedResult<Payment> |
| `get_supplier_payment_summary` | supplier_id | PaymentSummary |
| `get_all_product_payments` | supplier_id, product_id | Payment[] |
| `delete_supplier_payment` | id | void |
| `create_customer_payment` | PaymentInput | Payment |
| `get_customer_payments` | invoice_id | Payment[] |

### Authentication Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `login` | username, password | User |
| `logout` | - | void |
| `generate_biometric_token` | user_id | string |
| `verify_biometric_token` | token | User |
| `get_biometric_status` | user_id | BiometricStatus |
| `get_biometric_status_by_username` | username | BiometricStatus |

### AI Chat Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `start_ai_sidecar` | - | void |
| `stop_ai_sidecar` | - | void |
| `check_ai_sidecar_status` | - | boolean |
| `download_ai_sidecar` | - | void (with progress events) |
| `check_sidecar_downloaded` | - | boolean |

### Search & Data Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `omnisearch` | query | SearchResults |
| `export_products_csv` | - | string (file path) |
| `export_customers_csv` | - | string (file path) |
| `get_deleted_items` | page, page_size | PaginatedResult<DeletedItem> |
| `restore_customer` | id | Customer |
| `restore_product` | id | Product |
| `restore_supplier` | id | Supplier |
| `permanently_delete_item` | type, id | void |
| `clear_trash` | - | void |

### Settings Commands

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_invoice_settings` | - | InvoiceSettings |
| `save_invoice_settings` | settings | void |
| `migrate_inventory_data` | - | MigrationResult |
| `validate_migration_data` | - | ValidationResult |

---

## 7. UI Components & Pages

### Page Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Dashboard | 13 KPI cards, 6 charts, date filter |
| `/login` | Login | Password + biometric auth |
| `/inventory` | ProductList | Product CRUD, categories |
| `/inventory/details/[id]` | ProductDetail | Full product history |
| `/customers` | CustomerList | Customer CRUD |
| `/customers/details/[id]` | CustomerDetail | Invoice history, credit |
| `/suppliers` | SupplierList | Supplier CRUD |
| `/suppliers/details/[id]` | SupplierDetail | Purchase history |
| `/sales` | InvoiceList | Invoice management |
| `/purchase-orders` | POList | PO tracking |
| `/purchase-orders/details/[id]` | PODetail | PO items, status |
| `/billing` | PointOfSale | Cart, checkout |
| `/reports` | Reports | Analytics summary |
| `/settings` | Settings | PDF config, company info |
| `/settings/migration` | Migration | Data migration tools |

### UI Components Library

#### Form Controls
- Button, Input, Textarea, Label
- Select, Checkbox, Radio
- DatePicker, TimePicker

#### Display Components
- Card, Badge, Avatar
- Progress, Skeleton
- Alert, Toast

#### Navigation
- Tabs, Sheet (Drawer)
- Dialog (Modal)
- ScrollArea

#### Data Display
- Table, VirtualizedTable
- DataGrid
- Charts (10 types)

#### Specialized
- InvoicePreview
- PDFPreviewDialog
- EntityThumbnail
- LocationSelector
- AIChatPanel

### Dashboard Charts

| Chart | Type | Data Source |
|-------|------|-------------|
| RevenueChart | Line | get_revenue_trend |
| TopProductsChart | Bar | get_top_products |
| TopCustomersChart | List | get_top_customers |
| PaymentMethodChart | Pie | get_sales_by_payment_method |
| RegionSalesChart | Bar | get_sales_by_region |
| InventoryHealthChart | Donut | get_inventory_health |
| LowStockTable | Table | get_low_stock_alerts |
| CashflowChart | Line | get_cashflow_trend |

---

## 8. State Management

### TanStack Query (React Query)

```typescript
// Query Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute
      gcTime: 5 * 60 * 1000,       // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Example Query
const { data, isLoading } = useQuery({
  queryKey: ['products', page, search],
  queryFn: () => getProducts({ page, pageSize: 20, search }),
});

// Example Mutation
const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});
```

### Context State

#### AuthContext
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}
```

### Local Storage Patterns

```typescript
// Location defaults (remembered per user)
useLocalStorage('location-defaults', {
  state: '',
  district: '',
  town: '',
});

// Theme preference
useLocalStorage('theme', 'light');

// Quick-add products (billing page)
useLocalStorage('quick-add-products', []);
```

---

## 9. AI Integration

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     TAURI APP                           │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │   AI Chat UI    │    │     Tauri Commands       │   │
│  │  (React Panel)  │───▶│  (ai_chat.rs)           │   │
│  └─────────────────┘    └──────────────────────────┘   │
│                                    │                    │
└────────────────────────────────────│────────────────────┘
                                     │ IPC / HTTP
                                     ▼
┌─────────────────────────────────────────────────────────┐
│                  AI SIDECAR (Python)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  FastAPI    │  │  Vanna.AI    │  │  SQLite       │  │
│  │  Server     │◀▶│  (NL→SQL)    │◀▶│  Executor     │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         ▲                │                              │
│         │                ▼                              │
│  ┌──────┴──────┐  ┌──────────────┐                     │
│  │  Vector DB  │  │  Training    │                     │
│  │  (Schema)   │  │  Data        │                     │
│  └─────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### AI Chat API

```python
# POST /api/chat
{
  "question": "Show top 10 products this month"
}

# Response
{
  "sql": "SELECT name, SUM(quantity) as total FROM...",
  "results": [...],
  "timing": {
    "sql_generation_ms": 1200,
    "execution_ms": 15
  }
}
```

### Training Data Types

1. **DDL (Schema)** - Table structures
2. **Documentation** - Business logic descriptions
3. **Q&A Pairs** - Question → SQL examples

### Sidecar Management

```rust
// Commands in ai_chat.rs
pub fn start_ai_sidecar() -> Result<()>;
pub fn stop_ai_sidecar() -> Result<()>;
pub fn check_ai_sidecar_status() -> bool;
pub fn download_ai_sidecar() -> Result<()>;  // With progress events
pub fn check_sidecar_downloaded() -> bool;
```

---

## 10. Configuration Files

### tauri.conf.json

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "productName": "Inventory System",
  "version": "1.0.0",
  "identifier": "com.inventry.tauri",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Inventory System",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 768,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app", "msi", "nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns"],
    "resources": [
      "../DB_AI/vectordb/**/*",
      "../DB_AI/training/**/*"
    ]
  }
}
```

### package.json (Key Scripts)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:mac": "tauri build --target universal-apple-darwin",
    "tauri:build:win": "tauri build --target x86_64-pc-windows-msvc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  }
}
```

### Database PRAGMA Settings

```sql
-- Connection initialization (connection.rs)
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;      -- 64MB
PRAGMA mmap_size = 268435456;    -- 256MB
PRAGMA read_uncommitted = 1;
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom CSS variables
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))' },
        // Chart colors
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          // ...
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        heading: ['Playfair Display', 'serif'],
      },
    },
  },
};
```

---

## 11. Build & Deployment

### Development Workflow

```bash
# Install dependencies
npm install

# Start development (Next.js only)
npm run dev

# Start development (Tauri app)
npm run tauri:dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

### Production Build

```bash
# Build frontend (static export)
npm run build

# Build Tauri app (current platform)
npm run tauri:build

# Build for macOS (Universal Binary)
npm run tauri:build:mac

# Build for Windows
npm run tauri:build:win
```

### Build Output

| Platform | Output | Size |
|----------|--------|------|
| macOS | `.dmg`, `.app` | ~20MB |
| Windows | `.exe`, `.msi` | ~25MB |
| Frontend | `/out` (static) | ~5MB |

### System Requirements

| Requirement | Specification |
|-------------|---------------|
| macOS | 10.13+ (High Sierra) |
| Windows | 10+ (WebView2) |
| Disk Space | 20-30 MB |
| RAM | 256 MB minimum |
| Network | Only for AI model download |

---

## 12. Security Features

### Authentication

| Feature | Implementation |
|---------|----------------|
| Password Auth | Rust-side validation |
| Biometric Auth | OS-native (Touch ID, Windows Hello) |
| Session Tokens | sessionStorage (browser memory) |
| Token Hashing | SHA-256 |

### Data Protection

| Feature | Implementation |
|---------|----------------|
| Local Database | No cloud sync |
| Foreign Keys | Data integrity |
| Role-based Access | JSON permission strings |
| Audit Trail | All changes logged |
| Soft Delete | Recoverable deletions |

### API Security

| Feature | Implementation |
|---------|----------------|
| Tauri IPC | Process-local only |
| No HTTP API | No external endpoints |
| CSP | Content Security Policy |
| File System | Sandboxed access |

---

## 13. Performance Optimizations

### Database

| Optimization | Benefit |
|--------------|---------|
| Connection Pool (8) | Concurrent access |
| WAL Mode | Better concurrency |
| Memory Mapping (256MB) | Faster reads |
| Partial Indexes | Targeted queries |
| Query Caching | Repeated query speed |

### Frontend

| Optimization | Benefit |
|--------------|---------|
| Code Splitting | Smaller bundles |
| Query Caching (1min) | Reduced API calls |
| Virtual Tables | 10K+ row handling |
| Image Optimization | Faster loading |
| Prefetching | Smoother navigation |

---

## 14. Key Files Reference

### Backend (Rust)

| File | Purpose | Lines |
|------|---------|-------|
| `src-tauri/src/lib.rs` | Tauri setup | 200+ |
| `src-tauri/src/commands/analytics.rs` | 20+ analytics queries | 1000+ |
| `src-tauri/src/commands/invoices.rs` | Invoice CRUD | 400+ |
| `src-tauri/src/db/connection.rs` | Connection pool | 643 |
| `src-tauri/src/db/schema.rs` | Database schema | 247 |
| `src-tauri/src/db/models.rs` | Rust structs | 421 |

### Frontend (TypeScript)

| File | Purpose | Lines |
|------|---------|-------|
| `lib/tauri.ts` | Command wrappers | 800+ |
| `lib/pdf-generator.ts` | PDF generation | 800+ |
| `app/page.tsx` | Dashboard | 400+ |
| `app/billing/page.tsx` | Point of sale | 600+ |
| `app/sales/page.tsx` | Invoice list | 500+ |

### Configuration

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/tauri.conf.json` | Tauri configuration |
| `tailwind.config.js` | Styling configuration |
| `tsconfig.json` | TypeScript configuration |

---

## Quick Start Guide

### Prerequisites
- Node.js 18+
- Rust 1.77+
- Xcode (macOS) or Visual Studio (Windows)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd Inventry_tauri

# Install Node dependencies
npm install

# Start development
npm run tauri:dev
```

### First Run
1. App launches with login screen
2. Default credentials: admin / admin (change immediately)
3. Configure company settings in Settings page
4. Add products, customers, suppliers
5. Start creating invoices!

---

## Support & Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: This file + README.md
- **Changelog**: CHANGELOG.md for version history

---

*Last Updated: December 2025*
*Version: 1.0.5*
