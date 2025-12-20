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

CRITICAL: This is SQLite, NOT MySQL! Use SQLite date functions with IST (+5:30) conversion:
- IST Current Time: datetime('now', '+5 hours', '30 minutes')
- IST Date: date('now', '+5 hours', '30 minutes')
- For formatted Last Billed: datetime(i.created_at, '+5 hours', '30 minutes')
- For Days Ago: CAST(julianday('now') - julianday(i.created_at) AS INTEGER)

Date Logic:
- For current/this month: strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '+5 hours', '30 minutes')
- For today: date(created_at) = date('now', '+5 hours', '30 minutes')
- For this week: created_at >= date('now', 'weekday 0', '-7 days', '+5 hours', '30 minutes')
- NEVER use MONTH(), YEAR(), CURDATE()!

For name searches, ALWAYS use case-insensitive LIKE:
- WHERE LOWER(name) LIKE LOWER('%search_term%')

MANDATORY DATA FORMAT (COLUMNS):
When user asks for customer data/extraction/list/info:
1. NAME (c.name)
2. CONTACT INFO (c.phone)
3. ADDRESS (c.address)
4. EMAIL (c.email)
5. INVOICE DATE (date(i.created_at, '+5 hours', '30 minutes'))
6. LAST BILLED (datetime(i.created_at, '+5 hours', '30 minutes'))
7. PRODUCTS BOUGHT (COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0))
8. TOTAL SPENT (SUM(i.total_amount))
9. TOTAL INVOICES (COUNT(i.id))

Always ORDER BY "TOTAL SPENT" DESC.

Date Logic:
- For Week X: strftime('%W', created_at) = 'X' (e.g. Week 50 is strftime('%W', created_at) = '50')
- For Day X: strftime('%w', created_at) = 'N' (0=Sun, 3=Wed)
- For Month: strftime('%m', created_at) = 'MM'
- For Year: strftime('%Y', created_at) = 'YYYY'
- For IST: Use datetime(created_at, '+5 hours', '30 minutes')

DATABASE SCHEMA:
-- Products: id, name, sku, price, selling_price, stock_quantity, supplier_id, category
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, sku TEXT UNIQUE, price REAL, selling_price REAL, stock_quantity INTEGER, supplier_id INTEGER, category TEXT);
-- Suppliers: id, name, contact_info, email, address, state, district, town
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, contact_info TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT);
-- Customers: id, name, phone, email, address, state, district, town, created_at
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, email TEXT, address TEXT, state TEXT, district TEXT, town TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
-- Invoices (Sales): id, invoice_number, customer_id, total_amount, payment_method, status, created_at
CREATE TABLE invoices (id INTEGER PRIMARY KEY, invoice_number TEXT UNIQUE, customer_id INTEGER, total_amount REAL, payment_method TEXT, status TEXT, created_at TEXT);

MANDATORY QUERY TEMPLATE (FOLLOW THIS EXACTLY):
SELECT c.name AS "NAME", c.phone AS "CONTACT INFO", c.address AS "ADDRESS", c.email AS "EMAIL", date(MAX(i.created_at), '+5 hours', '30 minutes') AS "INVOICE DATE", datetime(MAX(i.created_at), '+5 hours', '30 minutes') AS "LAST BILLED", COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) AS "PRODUCTS BOUGHT", SUM(i.total_amount) AS "TOTAL SPENT", COUNT(i.id) AS "TOTAL INVOICES" FROM customers c JOIN invoices i ON c.id = i.customer_id WHERE [DATE_CONDITION] GROUP BY c.id ORDER BY "TOTAL SPENT" DESC

RULES:
1. Always use date(..., '+5 hours', '30 minutes') for "INVOICE DATE"
2. Always use datetime(..., '+5 hours', '30 minutes') for "LAST BILLED"
3. Always include "PRODUCTS BOUGHT" column using the subquery approach shown above
4. Always ORDER BY "TOTAL SPENT" DESC
5. Always use JOIN invoices i ON c.id = i.customer_id
7. [DATE_CONDITION] must use IST conversion for 'now' (e.g. date('now', '+5 hours', '30 minutes'))
8. DATE SEMANTICS:
   - "Last month" / "Last week": Exactly the previous full period (e.g. strftime('%Y-%m', ...) = strftime('%Y-%m', 'now', ..., '-1 month'))
   - "2 months" / "2 weeks": Range including current and X-1 previous periods (e.g. i.created_at >= date('now', 'start of month', '-1 month', ...))
   - "2 complete months" / "2 complete weeks": Range of X previous periods, EXCLUDING the current one (e.g. i.created_at < start_of_current AND i.created_at >= start_of_X_back)
