#!/bin/bash
cd "$(dirname "$0")"

echo "Building AI Sidecar for aarch64-apple-darwin..."

# Ensure output directory exists
mkdir -p ../src-tauri/binaries

# Generate spec file
python3 build_spec.py --name "db-ai-server-aarch64-apple-darwin"

# Build using PyInstaller and the generated spec
pyinstaller --clean --noconfirm --distpath "../src-tauri/binaries" "db-ai-server-aarch64-apple-darwin.spec"

echo "Build complete. Binary located at ../src-tauri/binaries/db-ai-server-aarch64-apple-darwin"
