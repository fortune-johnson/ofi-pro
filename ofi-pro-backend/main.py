from contextlib import asynccontextmanager
from typing import List, Optional

import aiohttp
import uvicorn
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.config import settings
from services.market_data import MarketDataService
from services.orderflow.engines import AnalysisRunner
from services.trading_lab import (
    FundamentalsService,
    PricePredictionService,
    SUPPORTED_ASSETS,
    SUPPORTED_PREDICTION_TIMEFRAMES,
    TradingLabService,
)

# Global HTTP session
http_session: aiohttp.ClientSession = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_session
    http_session = aiohttp.ClientSession()
    yield
    await http_session.close()


app = FastAPI(title="OFI Pro API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your Vercel URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    pair: str
    timeframe: str = "M5"
    detailed: bool = False


class BacktestRequest(BaseModel):
    pair: str
    timeframe: str = "M5"
    days: int = 30
    strategyId: str = "ict_smc_engine"


class PredictionManualRequest(BaseModel):
    pair: str
    timeframe: str = "M5"
    level: float


class PredictionAutoRequest(BaseModel):
    timeframe: str = "M5"
    pairs: List[str] = SUPPORTED_ASSETS[:8]


class TrainModelsRequest(BaseModel):
    pairs: List[str] = SUPPORTED_ASSETS[:8]
    timeframes: List[str] = SUPPORTED_PREDICTION_TIMEFRAMES


class QuantSummaryRequest(BaseModel):
    pair: str
    timeframe: str = "M15"
    dayMode: str = "current"
    date: Optional[str] = None


class FundamentalsRequest(BaseModel):
    pair: str
    timeframe: str = "H1"


@app.get("/")
async def root():
    return {"message": "OFI Pro Backend is running successfully!"}


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    try:
        if not http_session:
            raise HTTPException(status_code=500, detail="HTTP session not initialized")

        analysis_payload, error = await AnalysisRunner.run_analysis(
            http_session, request.pair, request.timeframe, request.detailed
        )

        if error:
            status_code = 400
            if "OANDA API key is missing" in error or "OANDA rejected the API key" in error:
                status_code = 503
            elif "authorization failed" in error.lower():
                status_code = 503

            raise HTTPException(status_code=status_code, detail=error)

        return {
            "success": True,
            "pair": request.pair,
            "timeframe": request.timeframe,
            "detailed": request.detailed,
            "messages": analysis_payload["messages"],
            "summary": analysis_payload["summary"],
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/market-data/history")
async def market_data_history(
    pair: str = Query(...),
    timeframe: str = Query("M1"),
    count: int = Query(240, ge=60, le=400),
):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = MarketDataService(http_session)
    payload, error = await service.history(pair, timeframe, count)
    if error or not payload:
        status_code = 503 if "OANDA" in (error or "") or "authorization" in (error or "").lower() else 400
        raise HTTPException(status_code=status_code, detail=error or "Unable to load market data.")

    return payload


@app.websocket("/ws/market-data/{pair}")
async def market_data_stream(websocket: WebSocket, pair: str, timeframe: str = "M1"):
    await websocket.accept()

    if not http_session:
        await websocket.send_json({"type": "error", "detail": "HTTP session not initialized"})
        await websocket.close(code=1011)
        return

    service = MarketDataService(http_session)

    try:
        async for event in service.stream(pair, timeframe):
            await websocket.send_json(event)
            if event.get("type") == "error":
                await websocket.close(code=1011)
                return
    except WebSocketDisconnect:
        return
    except Exception as e:
        await websocket.send_json({"type": "error", "detail": f"Market stream failed: {e}"})
        await websocket.close(code=1011)
        return


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "environment": settings.OANDA_ENVIRONMENT,
        "oandaConfigured": bool(settings.OANDA_API_KEY),
    }


@app.get("/ea/signals")
async def ea_signals(
    timeframe: str = Query("M5"),
    strategyId: Optional[str] = Query(None),
    pair: Optional[str] = Query(None),
):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = TradingLabService(http_session)
    payload, error = await service.scan_signals(timeframe=timeframe, strategy_id=strategyId, asset=pair)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to scan EA signals.")
    return payload


@app.get("/ea/strategies")
async def ea_strategies():
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = TradingLabService(http_session)
    payload, error = await service.strategies()
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to load strategies.")
    return payload


@app.get("/ea/scoreboard")
async def ea_scoreboard(pair: str = Query("EUR_USD"), timeframe: str = Query("M15")):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = TradingLabService(http_session)
    payload, error = await service.scoreboard(pair, timeframe)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to load scoreboard.")
    return payload


@app.post("/ea/backtest")
async def ea_backtest(request: BacktestRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = TradingLabService(http_session)
    payload, error = await service.backtest(request.pair, request.timeframe, request.days, request.strategyId)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to run EA backtest.")
    return payload


@app.post("/ai/manual")
async def ai_manual(request: PredictionManualRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = PricePredictionService(http_session)
    payload, error = await service.manual_forecast(request.pair, request.timeframe, request.level)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to generate manual AI forecast.")
    return payload


@app.post("/ai/automatic")
async def ai_automatic(request: PredictionAutoRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = PricePredictionService(http_session)
    payload, error = await service.auto_forecast(request.pairs, request.timeframe)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to generate automatic AI forecast.")
    return payload


@app.post("/ai/train")
async def ai_train(request: TrainModelsRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = PricePredictionService(http_session)
    payload, error = await service.train_models(request.pairs, request.timeframes)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to train AI models.")
    return payload


@app.get("/ai/previous-calls")
async def ai_previous_calls(pair: Optional[str] = Query(None), timeframe: Optional[str] = Query(None)):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = PricePredictionService(http_session)
    payload, error = await service.previous_calls(pair, timeframe)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to load previous calls.")
    return payload


@app.post("/ai/summary")
async def ai_summary(request: QuantSummaryRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = PricePredictionService(http_session)
    payload, error = await service.summarize_day(request.pair, request.timeframe, request.dayMode, request.date)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to summarize that day.")
    return payload


@app.post("/fundamentals/analyze")
async def fundamentals_analyze(request: FundamentalsRequest):
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = FundamentalsService(http_session)
    payload, error = await service.analyze(request.pair, request.timeframe)
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to build fundamentals brief.")
    return payload


@app.post("/fundamentals/retrain")
async def fundamentals_retrain():
    if not http_session:
        raise HTTPException(status_code=500, detail="HTTP session not initialized")

    service = FundamentalsService(http_session)
    payload, error = await service.retrain()
    if error or not payload:
        raise HTTPException(status_code=400, detail=error or "Unable to retrain fundamentals AI.")
    return payload




if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
