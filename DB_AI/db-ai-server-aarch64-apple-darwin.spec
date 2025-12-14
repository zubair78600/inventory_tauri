# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all
import os

datas = [('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/*', 'llama_cpp/lib'), ('core', 'core'), ('scripts', 'scripts'), ('vectordb', 'vectordb'), ('training', 'training')]
binaries = [('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libggml.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libmtmd.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libggml-base.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libggml-blas.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libllama.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libggml-cpu.dylib', '.'), ('/Users/naziya/inventory_tauri/DB_AI/.venv/lib/python3.13/site-packages/llama_cpp/lib/libggml-metal.dylib', '.')]
hiddenimports = ['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan.on', 'chromadb', 'chromadb.telemetry.product.posthog', 'chromadb.db.impl.sqlite', 'sqlite3', 'llama_cpp', 'vanna']

# Collect dependencies for complex packages
for pkg in ['chromadb', 'vanna']:
    tmp_ret = collect_all(pkg)
    datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='db-ai-server-aarch64-apple-darwin',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
