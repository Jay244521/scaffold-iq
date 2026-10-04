"""FastAPI entry point. Run with: uvicorn api.main:app --reload"""

from fastapi import FastAPI

from api.routes import underwriting
from config import MARKET_CITY, MARKET_STATE

app = FastAPI(
    title="Dallas Real Estate Development Platform",
    version="0.1.0",
)
app.include_router(underwriting.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "market": f"{MARKET_CITY}, {MARKET_STATE}"}
