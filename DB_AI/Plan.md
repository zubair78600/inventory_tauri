# Offline AI Chat Feature Implementation Plan

## Overview
Add an offline AI-powered database chat feature using **Vanna AI** + **Qwen 2.5 3B** (via llama-cpp-python) to the Tauri inventory application.

---

## 1. Folder Structure (All inside DB_AI/)

```
DB_AI/
├── __init__.py
├── requirements.txt              # Python dependencies
├── main.py                       # FastAPI server entry point
├── config.py                     # Configuration constants
│
├── core/
│   ├── __init__.py
│   ├── vanna_setup.py            # Vanna + llama-cpp-python integration
│   ├── llm_backend.py            # Custom LLM class for llama-cpp-python
│   └── sql_executor.py           # Safe SQL execution with timing
│
├── training/
│   ├── __init__.py
│   ├── training.py               # Script to feed training data
│   ├── ddl/
│   │   └── schema.sql            # Complete DDL from database
│   ├── documentation/
│   │   ├── products.md           # Business docs for products
│   │   ├── suppliers.md          # Business docs for suppliers
│   │   ├── customers.md          # Business docs for customers
│   │   ├── invoices.md           # Business docs for invoices/sales
│   │   ├── purchase_orders.md    # Business docs for POs
│   │   ├── payments.md           # Payment systems docs
│   │   └── inventory.md          # FIFO inventory docs
│   └── question_sql_pairs/
│       ├── products_queries.json
│       ├── sales_queries.json
│       ├── customers_queries.json
│       ├── suppliers_queries.json
│       ├── inventory_queries.json
│       └── analytics_queries.json
│
├── models/
│   └── .gitkeep                  # Qwen model downloaded here
│
├── vectordb/
│   └── .gitkeep                  # ChromaDB storage
│
└── scripts/
    ├── download_model.py         # Download Qwen model from HuggingFace
    ├── build_sidecar.py          # PyInstaller build script
    └── validate_setup.py         # Verify dependencies
```

---

## 2. Implementation Steps

### Step 1: Create DB_AI Python Backend

**Files to create:**

1. **DB_AI/requirements.txt**
   ```
   vanna>=0.7.0
   llama-cpp-python>=0.2.90
   chromadb>=0.4.22
   fastapi>=0.109.0
   uvicorn[standard]>=0.27.0
   pydantic>=2.5.0
   huggingface-hub>=0.20.0
   ```

2. **DB_AI/config.py** - Configuration with paths:
   - DB_PATH: `~/.config/com.inventry.tauri/inventory.db`
   - MODEL_PATH: `DB_AI/models/qwen2.5-3b-instruct-q4_k_m.gguf`
   - VECTORDB_PATH: `DB_AI/vectordb/`
   - SERVER_PORT: 8765

3. **DB_AI/core/llm_backend.py** - Custom LLM class using llama-cpp-python:
   - Load Qwen 2.5 3B GGUF model
   - Use ChatML format for Qwen
   - Metal acceleration on macOS (n_gpu_layers=-1)
   - Temperature 0.1 for deterministic SQL

4. **DB_AI/core/vanna_setup.py** - Vanna integration:
   - Extend ChromaDB_VectorStore
   - Connect to SQLite database
   - Override submit_prompt to use llama-cpp-python

5. **DB_AI/core/sql_executor.py** - Safe SQL execution:
   - Read-only enforcement (block INSERT/UPDATE/DELETE)
   - Auto-add LIMIT clause
   - Return results as list of dicts

6. **DB_AI/main.py** - FastAPI server with endpoints:
   - `GET /health` - Health check
   - `GET /status` - Setup status (model downloaded, trained, ready)
   - `POST /query` - Process natural language query
   - `POST /train` - Add training data
   - `POST /download-model` - Trigger model download

---

### Step 2: Create Training Data

**DDL (DB_AI/training/ddl/schema.sql):**
- Extract complete schema from `src-tauri/src/db/schema.rs`
- Include all 15 tables with columns and foreign keys

