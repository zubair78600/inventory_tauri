# Project Structure

This document outlines the organized folder structure of the Inventory Management System.

## Root Directory Structure

```
inventory_tauri/
├── app/                    # Next.js application pages
├── components/             # React components
├── contexts/              # React contexts
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries and helpers
├── types/                 # TypeScript type definitions
├── public/                # Public static files (served directly)
├── src-tauri/             # Tauri backend (Rust)
├── DB_AI/                 # AI database integration
├── scripts/               # Utility scripts
│   └── fake-data/         # Fake data generation scripts
├── assets/                # Application assets
│   └── images/            # Icons, logos, and images
├── docs/                  # Documentation files
└── data/                  # Application data files
```

## Organized Folders

### 📁 scripts/
Contains utility and automation scripts organized by purpose.

**scripts/fake-data/**
- `generate_fake_data.py` - Original fake data generator
- `generate_fake_data_v2.py` - Enhanced fake data generator
- `requirements.txt` - Python dependencies for data generation
- `README.md` - Documentation for fake data generation

### 📁 assets/
Application assets organized by type.

**assets/images/**
- `app_icon.png` - Application icon (PNG format)
- `app_icon.svg` - Application icon (SVG format)
- `whatsapp-icon.png` - WhatsApp sharing icon
- `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` - UI icons

### 📁 docs/
Project documentation and reference materials.

- `PROJECT_DOCUMENTATION.md` - Complete project documentation
- `CHANGELOG.md` - Version history and changes
- `Plan.md` - AI database integration plan
- `lint_output.txt` - Linting results and issues
- `PROJECT_STRUCTURE.md` - This file

### 📁 data/
Application data files (currently empty, ready for use).

## Notes

- **public/** folder still contains `whatsapp-icon.png` as it's referenced by Next.js Image component
- **DB_AI/** folder remains at root as it's a separate module with its own structure
- All Python scripts related to fake data generation are now in `scripts/fake-data/`
- Documentation files are consolidated in `docs/` for easy access
- Assets are organized in `assets/images/` making them easy to locate and manage
