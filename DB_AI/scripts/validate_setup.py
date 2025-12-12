#!/usr/bin/env python3
"""
Validate the DB_AI setup - check dependencies, paths, and configuration.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

def check_dependencies():
    """Check if all required packages are installed"""
    print("Checking dependencies...")
    issues = []

    # Core dependencies
    packages = [
        ("vanna", "vanna"),
        ("llama_cpp", "llama-cpp-python"),
        ("chromadb", "chromadb"),
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pydantic", "pydantic"),
        ("huggingface_hub", "huggingface-hub"),
        ("requests", "requests"),
        ("tqdm", "tqdm"),
    ]

    for module_name, package_name in packages:
        try:
            __import__(module_name)
            print(f"  ✓ {package_name}")
        except ImportError:
            print(f"  ✗ {package_name} - NOT INSTALLED")
            issues.append(f"pip install {package_name}")

    return issues


def check_paths():
    """Check if required paths exist"""
    print("\nChecking paths...")
    
    from config import BASE_DIR, MODELS_DIR, VECTORDB_PATH, TRAINING_DIR, DB_PATH, MODEL_PATH

    paths = [
        ("Base directory", BASE_DIR, True),
        ("Models directory", MODELS_DIR, True),
        ("VectorDB directory", VECTORDB_PATH, True),
        ("Training directory", TRAINING_DIR, True),
        ("Database file", DB_PATH, False),
        ("Model file", MODEL_PATH, False),
    ]

    issues = []
    for name, path, is_dir in paths:
        exists = path.exists()
        symbol = "✓" if exists else "✗"
        status = "exists" if exists else "NOT FOUND"
        print(f"  {symbol} {name}: {path} - {status}")

        if not exists:
            if is_dir:
                issues.append(f"Create directory: mkdir -p {path}")
            else:
                if name == "Model file":
                    issues.append("Download model: python scripts/download_model.py")
                elif name == "Database file":
                    issues.append("Run the main Tauri app to create the database")

    return issues


def check_training_data():
    """Check training data files"""
    print("\nChecking training data...")
    
    from config import TRAINING_DIR

    training_data = {
        "DDL files": list((TRAINING_DIR / "ddl").glob("*.sql")) if (TRAINING_DIR / "ddl").exists() else [],
        "Documentation files": list((TRAINING_DIR / "documentation").glob("*.md")) if (TRAINING_DIR / "documentation").exists() else [],
        "Q-SQL pair files": list((TRAINING_DIR / "question_sql_pairs").glob("*.json")) if (TRAINING_DIR / "question_sql_pairs").exists() else [],
    }

    issues = []
    for name, files in training_data.items():
        count = len(files)
        symbol = "✓" if count > 0 else "✗"
        print(f"  {symbol} {name}: {count} file(s)")
        if count == 0:
            issues.append(f"Add {name.lower()} to training directory")

    return issues


def main():
    print("=" * 50)
    print("DB_AI Setup Validator")
    print("=" * 50)

    all_issues = []

    all_issues.extend(check_dependencies())
    all_issues.extend(check_paths())
    all_issues.extend(check_training_data())

    print("\n" + "=" * 50)
    if all_issues:
        print("Issues found:")
        for issue in all_issues:
            print(f"  - {issue}")
        print("\nTo fix dependency issues, run:")
        print("  pip install -r requirements.txt")
    else:
        print("All checks passed! ✓")
    print("=" * 50)

    return len(all_issues) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
