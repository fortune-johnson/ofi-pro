from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional, Tuple

import aiohttp

from core.config import settings

TaskType = Literal["fundamentals", "quant", "ea"]


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: str
    url: str
    model: str
    rpm_limit: int
    daily_limit: int
    tpm_limit: int
    priority: int
    headers: Dict[str, str]


class LLMRouter:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self._cache: Dict[str, Tuple[datetime, str]] = {}
        self._usage: Dict[str, Dict[str, object]] = {}
        self.providers = self._build_providers()

    def _build_providers(self) -> List[ProviderConfig]:
        providers: List[ProviderConfig] = []
        if settings.CEREBRAS_API_KEY:
            providers.append(
                ProviderConfig(
                    name="cerebras",
                    api_key=settings.CEREBRAS_API_KEY,
                    url="https://api.cerebras.ai/v1/chat/completions",
                    model="llama-3.3-70b",
                    rpm_limit=30,
                    daily_limit=14400,
                    tpm_limit=60000,
                    priority=1,
                    headers={"Authorization": f"Bearer {settings.CEREBRAS_API_KEY}", "Content-Type": "application/json"},
                )
            )
        if settings.OPENROUTER_API_KEY:
            providers.append(
                ProviderConfig(
                    name="openrouter",
                    api_key=settings.OPENROUTER_API_KEY,
                    url="https://openrouter.ai/api/v1/chat/completions",
                    model="google/gemma-3-27b-it",
                    rpm_limit=30,
                    daily_limit=14400,
                    tpm_limit=15000,
                    priority=2,
                    headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}", "Content-Type": "application/json"},
                )
            )
        if settings.GROQ_API_KEY:
            providers.append(
                ProviderConfig(
                    name="groq",
                    api_key=settings.GROQ_API_KEY,
                    url="https://api.groq.com/openai/v1/chat/completions",
                    model="llama-3.3-70b-versatile",
                    rpm_limit=16,
                    daily_limit=1000,
                    tpm_limit=12000,
                    priority=3,
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
                )
            )
        if settings.OPENAI_API_KEY:
            providers.append(
                ProviderConfig(
                    name="openai",
                    api_key=settings.OPENAI_API_KEY,
                    url="https://api.openai.com/v1/chat/completions",
                    model="gpt-oss-120b",
                    rpm_limit=10,
                    daily_limit=1000,
                    tpm_limit=8000,
                    priority=4,
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                )
            )
        return sorted(providers, key=lambda item: item.priority)

    def _estimate_tokens(self, text: str) -> int:
        return max(50, min(4000, int(len(text.split()) * 1.6)))

    def _provider_order(self, task: TaskType) -> List[ProviderConfig]:
        if task == "quant":
            preferred = ["cerebras", "groq", "openrouter", "openai"]
        elif task == "ea":
            preferred = ["groq", "cerebras", "openrouter", "openai"]
        else:
            preferred = ["openrouter", "cerebras", "groq", "openai"]
        rank = {name: index for index, name in enumerate(preferred)}
        return sorted(self.providers, key=lambda item: rank.get(item.name, 99))

    def _can_use_provider(self, provider: ProviderConfig, estimated_tokens: int) -> bool:
        now = datetime.now(timezone.utc)
        state = self._usage.setdefault(
            provider.name,
            {
                "minute_start": now,
                "day": now.date().isoformat(),
                "requests_this_minute": 0,
                "tokens_this_minute": 0,
                "requests_today": 0,
            },
        )

        minute_start = state["minute_start"]
        if isinstance(minute_start, datetime) and now - minute_start >= timedelta(minutes=1):
            state["minute_start"] = now
            state["requests_this_minute"] = 0
            state["tokens_this_minute"] = 0

        if state["day"] != now.date().isoformat():
            state["day"] = now.date().isoformat()
            state["requests_today"] = 0

        return bool(
            state["requests_this_minute"] < provider.rpm_limit
            and state["requests_today"] < provider.daily_limit
            and state["tokens_this_minute"] + estimated_tokens <= provider.tpm_limit
        )

    def _record_usage(self, provider: ProviderConfig, estimated_tokens: int) -> None:
        state = self._usage[provider.name]
        state["requests_this_minute"] = int(state["requests_this_minute"]) + 1
        state["tokens_this_minute"] = int(state["tokens_this_minute"]) + estimated_tokens
        state["requests_today"] = int(state["requests_today"]) + 1

    async def complete(
        self,
        cache_key: str,
        system_prompt: str,
        user_prompt: str,
        fallback: str,
        task: TaskType = "fundamentals",
        cache_minutes: int = 10,
        max_tokens: int = 350,
    ) -> str:
        cached = self._cache.get(cache_key)
        if cached and cached[0] > datetime.now(timezone.utc):
            return cached[1]

        estimated_tokens = self._estimate_tokens(system_prompt + "\n" + user_prompt) + max_tokens
        for provider in self._provider_order(task):
            if not self._can_use_provider(provider, estimated_tokens):
                continue
            text = await self._try_provider(provider, system_prompt, user_prompt, max_tokens)
            if text:
                self._record_usage(provider, estimated_tokens)
                self._cache[cache_key] = (datetime.now(timezone.utc) + timedelta(minutes=cache_minutes), text)
                return text

        self._cache[cache_key] = (datetime.now(timezone.utc) + timedelta(minutes=max(3, cache_minutes // 2)), fallback)
        return fallback

    async def _try_provider(
        self,
        provider: ProviderConfig,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
    ) -> Optional[str]:
        payload = {
            "model": provider.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        try:
            async with self.session.post(provider.url, headers=provider.headers, json=payload, timeout=20) as response:
                if response.status != 200:
                    return None
                data = await response.json()
                choices = data.get("choices") or []
                if not choices:
                    return None
                message = choices[0].get("message") or {}
                content = message.get("content")
                return content.strip() if isinstance(content, str) and content.strip() else None
        except Exception:
            return None
        return None