**Documentation files (DB_AI/training/documentation/):**
- products.md - Fields, business rules, common queries
- suppliers.md - Supplier data, pending balance calculations
- customers.md - Customer data, credit tracking
- invoices.md - Sales/billing, GST calculations
- purchase_orders.md - PO workflow, receiving
- payments.md - Customer and supplier payments
- inventory.md - FIFO tracking, stock calculations

**Question-SQL pairs (DB_AI/training/question_sql_pairs/):**
- 50-100 high-quality pairs covering:
  - Product queries (stock, low stock, top selling)
  - Sales queries (by date, customer, product)
  - Customer queries (credit, invoices, spending)
  - Supplier queries (pending balance, stock value)
  - Analytics (trends, summaries, reports)

---

### Step 3: Tauri Integration

**Files to modify:**

1. **src-tauri/Cargo.toml** - Add dependency:
   ```toml
   tauri-plugin-shell = "2"
   ```

2. **src-tauri/tauri.conf.json** - Add sidecar config:
   ```json
   {
     "bundle": {
       "externalBin": ["binaries/db-ai-server"]
     },
     "plugins": {
       "shell": {
         "sidecar": true,
         "scope": [{
           "name": "binaries/db-ai-server",
           "sidecar": true,
           "args": true
         }]
       }
     }
   }
   ```

3. **src-tauri/src/commands/ai_chat.rs** (new file):
   - `start_ai_sidecar` - Launch Python server
   - `stop_ai_sidecar` - Kill server
   - `check_ai_sidecar_status` - Check if running

4. **src-tauri/src/lib.rs**:
   - Add `tauri_plugin_shell::init()`
   - Add AiSidecarState management
   - Register new commands

---

### Step 4: React Chat UI

**Files to create:**

1. **lib/ai-chat.ts** - API client:
   - Sidecar management (via Tauri invoke)
   - HTTP calls to FastAPI server
   - Query, train, download-model functions

2. **components/ai-chat/AIChatButton.tsx**:
   - Floating button fixed bottom-right
   - Opens chat dialog on click

3. **components/ai-chat/AIChatDialog.tsx**:
   - Setup screen (first-time download prompt)
   - Message list with user/assistant bubbles
   - Display SQL, results table, timing info
   - Input form for questions

4. **components/ai-chat/TrainingFeedbackModal.tsx**:
   - Opens when query fails
   - User provides correct SQL
   - Submits to /train endpoint

**Files to modify:**

5. **components/layout/AppShell.tsx**:
   - Import and add `<AIChatButton />` before closing div

---

### Step 5: Training Script

**DB_AI/training/training.py**:
- Load all DDL from `training/ddl/`
- Load all documentation from `training/documentation/`
- Load all question-SQL pairs from `training/question_sql_pairs/`
- Feed to Vanna using `vn.train()`

**Usage:**
```bash
cd DB_AI
python training/training.py
```

---

### Step 6: Build & Bundle

**DB_AI/scripts/download_model.py**:
- Download `qwen2.5-3b-instruct-q4_k_m.gguf` from HuggingFace
- Save to `DB_AI/models/`

**DB_AI/scripts/build_sidecar.py**:
- PyInstaller one-file build
- Output to `src-tauri/binaries/db-ai-server-{target-triple}`
- Include all dependencies

---

## 3. Model Download Flow (First Time Setup)

**User-controlled manual download with progress:**

1. User clicks chat icon for the first time
2. Chat dialog opens → shows "Setup Required" screen
3. Displays: "AI Model not found. Download required to enable AI chat."
4. User clicks **"Download AI Model"** button
5. Progress bar appears showing:
   - Download progress: `1.2 GB / 2.0 GB`
   - Percentage: `60%`
   - Estimated time remaining (optional)
6. User can **cancel** download if needed
7. On completion: "Download complete! Initializing AI..."
8. Chat is ready to use

