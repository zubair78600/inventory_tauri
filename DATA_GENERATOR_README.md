# Fake Data Generator for Inventory System

This script generates realistic fake data for testing and development of the Inventory Management System.

## Features

- Generates unique, realistic data for all database tables
- Uses Indian locale for names, addresses, and phone numbers
- Creates proper relationships between entities (foreign keys)
- Supports custom data volumes
- Progress indicators for large datasets
- FIFO-compatible data structure

## Installation

### 1. Install Python 3.8+

Make sure you have Python 3.8 or higher installed:
```bash
python3 --version
```

### 2. Install Dependencies

```bash
pip3 install -r requirements.txt
```

This installs the `Faker` library for generating realistic fake data.

## Usage

### Basic Usage

Run the script:
```bash
python3 generate_fake_data.py
```

### Interactive Prompts

The script will ask you for the number of records to generate and the date range:

```
Enter the number of records to generate:
(Press Enter to use default values)

Sales/Invoices [default: 100]: 100000
Customers [default: 70]: 70000
Inventory/Products [default: 50]: 5000
Suppliers [default: 25]: 250
Purchase Orders [default: 50]: 500

Enter date range for data generation:
(Format: YYYY-MM-DD, press Enter for defaults)

From Date [default: 1 year ago]: 2024-01-01
To Date [default: today]: 2024-12-31
```

### Example Session

```
$ python3 generate_fake_data.py

============================================================
INVENTORY MANAGEMENT SYSTEM - FAKE DATA GENERATOR
============================================================

Enter the number of records to generate:
(Press Enter to use default values)

Sales/Invoices [default: 100]: 100000
Customers [default: 70]: 70000
Inventory/Products [default: 50]: 5000
Suppliers [default: 25]: 250
Purchase Orders [default: 50]: 500

Enter date range for data generation:
(Format: YYYY-MM-DD, press Enter for defaults)

From Date [default: 1 year ago]: 2024-01-01
To Date [default: today]: 2024-12-31

------------------------------------------------------------
SUMMARY:
  Suppliers:        250
  Products:         5,000
  Customers:        70,000
  Purchase Orders:  500
  Sales:            100,000
  Date Range:       2024-01-01 to 2024-12-31
------------------------------------------------------------

Generate data with these settings? (yes/no): yes

============================================================
STARTING DATA GENERATION...
============================================================

✓ Connected to database: fake_inventory.db
Creating database schema...
✓ Schema created successfully

Generating 250 suppliers...
✓ Created 250 suppliers

Generating 5,000 products...
  Generated 1,000 products...
  Generated 2,000 products...
  Generated 3,000 products...
  Generated 4,000 products...
  Generated 5,000 products...
✓ Created 5,000 products

Generating 70,000 customers...
  Generated 5,000 customers...
  Generated 10,000 customers...
  ...
  Generated 70,000 customers...
✓ Created 70,000 customers

Generating 100,000 sales (invoices)...
  Generated 5,000 invoices...
  Generated 10,000 invoices...
  ...
  Generated 100,000 invoices...
✓ Created 100,000 invoices with 250,000 items

✓ Database saved: fake_inventory.db

============================================================
✓ DATA GENERATION COMPLETE!
============================================================

Database file: fake_inventory.db

To use this database in your Tauri app:
1. Copy fake_inventory.db to:
   macOS: ~/Library/Application Support/com.inventry.tauri/inventory.db
   Windows: %APPDATA%\com.inventry.tauri\inventory.db

2. Or use it for testing/development
```

## Date Range Feature

The generator now supports custom date ranges for all generated data. This allows you to:

- Generate historical data for specific time periods
- Test your app with data from specific months or years
- Create realistic datasets that match your business timeline
- Test date-based filtering and reporting features

**How it works:**
- All timestamps (created_at, updated_at, order_date, etc.) are randomly generated within the specified date range
- Invoice financial years are automatically calculated based on the invoice date (April-March)
- Default range: 1 year ago to today
- Format: YYYY-MM-DD (e.g., 2024-01-01)

**Example use cases:**
- Generate 2024 data only: `2024-01-01` to `2024-12-31`
- Generate Q1 2024 data: `2024-01-01` to `2024-03-31`
- Generate last 6 months: `2024-06-01` to `2024-12-31`

## Generated Data Details

### Suppliers (250 default)
- Unique company names with industry types (Pharma, Medical, Healthcare, etc.)
- Contact person names (Indian names)
- Email addresses
- Phone numbers (Indian format)
- Physical addresses

### Products (5,000 default)
- Medicine names with dosages (Paracetamol 500mg, etc.)
- Unique SKU codes (TAB-000001, CAP-000002, etc.)
- Purchase prices (₹10-₹500 range)
- Selling prices (20%-150% markup)
- Stock quantities (50-1000 units)
- Linked to suppliers
- Amount paid calculations

