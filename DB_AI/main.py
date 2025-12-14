import time
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import Optional

from core.vanna_setup import VannaAI
from core.sql_executor import SQLExecutor
from config import DB_PATH, MODEL_PATH, VECTORDB_PATH

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

vanna_ai: Optional[VannaAI] = None
sql_executor: Optional[SQLExecutor] = None


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    sql: str
    results: list
    sql_extraction_time_ms: float
    execution_time_ms: float
    total_time_ms: float
    success: bool
    error: Optional[str] = None


class TrainingRequest(BaseModel):
    training_type: str  # "ddl", "documentation", or "question_sql"
    content: str
    question: Optional[str] = None


class SetupStatus(BaseModel):
    model_downloaded: bool
    vectordb_initialized: bool
    training_data_loaded: bool
    ready: bool


class DownloadProgress(BaseModel):
    status: str  # "downloading", "complete", "error", "cancelled"
    downloaded_bytes: int
    total_bytes: int
    downloaded_gb: float
    total_gb: float
    percentage: float
    speed_mbps: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    global vanna_ai, sql_executor
    logger.info("Starting AI Chat sidecar...")
    
    # Initialize SQL executor (always available for read-only queries)
    sql_executor = SQLExecutor(str(DB_PATH))
    
    # Initialize VannaAI only if model is downloaded and valid
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        try:
            vanna_ai = VannaAI(
                model_path=str(MODEL_PATH),
                db_path=str(DB_PATH),
                vectordb_path=str(VECTORDB_PATH)
            )
            logger.info("VannaAI initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize VannaAI: {e}")
            vanna_ai = None
    else:
        logger.warning(f"Model not found at {MODEL_PATH}")
    
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
    """Health check endpoint"""
    return {"status": "healthy", "ready": vanna_ai is not None}


@app.get("/status", response_model=SetupStatus)
async def get_status():
    """Get the current setup status"""
    # Check model exists AND has content (not empty/corrupt)
    model_downloaded = MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 1000000  # > 1MB
    return SetupStatus(
        model_downloaded=model_downloaded,
        vectordb_initialized=VECTORDB_PATH.exists(),
        training_data_loaded=vanna_ai is not None and vanna_ai.is_trained(),
        ready=vanna_ai is not None
    )


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Process a natural language query and return SQL results"""
    if vanna_ai is None:
        raise HTTPException(status_code=503, detail="AI not initialized. Please download the model first.")

    total_start = time.perf_counter()

    # SQL Generation
    sql_start = time.perf_counter()
    try:
        sql = vanna_ai.generate_sql(request.question)
    except Exception as e:
        logger.error(f"SQL generation failed: {e}")
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
        logger.error(f"SQL execution failed: {e}")
        return QueryResponse(
            sql=sql, results=[], sql_extraction_time_ms=sql_time,
            execution_time_ms=0, total_time_ms=(time.perf_counter() - total_start) * 1000,
            success=False, error=f"SQL execution failed: {str(e)}"
        )
    exec_time = (time.perf_counter() - exec_start) * 1000

    total_time = (time.perf_counter() - total_start) * 1000

    # Log timing information
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
    """Add training data to improve SQL generation"""
    if vanna_ai is None:
        raise HTTPException(status_code=503, detail="AI not initialized")

    try:
        if request.training_type == "ddl":
            vanna_ai.train(ddl=request.content)
        elif request.training_type == "documentation":
            vanna_ai.train(documentation=request.content)
        elif request.training_type == "question_sql":
            if not request.question:
                raise HTTPException(status_code=400, detail="Question required for question_sql training")
            vanna_ai.train(question=request.question, sql=request.content)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown training type: {request.training_type}")
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download-model")
async def download_model():
    """Trigger model download (runs in a separate thread to not block API)"""
    import threading
    try:
        from scripts.download_model import download_qwen_model

        # Run in a separate thread to ensure API returns immediately
        # BackgroundTasks runs synchronously with single uvicorn worker
        thread = threading.Thread(target=download_qwen_model, daemon=True)
        thread.start()

        return {"success": True}
    except Exception as e:
        logger.error(f"Model download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download-progress", response_model=Optional[DownloadProgress])
async def get_download_progress():
    """Get the current download progress"""
    try:
        from scripts.download_model import get_download_progress
        progress = get_download_progress()
        if progress:
            return DownloadProgress(**progress)
        return None
    except Exception as e:
        logger.error(f"Failed to get download progress: {e}")
        return None


@app.post("/cancel-download")
async def cancel_download():
    """Cancel ongoing model download"""
    try:
        from scripts.download_model import cancel_download
        cancel_download()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to cancel download: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
