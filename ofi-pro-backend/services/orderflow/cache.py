# services/orderflow/cache.py
import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple

class CacheManager:
    def __init__(self, default_ttl: int = 60):
        self._cache: Dict[str, Tuple[Any, datetime]] = {}
        self._ttl = default_ttl
        self._lock = asyncio.Lock()

    def _make_key(self, *args) -> str:
        key_str = ":".join(str(a) for a in args)
        return hashlib.md5(key_str.encode()).hexdigest()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key in self._cache:
                value, timestamp = self._cache[key]
                if datetime.now(timezone.utc) - timestamp < timedelta(seconds=self._ttl):
                    return value
                else:
                    del self._cache[key]
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        async with self._lock:
            self._cache[key] = (value, datetime.now(timezone.utc))

    async def clear(self) -> None:
        async with self._lock:
            self._cache.clear()

# Global cache
cache = CacheManager()