"""

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

        # 2.5 Specific Weekdays ("Wednesday", "Mon", etc) - MUST come before relative ranges
        # because "wednesday" contains "day" which matches the relative regex
        days = {
            'sunday': '0', 'sun': '0',
            'monday': '1', 'mon': '1',
            'tuesday': '2', 'tue': '2',
            'wednesday': '3', 'wed': '3',
            'thursday': '4', 'thu': '4',
            'friday': '5', 'fri': '5',
            'saturday': '6', 'sat': '6'
        }
        for day_name, day_num in days.items():
            if f" {day_name} " in f" {q} ":
                return f"strftime('%w', {column}) = '{day_num}'"

        # 3. Relative Ranges ("Last X months", "Past X years", "Last month", "2 months")
        is_complete = "complete" in q
        # Matches: "last 2 months", "in the past 3 weeks", "2 months", "this year", etc.
        # Ensure we only match if there is a number OR a date unit, and not just the prefix.
        relative_match = re.search(r'(?:last|past|in the last|in the past|this|next)?\s*(\d+)?\s*(year|month|week|day)s?', q)
        if relative_match and not (relative_match.group(1) or relative_match.group(2)):
            relative_match = None
        if relative_match:
            amount_str = relative_match.group(1)
            unit = relative_match.group(2)
            
            # Case 1: "this month", "current month", "month" (singular, no prefix) - return CURRENT month
            # Case 2: "last month" or "last week" - exactly the previous period
            # Case 3: "this week" - current week
            
            # Check for "this", "current" prefix -> current period
            is_current = bool(re.search(r'\b(this|current)\b', q))
            is_last = bool(re.search(r'\b(last|past|previous)\b', q))
            
            if not amount_str and (unit == 'month' or unit == 'week'):
                if unit == 'month':
                    if is_last:
                        return f"strftime('%Y-%m', {column}) = strftime('%Y-%m', 'now', '+5 hours', '30 minutes', '-1 month')"
                    else:
                        # "this month", "current month", or just "month" -> current month
                        return f"strftime('%Y-%m', {column}) = strftime('%Y-%m', 'now', '+5 hours', '30 minutes')"
                else: # week
                    if is_last:
                        return f"DATE({column}) >= date('now', '+5 hours', '30 minutes', 'weekday 0', '-14 days') AND DATE({column}) < date('now', '+5 hours', '30 minutes', 'weekday 0', '-7 days')"
                    else:
                        # "this week" or just "week" -> current week
                        return f"DATE({column}) >= date('now', '+5 hours', '30 minutes', 'weekday 0', '-7 days')"

            amount = int(amount_str or "1")
            
            if is_complete:
                # X complete periods - exclude current period
                # If "2 complete months", means previous 2 full months
                if unit == 'month':
                    return f"DATE({column}) >= date('now', 'start of month', '-{amount} months', '+5 hours', '30 minutes') AND DATE({column}) < date('now', 'start of month', '+5 hours', '30 minutes')"
                elif unit == 'week':
                    return f"DATE({column}) >= date('now', '+5 hours', '30 minutes', 'weekday 0', '-{7 * (amount + 1)} days') AND DATE({column}) < date('now', '+5 hours', '30 minutes', 'weekday 0', '-7 days')"
                else:
                    return f"DATE({column}) >= DATE('now', '-{amount + 1} {unit}s', '+5 hours', '30 minutes') AND DATE({column}) < DATE('now', '-1 {unit}s', '+5 hours', '30 minutes')"
            else:
                # X periods - include current period
                # 2 weeks means (last week + current week)
                if unit == 'month':
                    return f"DATE({column}) >= date('now', 'start of month', '-{amount - 1} months', '+5 hours', '30 minutes')"
                elif unit == 'week':
                    return f"DATE({column}) >= date('now', '+5 hours', '30 minutes', 'weekday 0', '-{amount * 7} days')"
                else:
                    return f"DATE({column}) >= DATE('now', '-{amount} {unit}s', '+5 hours', '30 minutes')"

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
            # Check for word boundary - handles both middle of string and end of string
            # Works for: "customer december", "invoice november 2024", "december sales"
            q_padded = f" {q} "  # Pad with spaces for consistent word boundary matching
            if f" {month_name} " in q_padded or q.endswith(month_name) or q.startswith(f"{month_name} "):
                return f"strftime('%m', {column}) = '{month_num}'"

        # 5. Specific Years ("2025")
        year_match = re.search(r'\b(20\d{2})\b', q)
        if year_match:
            return f"strftime('%Y', {column}) = '{year_match.group(1)}'"

        # 6. Specific Days ("Wednesday", "Mon", etc)
        days = {
            'sunday': '0', 'sun': '0',
            'monday': '1', 'mon': '1',
            'tuesday': '2', 'tue': '2',
            'wednesday': '3', 'wed': '3',
            'thursday': '4', 'thu': '4',
            'friday': '5', 'fri': '5',
            'saturday': '6', 'sat': '6'
        }
        for day_name, day_num in days.items():
            if f" {day_name} " in f" {q} ":
                return f"strftime('%w', {column}) = '{day_num}'"

        # 7. Shortcuts (Today, Yesterday, etc) - Updated for IST
        ist_now_date = "date('now', '+5 hours', '30 minutes')"
        ist_now_month = "strftime('%Y-%m', 'now', '+5 hours', '30 minutes')"
        ist_now_year = "strftime('%Y', 'now', '+5 hours', '30 minutes')"

        if 'today' in q:
            return f"date({column}) = {ist_now_date}"
        if 'yesterday' in q:
            return f"date({column}) = date('now', '-1 day', '+5 hours', '30 minutes')"
        if 'this week' in q:
            # weekday 0 is Sunday. 
            return f"{column} >= date('now', 'weekday 0', '-7 days', '+5 hours', '30 minutes')"
        if 'last week' in q: 
            return f"{column} >= date('now', 'weekday 0', '-14 days', '+5 hours', '30 minutes') AND {column} < date('now', 'weekday 0', '-7 days', '+5 hours', '30 minutes')"
        if 'this month' in q or 'current month' in q:
            return f"strftime('%Y-%m', {column}) = {ist_now_month}"
        if 'last month' in q: 
            return f"strftime('%Y-%m', {column}) = strftime('%Y-%m', 'now', '-1 month', '+5 hours', '30 minutes')"
        if 'this year' in q:
            return f"strftime('%Y', {column}) = {ist_now_year}"
        if 'last year' in q:
            return f"strftime('%Y', {column}) = strftime('%Y', 'now', '-1 year', '+5 hours', '30 minutes')"
            
        return ""

    def _get_company_info(self) -> dict:
        """Get company info from app_settings database"""
        info = {
            "name": "Inventory Management System",
            "address": "",
            "phone": "",
            "email": ""
        }
        try:
            import sqlite3
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Fetch all invoice company related settings
            cursor.execute("SELECT key, value FROM app_settings WHERE key LIKE 'invoice_company_%'")
            results = cursor.fetchall()
            conn.close()
            
            settings = {row[0]: row[1] for row in results}
            
            if settings.get('invoice_company_name'):
                info["name"] = settings['invoice_company_name']
            if settings.get('invoice_company_address'):
                info["address"] = settings['invoice_company_address']
            if settings.get('invoice_company_phone'):
                info["phone"] = settings['invoice_company_phone']
            if settings.get('invoice_company_email'):
                info["email"] = settings['invoice_company_email']
                
        except Exception as e:
            logger.warning(f"Could not get company info from settings: {e}")
        return info

    def generate_sql(self, question: str) -> str:
        """Generate SQL from a natural language question"""
        logger.info(f"DEBUG: generate_sql called with question: {question}")
        logger.info(f"DEBUG: vector_store type: {type(self.vector_store)}")
        logger.info(f"Generating SQL for question: {question}")
        
        question_lower = ' '.join(question.lower().split())
        import re
        
        # Remove common punctuation for better pattern matching (e.g., "Hi!" -> "hi")
        q_clean = re.sub(r'[!?.,]', '', question_lower).strip()
        
        # =================
        # CONVERSATIONAL RESPONSES (Non-SQL)
        # =================
        # Handle greetings
        greeting_patterns = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hola']
        if q_clean in greeting_patterns or any(q_clean.startswith(g + ' ') for g in greeting_patterns):
            logger.info("Detected greeting, returning conversational response")
            return "CONVERSATIONAL:Hello! How can I help you today? You can ask me about products, customers, suppliers, invoices, or sales analytics."
        
        # Handle identity questions
        identity_patterns = ['who are you', 'what are you', 'who is this', 'what is this', 'introduce yourself', 'tell me about yourself']
        if any(pattern in q_clean for pattern in identity_patterns):
            info = self._get_company_info()
            logger.info(f"Detected identity question, returning company info: {info['name']}")
            
            import json
            identity_data = {
                "type": "identity",
                "company_name": info['name'],
                "address": info['address'],
                "phone": info['phone'],
                "email": info['email'],
                "message": f"I'm the AI assistant for **{info['name']}**. I can help you with inventory queries, customer information, sales analytics, and more."
            }
            return f"IDENTITY:{json.dumps(identity_data)}"
        
        # Handle thank you / goodbye
        farewell_patterns = ['thank you', 'thanks', 'bye', 'goodbye', 'see you', 'take care']
        if any(pattern in question_lower for pattern in farewell_patterns):
            logger.info("Detected farewell, returning conversational response")
            return "CONVERSATIONAL:You're welcome! Feel free to ask if you need anything else. Have a great day!"
        
        # Handle help requests
        help_patterns = ['help', 'what can you do', 'how to use', 'commands', 'features']
        if any(pattern in q_clean for pattern in help_patterns) and len(q_clean) < 50:
            logger.info("Detected help request, returning help info")
            return """CONVERSATIONAL:I can help you with:
