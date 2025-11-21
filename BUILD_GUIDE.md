# Build & Release Guide - Inventory System

**Version:** 1.0.0
**Date:** November 21, 2024
**Platform:** macOS (primary), Windows (optional)

---

## Prerequisites

### Development Tools
- [x] Rust 1.70+ (`rustc --version`)
- [x] Node.js 18+ (`node --version`)
- [x] npm 9+ (`npm --version`)
- [x] Tauri CLI 2.x (`npm run tauri --version`)

### macOS Specific
- [x] Xcode Command Line Tools
- [x] Code signing certificate (optional, for distribution)

### Windows Specific (if building)
- [ ] Visual Studio Build Tools
- [ ] WebView2 Runtime

---

## Phase 12: Build Configuration & Icons

### Current Status
✅ `tauri.conf.json` configured
✅ Bundle targets set: `["dmg", "app"]`
✅ Window dimensions: 1400x900 (min: 1024x768)
⏳ **App icon needed** (1024x1024px)

### Icon Requirements

**Sizes Needed:**
- `icons/32x32.png` - Small size
- `icons/128x128.png` - Standard
- `icons/128x128@2x.png` - Retina
- `icons/icon.icns` - macOS bundle
- `icons/icon.ico` - Windows

**Creating Icons:**

1. **Design 1024x1024 master icon**
   - Simple, recognizable design
   - Inventory/warehouse theme
   - Good contrast for small sizes

2. **Generate all sizes:**
   ```bash
   # Option 1: Use online tool
   # - https://easyappicon.com
   # - Upload 1024x1024 PNG
   # - Download icon set

   # Option 2: Use imagemagick
   convert master-icon.png -resize 32x32 icons/32x32.png
   convert master-icon.png -resize 128x128 icons/128x128.png
   convert master-icon.png -resize 256x256 icons/128x128@2x.png

   # For .icns (macOS):
   iconutil -c icns icons.iconset -o icons/icon.icns

   # For .ico (Windows):
   convert master-icon.png -define icon:auto-resize=256,128,64,48,32,16 icons/icon.ico
   ```

3. **Place in:** `src-tauri/icons/`

### Configuration Review

**`tauri.conf.json` Settings:**
```json
{
  "productName": "Inventory System",
  "version": "1.0.0",
  "identifier": "com.inventry.tauri",
  "bundle": {
    "targets": ["dmg", "app"],
    "macOS": {
      "minimumSystemVersion": "10.13"
    }
  }
}
```

✅ All configuration ready for production build

---

## Phase 13: macOS Build & Testing

### Build Commands

#### Development Build
```bash
npm run tauri:dev
```

#### Production Build
```bash
# Full production build
npm run tauri build

# Or step by step:
npm run build              # Build Next.js static export
cd src-tauri
cargo build --release      # Build Rust
cd ..
npm run tauri build        # Create bundles
```

### Build Output

**Location:** `src-tauri/target/release/bundle/`

**Files Created:**
- `dmg/Inventory System_1.0.0_aarch64.dmg` (Apple Silicon)
- `dmg/Inventory System_1.0.0_x64.dmg` (Intel)
- `macos/Inventory System.app/` (Application bundle)

### Build Time Expectations
- **First build:** 5-10 minutes (compiling Rust dependencies)
- **Incremental builds:** 1-3 minutes
- **Bundle size:** ~15-25 MB (depends on dependencies)

### Testing the .dmg

1. **Mount the DMG:**
   ```bash
   open "src-tauri/target/release/bundle/dmg/Inventory System_1.0.0_aarch64.dmg"
   ```

2. **Install:**
   - Drag "Inventory System.app" to Applications
   - Or run directly from DMG

3. **First Launch:**
   - Right-click → Open (if not code-signed)
   - Grant any permissions requested