**Progress UI Component:**
```
┌─────────────────────────────────────────┐
│  Downloading AI Model...                │
│  ████████████░░░░░░░░  1.2 GB / 2.0 GB  │
│  60% complete                           │
│                          [Cancel]       │
└─────────────────────────────────────────┘
```

---

## 4. Console Timing Output Format

Every query logs to console:
```
Extracted SQL: SELECT name FROM customers;
  [SQL Gen]: 1.71s
  [SQL Run]: 0.00s
  [Total]: 1.71s
```

---

## 5. Performance Targets (<2 seconds)

1. **Model**: Q4_K_M quantization (~2GB, fast inference)
2. **GPU**: Metal acceleration on macOS
3. **Context**: n_ctx=4096 (smaller = faster)
4. **Temperature**: 0.1 (deterministic)
5. **Caching**: Hash-based query cache for repeated questions
6. **Pre-warming**: Start sidecar on app launch (background)

---

## 6. Critical Files to Modify

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add tauri-plugin-shell |
| `src-tauri/tauri.conf.json` | Add externalBin and shell plugin |
| `src-tauri/src/lib.rs` | Add shell plugin, sidecar state, commands |
| `src-tauri/src/commands/mod.rs` | Export ai_chat module |
| `components/layout/AppShell.tsx` | Add AIChatButton |

---

## 7. New Files to Create

| Path | Purpose |
|------|---------|
| `DB_AI/` (entire folder) | Python AI backend |
| `src-tauri/src/commands/ai_chat.rs` | Sidecar management commands |
| `lib/ai-chat.ts` | TypeScript API client |
| `components/ai-chat/AIChatButton.tsx` | Floating chat button |
| `components/ai-chat/AIChatDialog.tsx` | Chat interface |
| `components/ai-chat/TrainingFeedbackModal.tsx` | Error feedback UI |

---

## 8. Training Workflow for Failed Queries

1. User asks question → AI generates wrong SQL
2. User clicks "Help improve this query" button
3. Modal opens showing question + failed SQL
4. User enters correct SQL
5. Submit calls `/train` with question-SQL pair
6. Data added to ChromaDB vectorstore
7. Future similar questions use improved context

---

## 9. Detailed Code Examples

### 9.1 DB_AI/config.py

```python
from pathlib import Path
import os

# Base paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
VECTORDB_PATH = BASE_DIR / "vectordb"
TRAINING_DIR = BASE_DIR / "training"

# Database path (same as Tauri app)
if os.name == "nt":  # Windows
    APP_DATA = Path(os.environ.get("APPDATA", "")) / "com.inventry.tauri"
else:  # macOS/Linux
    APP_DATA = Path.home() / ".config" / "com.inventry.tauri"

DB_PATH = APP_DATA / "inventory.db"

# Model configuration
MODEL_NAME = "Qwen2.5-3B-Instruct-GGUF"
MODEL_FILE = "qwen2.5-3b-instruct-q4_k_m.gguf"
MODEL_PATH = MODELS_DIR / MODEL_FILE
MODEL_REPO = "Qwen/Qwen2.5-3B-Instruct-GGUF"

# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8765
```

### 9.2 DB_AI/core/llm_backend.py

```python
from llama_cpp import Llama
import logging

logger = logging.getLogger(__name__)

class LlamaCppLLM:
    """Custom LLM backend using llama-cpp-python for Qwen 2.5 3B"""

    def __init__(self, model_path: str, n_ctx: int = 4096, n_gpu_layers: int = -1):
        logger.info(f"Loading model from {model_path}")
        self.llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
            chat_format="chatml",  # Qwen uses ChatML format
        )
        logger.info("Model loaded successfully")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.1) -> str:
        response = self.llm.create_chat_completion(
            messages=[
                {"role": "system", "content": "You are a SQL expert. Generate only valid SQLite SQL queries."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            stop=["```", "\n\n"]
        )
        return response["choices"][0]["message"]["content"].strip()
