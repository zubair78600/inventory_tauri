import json
import logging
from pathlib import Path
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class QueryCache:
    """Simple JSON-based cache for Natural Language -> SQL mappings"""
    
    def __init__(self, base_path: str):
        self.cache_dir = Path(base_path) / "AI" / "AI_Cache"
        self.cache_file = self.cache_dir / "query_cache.json"
        
        # Ensure directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.cache: Dict[str, str] = {}
        self.load_cache()
    
    def load_cache(self):
        """Load cache from disk"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.cache = json.load(f)
                logger.info(f"Loaded {len(self.cache)} cached queries")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")
                self.cache = {}
    
    def _save(self):
        """Save cache to disk"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def _normalize(self, text: str) -> str:
        """Normalize query text for consistent cache keys"""
        return text.strip().lower()

    def get(self, question: str) -> Optional[str]:
        """Get cached SQL for a question"""
        key = self._normalize(question)
        return self.cache.get(key)

    def set(self, question: str, sql: str):
        """Cache SQL for a question"""
        key = self._normalize(question)
        if key not in self.cache or self.cache[key] != sql:
            self.cache[key] = sql
            self._save()
    def clear(self):
        """Clear the entire cache"""
        self.cache = {}
        self._save()
        logger.info("Query cache cleared")