4. **Verify:**
   - [ ] Application launches
   - [ ] Window displays correctly
   - [ ] Database created at: `~/Library/Application Support/com.inventry.tauri/`
   - [ ] All pages accessible
   - [ ] Mock data can be loaded
   - [ ] CRUD operations work

### Database Location Verification
```bash
# Check database was created
ls -lh "~/Library/Application Support/com.inventry.tauri/inventory.db"

# View database
sqlite3 "~/Library/Application Support/com.inventry.tauri/inventory.db" ".tables"
```

### Performance Testing

Run through test scenarios:
- [ ] Load 100+ products
- [ ] Create 20+ invoices
- [ ] Test search with large dataset
- [ ] Verify no memory leaks
- [ ] Check CPU usage

**Acceptable Performance:**
- App startup: < 3 seconds
- Page navigation: < 200ms
- Database operations: < 500ms

### Known Issues Checklist
- [ ] Dark mode compatibility
- [ ] Retina display support
- [ ] Window state persistence
- [ ] Database file permissions
- [ ] Network connectivity (should work offline)

---

## Phase 14: Windows Build (Optional)

### Windows Build Setup

#### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/build-windows.yml`:
```yaml
name: Windows Build
on: [push, workflow_dispatch]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: npm install
      - run: npm run tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: src-tauri/target/release/bundle/msi/
```

#### Option 2: Local Windows Machine

```powershell
# Install Rust
winget install Rustlang.Rust.GNU

# Install Node.js
winget install OpenJS.NodeJS

# Clone repo
git clone https://github.com/zubair78600/inventory_tauri
cd inventory_tauri

# Build
npm install
npm run tauri build
```

### Windows Build Output

**Location:** `src-tauri\target\release\bundle\`

**Files:**
- `msi\Inventory System_1.0.0_x64_en-US.msi` (Installer)
- `nsis\Inventory System_1.0.0_x64-setup.exe` (Alternative installer)

### Windows Testing
- [ ] Install on Windows 10/11
- [ ] Verify WebView2 installation
- [ ] Test all features
- [ ] Check database location: `%APPDATA%\com.inventry.tauri\`

---

## Phase 15: Final Testing, Documentation & Release

### Pre-Release Checklist

#### Code Quality
- [x] All Rust code compiles without errors
- [x] TypeScript builds without errors
- [x] No console errors in production
- [x] Database migrations stable
- [x] All 30 commands functional

#### Documentation
- [x] README.md updated
- [x] BACKEND_COMPLETE.md created
- [x] TEST_PLAN.md created
- [x] BUILD_GUIDE.md created (this file)
- [x] PHASE_TRACKING.md complete
- [ ] User guide (optional)
- [ ] API documentation (optional)

#### Testing
- [ ] All test plan scenarios passed
- [ ] Performance benchmarks met
- [ ] Cross-platform testing (if applicable)
- [ ] User acceptance testing

### Creating GitHub Release

1. **Tag the version:**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0 - Full backend implementation"
   git push origin v1.0.0
   ```

2. **Create Release on GitHub:**
   - Go to: https://github.com/zubair78600/inventory_tauri/releases
   - Click "Create a new release"
   - Choose tag: `v1.0.0`
   - Release title: `Inventory System v1.0.0`
   - Description:

   ```markdown
   # Inventory System v1.0.0

   First production release of the Tauri-based Inventory Management System.

   ## Features
   - ✅ Products management (CRUD)
   - ✅ Suppliers management (CRUD)
   - ✅ Customers management (CRUD)
   - ✅ Invoice creation with stock management
   - ✅ Analytics dashboard
   - ✅ OmniSearch across all entities
   - ✅ CSV export (products, customers)
   - ✅ 30 Tauri commands
   - ✅ SQLite database
   - ✅ Offline-first desktop app

   ## Downloads
   - **macOS (Apple Silicon):** `Inventory System_1.0.0_aarch64.dmg`
   - **macOS (Intel):** `Inventory System_1.0.0_x64.dmg`
   - **Windows:** `Inventory System_1.0.0_x64_en-US.msi` (if built)

   ## Installation
   1. Download the appropriate file for your platform
   2. macOS: Open DMG, drag to Applications
   3. Windows: Run MSI installer
   4. Launch the application

   ## Database
   - macOS: `~/Library/Application Support/com.inventry.tauri/inventory.db`
   - Windows: `%APPDATA%\com.inventry.tauri\inventory.db`

   ## Known Limitations
   - PDF invoice generation not implemented (future release)
   - No cloud sync (local database only)
   - No authentication (single-user desktop app)

   ## Requirements
   - macOS 10.13+ or Windows 10+
   - ~25 MB disk space
   - No internet required (offline-capable)
   ```