```

### 9.3 DB_AI/core/vanna_setup.py

```python
from vanna.chromadb import ChromaDB_VectorStore
from core.llm_backend import LlamaCppLLM
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class MyVanna(ChromaDB_VectorStore):
    """Custom Vanna class using llama-cpp-python + ChromaDB"""

    def __init__(self, config=None):
        ChromaDB_VectorStore.__init__(self, config=config)
        self.llm = None

    def set_llm(self, llm: LlamaCppLLM):
        self.llm = llm

    def submit_prompt(self, prompt, **kwargs) -> str:
        if self.llm is None:
            raise RuntimeError("LLM not initialized")
        return self.llm.generate(prompt)

class VannaAI:
    """High-level Vanna AI wrapper for the inventory system"""

    def __init__(self, model_path: str, db_path: str, vectordb_path: str):
        self.model_path = Path(model_path)
        self.db_path = Path(db_path)
        self.vectordb_path = Path(vectordb_path)

        # Initialize ChromaDB vector store
        self.vn = MyVanna(config={"path": str(self.vectordb_path)})

        # Initialize LLM
        llm = LlamaCppLLM(
            model_path=str(self.model_path),
            n_ctx=4096,
            n_gpu_layers=-1  # Use Metal acceleration on Mac
        )
        self.vn.set_llm(llm)

        # Connect to SQLite database
        self.vn.connect_to_sqlite(str(self.db_path))

        logger.info("VannaAI initialized")

    def generate_sql(self, question: str) -> str:
        sql = self.vn.generate_sql(question)
        if sql.startswith("```"):
            lines = sql.split("\n")
            sql = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return sql.strip()

    def train(self, ddl: str = None, documentation: str = None,
              question: str = None, sql: str = None):
        if ddl:
            self.vn.train(ddl=ddl)
        elif documentation:
            self.vn.train(documentation=documentation)
        elif question and sql:
            self.vn.train(question=question, sql=sql)

    def is_trained(self) -> bool:
        try:
            data = self.vn.get_training_data()
            return len(data) > 0 if data is not None else False
        except:
            return False
