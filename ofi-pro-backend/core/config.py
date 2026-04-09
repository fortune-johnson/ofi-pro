# core/config.py
from dotenv import load_dotenv
import os

load_dotenv()


def _clean_env(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _clean_oanda_token(value: str) -> str:
    cleaned = _clean_env(value)
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()
    return cleaned

class Settings:
    OANDA_API_KEY: str = _clean_oanda_token(os.getenv("OANDA_API_KEY", ""))
    OANDA_ACCOUNT_ID: str = _clean_env(os.getenv("OANDA_ACCOUNT_ID", ""))
    OANDA_ENVIRONMENT: str = _clean_env(os.getenv("OANDA_ENVIRONMENT", "practice")).lower()
    
    TWELVEDATA_API_KEY: str = _clean_env(os.getenv("TWELVEDATA_API_KEY", ""))
    POLYGON_API_KEY: str = _clean_env(os.getenv("POLYGON_API_KEY", ""))
    CEREBRAS_API_KEY: str = _clean_env(os.getenv("CEREBRAS_API_KEY", ""))
    OPENROUTER_API_KEY: str = _clean_env(os.getenv("OPENROUTER_API_KEY", ""))
    GROQ_API_KEY: str = _clean_env(os.getenv("GROQ_API_KEY", ""))
    OPENAI_API_KEY: str = _clean_env(os.getenv("OPENAI_API_KEY", ""))
    
    DEBUG: bool = True

settings = Settings()
