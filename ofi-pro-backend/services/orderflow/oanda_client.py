# services/orderflow/oanda_client.py
import json
from typing import AsyncIterator, Dict, List, Optional

import aiohttp
from core.config import settings
import logging

log = logging.getLogger("OFI-Backend")

class OandaClient:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.base_url = "https://api-fxpractice.oanda.com" if settings.OANDA_ENVIRONMENT == "practice" else "https://api-fxtrade.oanda.com"
        self.stream_base_url = "https://stream-fxpractice.oanda.com" if settings.OANDA_ENVIRONMENT == "practice" else "https://stream-fxtrade.oanda.com"
        self.last_error: Optional[str] = None
        self.headers = {
            "Authorization": f"Bearer {settings.OANDA_API_KEY}",
            "Accept-Datetime-Format": "RFC3339"
        }

    async def _request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        if not settings.OANDA_API_KEY:
            self.last_error = (
                "OANDA API key is missing. Add OANDA_API_KEY to your backend .env file "
                "without the 'Bearer' prefix."
            )
            return None

        url = f"{self.base_url}{endpoint}"
        try:
            async with self.session.get(url, headers=self.headers, params=params, timeout=30) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    log.warning(f"OANDA error {resp.status}: {text[:200]}")
                    if "Invalid value specified for 'Authorization'" in text:
                        self.last_error = (
                            "OANDA rejected the API key. Check OANDA_API_KEY in your backend .env. "
                            "Use only the raw token value with no quotes and no 'Bearer' prefix."
                        )
                    elif resp.status in {401, 403}:
                        self.last_error = (
                            "OANDA authorization failed. Confirm the API key and environment "
                            "match your OANDA account."
                        )
                    else:
                        self.last_error = f"OANDA request failed with status {resp.status}."
                    return None
                self.last_error = None
                return await resp.json()
        except Exception as e:
            log.warning(f"OANDA request failed: {e}")
            self.last_error = f"OANDA request failed: {e}"
            return None

    async def fetch_candles(
        self,
        instrument: str,
        granularity: str,
        count: int = 200,
        from_time: Optional[str] = None,
        to_time: Optional[str] = None,
    ) -> List[Dict]:
        params = {"granularity": granularity, "price": "M"}
        if from_time:
            params["from"] = from_time
        if to_time:
            params["to"] = to_time
        if not from_time or not to_time:
            params["count"] = count
        data = await self._request(f"/v3/instruments/{instrument}/candles", params)
        return data.get("candles", []) if data else []

    async def fetch_order_book(self, instrument: str) -> Optional[Dict]:
        data = await self._request(f"/v3/instruments/{instrument}/orderBook")
        return data.get("orderBook") if data else None

    async def fetch_position_book(self, instrument: str) -> Optional[Dict]:
        data = await self._request(f"/v3/instruments/{instrument}/positionBook")
        return data.get("positionBook") if data else None

    async def stream_prices(self, instrument: str) -> AsyncIterator[Dict]:
        if not settings.OANDA_API_KEY:
            self.last_error = (
                "OANDA API key is missing. Add OANDA_API_KEY to your backend .env file "
                "without the 'Bearer' prefix."
            )
            return

        if not settings.OANDA_ACCOUNT_ID:
            self.last_error = "OANDA account ID is missing. Add OANDA_ACCOUNT_ID to your backend .env file."
            return

        url = f"{self.stream_base_url}/v3/accounts/{settings.OANDA_ACCOUNT_ID}/pricing/stream"
        params = {"instruments": instrument, "snapshot": "true"}
        timeout = aiohttp.ClientTimeout(total=None, connect=30, sock_connect=30, sock_read=None)

        try:
            async with self.session.get(url, headers=self.headers, params=params, timeout=timeout) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    log.warning(f"OANDA stream error {resp.status}: {text[:200]}")
                    if "Invalid value specified for 'Authorization'" in text:
                        self.last_error = (
                            "OANDA rejected the API key. Check OANDA_API_KEY in your backend .env. "
                            "Use only the raw token value with no quotes and no 'Bearer' prefix."
                        )
                    elif resp.status in {401, 403}:
                        self.last_error = (
                            "OANDA authorization failed. Confirm the API key and environment "
                            "match your OANDA account."
                        )
                    else:
                        self.last_error = f"OANDA pricing stream failed with status {resp.status}."
                    return

                self.last_error = None
                buffer = ""
                async for chunk in resp.content.iter_any():
                    if not chunk:
                        continue

                    buffer += chunk.decode("utf-8", errors="ignore")
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        payload = line.strip()
                        if not payload:
                            continue
                        try:
                            yield json.loads(payload)
                        except json.JSONDecodeError:
                            log.debug("Skipping malformed OANDA stream payload")
        except Exception as e:
            log.warning(f"OANDA stream failed: {e}")
            self.last_error = f"OANDA pricing stream failed: {e}"
            return


class TwelveDataClient:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.base_url = "https://api.twelvedata.com"
        self.api_key = settings.TWELVEDATA_API_KEY

    async def fetch_quote(self, symbol: str) -> Optional[Dict]:
        try:
            async with self.session.get(
                f"{self.base_url}/quote",
                params={"symbol": symbol.replace("_", "/"), "apikey": self.api_key}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception:
            pass
        return None


class PolygonClient:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.api_key = settings.POLYGON_API_KEY

    async def fetch_forex_snapshot(self, symbol: str) -> Optional[Dict]:
        try:
            ticker = f"C:{symbol.replace('_', '')}"
            async with self.session.get(
                f"https://api.polygon.io/v2/snapshot/locale/global/markets/forex/tickers/{ticker}",
                params={"apiKey": self.api_key}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("ticker")
        except Exception:
            pass
        return None