```

### 9.4 DB_AI/core/sql_executor.py

```python
import sqlite3
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class SQLExecutor:
    """Safe SQL executor with read-only enforcement"""

    BLOCKED_KEYWORDS = [
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
        "TRUNCATE", "REPLACE", "GRANT", "REVOKE", "ATTACH", "DETACH"
    ]

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)

    def _is_safe_query(self, sql: str) -> bool:
        sql_upper = sql.upper().strip()
        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            return False
        for keyword in self.BLOCKED_KEYWORDS:
            if keyword in sql_upper:
                return False
        return True

    def execute(self, sql: str, limit: int = 100) -> list:
        if not self._is_safe_query(sql):
            raise ValueError("Only SELECT queries allowed")

        if "LIMIT" not in sql.upper():
            sql = f"{sql.rstrip(';')} LIMIT {limit}"

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row

        try:
            cursor = conn.execute(sql)
            columns = [description[0] for description in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return results
        finally:
            conn.close()
```

### 9.5 DB_AI/main.py

```python
import time
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from core.vanna_setup import VannaAI
from core.sql_executor import SQLExecutor
from config import DB_PATH, MODEL_PATH, VECTORDB_PATH

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

vanna_ai: VannaAI = None
sql_executor: SQLExecutor = None

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    sql: str
    results: list
    sql_extraction_time_ms: float
    execution_time_ms: float
    total_time_ms: float
    success: bool
    error: str | None = None

class TrainingRequest(BaseModel):
    training_type: str
    content: str
    question: str | None = None

class SetupStatus(BaseModel):
    model_downloaded: bool
    vectordb_initialized: bool
    training_data_loaded: bool
    ready: bool

@asynccontextmanager
async def lifespan(app: FastAPI):
    global vanna_ai, sql_executor
    logger.info("Starting AI Chat sidecar...")
    sql_executor = SQLExecutor(str(DB_PATH))

    if MODEL_PATH.exists():
        vanna_ai = VannaAI(
            model_path=str(MODEL_PATH),
            db_path=str(DB_PATH),
            vectordb_path=str(VECTORDB_PATH)
        )
    yield
    logger.info("Shutting down AI Chat sidecar...")

app = FastAPI(title="Inventory AI Chat", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "ready": vanna_ai is not None}

@app.get("/status", response_model=SetupStatus)
async def get_status():
    return SetupStatus(
        model_downloaded=MODEL_PATH.exists(),
        vectordb_initialized=VECTORDB_PATH.exists(),
        training_data_loaded=vanna_ai is not None and vanna_ai.is_trained(),
        ready=vanna_ai is not None
    )

@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    if vanna_ai is None:
        raise HTTPException(status_code=503, detail="AI not initialized")

    total_start = time.perf_counter()

    # SQL Generation
    sql_start = time.perf_counter()
    try:
        sql = vanna_ai.generate_sql(request.question)
    except Exception as e:
        return QueryResponse(
            sql="", results=[], sql_extraction_time_ms=0,
            execution_time_ms=0, total_time_ms=0, success=False,
            error=f"SQL generation failed: {str(e)}"
        )
    sql_time = (time.perf_counter() - sql_start) * 1000

    # SQL Execution
    exec_start = time.perf_counter()
    try:
        results = sql_executor.execute(sql)
    except Exception as e:
        return QueryResponse(
            sql=sql, results=[], sql_extraction_time_ms=sql_time,
            execution_time_ms=0, total_time_ms=(time.perf_counter() - total_start) * 1000,
            success=False, error=f"SQL execution failed: {str(e)}"
        )
    exec_time = (time.perf_counter() - exec_start) * 1000

    total_time = (time.perf_counter() - total_start) * 1000

    # Log timing
    logger.info(f"Extracted SQL: {sql}")
    logger.info(f"  [SQL Gen]: {sql_time/1000:.2f}s")
    logger.info(f"  [SQL Run]: {exec_time/1000:.2f}s")
    logger.info(f"  [Total]: {total_time/1000:.2f}s")

    return QueryResponse(
        sql=sql, results=results, sql_extraction_time_ms=sql_time,
        execution_time_ms=exec_time, total_time_ms=total_time, success=True
    )

@app.post("/train")
async def train(request: TrainingRequest):
    if vanna_ai is None:
        raise HTTPException(status_code=503, detail="AI not initialized")

    try:
        if request.training_type == "ddl":
            vanna_ai.train(ddl=request.content)
        elif request.training_type == "documentation":
            vanna_ai.train(documentation=request.content)
        elif request.training_type == "question_sql":
            vanna_ai.train(question=request.question, sql=request.content)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-model")
async def download_model():
    from scripts.download_model import download_qwen_model
    try:
        download_qwen_model()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
```

### 9.6 DB_AI/scripts/download_model.py (with progress tracking)

```python
#!/usr/bin/env python3
import os
import sys
import json
import requests
from pathlib import Path
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import MODEL_REPO, MODEL_FILE, MODELS_DIR

# Progress file for frontend to read
PROGRESS_FILE = MODELS_DIR / ".download_progress.json"

def update_progress(downloaded: int, total: int, status: str = "downloading"):
    """Update progress file for frontend to read"""
    progress = {
        "status": status,  # "downloading", "complete", "error", "cancelled"
        "downloaded_bytes": downloaded,
        "total_bytes": total,
        "downloaded_gb": round(downloaded / (1024**3), 2),
        "total_gb": round(total / (1024**3), 2),
        "percentage": round((downloaded / total) * 100, 1) if total > 0 else 0
    }
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f)

