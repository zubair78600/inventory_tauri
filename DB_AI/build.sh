#!/bin/bash
cd "$(dirname "$0")"

echo "Building AI Sidecar for aarch64-apple-darwin..."

# Ensure output directory exists
mkdir -p ../src-tauri/binaries

# Build using PyInstaller
pyinstaller --clean --noconfirm --onefile \
    --name "db-ai-server-aarch64-apple-darwin" \
    --distpath "../src-tauri/binaries" \
    --hidden-import="uvicorn.logging" \
    --hidden-import="uvicorn.loops" \
    --hidden-import="uvicorn.loops.auto" \
    --hidden-import="uvicorn.protocols" \
    --hidden-import="uvicorn.protocols.http" \
    --hidden-import="uvicorn.protocols.http.auto" \
    --hidden-import="uvicorn.protocols.websockets" \
    --hidden-import="uvicorn.protocols.websockets.auto" \
    --hidden-import="uvicorn.lifespan.on" \
    --hidden-import="chromadb" \
    --hidden-import="chromadb.telemetry.product.posthog" \
    --hidden-import="chromadb.db.impl.sqlite" \
    --hidden-import="sqlite3" \
    --collect-all="chromadb" \
    --collect-all="vanna" \
    --collect-all="llama_cpp" \
    main.py

echo "Build complete. Binary located at ../src-tauri/binaries/db-ai-server-aarch64-apple-darwin"
