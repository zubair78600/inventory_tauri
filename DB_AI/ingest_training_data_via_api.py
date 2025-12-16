import json
import requests
from pathlib import Path
import time

TRAINING_FILE = Path("/Users/zubair/Documents/Inventry_tauri/DB_AI/training/question_sql_pairs/inventory_queries.json")
API_URL = "http://127.0.0.1:8765/train"

def ingest_data():
    if not TRAINING_FILE.exists():
        print(f"Error: File not found at {TRAINING_FILE}")
        return

    try:
        with open(TRAINING_FILE, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    print(f"Found {len(data)} training pairs.")
    
    success_count = 0
    headers = {"Content-Type": "application/json"}

    for item in data:
        question = item.get("question")
        sql = item.get("sql")
        
        if not question or not sql:
            print(f"Skipping invalid item: {item}")
            continue

        payload = {
            "training_type": "question_sql",
            "question": question,
            "content": sql
        }

        try:
            response = requests.post(API_URL, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"[OK] Trained: {question}")
                success_count += 1
            else:
                print(f"[FAIL] {question} - Status: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] Could not connect to API for '{question}': {e}")
            # If server is down, no point retrying all immediately
            break
            
    print(f"\nIngestion complete. Successfully trained {success_count}/{len(data)} items.")

if __name__ == "__main__":
    ingest_data()
