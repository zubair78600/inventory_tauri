import sys
from pathlib import Path
import os
import logging

# Base paths logic
if getattr(sys, 'frozen', False):
    # If running as PyInstaller binary
    # macOS .app bundle structure:
    # App.app/Contents/MacOS/db-ai-server (binary)
    # App.app/Contents/Resources/models (resources)
    
    # sys.executable is the path to the binary
    base_exe = Path(sys.executable)
    
    candidate_resources = base_exe.parent.parent / "Resources"
    
    # Check for resources relative to binary (Tauri structure)
    # Tauri often flattens ../ paths to _up_
    if (candidate_resources / "_up_" / "DB_AI").exists():
        BASE_DIR = candidate_resources / "_up_" / "DB_AI"
    elif (candidate_resources / "models").exists():
        BASE_DIR = candidate_resources
    else:
        # Fallback for local testing of binary (Dev) where models might be next to it
        BASE_DIR = base_exe.parent
else:
    # Standard Python script usage
    BASE_DIR = Path(__file__).parent

# Database path (same as Tauri app)
if os.name == "nt":  # Windows
    APP_DATA = Path(os.environ.get("APPDATA", "")) / "com.inventry.tauri"
elif os.uname().sysname == "Darwin":  # macOS
    APP_DATA = Path.home() / "Library" / "Application Support" / "com.inventry.tauri"
else:  # Linux
    APP_DATA = Path.home() / ".config" / "com.inventry.tauri"

# Models always stored in app data (not bundled) - downloaded on-demand
MODELS_DIR = APP_DATA / "models"
VECTORDB_PATH = BASE_DIR / "vectordb"
TRAINING_DIR = BASE_DIR / "training"

DB_PATH = APP_DATA / "inventory.db"

# Model configuration
MODEL_NAME = "Qwen2.5-3B-Instruct-GGUF"
MODEL_FILE = "model.gguf"  # Local model file name (user's existing model)
MODEL_PATH = MODELS_DIR / MODEL_FILE
MODEL_REPO = "Qwen/Qwen2.5-3B-Instruct-GGUF"
MODEL_REPO_FILE = "qwen2.5-3b-instruct-q4_k_m.gguf"  # The HuggingFace file to download

# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8765