### Customers (70,000 default)
- Indian names (using Faker's en_IN locale)
- Email addresses (70% have emails)
- Phone numbers (80% have phones)
- Addresses (50% have full addresses)
- Places (Indian cities: Mumbai, Delhi, Bangalore, etc.)

### Purchase Orders (500 default)
- Unique PO numbers (PO-2025-000001, etc.)
- Linked to suppliers
- Multiple items per PO (2-10 products)
- Order dates, expected delivery, and received dates
- Status (received or pending, 75% received)
- Total amounts calculated from items
- Unit costs and quantities per item

### Sales/Invoices (100,000 default)
- Unique invoice numbers (INV-2025-000001, etc.)
- Linked to customers (or walk-in)
- Multiple items per invoice (1-5 products)
- Realistic pricing with tax and discounts
- Payment methods (Cash, UPI, Card, Bank Transfer, Cheque)
- Random dates over the past year
- Invoice items with product details

## Database Schema

The generated database includes all tables from the Tauri app:
- `suppliers` - Supplier information
- `products` - Product catalog
- `customers` - Customer database
- `invoices` - Sales records
- `invoice_items` - Invoice line items
- `purchase_orders` - Purchase orders (future feature)
- `purchase_order_items` - PO line items
- `po_payments` - Payment records
- `inventory_batches` - FIFO batches
- `inventory_transactions` - Transaction history

## Performance

Generation times (approximate):
- 250 suppliers: < 1 second
- 5,000 products: ~5-10 seconds
- 70,000 customers: ~30-60 seconds
- 100,000 invoices: ~2-5 minutes

Total time for default dataset: ~5-7 minutes

## File Output

The script generates a SQLite database file named `fake_inventory.db` in the same directory.

**File size estimates:**
- 100 sales: ~100 KB
- 1,000 sales: ~1 MB
- 10,000 sales: ~10 MB
- 100,000 sales: ~100 MB

## Using the Generated Database

### Option 1: Replace Existing Database

**macOS:**
```bash
cp fake_inventory.db ~/Library/Application\ Support/com.inventry.tauri/inventory.db
```

**Windows:**
```cmd
copy fake_inventory.db %APPDATA%\com.inventry.tauri\inventory.db
```

### Option 2: Use for Testing

Keep the `fake_inventory.db` file for:
- Performance testing
- UI/UX testing with large datasets
- Load testing
- Development without affecting production data

### Option 3: Inspect Data

Use SQLite tools to inspect the generated data:
```bash
sqlite3 fake_inventory.db

# List tables
.tables

# Count records
SELECT COUNT(*) FROM invoices;
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM products;

# Sample data
SELECT * FROM invoices LIMIT 10;
```

## Customization

### Modify Product Categories

Edit the `PRODUCT_CATEGORIES` dictionary in the script:
```python
PRODUCT_CATEGORIES = {
    'Medicines': ['TAB', 'CAP', 'SYR', 'INJ'],
    'Medical Supplies': ['MED', 'SUP', 'EQP'],
    'Your Category': ['PRE', 'FIX'],
}
```

### Modify Price Ranges

Edit the price generation in `generate_products()`:
```python
price = round(random.uniform(10, 500), 2)  # Change min/max
selling_price = round(price * random.uniform(1.2, 2.5), 2)  # Change markup
```

### Add More Cities

Edit the `indian_cities` list in `generate_customers()`:
```python
indian_cities = [
    'Mumbai', 'Delhi', 'Bangalore',
    'Your City 1', 'Your City 2',
]
```

## Troubleshooting

### Error: "No module named 'faker'"
```bash
pip3 install faker
```

### Error: "Permission denied"
```bash
chmod +x generate_fake_data.py
python3 generate_fake_data.py
```

### Large datasets taking too long
- Reduce the number of records
- Use faster SSD storage
- Close other applications

### Database file too large
- Reduce the number of sales/invoices
- Each invoice with items adds ~1-2 KB

## Best Practices

1. **Start Small**: Test with small datasets first (100-1000 records)
2. **Backup**: Keep backups of your production database
3. **Performance**: Generate large datasets on SSD for better performance
4. **Memory**: Ensure sufficient RAM for very large datasets (100K+ records)

## Examples

### Small Dataset (Testing)
```
Sales: 100
Customers: 50
Inventory: 25
Suppliers: 10
Purchase Orders: 20
```

### Medium Dataset (Development)
```
Sales: 10000
Customers: 5000
Inventory: 500
Suppliers: 50
Purchase Orders: 200
```

### Large Dataset (Load Testing)
```
Sales: 100000
Customers: 70000
Inventory: 5000
Suppliers: 250
Purchase Orders: 500
```

### Extra Large Dataset (Stress Testing)
```
Sales: 500000
Customers: 300000
Inventory: 10000
Suppliers: 1000
Purchase Orders: 2000
```

## Support

For issues or questions:
- Check the main README.md
- Review the script source code
- Open an issue on GitHub

---

**Generated Data is for Testing Only**

All data is fake and randomly generated. Do not use this data in production environments.

*Last Updated: November 2025*
