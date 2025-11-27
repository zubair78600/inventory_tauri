# Inventory Management System

A modern, lightweight desktop inventory management system built with Tauri, Next.js, and Rust.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Requirements](#-system-requirements)
- [Installation](#-installation)
- [Quick Start Guide](#-quick-start-guide)
- [User Guide](#-user-guide)
- [For Developers](#-for-developers)
- [Building from Source](#-building-from-source)
- [Database](#-database)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Support](#-support)
- [License](#-license)

---

## ✨ Features

### Core Functionality
- **Product Management** - Track products, SKUs, pricing, and stock levels with FIFO inventory tracking
- **Purchase Orders** - Create and manage purchase orders with batch tracking and payment management
- **Supplier Management** - Manage supplier information, relationships, and purchase history
- **Customer Management** - Maintain customer database with complete purchase history
- **Invoice Management** - Create and edit invoices with automatic stock updates and profit calculation
- **Payment Tracking** - Track payments against purchase orders with partial payment support

### Advanced Features
- **FIFO Inventory** - Automatic First-In-First-Out cost calculation for accurate profit tracking
- **Batch Tracking** - Track inventory batches from each purchase order
- **Analytics Dashboard** - Real-time insights into sales, inventory, and performance
- **Reports** - Comprehensive reporting for customers, sales, inventory, and suppliers
- **OmniSearch** - Powerful search across all modules
- **Data Export** - Export data to CSV for external analysis
- **Data Migration** - Tools for migrating existing inventory data to FIFO system

### Technical Features
- **Offline-First** - Works completely offline, no internet required
- **Fast & Lightweight** - Native desktop app, ~20-25MB disk space
- **Secure** - Local SQLite database, your data stays on your machine
- **Cross-Platform** - Available for macOS and Windows

---

## 🛠 Tech Stack

### Frontend
- **Next.js 16** - React framework with static export
- **React 19** - Modern UI library
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type-safe development

### Backend
- **Tauri 2.0** - Modern desktop app framework
- **Rust** - High-performance systems language
- **SQLite** - Embedded database via rusqlite
- **30+ Tauri Commands** - Comprehensive backend API

---

## 💻 System Requirements

### macOS
- macOS 10.13 or later
- ~20MB disk space
- No additional dependencies

### Windows
- Windows 10 or later
- WebView2 Runtime (auto-installed if needed)
- ~25MB disk space

---

## 📥 Installation

### Download

Download the latest release for your platform from [Releases](https://github.com/zubair78600/inventory_tauri/releases):
- **macOS (Apple Silicon):** `Inventory-System_1.0.0_aarch64.dmg`
- **macOS (Intel):** `Inventory-System_1.0.0_x64.dmg`
- **Windows:** `Inventory-System_1.0.0_x64-setup.exe`

### macOS Installation
1. Download the `.dmg` file
2. Open the `.dmg` file
3. Drag "Inventory System" to Applications folder
4. Launch from Applications (Right-click → Open on first launch)

### Windows Installation
1. Download the `.exe` installer
2. Run the installer
3. Follow the installation wizard
4. Launch from Start menu

---

## 🚀 Quick Start Guide

### First Time Setup

#### If You Have Existing Products (Data Migration)

**Step 1: Check Migration Status**
```
1. Start the application
2. Go to Settings → Migration
3. Click "Check Status"
```

**Step 2: Run Migration (if needed)**
```
1. Click "Migrate X Product(s)" button
2. Confirm the migration
3. Wait for completion
4. Review the results
```

The migration creates:
- A "Data Migration" supplier
- Purchase Orders (PO-MIGRATED-XXXXX) for each product
- Inventory batches for FIFO tracking

**Step 3: Validate Data**
```
1. Click "Validate Data" button
2. Check that all products show as "Consistent"
```

### Creating Your First Purchase Order

**Scenario**: Buying 100 tablets from a supplier at ₹98 each

```
1. Go to "Inventory" → Click "Purchase Orders" button
2. Click "Create Purchase Order"
3. Fill in the form:
   - Supplier: Select your supplier
   - Order Date: Today's date (auto-filled)
   - Items:
     - Product: Select the product
     - Quantity: 100
     - Unit Cost: 98
   - Notes: "Monthly stock purchase" (optional)
4. Click "Create Purchase Order"
```

The system automatically:
- Creates a new PO (e.g., PO-2025-001)
- Updates product stock (+100 tablets)
- Creates an inventory batch (100 @ ₹98)
- Records the transaction

### Recording Payments

```
1. Go to Purchase Orders → Click on the PO
2. Scroll to "Payment Summary"
3. Click "+ Add Payment"
4. Fill in:
   - Amount: Enter amount
   - Payment Method: Cash/UPI/Bank Transfer
   - Date: Today's date
   - Note: Optional reference
5. Click "Record Payment"
```

Supports partial payments - track exactly what you owe suppliers!

### Selling Products (Creating Invoices)

```
1. Go to "Billing"
2. Select customer
3. Add products
4. Click "Create Invoice"
```

**What's NEW:** The system automatically:
- Uses FIFO to calculate Cost of Goods Sold (COGS)
- Updates inventory batches (oldest first)
- Calculates profit: Revenue - COGS

---

## 📖 User Guide

### Understanding the System

#### Key Concepts

**1. Purchase Orders (PO)**
- Create a new PO every time you buy stock
- Track: Date, Quantity, Cost, Supplier
- Multiple POs can exist for the same product

**2. FIFO (First In First Out)**
- System automatically uses oldest stock first when selling
- Ensures accurate profit calculation
- You don't need to do anything - it's automatic!

**3. Batches**
- Each Purchase Order creates a batch of inventory
- System tracks remaining quantity in each batch
- When selling, oldest batch is used first

**4. SKU (Stock Keeping Unit)**
- One SKU per supplier-product combination
- Same supplier + monthly purchase = Same SKU + New PO
- Different supplier = Different SKU + New PO

### Common Workflows

#### Monthly Stock Purchase (Same Supplier)

**January Purchase:**
```
1. Create PO → Product: Albuterol, 100 tablets @ ₹98
2. System creates Batch #1
3. Record Payment → ₹9,800
```

**February Purchase (Price increased):**
```
1. Create PO → Product: Albuterol, 150 tablets @ ₹105
2. System creates Batch #2 (separate from Batch #1)
3. Record Payment → ₹15,750
```

System tracks both batches separately!
When customer buys, oldest batch (₹98) is used first.

#### Multiple Suppliers for Same Product

You can buy the same product from different suppliers:

```
Purchase 1:
- Supplier: ABC Pharma
- Product: Albuterol (SKU: ALBU-ABC)
- Cost: ₹98

Purchase 2:
- Supplier: XYZ Medical
- Product: Albuterol (SKU: ALBU-XYZ)
- Cost: ₹105
```

Create different SKUs for each supplier and track which is more cost-effective!

#### Partial Payments

```
Scenario: PO total is ₹50,000

Payment 1: ₹30,000 (Advance)
- System shows: Paid: ₹30,000, Pending: ₹20,000

Payment 2: ₹20,000 (Final)
- System shows: Paid: ₹50,000, Pending: ₹0, Status: PAID
```

### Viewing Reports

**Purchase History per Product:**
```
1. Go to Inventory → Click product
2. See "Purchase History" tab
3. View all purchases with dates and costs
```

**Supplier Payments:**
```
1. Go to Purchase Orders
2. Click on any PO
3. View payment history and status
```

**Profit Reports:**
```
1. Go to Sales/Invoices
2. Click on any invoice
3. View FIFO cost breakdown and profit
```

### Keyboard Shortcuts

- **Add Product**: When on Inventory page, click "Add Product" button
- **Create PO**: When on Inventory page, click "Purchase Orders" button
- **Quick Search**: Use search bar at top of each page

---

## 👨‍💻 For Developers

### Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific requirements:
  - **macOS:** Xcode Command Line Tools
  - **Windows:** Visual Studio Build Tools

### Setup

```bash
# Clone the repository
git clone https://github.com/zubair78600/inventory_tauri.git
cd inventory_tauri

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

### Project Structure

```
inventory_tauri/
├── app/              # Next.js pages
├── components/       # React components
├── lib/             # Utilities and helpers
├── types/           # TypeScript types
├── public/          # Static assets
├── src-tauri/       # Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── commands/         # Tauri commands (30+ commands)
│   │   ├── db/               # Database layer
│   │   └── services/         # Business logic
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── package.json     # Node dependencies
```

### Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Build Next.js for production
npm run tauri:dev    # Run Tauri in development mode
npm run tauri:build  # Build Tauri application
```

### Available Tauri Commands

**Product Commands:**
- `get_all_products` - Get all products
- `get_product_by_id` - Get single product
- `create_product` - Create new product
- `update_product` - Update product
- `delete_product` - Delete product
- `add_mock_products` - Add sample data

**Purchase Order Commands:**
- `get_all_purchase_orders` - Get all POs
- `get_purchase_order_by_id` - Get single PO
- `create_purchase_order` - Create new PO
- `update_purchase_order_status` - Update status
- `record_po_payment` - Record payment
- `get_po_payments` - Get payment history

**Supplier Commands:**
- `get_all_suppliers` - Get all suppliers
- `create_supplier` - Create supplier
- `update_supplier` - Update supplier
- `delete_supplier` - Delete supplier

**Customer Commands:**
- `get_all_customers` - Get all customers
- `create_customer` - Create customer
- `update_customer` - Update customer
- `delete_customer` - Delete customer

**Invoice Commands:**
- `get_all_invoices` - Get all invoices
- `create_invoice` - Create invoice (with FIFO)
- `get_invoice_by_id` - Get invoice details

**Migration Commands:**
- `check_migration_status` - Check migration needs
- `migrate_products_to_fifo` - Run migration
- `validate_inventory_consistency` - Validate data

_See `src-tauri/src/commands/` for complete implementation_

---

## 🏗 Building from Source

### macOS

```bash
# Build production app
npm run tauri:build

# Output location:
# src-tauri/target/release/bundle/dmg/
```

Creates:
- `Inventory-System_1.0.0_aarch64.dmg` (Apple Silicon)
- `Inventory-System_1.0.0_x64.dmg` (Intel)

### Windows

```bash
# Build production app
npm run tauri:build

# Output location:
# src-tauri/target/release/bundle/nsis/
```

Creates:
- `Inventory-System_1.0.0_x64-setup.exe`

### Build Configuration

Edit `src-tauri/tauri.conf.json`:
```json
{
  "productName": "Inventory System",
  "version": "1.0.0",
  "identifier": "com.inventry.tauri"
}
```

---

## 🗄 Database

### Location

The application stores its database in:
- **macOS:** `~/Library/Application Support/com.inventry.tauri/inventory.db`
- **Windows:** `%APPDATA%\com.inventry.tauri\inventory.db`

### Schema

**Tables:**
- `products` - Product catalog
- `suppliers` - Supplier information
- `customers` - Customer database
- `invoices` - Invoice records
- `invoice_items` - Invoice line items
- `purchase_orders` - Purchase order records
- `purchase_order_items` - PO line items
- `po_payments` - Payment records
- `inventory_batches` - FIFO batch tracking
- `inventory_transactions` - Transaction history

### Backup

Simply copy the database file to create a backup:

```bash
# macOS
cp ~/Library/Application\ Support/com.inventry.tauri/inventory.db ~/Desktop/backup.db

# Windows
copy %APPDATA%\com.inventry.tauri\inventory.db %USERPROFILE%\Desktop\backup.db
```

---

## 🔧 Troubleshooting

### Common Issues

**Issue: "Stock quantity doesn't match batch total"**
```
Solution:
1. Go to Settings → Migration
2. Click "Validate Data"
3. Check inconsistencies table
4. Run migration if needed
```

**Issue: "Can't create invoice - insufficient stock"**
```
Solution:
1. Go to Inventory
2. Check product stock quantity
3. Verify Purchase Orders are marked as "Received"
```

**Issue: "Payment exceeds pending amount"**
```
The system prevents overpayment automatically.
Check:
1. PO total amount
2. Total paid so far
3. Verify payment = pending amount
```

**Issue: "Application won't open on macOS"**
```
Solution:
1. Right-click on app → Open
2. Or: System Preferences → Security & Privacy → Allow
```

**Issue: "Database not created"**
```
Solution:
1. Check app has permissions to write to app data folder
2. View console logs for errors
3. Try running as administrator (Windows)
```

### Getting Help

1. Check this README thoroughly
2. Search existing [GitHub Issues](https://github.com/zubair78600/inventory_tauri/issues)
3. Create a new issue with:
   - Operating system and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

---

## 💬 Support

### Community Support
- **GitHub Discussions:** [Ask questions](https://github.com/zubair78600/inventory_tauri/discussions)
- **Issues:** [Report bugs](https://github.com/zubair78600/inventory_tauri/issues)

### Documentation
- This README
- Inline code documentation
- TypeScript type definitions

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

Built with:
- [Tauri](https://tauri.app/) - Desktop app framework
- [Next.js](https://nextjs.org/) - React framework
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [SQLite](https://www.sqlite.org/) - Database engine
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

## 📊 Project Status

- ✅ Product Management
- ✅ Purchase Order System
- ✅ FIFO Inventory Tracking
- ✅ Invoice Generation
- ✅ Payment Tracking
- ✅ Analytics Dashboard
- ✅ Data Export
- ✅ Data Migration Tools
- 🚧 PDF Invoice Generation (Coming Soon)
- 🚧 Cloud Sync (Future Release)

---

## 📞 Contact

**Developer:** Zubair
**Repository:** [https://github.com/zubair78600/inventory_tauri](https://github.com/zubair78600/inventory_tauri)
**Issues:** [https://github.com/zubair78600/inventory_tauri/issues](https://github.com/zubair78600/inventory_tauri/issues)

---

**Built with ❤️ using Tauri**

*Last Updated: November 2025*
*Version: 1.0.0*