def download_qwen_model():
    """Download model with progress tracking"""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # HuggingFace direct download URL
    url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/{MODEL_FILE}"
    output_path = MODELS_DIR / MODEL_FILE

    print(f"Downloading {MODEL_FILE}...")

    # Get file size
    response = requests.head(url, allow_redirects=True)
    total_size = int(response.headers.get('content-length', 0))

    # Download with progress
    response = requests.get(url, stream=True)
    downloaded = 0

    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                update_progress(downloaded, total_size, "downloading")

    update_progress(total_size, total_size, "complete")
    print(f"Model downloaded to: {output_path}")
    return str(output_path)

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

if __name__ == "__main__":
    download_qwen_model()
```

### 9.7 DB_AI/training/training.py

```python
#!/usr/bin/env python3
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.vanna_setup import VannaAI
from config import DB_PATH, MODEL_PATH, VECTORDB_PATH, TRAINING_DIR

def load_training_data():
    training_data = {"ddl": [], "documentation": [], "question_sql": []}

    # Load DDL
    for ddl_file in (TRAINING_DIR / "ddl").glob("*.sql"):
        with open(ddl_file) as f:
            training_data["ddl"].append(f.read())

    # Load Documentation
    for doc_file in (TRAINING_DIR / "documentation").glob("*.md"):
        with open(doc_file) as f:
            training_data["documentation"].append(f.read())

    # Load Question-SQL pairs
    for qs_file in (TRAINING_DIR / "question_sql_pairs").glob("*.json"):
        with open(qs_file) as f:
            training_data["question_sql"].extend(json.load(f))

    return training_data

def train_vanna():
    print("Initializing VannaAI...")
    vanna = VannaAI(
        model_path=str(MODEL_PATH),
        db_path=str(DB_PATH),
        vectordb_path=str(VECTORDB_PATH)
    )

    data = load_training_data()

    print(f"Training with {len(data['ddl'])} DDL statements...")
    for ddl in data["ddl"]:
        vanna.train(ddl=ddl)

    print(f"Training with {len(data['documentation'])} documentation files...")
    for doc in data["documentation"]:
        vanna.train(documentation=doc)

    print(f"Training with {len(data['question_sql'])} question-SQL pairs...")
    for pair in data["question_sql"]:
        vanna.train(question=pair["question"], sql=pair["sql"])

    print("Training complete!")

if __name__ == "__main__":
    train_vanna()
```

---

## 10. React Components

### 10.1 lib/ai-chat.ts (with progress polling)

```typescript
import { invoke } from '@tauri-apps/api/core';

const AI_SERVER_URL = 'http://127.0.0.1:8765';

export interface QueryResponse {
  sql: string;
  results: Record<string, unknown>[];
  sql_extraction_time_ms: number;
  execution_time_ms: number;
  total_time_ms: number;
  success: boolean;
  error: string | null;
}

export interface SetupStatus {
  model_downloaded: boolean;
  vectordb_initialized: boolean;
  training_data_loaded: boolean;
  ready: boolean;
}

export interface DownloadProgress {
  status: 'downloading' | 'complete' | 'error' | 'cancelled';
  downloaded_bytes: number;
  total_bytes: number;
  downloaded_gb: number;
  total_gb: number;
  percentage: number;
}