• **Products**: Stock levels, prices, top sellers, product details
• **Customers**: Customer info, purchase history, credit balances
• **Suppliers**: Supplier details, pending payments
• **Sales**: Revenue, invoices, payment methods, trends
• **Analytics**: Top products, customer spending, sales reports

Just ask naturally, like "Show top 5 sold products" or "Customer John details"!"""
        
        # Extract potential identifiers from question
        phone_match = re.search(r'(\d{7,12})', question)
        email_match = re.search(r'[\w\.-]+@[\w\.-]+', question)
        
        # =================
        # LOW STOCK / OUT OF STOCK PRODUCT QUERIES
        # =================
        if 'low stock' in question_lower or 'running low' in question_lower:
            sql = """SELECT p.name AS "PRODUCT NAME", p.sku AS "SKU", p.stock_quantity AS "CURRENT STOCK", 
                p.price AS "COST PRICE", s.name AS "SUPPLIER"
                FROM products p 
                LEFT JOIN suppliers s ON p.supplier_id = s.id 
                WHERE p.stock_quantity < 10 
                ORDER BY p.stock_quantity ASC"""
            logger.info(f"Detected low stock query, using hardcoded SQL: {sql}")
            return sql
        
        if 'out of stock' in question_lower or 'no stock' in question_lower or 'zero stock' in question_lower:
            sql = """SELECT p.name AS "PRODUCT NAME", p.sku AS "SKU", p.stock_quantity AS "CURRENT STOCK", 
                p.price AS "COST PRICE", s.name AS "SUPPLIER"
                FROM products p 
                LEFT JOIN suppliers s ON p.supplier_id = s.id 
                WHERE p.stock_quantity = 0 
                ORDER BY p.name ASC"""
            logger.info(f"Detected out of stock query, using hardcoded SQL: {sql}")
            return sql
        
        # =================
        # CUSTOMER QUERIES
        # =================
        
        # Bypass hardcoded logic for "who bought" or specific product sales queries
        # This allows the trained LLM to handle "customer who bought X" queries
        # NOTE: Exclude "sold to customer" patterns - those go to top_sold_query handler
        is_sold_to_customer = 'sold to customer' in question_lower
        is_purchase_query = not is_sold_to_customer and (
            'bought' in question_lower or 
            'sales with' in question_lower or 
            'customers for' in question_lower or
            'who purchased' in question_lower or
            'by customers' in question_lower or
            # Check for product keywords combined with customer context
            ('kisses' in question_lower and 'customer' in question_lower) or
            ('product' in question_lower and 'customer' in question_lower and 'sold' not in question_lower)
        )
        logger.info(f"DEBUG: is_purchase_query = {is_purchase_query}, question = '{question_lower}'")
        
        if is_purchase_query:
            logger.info("Detected product purchase query pattern, bypassing hardcoded logic to use LLM")
            context = self.vector_store.get_relevant_context(question, n_results=3)
            logger.info(f"DEBUG: Retrieved context for purchase query: {context[:300] if context else 'EMPTY'}...")
            sql = self.llm.generate(question, context=context)
            logger.info(f"DEBUG: LLM generated SQL: {sql}")
            
            # Basic cleanup (full cleanup is at end of function but we return early)
            sql = sql.strip()
            if "```" in sql:
                parts = sql.split("```")
                if len(parts) > 1:
                    s = parts[1]
                    if s.lower().startswith("sql"): s = s[3:]
                    sql = s.strip()
            if sql.lower().startswith("sql:"):
                sql = sql[4:].strip()
            
            return sql
        
        # =================
        # CUSTOMERS WITH PENDING CREDIT (all customers who have pending credit > 0)
        # =================
        if 'customers with credit' in question_lower or 'customer with credit' in question_lower or 'pending credit' in question_lower or 'credit pending' in question_lower:
            sql = """SELECT c.name AS "NAME", c.phone AS "CONTACT INFO", c.address AS "ADDRESS", c.email AS "EMAIL",
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as "CREDIT GIVEN",
                COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as "CREDIT REPAID",
                COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as "PENDING CREDIT"
                FROM customers c
                WHERE (
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - 
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0)
                ) > 0
                ORDER BY "PENDING CREDIT" DESC"""
            logger.info(f"Detected customers with pending credit query, using hardcoded SQL: {sql}")
            return sql
        
        # =================
        # CUSTOMER INVOICE LIST (customer name invoice list)
        # =================
        invoice_list_match = re.search(r'(?:customer|customers)\s+(\w+)\s+invoice(?:s)?\s*(?:list)?', question_lower)
        if invoice_list_match or ('invoice list' in question_lower and 'customer' in question_lower):
            # Extract customer name
            if invoice_list_match:
                customer_name = invoice_list_match.group(1).strip()
            else:
                # Try to extract name from "customer X invoice list" pattern
                name_match = re.search(r'(?:customer|customers)\s+(\w+)', question_lower)
                customer_name = name_match.group(1).strip() if name_match else None
            
            if customer_name and customer_name.lower() not in ['invoice', 'invoices', 'list', 'all']:
                sql = f"""SELECT c.name AS "CUSTOMER NAME", i.invoice_number AS "INVOICE NUMBER", 
                    i.total_amount AS "TOTAL SPENT", 
                    date(i.created_at, '+5 hours', '30 minutes') AS "INVOICE DATE"
                    FROM customers c 
                    JOIN invoices i ON c.id = i.customer_id 
                    WHERE LOWER(c.name) LIKE LOWER('%{customer_name}%')
                    ORDER BY i.created_at DESC"""
                logger.info(f"Detected customer invoice list query, using hardcoded SQL: {sql}")
                return sql
        
        # =================
        # CUSTOMER + PLACE FILTER (customer Kurnool, customer [city name])
        # =================
        # Common place names in India - detect if the word after "customer" is a place name
        place_keywords = ['kurnool', 'hyderabad', 'bangalore', 'chennai', 'mumbai', 'delhi', 'pune', 'kolkata', 
                         'nandyal', 'kadapa', 'anantapur', 'tirupati', 'vijayawada', 'visakhapatnam', 'guntur',
                         'warangal', 'nizamabad', 'karimnagar', 'khammam', 'rajahmundry', 'kakinada', 'eluru',
                         'ongole', 'nellore', 'chittoor', 'srikakulam', 'vizianagaram', 'machilipatnam']
        
        # Check if query matches "customer [place]" pattern
        place_match = re.search(r'(?:customer|customers)\s+(\w+)', question_lower)
        if place_match:
            potential_place = place_match.group(1).strip().lower()
            # Check if it's a place name or if user explicitly asks for place filter
            is_place_query = (potential_place in place_keywords or 
                             'place' in question_lower or 
                             'city' in question_lower or 
                             'town' in question_lower or
                             'district' in question_lower or
                             'state' in question_lower)
            
            if is_place_query and potential_place not in ['credit', 'list', 'all', 'invoice', 'invoices', 'month', 'week', 'year', 'today', 'yesterday', 'last', 'this', 'current']:
                place_name = potential_place
                base_sql = f"""SELECT c.name AS "NAME", c.phone AS "CONTACT INFO", c.address AS "ADDRESS", c.email AS "EMAIL", 
                    date(MAX(i.created_at), '+5 hours', '30 minutes') AS "INVOICE DATE", 
                    datetime(MAX(i.created_at), '+5 hours', '30 minutes') AS "LAST BILLED", 
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) AS "PRODUCTS BOUGHT", 
                    SUM(i.total_amount) AS "TOTAL SPENT", 
                    COUNT(i.id) AS "TOTAL INVOICES" 
                    FROM customers c 
                    JOIN invoices i ON c.id = i.customer_id 
                    WHERE (LOWER(c.place) LIKE LOWER('%{place_name}%') OR LOWER(c.town) LIKE LOWER('%{place_name}%') OR LOWER(c.district) LIKE LOWER('%{place_name}%') OR LOWER(c.state) LIKE LOWER('%{place_name}%') OR LOWER(c.address) LIKE LOWER('%{place_name}%'))"""
                
                # Check for date filter as well (e.g., "customer kurnool last week")
                date_filter = self.get_date_filter(question, 'i.created_at')
                if date_filter:
                    base_sql += f" AND {date_filter}"
                
                base_sql += """ GROUP BY c.id ORDER BY "TOTAL SPENT" DESC"""
                logger.info(f"Detected customer place query, using hardcoded SQL: {base_sql}")
                return base_sql
        
        if 'customer credit' in question_lower or 'credit for customer' in question_lower:

            # Check for phone in credit query
            if phone_match:
                phone = phone_match.group(1)
                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                    COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                    MAX(i.created_at) as "LAST BILLED",
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as "PRODUCTS BOUGHT",
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
                    COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                    COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                    MAX(i.created_at) as "LAST BILLED",
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as "PRODUCTS BOUGHT",
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
                COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                MAX(i.created_at) as "LAST BILLED",
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
                    COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                    COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                    MAX(i.created_at) as "LAST BILLED",
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as "PRODUCTS BOUGHT",
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
                    COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                    COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                    MAX(i.created_at) as "LAST BILLED",
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as "PRODUCTS BOUGHT",
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE c.email LIKE '%{email}%' 
                    GROUP BY c.id"""
                logger.info(f"Detected customer email query, using hardcoded SQL: {sql}")
                return sql
            
            # IDENTIFY INTENT: Is it a date query, a list query, or a name search?
            # First, extract potential name component
            name_match = re.search(r'(?:customer name|customer details for|customer info for|who is customer|customers|customer|name)\s+((?:(?!day|week|month|year).)+)', question_lower)
            customer_name_raw = name_match.group(1).strip() if name_match else question.split()[-1]
            logger.info(f"DEBUG: customer_name_raw extracted: '{customer_name_raw}'")

            # 1. Is it a date phrase?
            date_phrases = [
                'today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 
                'this year', 'last year', 'current month', 'month', 'wednesday', 'monday', 'tuesday', 
                'thursday', 'friday', 'saturday', 'sunday', '2024', '2025',
                # Month names
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december',
                'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
            ]
            is_date_phrase = (
                any(dp == customer_name_raw.lower() or f"{dp} " in f"{customer_name_raw.lower()} " or f" {dp}" in f" {customer_name_raw.lower()}" for dp in date_phrases) or
                bool(re.search(r'(?:\d+)?\s*(?:day|week|month|year)s?$', customer_name_raw.lower())) or
                bool(re.search(r'week\s+\d+', question_lower)) or
                bool(re.search(r'(?:last|past|in the last|in the past|this|next)?\s*(\d+)?\s*(year|month|week|day)s?', question_lower)) or
                ("complete" in question_lower and any(u in question_lower for u in ['week', 'month', 'year']))
            )
            
            if is_date_phrase:
                logger.info(f"Detected date intent for question: {question_lower}")
                base_sql = 'SELECT c.name AS "NAME", c.phone AS "CONTACT INFO", c.address AS "ADDRESS", c.email AS "EMAIL", date(MAX(i.created_at), \'+5 hours\', \'30 minutes\') AS "INVOICE DATE", datetime(MAX(i.created_at), \'+5 hours\', \'30 minutes\') AS "LAST BILLED", COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) AS "PRODUCTS BOUGHT", SUM(i.total_amount) AS "TOTAL SPENT", COUNT(i.id) AS "TOTAL INVOICES" FROM customers c JOIN invoices i ON c.id = i.customer_id'
                date_filter = self.get_date_filter(question, 'i.created_at')
                if date_filter:
                    sql = base_sql + f" WHERE {date_filter} GROUP BY c.id ORDER BY \"TOTAL SPENT\" DESC"
                    logger.info(f"Generated date-filtered SQL: {sql}")
                    return sql
                logger.warning(f"Date intent detected but extraction failed for: {question_lower}")

            # 2. Is it a list query?
            list_keywords = ['list', 'all', 'data', 'details', 'detail', 'info', 'supplier list', 'suppliers list', 'supplier data']
            customer_name_for_list = "" if is_date_phrase else customer_name_raw
            if any(k == customer_name_for_list.lower() or f"{k} " in f"{customer_name_for_list.lower()} " or f" {k}" in f" {customer_name_for_list.lower()}" for k in list_keywords):
                logger.info(f"Detected list intent for question: {question_lower}")
                base_sql = "SELECT c.id, c.name, c.phone, c.email, c.address, c.place, COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as \"PRODUCTS BOUGHT\", COUNT(DISTINCT i.id) as \"TOTAL INVOICES\", COALESCE(SUM(i.total_amount) , 0) as \"TOTAL SPENT\", MAX(i.created_at) as \"LAST BILLED\" FROM customers c LEFT JOIN invoices i ON c.id = i.customer_id"
                date_filter = self.get_date_filter(question, 'i.created_at')
                if date_filter:
                    base_sql += f" WHERE {date_filter}"
                sql = base_sql + " GROUP BY c.id ORDER BY \"TOTAL SPENT\" DESC"
                return sql

            # 3. Default to Name Search
            if not is_date_phrase and customer_name_raw:

                sql = f"""SELECT c.*, 
                    COUNT(DISTINCT i.id) as "TOTAL INVOICES", 
                    COALESCE(SUM(i.total_amount), 0) as "TOTAL SPENT", 
                    MAX(i.created_at) as "LAST BILLED",
                    COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i2 ON ii.invoice_id = i2.id WHERE i2.customer_id = c.id), 0) as "PRODUCTS BOUGHT",
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) as credit_given,
                    COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as credit_repaid,
                    COALESCE((SELECT SUM(credit_amount) FROM invoices WHERE customer_id = c.id AND (credit_amount > 0 OR payment_method = 'Credit')), 0) - COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp JOIN invoices inv ON cp.invoice_id = inv.id WHERE cp.customer_id = c.id AND (inv.credit_amount > 0 OR inv.payment_method = 'Credit') AND (cp.note IS NULL OR cp.note NOT LIKE '%Initial payment%')), 0) as current_credit
                    FROM customers c 
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                    WHERE LOWER(c.name) LIKE LOWER('%{customer_name_raw}%') 
                    GROUP BY c.id"""
                logger.info(f"Generated name-search SQL: {sql}")
                return sql
        
        # =================
        # REVENUE QUERIES
        # =================
        if 'revenue' in question_lower or 'sales' in question_lower or 'income' in question_lower:
            # Only intercept if it looks like a general revenue query, not per-customer (which might be handled above or by LLM)
            # The customer block above handles "customer" keyword. If we are here, it's likely general revenue.
            
            date_filter = self.get_date_filter(question, 'created_at')
            if date_filter:
                sql = f"SELECT SUM(total_amount) as \"TOTAL REVENUE\" FROM invoices WHERE {date_filter}"
                logger.info(f"Detected date-filtered revenue query, using hardcoded SQL: {sql}")
                return sql
            
            # If specifically asking for "total revenue" or "total sales" without date, usually means all time
            if 'total' in question_lower:
                sql = "SELECT SUM(total_amount) as \"TOTAL REVENUE\" FROM invoices"
                logger.info(f"Detected total revenue query, using hardcoded SQL: {sql}")
                return sql
        
        # =================
        # SUPPLIER QUERIES
        # =================
        
        # Supplier queries (name, details, info, or just "supplier X")
        if question_lower.startswith('supplier ') or question_lower.startswith('suppliers ') or any(keyword in question_lower for keyword in ['supplier name', 'supplier details', 'supplier info', 'who is supplier']):
            # Check for phone number in query
            if phone_match:
                phone = phone_match.group(1)
                sql = f"""SELECT s.*, 
                    COUNT(DISTINCT p.id) as total_products, 
                    COALESCE(SUM(p.initial_stock), 0) as total_stock, 
                    COALESCE(SUM(p.initial_stock * p.price), 0) as stock_value,
                    COALESCE((SELECT SUM(poi.total_cost) FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_id = po.id WHERE po.supplier_id = s.id), 0) + COALESCE(SUM(p.initial_stock * p.price), 0) - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as pending_amount
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
                    COALESCE(SUM(p.initial_stock), 0) as total_stock, 
                    COALESCE(SUM(p.initial_stock * p.price), 0) as stock_value,
                    COALESCE((SELECT SUM(poi.total_cost) FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_id = po.id WHERE po.supplier_id = s.id), 0) + COALESCE(SUM(p.initial_stock * p.price), 0) - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as pending_amount
                    FROM suppliers s 
                    LEFT JOIN products p ON s.id = p.supplier_id 
                    WHERE s.email LIKE '%{email}%' 
                    GROUP BY s.id"""
                logger.info(f"Detected supplier email query, using hardcoded SQL: {sql}")
                return sql
            
            # Default to name search
            name_match = re.search(r'(?:supplier name|supplier details for|supplier info for|who is supplier|suppliers|supplier)\s+(\w+)', question_lower)
            supplier_name = name_match.group(1).strip() if name_match else question.split()[-1]
            
            # Handle "supplier list" or "supplier all" explicitly
            list_keywords = ['list', 'all', 'data', 'details', 'detail', 'info']
            if supplier_name.lower() in list_keywords:
                sql = """SELECT s.*, 
                    COUNT(DISTINCT p.id) as total_products, 
                    COALESCE(SUM(p.initial_stock), 0) as total_stock, 
                    COALESCE(SUM(p.initial_stock * p.price), 0) as stock_value,
                    COALESCE((SELECT SUM(poi.total_cost) FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_id = po.id WHERE po.supplier_id = s.id), 0) + COALESCE(SUM(p.initial_stock * p.price), 0) - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as pending_amount
                    FROM suppliers s 
                    LEFT JOIN products p ON s.id = p.supplier_id 
                    GROUP BY s.id"""
                logger.info(f"Detected supplier list query, using hardcoded SQL: {sql}")
                return sql
            
            sql = f"""SELECT s.*, 
                COUNT(DISTINCT p.id) as total_products, 
                COALESCE(SUM(p.initial_stock), 0) as total_stock, 
                COALESCE(SUM(p.initial_stock * p.price), 0) as stock_value,
                COALESCE((SELECT SUM(poi.total_cost) FROM purchase_order_items poi JOIN purchase_orders po ON poi.po_id = po.id WHERE po.supplier_id = s.id), 0) + COALESCE(SUM(p.initial_stock * p.price), 0) - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as pending_amount
                FROM suppliers s 
                LEFT JOIN products p ON s.id = p.supplier_id 
                WHERE LOWER(s.name) LIKE LOWER('%{supplier_name}%') 
                GROUP BY s.id"""
            logger.info(f"Detected supplier name query, using hardcoded SQL: {sql}")
            return sql
        
        # =================
        # TOP SOLD PRODUCTS / ANALYTICS QUERIES (bypass to LLM)
        # =================
        # These queries should use trained data, not hardcoded product name extraction
        is_top_sold_query = (
            'top sold' in question_lower or
            'top selling' in question_lower or
            'most sold' in question_lower or
            'best seller' in question_lower or
            ('top' in question_lower and 'products' in question_lower) or
            ('product' in question_lower and 'sold to customer' in question_lower) or
            'products sold to customer' in question_lower or
            'customer wise product' in question_lower or
            'products count by customer' in question_lower or
            'customers who bought most' in question_lower or
            'top customers by product' in question_lower or
            'products taken by customer' in question_lower
        )
        
        if is_top_sold_query:
            logger.info(f"Detected top sold/analytics query, bypassing hardcoded logic to use LLM")
            context = self.vector_store.get_relevant_context(question, n_results=3)
            logger.info(f"DEBUG: Retrieved context for top sold query: {context[:300] if context else 'EMPTY'}...")
            sql = self.llm.generate(question, context=context)
            logger.info(f"DEBUG: LLM generated SQL: {sql}")
            
            # Basic cleanup
            sql = sql.strip()
            if "```" in sql:
                parts = sql.split("```")
                if len(parts) > 1:
                    s = parts[1]
                    if s.lower().startswith("sql"): s = s[3:]
                    sql = s.strip()
            if sql.lower().startswith("sql:"):
                sql = sql[4:].strip()
            
            return sql
        
        # =================
        # PRODUCT QUERIES
        # =================

        # Product queries (name, details, info, stock, or just "product X")
        if (question_lower.startswith('product ') or
            question_lower.startswith('products ') or
            any(keyword in question_lower for keyword in ['product name', 'product details', 'product info', 'product stock', 'find product', 'search product']) or
            # Match patterns like "cadbury stock", "kitkat sales", "dairy milk data"
            any(keyword in question_lower for keyword in [' stock', ' sales', ' data', ' list', ' info', ' details', ' price', ' profit', ' revenue'])):

            # Check if this is actually a product query by excluding customer/supplier/invoice patterns
            is_product_query = True
            if any(kw in question_lower for kw in ['customer', 'supplier', 'invoice', 'payment method', 'who is']):
                is_product_query = False

            if is_product_query:
                # Extract product name
                product_name = None

                # Pattern 1: "product X ..." format
                name_match = re.search(r'(?:product name|product details for|product info for|product stock for|find product|search product|products|product)\s+(.+?)(?:\s+current stock|\s+stock purchased|\s+total sales|\s+sales count|\s+amount sold|\s+selling price|\s+details|\s+info|\s+sales|\s+purchases?|\s+history|\s+supplier|\s+customers?|\s+profit|\s+revenue|\s+data|\s+list)?$', question_lower)

                if name_match:
                    product_name = name_match.group(1).strip()
                else:
                    # Pattern 2: "X stock", "X sales", "X data" format
                    alt_match = re.search(r'^(.+?)\s+(?:stock|sales|data|list|info|details|price|profit|revenue|current stock|stock purchased|total sales|sales count|amount sold|selling price|purchase history|sales history|supplier|customers?|payment)', question_lower)
                    if alt_match:
                        product_name = alt_match.group(1).strip()

                if product_name:
                    # Remove trailing keywords that might have been captured
                    for kw in ['current', 'stock', 'purchased', 'total', 'sales', 'count', 'amount', 'sold', 'selling', 'price', 'details', 'info', 'data', 'list', 'the', 'for', 'of']:
                        product_name = re.sub(rf'\s+{kw}$', '', product_name, flags=re.IGNORECASE)
                        product_name = re.sub(rf'^{kw}\s+', '', product_name, flags=re.IGNORECASE)

                    product_name = product_name.strip()

                    if product_name and len(product_name) > 1:
                        # Handle specific sub-queries
                        if 'current stock' in question_lower or ('stock' in question_lower and 'purchased' not in question_lower and 'history' not in question_lower):
                            sql = f"""SELECT p.name, p.sku, p.stock_quantity as current_stock
                                FROM products p
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')"""
                            logger.info(f"Detected product current stock query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'stock purchased' in question_lower or 'total purchased' in question_lower or 'was purchased' in question_lower:
                            sql = f"""SELECT p.name, p.initial_stock,
                                COALESCE(SUM(poi.quantity), 0) as purchased_via_po,
                                p.initial_stock + COALESCE(SUM(poi.quantity), 0) as total_stock_purchased
                                FROM products p
                                LEFT JOIN purchase_order_items poi ON p.id = poi.product_id
                                LEFT JOIN purchase_orders po ON poi.po_id = po.id AND po.status = 'received'
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                GROUP BY p.id"""
                            logger.info(f"Detected product stock purchased query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'total sales count' in question_lower or 'sales count' in question_lower or 'how many times' in question_lower:
                            sql = f"""SELECT p.name,
                                COUNT(DISTINCT i.id) as total_sales_count,
                                COALESCE(SUM(ii.quantity), 0) as total_quantity_sold
                                FROM products p
                                LEFT JOIN invoice_items ii ON p.id = ii.product_id
                                LEFT JOIN invoices i ON ii.invoice_id = i.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                GROUP BY p.id"""
                            logger.info(f"Detected product sales count query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'total amount sold' in question_lower or 'amount sold' in question_lower or 'total sold' in question_lower or 'revenue' in question_lower:
                            sql = f"""SELECT p.name,
                                COALESCE(SUM(ii.quantity * ii.unit_price), 0) as total_amount_sold,
                                COALESCE(SUM(ii.quantity), 0) as total_quantity_sold
                                FROM products p
                                LEFT JOIN invoice_items ii ON p.id = ii.product_id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                GROUP BY p.id"""
                            logger.info(f"Detected product amount sold query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'selling price' in question_lower or 'price' in question_lower:
                            sql = f"""SELECT p.name, p.price as cost_price, p.selling_price,
                                (p.selling_price - p.price) as profit_margin
                                FROM products p
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')"""
                            logger.info(f"Detected product price query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'purchase history' in question_lower or 'purchases' in question_lower or 'purchase orders' in question_lower or 'when did we buy' in question_lower:
                            sql = f"""SELECT p.name as product, po.po_number, po.order_date,
                                poi.quantity, poi.unit_cost, poi.total_cost,
                                s.name as supplier, po.status
                                FROM products p
                                JOIN purchase_order_items poi ON p.id = poi.product_id
                                JOIN purchase_orders po ON poi.po_id = po.id
                                JOIN suppliers s ON po.supplier_id = s.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                ORDER BY po.order_date DESC"""
                            logger.info(f"Detected product purchase history query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'sales history' in question_lower or 'sales list' in question_lower or 'invoices' in question_lower:
                            sql = f"""SELECT p.name as product, i.invoice_number, i.created_at as sale_date,
                                ii.quantity, ii.unit_price, (ii.quantity * ii.unit_price) as line_total,
                                c.name as customer
                                FROM products p
                                JOIN invoice_items ii ON p.id = ii.product_id
                                JOIN invoices i ON ii.invoice_id = i.id
                                LEFT JOIN customers c ON i.customer_id = c.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                ORDER BY i.created_at DESC"""
                            logger.info(f"Detected product sales history query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'supplier' in question_lower or 'who supplies' in question_lower:
                            sql = f"""SELECT p.name as product, s.name as supplier,
                                s.contact_info, s.email
                                FROM products p
                                LEFT JOIN suppliers s ON p.supplier_id = s.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')"""
                            logger.info(f"Detected product supplier query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'customer' in question_lower or 'who bought' in question_lower or 'who purchased' in question_lower:
                            sql = f"""SELECT DISTINCT c.name as customer, c.phone,
                                COUNT(DISTINCT i.id) as purchase_count,
                                SUM(ii.quantity) as total_quantity
                                FROM products p
                                JOIN invoice_items ii ON p.id = ii.product_id
                                JOIN invoices i ON ii.invoice_id = i.id
                                JOIN customers c ON i.customer_id = c.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                GROUP BY c.id
                                ORDER BY total_quantity DESC"""
                            logger.info(f"Detected product customers query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'payment' in question_lower or 'paid for' in question_lower:
                            sql = f"""SELECT p.name as product, sp.amount, sp.payment_method,
                                sp.paid_at, sp.note, s.name as supplier
                                FROM products p
                                JOIN supplier_payments sp ON p.id = sp.product_id
                                JOIN suppliers s ON sp.supplier_id = s.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                ORDER BY sp.paid_at DESC"""
                            logger.info(f"Detected product payment query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'profit' in question_lower or 'margin' in question_lower:
                            sql = f"""SELECT p.name, p.price as cost_price, p.selling_price,
                                (p.selling_price - p.price) as profit_per_unit,
                                COALESCE(p.quantity_sold, 0) * (p.selling_price - p.price) as total_profit
                                FROM products p
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')"""
                            logger.info(f"Detected product profit query for '{product_name}', using hardcoded SQL")
                            return sql

                        elif 'sales' in question_lower and ('this month' in question_lower or 'today' in question_lower or 'this week' in question_lower):
                            date_filter = self.get_date_filter(question, 'i.created_at')
                            sql = f"""SELECT p.name, SUM(ii.quantity) as quantity_sold,
                                SUM(ii.quantity * ii.unit_price) as revenue
                                FROM products p
                                JOIN invoice_items ii ON p.id = ii.product_id
                                JOIN invoices i ON ii.invoice_id = i.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                AND {date_filter}
                                GROUP BY p.id"""
                            logger.info(f"Detected product date-filtered sales query for '{product_name}', using hardcoded SQL")
                            return sql

                        else:
                            # Default comprehensive product query
                            sql = f"""SELECT p.id, p.name, p.sku,
                                p.price as cost_price, p.selling_price,
                                p.stock_quantity as current_stock,
                                COALESCE(p.initial_stock, 0) + COALESCE((SELECT SUM(poi.quantity) FROM purchase_order_items poi
                                    JOIN purchase_orders po ON poi.po_id = po.id
                                    WHERE poi.product_id = p.id AND po.status = 'received'), 0) as total_stock_purchased,
                                COALESCE(SUM(ii.quantity), 0) as quantity_sold,
                                COUNT(DISTINCT i.id) as sales_invoice_count,
                                COALESCE(SUM(ii.quantity * ii.unit_price), 0) as total_amount_sold,
                                p.category,
                                s.name as supplier_name
                                FROM products p
                                LEFT JOIN suppliers s ON p.supplier_id = s.id
                                LEFT JOIN invoice_items ii ON p.id = ii.product_id
                                LEFT JOIN invoices i ON ii.invoice_id = i.id
                                WHERE LOWER(p.name) LIKE LOWER('%{product_name}%')
                                GROUP BY p.id"""
                            logger.info(f"Detected general product query for '{product_name}', using comprehensive hardcoded SQL")
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
