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

    def generate(self, prompt: str, context: str = "", max_tokens: int = 512, temperature: float = 0.1) -> str:
        """Generate SQL from a prompt using the Qwen model"""
        
        # Build system prompt with emphasis on SQLite
        system_content = """You are a SQL expert for an inventory management SQLite database.
Generate ONLY valid SQLite SQL. Return ONLY the query, no markdown, no explanations.

CRITICAL: This is SQLite, NOT MySQL! Use SQLite date functions:
- For current month: strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
- For today: DATE(created_at) = DATE('now')  
- For this week: created_at >= DATE('now', '-7 days')
- NEVER use MONTH(), YEAR(), CURDATE() - these are MySQL functions!

For name searches, ALWAYS use case-insensitive LIKE:
- WHERE LOWER(name) LIKE LOWER('%search_term%')

DATABASE SCHEMA:

-- Products: id, name, sku, price, selling_price, stock_quantity, supplier_id, category
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, sku TEXT UNIQUE, price REAL, selling_price REAL, stock_quantity INTEGER, supplier_id INTEGER, category TEXT);

-- Suppliers: id, name, contact_info, email, address, state, district, town
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, contact_info TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT);

-- Customers: id, name, phone, email, address, state, district, town, created_at
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

-- Invoices (Sales): id, invoice_number, customer_id, total_amount, payment_method, status, created_at
CREATE TABLE invoices (id INTEGER PRIMARY KEY, invoice_number TEXT UNIQUE, customer_id INTEGER, total_amount REAL, payment_method TEXT, status TEXT, created_at TEXT);

-- Invoice Items: id, invoice_id, product_id, quantity, unit_price
CREATE TABLE invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER, product_id INTEGER, quantity INTEGER, unit_price REAL);

-- Purchase Orders: id, po_number, supplier_id, total_amount, status, order_date
CREATE TABLE purchase_orders (id INTEGER PRIMARY KEY, po_number TEXT UNIQUE, supplier_id INTEGER, total_amount REAL, status TEXT, order_date TEXT);

-- Purchase Order Items: id, po_id, product_id, quantity, unit_cost, total_cost
CREATE TABLE purchase_order_items (id INTEGER PRIMARY KEY, po_id INTEGER, product_id INTEGER, quantity INTEGER, unit_cost REAL, total_cost REAL);

MANDATORY QUERY TEMPLATES (USE THESE EXACTLY):
When user asks for customer by name, customer info, customer details, or customer name:
SELECT c.*, COUNT(DISTINCT i.id) as total_invoices, COALESCE(SUM(i.total_amount), 0) as total_spent, MAX(i.created_at) as last_billed FROM customers c LEFT JOIN invoices i ON c.id = i.customer_id WHERE LOWER(c.name) LIKE LOWER('%CUSTOMERNAME%') GROUP BY c.id

RULES:
1. Column 'name' is just 'name', NOT 'product_name' or 'customer_name'
2. Use strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') for THIS MONTH
3. Use DATE(created_at) = DATE('now') for TODAY
4. Always start with SELECT
5. For customer/supplier searches by name, use LOWER() for case-insensitive matching"""

        if context:
            system_content += f"\n\nRELEVANT EXAMPLES:\n{context}"

        logger.info(f"DEBUG: System Prompt:\n{system_content}")
        logger.info(f"LLM prompt: {prompt}")
        response = self.llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system_content},
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
            # Filter to only get Q+SQL pairs, not documentation
            results = self.collection.query(
                query_texts=[question],
                n_results=n_results,
                where={"type": "question_sql"}
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

    def get_date_filter(self, question: str, column: str) -> str:
        """Extract date filter from question and return SQL condition"""
        import re
        from datetime import datetime
        q = question.lower()
        
        # 1. Explicit Date Ranges ("From X to Y")
        # Matches: from 12-11-2025 to 15-12-2025, from 12th nov to 15th dec, etc.
        range_match = re.search(r'from\s+(.+?)\s+to\s+(.+)', q)
        if range_match:
            start_str = range_match.group(1).strip()
            end_str = range_match.group(2).strip()
            
            def parse_date_str(date_str):
                # Try common formats
                formats = [
                    '%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d',
                    '%d %B', '%dth %B', '%dst %B', '%dnd %B', '%drd %B',  # 12th November
                    '%d %b', '%dth %b', '%dst %b', '%dnd %b', '%drd %b',  # 12th Nov
                    '%B %d', '%b %d' # November 12
                ]
                
                # Clean up "th", "st", "nd", "rd" if followed by space (e.g. 12th november)
                # But be careful not to break "12-11"
                clean_str = re.sub(r'(\d+)(st|nd|rd|th)\s+', r'\1 ', date_str) 
                
                for fmt in formats:
                    try:
                        dt = datetime.strptime(clean_str, fmt)
                        # If year is missing (1900), set to current year
                        if dt.year == 1900:
                            dt = dt.replace(year=datetime.now().year)
                        return dt.strftime('%Y-%m-%d')
                    except ValueError:
                        continue
                        
                # Try adding year if missing for formats like "12th November"
                try:
                    clean_str_with_year = f"{clean_str} {datetime.now().year}"
                    for fmt in [f"{f} %Y" for f in formats]:
                         try:
                            dt = datetime.strptime(clean_str_with_year, fmt)
                            return dt.strftime('%Y-%m-%d')
                         except ValueError:
                            continue
                except:
                    pass
                return None

            start_date = parse_date_str(start_str)
            end_date = parse_date_str(end_str)
            
            if start_date and end_date:
                return f"DATE({column}) BETWEEN DATE('{start_date}') AND DATE('{end_date}')"

        # 2. Week Numbers ("Week 45")
        week_match = re.search(r'week\s+(\d+)', q)
        if week_match:
             week_num = week_match.group(1)
             # SQLite %W is 00-53. Ensure 2 digits.
             return f"strftime('%W', {column}) = '{int(week_num):02d}'"

        # 3. Relative Ranges ("Last X months", "Past X years")
        # "From 1 year" -> Treated as "Last 1 year"
        relative_match = re.search(r'(?:last|past|from)\s+(\d+)\s+(year|month|week|day)s?', q)
        if relative_match:
            amount = relative_match.group(1)
            unit = relative_match.group(2) # year, month, week, day
            if unit == 'week': unit = 'day'; amount = str(int(amount) * 7) # SQLite doesn't strictly support '-X weeks' in all versions, days is safer
            
            return f"DATE({column}) >= DATE('now', '-{amount} {unit}s')"

        # 4. Specific Months ("November", "Nov")
        # Map month names to numbers
        months = {
            'january': '01', 'jan': '01',
            'february': '02', 'feb': '02',
            'march': '03', 'mar': '03',
            'april': '04', 'apr': '04',
            'may': '05',
            'june': '06', 'jun': '06',
            'july': '07', 'jul': '07',
            'august': '08', 'aug': '08',
            'september': '09', 'sep': '09',
            'october': '10', 'oct': '10',
            'november': '11', 'nov': '11',
            'december': '12', 'dec': '12'
        }
        for month_name, month_num in months.items():
            # Check for word boundary logic manually or simple strict match
            # "november" in q might match "november rain" but reasonably implies date filter here
            if f" {month_name} " in f" {q} ": # simplistic word boundary
                # Verify it's not part of "last november" which implies range? 
                # Actually "last november" usually means "the previous november", but simplistic "month = 11" 
                # gets ALL novembers. User asked for "November month".
                return f"strftime('%m', {column}) = '{month_num}'"

        # 5. Shortcuts (Today, Yesterday, etc) - Keep existing logic
        if 'today' in q:
            return f"DATE({column}) = DATE('now')"
        if 'yesterday' in q:
            return f"DATE({column}) = DATE('now', '-1 day')"
        if 'this week' in q:
            return f"strftime('%Y-%W', {column}) = strftime('%Y-%W', 'now')"
        if 'last week' in q: # This is "previous week", distinct from "last 7 days" regex above
            return f"strftime('%Y-%W', {column}) = strftime('%Y-%W', 'now', '-7 days')"
        if 'this month' in q:
            return f"strftime('%Y-%m', {column}) = strftime('%Y-%m', 'now')"
        if 'last month' in q: # Previous calendar month
            return f"strftime('%Y-%m', {column}) = strftime('%Y-%m', 'now', '-1 month')"
        if 'this year' in q:
            return f"strftime('%Y', {column}) = strftime('%Y', 'now')"
        if 'last year' in q:
            return f"strftime('%Y', {column}) = strftime('%Y', 'now', '-1 year')"
            
        return ""

    def generate_sql(self, question: str) -> str:
        """Generate SQL from a natural language question"""
        logger.info(f"DEBUG: generate_sql called with question: {question}")
        logger.info(f"DEBUG: vector_store type: {type(self.vector_store)}")
        logger.info(f"Generating SQL for question: {question}")
        
        question_lower = question.lower()
        import re
        
        # Extract potential identifiers from question
        phone_match = re.search(r'(\d{7,12})', question)
        email_match = re.search(r'[\w\.-]+@[\w\.-]+', question)
        
        # =================
        # CUSTOMER QUERIES
        # =================
        
        # Customer credit queries (specific request for credit info)
        if 'customer credit' in question_lower or 'credit for customer' in question_lower:
            # Check for phone in credit query
            if phone_match:
                phone = phone_match.group(1)
                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as total_invoices, 
                    COALESCE(SUM(i.total_amount), 0) as total_spent, 
                    MAX(i.created_at) as last_billed,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE c.phone LIKE '%{phone}%' 
                    GROUP BY c.id"""
                logger.info(f"Detected customer credit phone query, using hardcoded SQL: {sql}")
                return sql
            
            # Check for email in credit query
            if email_match:
                email = email_match.group(0)
                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as total_invoices, 
                    COALESCE(SUM(i.total_amount), 0) as total_spent, 
                    MAX(i.created_at) as last_billed,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE c.email LIKE '%{email}%' 
                    GROUP BY c.id"""
                logger.info(f"Detected customer credit email query, using hardcoded SQL: {sql}")
                return sql
            
            # Default to name search
            name_match = re.search(r'(?:customer credit|credit for customer)\s+(\w+)', question_lower)
            customer_name = name_match.group(1).strip() if name_match else question.split()[-1]
            
            sql = f"""SELECT c.*, 
                COUNT(DISTINCT i.id) as total_invoices, 
                COALESCE(SUM(i.total_amount), 0) as total_spent, 
                MAX(i.created_at) as last_billed,
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                FROM customers c 
                LEFT JOIN invoices i ON c.id = i.customer_id 
                WHERE LOWER(c.name) LIKE LOWER('%{customer_name}%') 
                GROUP BY c.id"""
            logger.info(f"Detected customer credit query, using hardcoded SQL: {sql}")
            return sql
        
        # Customer queries (name, details, info, or just "customer X")
        # Also handle "name X" if not referring to product/supplier
        if (question_lower.startswith('customer ') or question_lower.startswith('customers ') or 
            (question_lower.startswith('name ') and 'product' not in question_lower and 'supplier' not in question_lower) or 
            any(keyword in question_lower for keyword in ['customer name', 'customer details', 'customer info', 'who is customer'])):
            # Check for phone number in query
            if phone_match:
                phone = phone_match.group(1)
                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as total_invoices, 
                    COALESCE(SUM(i.total_amount), 0) as total_spent, 
                    MAX(i.created_at) as last_billed,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE c.phone LIKE '%{phone}%' 
                    GROUP BY c.id"""
                logger.info(f"Detected customer phone query, using hardcoded SQL: {sql}")
                return sql
            
            # Check for email in query
            if email_match:
                email = email_match.group(0)
                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as total_invoices, 
                    COALESCE(SUM(i.total_amount), 0) as total_spent, 
                    MAX(i.created_at) as last_billed,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE c.email LIKE '%{email}%' 
                    GROUP BY c.id"""
                logger.info(f"Detected customer email query, using hardcoded SQL: {sql}")
                return sql
            
            # Default to name search
            # Capture full name after keywords (allow spaces)
            name_match = re.search(r'(?:customer name|customer details for|customer info for|who is customer|customers|customer|name)\s+(.+)', question_lower)
            customer_name = name_match.group(1).strip() if name_match else question.split()[-1]
            
            # Handle "customer list" or "customer all" explicitly
            if customer_name.lower() in ['list', 'all', 'data', 'details', 'detail', 'info']:
                base_sql = "SELECT c.id, c.name, c.phone, c.email, c.address, c.place, COUNT(DISTINCT i.id) as total_invoices, COALESCE(SUM(i.total_amount), 0) as total_spent, MAX(i.created_at) as last_billed FROM customers c LEFT JOIN invoices i ON c.id = i.customer_id"
                
                # Apply date filter if present
                date_filter = self.get_date_filter(question, 'c.created_at')
                if date_filter:
                    base_sql += f" WHERE {date_filter}"
                
                sql = base_sql + " GROUP BY c.id"
                logger.info(f"Detected customer list query (filtered: {bool(date_filter)}), using hardcoded SQL: {sql}")
                return sql
            
            sql = f"""SELECT c.*, 
                COUNT(DISTINCT i.id) as total_invoices, 
                COALESCE(SUM(i.total_amount), 0) as total_spent, 
                MAX(i.created_at) as last_billed,
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                FROM customers c 
                LEFT JOIN invoices i ON c.id = i.customer_id 
                WHERE LOWER(c.name) LIKE LOWER('%{customer_name}%') 
                GROUP BY c.id"""
            logger.info(f"Detected customer name query, using hardcoded SQL: {sql}")
            return sql
        
        # =================
        # REVENUE QUERIES
        # =================
        if 'revenue' in question_lower or 'sales' in question_lower or 'income' in question_lower:
            # Only intercept if it looks like a general revenue query, not per-customer (which might be handled above or by LLM)
            # The customer block above handles "customer" keyword. If we are here, it's likely general revenue.
            
            date_filter = self.get_date_filter(question, 'created_at')
            if date_filter:
                sql = f"SELECT SUM(total_amount) as total_revenue FROM invoices WHERE {date_filter}"
                logger.info(f"Detected date-filtered revenue query, using hardcoded SQL: {sql}")
                return sql
            
            # If specifically asking for "total revenue" or "total sales" without date, usually means all time
            if 'total' in question_lower:
                sql = "SELECT SUM(total_amount) as total_revenue FROM invoices"
                logger.info(f"Detected total revenue query, using hardcoded SQL: {sql}")
                return sql
        
        # =================
        # SUPPLIER QUERIES
        # =================
        
        # Supplier queries (name, details, info, or just "supplier X")
        if question_lower.startswith('supplier ') or any(keyword in question_lower for keyword in ['supplier name', 'supplier details', 'supplier info', 'who is supplier']):
            # Check for phone number in query
            if phone_match:
                phone = phone_match.group(1)
                sql = f"""SELECT s.*, 
                    COUNT(DISTINCT p.id) as total_products, 
                    COALESCE(SUM(p.stock_quantity), 0) as total_stock, 
                    COALESCE(SUM(p.stock_quantity * p.price), 0) as stock_value,
                    COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.supplier_id = s.id) - 
                             COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0), 0) as pending_amount
                    FROM suppliers s 
                    LEFT JOIN products p ON s.id = p.supplier_id 
                    WHERE s.contact_info LIKE '%{phone}%' 
                    GROUP BY s.id"""
                logger.info(f"Detected supplier phone query, using hardcoded SQL: {sql}")
                return sql
            
            # Check for email in query
            if email_match:
                email = email_match.group(0)
                sql = f"""SELECT s.*, 
                    COUNT(DISTINCT p.id) as total_products, 
                    COALESCE(SUM(p.stock_quantity), 0) as total_stock, 
                    COALESCE(SUM(p.stock_quantity * p.price), 0) as stock_value,
                    COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.supplier_id = s.id) - 
                             COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0), 0) as pending_amount
                    FROM suppliers s 
                    LEFT JOIN products p ON s.id = p.supplier_id 
                    WHERE s.email LIKE '%{email}%' 
                    GROUP BY s.id"""
                logger.info(f"Detected supplier email query, using hardcoded SQL: {sql}")
                return sql
            
            # Default to name search
            name_match = re.search(r'(?:supplier name|supplier details for|supplier info for|who is supplier|supplier)\s+(\w+)', question_lower)
            supplier_name = name_match.group(1).strip() if name_match else question.split()[-1]
            
            sql = f"""SELECT s.*, 
                COUNT(DISTINCT p.id) as total_products, 
                COALESCE(SUM(p.stock_quantity), 0) as total_stock, 
                COALESCE(SUM(p.stock_quantity * p.price), 0) as stock_value,
                COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.supplier_id = s.id) - 
                         COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0), 0) as pending_amount
                FROM suppliers s 
                LEFT JOIN products p ON s.id = p.supplier_id 
                WHERE LOWER(s.name) LIKE LOWER('%{supplier_name}%') 
                GROUP BY s.id"""
            logger.info(f"Detected supplier name query, using hardcoded SQL: {sql}")
            return sql
        
        # Get relevant training examples from vector store
        context = self.vector_store.get_relevant_context(question, n_results=2)
        if context:
            logger.info(f"Retrieved context: {context[:200]}...")
        else:
            logger.warning("No context found for question!")
        
        # Generate SQL with context
        sql = self.llm.generate(question, context=context)
        logger.info(f"Raw LLM output: {repr(sql)}")
        
        sql = sql.strip()
        
        # Clean up any markdown or extra formatting
        if "```" in sql:
            lines = sql.split("\n")
            new_lines = []
            in_code_block = False
            for line in lines:
                if "```" in line:
                    in_code_block = not in_code_block
                    continue
                if in_code_block:
                    new_lines.append(line)
            
            if new_lines:
                sql = "\n".join(new_lines)
            else:
                # If we failed to extract code block content, try a simpler fallback
                # This handles cases where the logic above might fail or there's no matching closing backtick
                parts = sql.split("```")
                if len(parts) > 1:
                    sql = parts[1]
                    if sql.lower().startswith("sql"):
                        sql = sql[3:]
                    sql = sql.strip()
        
        # Remove "SQL:" prefix if present
        if sql.lower().startswith("sql:"):
            sql = sql[4:].strip()
        
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
