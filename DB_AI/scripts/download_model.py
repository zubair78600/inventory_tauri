#!/usr/bin/env python3
"""
Download Qwen 2.5 3B GGUF model from HuggingFace with progress tracking.
"""
import os
import sys
import json
import time
import requests
from pathlib import Path
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import MODEL_REPO, MODEL_FILE, MODELS_DIR, MODEL_REPO_FILE

# Progress file for frontend to read
PROGRESS_FILE = MODELS_DIR / ".download_progress.json"


def update_progress(downloaded: int, total: int, status: str = "downloading", speed_mbps: float = 0.0):
    """Update progress file for frontend to read"""
    progress = {
        "status": status,  # "downloading", "complete", "error", "cancelled"
        "downloaded_bytes": downloaded,
        "total_bytes": total,
        "downloaded_gb": round(downloaded / (1024**3), 2),
        "total_gb": round(total / (1024**3), 2),
        "percentage": round((downloaded / total) * 100, 1) if total > 0 else 0,
        "speed_mbps": round(speed_mbps, 1)
    }
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f)


def download_qwen_model():
    """Download model with progress tracking"""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # HuggingFace direct download URL (uses the repo file name)
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{MODEL_REPO_FILE}"
    # Save as our local model file name
    output_path = MODELS_DIR / MODEL_FILE

    # Clean up any existing corrupted/incomplete file (less than 1GB)
    if output_path.exists():
        file_size = output_path.stat().st_size
        min_valid_size = 1 * 1024 * 1024 * 1024  # 1GB
        if file_size < min_valid_size:
            print(f"Removing incomplete/corrupted file ({file_size} bytes)...")
            output_path.unlink()
        else:
            print(f"Model already exists and appears valid ({file_size / (1024**3):.2f} GB)")
            update_progress(file_size, file_size, "complete")
            return str(output_path)

    print(f"Downloading {MODEL_FILE}...")
    print(f"From: {url}")
    print(f"To: {output_path}")

    try:
        # Get file size first
        response = requests.head(url, allow_redirects=True)
        total_size = int(response.headers.get('content-length', 0))
        print(f"Total size: {total_size / (1024**3):.2f} GB")

        # Download with progress
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        downloaded = 0
        start_time = time.time()
        last_update_time = start_time
        last_downloaded = 0

        with open(output_path, 'wb') as f:
            with tqdm(total=total_size, unit='B', unit_scale=True, desc=MODEL_FILE) as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        # Check if cancelled
                        if PROGRESS_FILE.exists():
                            with open(PROGRESS_FILE) as pf:
                                progress = json.load(pf)
                                if progress.get("status") == "cancelled":
                                    print("\nDownload cancelled by user")
                                    f.close()
                                    output_path.unlink(missing_ok=True)
                                    return None

                        f.write(chunk)
                        downloaded += len(chunk)
                        pbar.update(len(chunk))
                        
                        # Calculate speed (update every 0.5 seconds to avoid overhead)
                        current_time = time.time()
                        if current_time - last_update_time >= 0.5:
                            elapsed = current_time - last_update_time
                            bytes_since_last = downloaded - last_downloaded
                            speed_mbps = (bytes_since_last / elapsed) / (1024 * 1024)  # MB/s
                            update_progress(downloaded, total_size, "downloading", speed_mbps)
                            last_update_time = current_time
                            last_downloaded = downloaded

        update_progress(total_size, total_size, "complete")
        print(f"\nModel downloaded successfully to: {output_path}")
        return str(output_path)

    except Exception as e:
        update_progress(0, 0, "error")
        print(f"\nError downloading model: {e}")
        raise


def get_download_progress():
    """Read current download progress"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return None


def cancel_download():
    """Mark download as cancelled"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            progress = json.load(f)
        progress["status"] = "cancelled"
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(progress, f)
    else:
        # Create cancellation marker
        update_progress(0, 0, "cancelled")


def check_model_exists():
    """Check if model is already downloaded and valid (not empty/corrupt)"""
    model_path = MODELS_DIR / MODEL_FILE
    if not model_path.exists():
        return False
    # Model should be at least 1GB (valid GGUF file)
    # If it's smaller, it's likely corrupted or incomplete
    file_size = model_path.stat().st_size
    min_valid_size = 1 * 1024 * 1024 * 1024  # 1GB
    return file_size >= min_valid_size


def force_delete_model():
    """Explicitly delete the model file for re-download (user requested)"""
    model_path = MODELS_DIR / MODEL_FILE
    if model_path.exists():
        print(f"Deleting model file: {model_path}")
        model_path.unlink()
        # Also clear progress file
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        return True
    return False


if __name__ == "__main__":
    if check_model_exists():
        print(f"Model already exists at: {MODELS_DIR / MODEL_FILE}")
        print("Delete it if you want to re-download.")
    else:
        download_qwen_model()
