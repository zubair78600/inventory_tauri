"""
Custom Vanna-like interface using llama-cpp-python + ChromaDB directly.
This replaces the vanna package dependency which has a different API now.
"""
from llama_cpp import Llama
from pathlib import Path
import chromadb
import logging
import hashlib

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
        """Generate SQL from a prompt using the Qwen model"""
        logger.info(f"LLM prompt: {prompt}")
        response = self.llm.create_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": """You are a SQL expert for an inventory management SQLite database.
Generate ONLY valid SQLite SQL. Return ONLY the query, no markdown, no explanations.

DATABASE SCHEMA:

-- Products: id, name, sku, price, selling_price, stock_quantity, supplier_id, category
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, sku TEXT UNIQUE, price REAL, selling_price REAL, stock_quantity INTEGER, supplier_id INTEGER, category TEXT);

-- Suppliers: id, name, contact_info, email, address, state, district, town
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, contact_info TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT);

-- Customers: id, name, phone, email, address, state, district, town
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT);

-- Invoices (Sales): id, invoice_number, customer_id, total_amount, payment_method, status, created_at
CREATE TABLE invoices (id INTEGER PRIMARY KEY, invoice_number TEXT UNIQUE, customer_id INTEGER, total_amount REAL, payment_method TEXT, status TEXT, created_at TEXT);

-- Invoice Items: id, invoice_id, product_id, quantity, unit_price
CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER, product_id INTEGER, quantity INTEGER, unit_price REAL);

-- Purchase Orders: id, po_number, supplier_id, total_amount, status, order_date
CREATE TABLE purchase_orders (id INTEGER PRIMARY KEY, po_number TEXT UNIQUE, supplier_id INTEGER, total_amount REAL, status TEXT, order_date TEXT);

-- Purchase Order Items: id, po_id, product_id, quantity, unit_cost, total_cost
CREATE TABLE purchase_order_items (id INTEGER PRIMARY KEY, po_id INTEGER, product_id INTEGER, quantity INTEGER, unit_cost REAL, total_cost REAL);

Example queries:
Q: Show today's sales -> SELECT * FROM invoices WHERE DATE(created_at) = DATE('now')
Q: Low stock products -> SELECT name, stock_quantity FROM products WHERE stock_quantity < 10
Q: Products from each supplier -> SELECT s.name, p.name FROM suppliers s JOIN products p ON s.id = p.supplier_id

RULES:
1. Column 'name' is just 'name', NOT 'product_name' or 'customer_name'
2. Use DATE(created_at) = DATE('now') for today
3. Always start with SELECT"""
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )
        logger.info(f"LLM raw response: {response}")
        result = response["choices"][0]["message"]["content"].strip()
        # Clean up any remaining markdown
        if result.startswith("```sql"):
            result = result[6:]
        if result.startswith("```"):
            result = result[3:]
        if result.endswith("```"):
            result = result[:-3]
        return result.strip()


class SimpleVectorStore:
    """Simple vector store using ChromaDB for training data"""

    def __init__(self, persist_path: str):
        self.client = chromadb.PersistentClient(path=persist_path)
        self.collection = self.client.get_or_create_collection(
            name="training_data",
            metadata={"hnsw:space": "cosine"}
        )

    def add_training_data(self, data_type: str, content: str, question: str = None):
        """Add training data to the vector store"""
        doc_id = hashlib.md5(content.encode()).hexdigest()
        metadata = {"type": data_type}
        if question:
            metadata["question"] = question
        
        try:
            self.collection.add(
                documents=[content],
                metadatas=[metadata],
                ids=[doc_id]
            )
        except Exception as e:
            logger.warning(f"Could not add training data (may already exist): {e}")

    def get_relevant_context(self, question: str, n_results: int = 5) -> str:
        """Get relevant training data for a question"""
        try:
            results = self.collection.query(
                query_texts=[question],
                n_results=n_results
            )
            if results and results["documents"]:
                return "\n\n---\n\n".join(results["documents"][0])
            return ""
        except Exception as e:
            logger.error(f"Error getting context: {e}")
            return ""

    def get_training_count(self) -> int:
        """Get count of training data"""
        return self.collection.count()


class VannaAI:
    """High-level wrapper combining LLM + VectorStore for SQL generation"""

    def __init__(self, model_path: str, db_path: str, vectordb_path: str):
        self.model_path = Path(model_path)
        self.db_path = Path(db_path)
        self.vectordb_path = Path(vectordb_path)

        # Initialize vector store
        self.vector_store = SimpleVectorStore(str(self.vectordb_path))

        # Initialize LLM
        self.llm = LlamaCppLLM(
            model_path=str(self.model_path),
            n_ctx=4096,
            n_gpu_layers=-1  # Use Metal acceleration on Mac
        )

        logger.info("VannaAI initialized")

    def generate_sql(self, question: str) -> str:
        """Generate SQL from a natural language question"""
        # The system prompt already contains the full DDL schema
        # Just pass the question directly
        logger.info(f"Generating SQL for question: {question}")
        sql = self.llm.generate(question)
        logger.info(f"Raw LLM output: {repr(sql)}")
        
        # Clean up any markdown or extra formatting
        if sql.startswith("```"):
            lines = sql.split("\n")
            sql = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        
        result = sql.strip()
        logger.info(f"Cleaned SQL: {repr(result)}")
        return result

    def train(self, ddl: str = None, documentation: str = None,
              question: str = None, sql: str = None):
        """Train the model with various types of data"""
        if ddl:
            self.vector_store.add_training_data("ddl", ddl)
        elif documentation:
            self.vector_store.add_training_data("documentation", documentation)
        elif question and sql:
            content = f"Question: {question}\nSQL: {sql}"
            self.vector_store.add_training_data("question_sql", content, question)

    def is_trained(self) -> bool:
        """Check if the model has been trained with any data"""
        return self.vector_store.get_training_count() > 0
