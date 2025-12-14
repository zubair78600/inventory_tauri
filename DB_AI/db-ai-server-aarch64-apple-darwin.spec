# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = ['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan.on', 'chromadb', 'chromadb.telemetry.product.posthog', 'chromadb.db.impl.sqlite', 'sqlite3']
tmp_ret = collect_all('chromadb')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('vanna')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
# Manually locate llama dependencies
import os
import llama_cpp
llama_cpp_path = os.path.dirname(llama_cpp.__file__)
# Include the specific library files
binaries += [(os.path.join(llama_cpp_path, 'lib', 'libllama.dylib'), '.')]
datas += [(os.path.join(llama_cpp_path, 'lib', '*'), 'llama_cpp/lib')]
hiddenimports += ['llama_cpp']

# Include local packages
datas += [('core', 'core'), ('scripts', 'scripts'), ('vectordb', 'vectordb'), ('training', 'training')]
binaries += []


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
