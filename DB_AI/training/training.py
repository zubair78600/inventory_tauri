#!/usr/bin/env python3
"""
Training script for Vanna AI.
Loads DDL, documentation, and question-SQL pairs to train the model.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vanna_setup import VannaAI
from config import DB_PATH, MODEL_PATH, VECTORDB_PATH, TRAINING_DIR


def load_training_data():
    """Load all training data from files"""
    training_data = {"ddl": [], "documentation": [], "question_sql": []}

    # Load DDL files
    ddl_dir = TRAINING_DIR / "ddl"
    if ddl_dir.exists():
        for ddl_file in ddl_dir.glob("*.sql"):
            with open(ddl_file) as f:
                training_data["ddl"].append(f.read())
                print(f"Loaded DDL: {ddl_file.name}")

    # Load Documentation files
    doc_dir = TRAINING_DIR / "documentation"
    if doc_dir.exists():
        for doc_file in doc_dir.glob("*.md"):
            with open(doc_file) as f:
                training_data["documentation"].append(f.read())
                print(f"Loaded documentation: {doc_file.name}")

    # Load Question-SQL pairs
    qs_dir = TRAINING_DIR / "question_sql_pairs"
    if qs_dir.exists():
        for qs_file in qs_dir.glob("*.json"):
            with open(qs_file) as f:
                pairs = json.load(f)
                training_data["question_sql"].extend(pairs)
                print(f"Loaded {len(pairs)} Q-SQL pairs from: {qs_file.name}")

    return training_data


def train_vanna():
    """Train VannaAI with all available training data"""
    print("=" * 50)
    print("Vanna AI Training Script")
    print("=" * 50)

    # Check if model exists
    if not MODEL_PATH.exists():
        print(f"\nError: Model not found at {MODEL_PATH}")
        print("Please download the model first using scripts/download_model.py")
        sys.exit(1)

    print(f"\nInitializing VannaAI...")
    print(f"  Model: {MODEL_PATH}")
    print(f"  Database: {DB_PATH}")
    print(f"  VectorDB: {VECTORDB_PATH}")

    vanna = VannaAI(
        model_path=str(MODEL_PATH),
        db_path=str(DB_PATH),
        vectordb_path=str(VECTORDB_PATH)
    )

    data = load_training_data()

    print("\n" + "-" * 50)
    print("Training with DDL statements...")
    for i, ddl in enumerate(data["ddl"], 1):
        vanna.train(ddl=ddl)
        print(f"  Trained DDL {i}/{len(data['ddl'])}")

    print("\n" + "-" * 50)
    print("Training with documentation...")
    for i, doc in enumerate(data["documentation"], 1):
        vanna.train(documentation=doc)
        print(f"  Trained doc {i}/{len(data['documentation'])}")

    print("\n" + "-" * 50)
    print("Training with question-SQL pairs...")
    for i, pair in enumerate(data["question_sql"], 1):
        vanna.train(question=pair["question"], sql=pair["sql"])
        if i % 10 == 0 or i == len(data["question_sql"]):
            print(f"  Trained pair {i}/{len(data['question_sql'])}")

    print("\n" + "=" * 50)
    print("Training complete!")
    print(f"  DDL statements: {len(data['ddl'])}")
    print(f"  Documentation files: {len(data['documentation'])}")
    print(f"  Question-SQL pairs: {len(data['question_sql'])}")
    print("=" * 50)


if __name__ == "__main__":
    train_vanna()