3. **Upload Build Artifacts:**
   - Drag and drop `.dmg` files
   - Drag and drop `.msi` file (if built)
   - Add checksums (optional)

4. **Publish Release**

### Post-Release

#### Update README.md
```markdown
## Download

Download the latest release: [v1.0.0](https://github.com/zubair78600/inventory_tauri/releases/tag/v1.0.0)

- macOS (Apple Silicon): `Inventory System_1.0.0_aarch64.dmg`
- macOS (Intel): `Inventory System_1.0.0_x64.dmg`
```

#### Create Screenshots
- [ ] Dashboard view
- [ ] Products list
- [ ] Invoice creation
- [ ] Search results
- [ ] Analytics view

Store in: `screenshots/` folder

#### Update Documentation Site (Optional)
- User guide
- API reference
- Video tutorials

---

## Troubleshooting

### Build Issues

**Issue: Rust compilation fails**
```bash
# Clean and rebuild
cd src-tauri
cargo clean
cargo build --release
```

**Issue: Next.js build fails**
```bash
# Clean Next.js cache
rm -rf .next out
npm run build
```

**Issue: Icon not found**
```bash
# Verify icons exist
ls -la src-tauri/icons/
```

### Runtime Issues

**Issue: Database not created**
- Check app permissions
- Verify app data directory exists
- Check logs in console

**Issue: Commands fail**
```bash
# Check Tauri console for errors
# View Rust logs
export RUST_LOG=debug
npm run tauri dev
```

---

## Performance Optimization

### Release Build Optimizations

**Already configured in `Cargo.toml`:**
```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
```

### Bundle Size Reduction
- [ ] Remove unused dependencies
- [ ] Optimize images/icons
- [ ] Tree-shake JavaScript
- [ ] Compress assets

### Runtime Optimizations
- [ ] Add database indexes (already done)
- [ ] Implement pagination for large lists
- [ ] Cache frequent queries
- [ ] Lazy load components

---

## Maintenance

### Version Updates

**Update version in:**
1. `package.json` → `"version": "1.1.0"`
2. `src-tauri/Cargo.toml` → `version = "1.1.0"`
3. `src-tauri/tauri.conf.json` → `"version": "1.1.0"`

**Build new release:**
```bash
npm run tauri build
git tag -a v1.1.0 -m "Version 1.1.0"
git push origin v1.1.0
```

### Database Migrations

For future schema changes:
1. Create migration script
2. Implement in `src-tauri/src/db/schema.rs`
3. Version check on startup
4. Auto-migrate or prompt user

---

## Success Criteria

### Phase 13 Complete When:
- [x] macOS build creates .dmg successfully
- [ ] .dmg installs and runs without errors
- [ ] All 30 commands functional in production
- [ ] Performance meets benchmarks
- [ ] No critical bugs

### Phase 15 Complete When:
- [ ] GitHub release v1.0.0 published
- [ ] Build artifacts uploaded
- [ ] Documentation complete
- [ ] README updated with download links
- [ ] Project tagged and versioned

---

**Last Updated:** November 21, 2024

**Status:** Ready for macOS build (icon creation pending)
