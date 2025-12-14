import os
import sys
import argparse
import PyInstaller.__main__
import glob
from pathlib import Path

def generate_spec(name):
    print(f"Generating spec for {name} on {sys.platform}...")
    
    # 1. Find llama_cpp location
    try:
        import llama_cpp
        llama_path = os.path.dirname(llama_cpp.__file__)
        print(f"Found llama_cpp at: {llama_path}")
    except ImportError:
        print("Error: llama_cpp module not found. Please install requirements first.")
        sys.exit(1)

    # 2. Determine binary/data paths for llama_cpp
    binaries = []
    datas = []
    
    if sys.platform.startswith('darwin'):
        # macOS: Look for .dylib
        lib_files = glob.glob(os.path.join(llama_path, 'lib', '*.dylib'))
        for lib in lib_files:
            binaries.append((lib, '.'))
        # Also include everything in lib as data to be safe
        datas.append((os.path.join(llama_path, 'lib', '*'), 'llama_cpp/lib'))
        
    elif sys.platform.startswith('win'):
        # Windows: Look for .dll
        # Sometimes it's in the package root, sometimes in lib
        dll_files = glob.glob(os.path.join(llama_path, '*.dll')) + \
                    glob.glob(os.path.join(llama_path, 'lib', '*.dll'))
        for dll in dll_files:
            binaries.append((dll, '.'))
            
    else: # Linux
        # Linux: Look for .so
        so_files = glob.glob(os.path.join(llama_path, 'lib', '*.so'))
        for so in so_files:
            binaries.append((so, '.'))

    # 3. Add local packages
    # (source_path, dest_folder_in_bundle)
    packages = ['core', 'scripts', 'vectordb', 'training']
    for pkg in packages:
        if os.path.exists(pkg):
            datas.append((pkg, pkg))
    
    # Add config content
    script_content = f"""# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all
import os

datas = {datas}
binaries = {binaries}
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
    hooksconfig={{}},
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
    name='{name}',
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
"""
    
    spec_file = f"{name}.spec"
    with open(spec_file, 'w') as f:
        f.write(script_content)
    
    print(f"Generated {spec_file}")
    print(f"Included binaries: {len(binaries)}")
    print(f"Included datas: {len(datas)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True, help="Name of the output binary")
    args = parser.parse_args()
    
    generate_spec(args.name)
