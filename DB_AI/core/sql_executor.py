import sqlite3
from pathlib import Path
import logging
import re

logger = logging.getLogger(__name__)


class SQLExecutor:
    """Safe SQL executor with read-only enforcement"""

    BLOCKED_KEYWORDS = [
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
        "TRUNCATE", "REPLACE", "GRANT", "REVOKE", "ATTACH", "DETACH"
    ]
    
    # Compile regex patterns for word boundary matching
    BLOCKED_PATTERNS = [re.compile(rf'\b{kw}\b', re.IGNORECASE) for kw in BLOCKED_KEYWORDS]

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)

    def _is_safe_query(self, sql: str) -> bool:
        """Check if a query is safe (read-only)"""
        if not sql or not sql.strip():
            logger.warning("Empty SQL received")
            return False
            
        sql_upper = sql.upper().strip()
        logger.info(f"Checking SQL safety: {sql_upper[:100]}...")
        
        # Only allow SELECT and WITH (for CTEs) statements
        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            logger.warning(f"SQL doesn't start with SELECT/WITH: {sql_upper[:50]}")
            return False
            
        # Check for blocked keywords using word boundaries (not substring!)
        for pattern in self.BLOCKED_PATTERNS:
            if pattern.search(sql):
                logger.warning(f"Blocked keyword found in SQL: {pattern.pattern}")
                return False
        return True

    def execute(self, sql: str, limit: int = 100) -> list:
        """Execute a SQL query and return results as list of dicts"""
        logger.info(f"Executing SQL: {repr(sql)}")
        if not self._is_safe_query(sql):
            raise ValueError("Only SELECT queries are allowed for safety")

        # Auto-add LIMIT clause if not present
        if "LIMIT" not in sql.upper():
            sql = f"{sql.rstrip(';')} LIMIT {limit}"

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row

        try:
            cursor = conn.execute(sql)
            columns = [description[0] for description in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            return results
        except Exception as e:
            logger.error(f"SQL execution error: {e}")
            raise
        finally:
            conn.close()
