from config import MODEL_PATH, APP_DATA, MODELS_DIR
import os
import sys

print(f"Python Executable: {sys.executable}")
print(f"Current Working Directory: {os.getcwd()}")
print(f"OS Information: {os.uname()}")
print(f"APP_DATA: {APP_DATA}")
print(f"MODELS_DIR: {MODELS_DIR}")
print(f"MODEL_PATH: {MODEL_PATH}")

if MODEL_PATH.exists():
    print(f"SUCCESS: Model file found at {MODEL_PATH}")
    print(f"File size: {MODEL_PATH.stat().st_size} bytes")
else:
    print(f"FAILURE: Model file NOT found at {MODEL_PATH}")
    if not MODELS_DIR.exists():
        print(f"FAILURE: Models directory does NOT exist at {MODELS_DIR}")
    else:
        print(f"Models directory exists.")
        print("Contents of models directory:")
        try:
            for item in MODELS_DIR.iterdir():
                print(f" - {item.name}")
        except Exception as e:
            print(f"Error listing directory: {e}")
