# Inventory System - Tauri Desktop Application

A modern, lightweight desktop inventory management system built with Tauri, Next.js, and Rust.

## Features

- **Product Management** - Track products, SKUs, pricing, and stock levels
- **Supplier Management** - Manage supplier information and relationships
- **Customer Management** - Maintain customer database with purchase history
- **Invoice Management** - Create, edit, and track invoices with automatic stock updates
- **PDF Generation** - Generate professional invoice PDFs
- **Analytics Dashboard** - Real-time insights into sales, inventory, and performance
- **Reports** - Comprehensive reporting for customers, sales, and inventory
- **Search** - Powerful OmniSearch across all modules
- **Export** - Export data to CSV for external analysis
- **Backup/Restore** - Protect your data with easy backup and restore

## Tech Stack

### Frontend
- **Next.js 16** - React framework with static export
- **React 19** - UI library
- **Tailwind CSS** - Utility-first CSS
- **TypeScript** - Type safety

### Backend
- **Tauri 2.0** - Desktop app framework
- **Rust** - Systems programming language
- **SQLite** - Embedded database via rusqlite

## System Requirements

### macOS
- macOS 10.13 or later
- ~20MB disk space

### Windows
- Windows 10 or later
- WebView2 Runtime (auto-installed if needed)
- ~25MB disk space

## Installation

### Download

Download the latest release for your platform:
- **macOS:** `Inventory-System_1.0.0_universal.dmg`
- **Windows:** `Inventory-System_1.0.0_x64-setup.exe`

### macOS Installation
1. Download the `.dmg` file
2. Open the `.dmg` file
3. Drag "Inventory System" to Applications folder
4. Launch from Applications

### Windows Installation
1. Download the `.exe` installer
2. Run the installer
3. Follow the installation wizard
4. Launch from Start menu

## For Developers

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
├── types/           # TypeScript type definitions
├── public/          # Static assets
├── src-tauri/       # Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── commands/         # Tauri commands
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

## Database Location

The application stores its database in the following locations:

- **macOS:** `~/Library/Application Support/com.inventry.tauri/inventory.db`
- **Windows:** `%APPDATA%\com.inventry.tauri\inventory.db`

## Building from Source

### macOS

```bash
npm run tauri:build:mac
```

Output: `src-tauri/target/release/bundle/dmg/`

### Windows

```bash
npm run tauri:build:win
```

Output: `src-tauri/target/release/bundle/nsis/`

## License

[Add license information]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: https://github.com/zubair78600/inventory_tauri/issues

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Built with ❤️ using Tauri**