export const aiChatApi = {
  startSidecar: async (): Promise<void> => {
    await invoke('start_ai_sidecar');
  },

  stopSidecar: async (): Promise<void> => {
    await invoke('stop_ai_sidecar');
  },

  checkSidecarStatus: async (): Promise<boolean> => {
    return await invoke('check_ai_sidecar_status');
  },

  getStatus: async (): Promise<SetupStatus> => {
    const response = await fetch(`${AI_SERVER_URL}/status`);
    return response.json();
  },

  query: async (question: string): Promise<QueryResponse> => {
    const response = await fetch(`${AI_SERVER_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    return response.json();
  },

  // Start model download (non-blocking)
  downloadModel: async (): Promise<void> => {
    await fetch(`${AI_SERVER_URL}/download-model`, { method: 'POST' });
  },

  // Poll download progress
  getDownloadProgress: async (): Promise<DownloadProgress | null> => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/download-progress`);
      if (response.ok) {
        return response.json();
      }
      return null;
    } catch {
      return null;
    }
  },

  // Cancel ongoing download
  cancelDownload: async (): Promise<void> => {
    await fetch(`${AI_SERVER_URL}/cancel-download`, { method: 'POST' });
  },

  train: async (type: string, content: string, question?: string): Promise<void> => {
    await fetch(`${AI_SERVER_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_type: type, content, question }),
    });
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};
```

### 10.2 components/ai-chat/AIChatButton.tsx

```tsx
'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIChatDialog } from './AIChatDialog';

export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      <AIChatDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
```

### 10.3 components/ai-chat/DownloadProgress.tsx (Progress UI with GB display)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, X, Loader2, CheckCircle } from 'lucide-react';
import { aiChatApi, type DownloadProgress as DownloadProgressType } from '@/lib/ai-chat';

interface DownloadProgressProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function DownloadProgress({ onComplete, onCancel }: DownloadProgressProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgressType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll progress while downloading
  useEffect(() => {
    if (!isDownloading) return;

    const interval = setInterval(async () => {
      const progressData = await aiChatApi.getDownloadProgress();
      if (progressData) {
        setProgress(progressData);

        if (progressData.status === 'complete') {
          setIsDownloading(false);
          onComplete();
        } else if (progressData.status === 'error') {
          setIsDownloading(false);
          setError('Download failed. Please try again.');
        } else if (progressData.status === 'cancelled') {
          setIsDownloading(false);
        }
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(interval);
  }, [isDownloading, onComplete]);

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await aiChatApi.downloadModel();
    } catch (err) {
      setError('Failed to start download');
      setIsDownloading(false);
    }
  };

  const handleCancel = async () => {
    await aiChatApi.cancelDownload();
    setIsDownloading(false);
    onCancel();
  };

  // Not started yet
  if (!isDownloading && !progress) {
    return (
      <div className="space-y-4 p-6 text-center">
        <Download className="h-12 w-12 mx-auto text-muted-foreground" />
        <div>
          <h3 className="font-semibold">AI Model Required</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download the AI model (~2 GB) to enable chat features.
          </p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={handleStartDownload} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Download AI Model
        </Button>
      </div>
    );
  }

  // Downloading
  if (isDownloading && progress) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="font-medium">Downloading AI Model...</span>
        </div>

        <Progress value={progress.percentage} className="h-3" />

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{progress.downloaded_gb} GB / {progress.total_gb} GB</span>
          <span>{progress.percentage}%</span>
        </div>

        <Button variant="outline" onClick={handleCancel} className="w-full">
          <X className="mr-2 h-4 w-4" />
          Cancel Download
        </Button>
      </div>
    );
  }

  // Complete
  if (progress?.status === 'complete') {
    return (
      <div className="space-y-4 p-6 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
        <div>
          <h3 className="font-semibold">Download Complete!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Initializing AI assistant...
          </p>
        </div>
        <Loader2 className="h-6 w-6 mx-auto animate-spin" />
      </div>
    );
  }

  return null;
}
```

---

## 11. Rust Sidecar Commands

### src-tauri/src/commands/ai_chat.rs

```rust
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use std::sync::Mutex;

pub struct AiSidecarState {
    pub process: Mutex<Option<CommandChild>>,
}

#[tauri::command]
pub async fn start_ai_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AiSidecarState>();
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if process_guard.is_some() {
        return Ok(());
    }

    let sidecar = app.shell()
        .sidecar("db-ai-server")
        .map_err(|e| e.to_string())?;

    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;
    *process_guard = Some(child);

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                log::info!("[AI] {}", String::from_utf8_lossy(&line));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_ai_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AiSidecarState>();
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(child) = process_guard.take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn check_ai_sidecar_status(app: tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<AiSidecarState>();
    let process_guard = state.process.lock().map_err(|e| e.to_string())?;
    Ok(process_guard.is_some())
}
```
