"""FastAPI entry point. Run with: uvicorn api.main:app --reload

    GET  /health               liveness check
    POST /underwrite           full development pro forma for a deal
    POST /sift-parcels         DCAD pipeline -> top under-improved parcels
    POST /underwriting/quick   quick stabilized-deal metrics
"""

from fastapi import FastAPI

from api.routes import parcels, proforma, underwriting
from config import MARKET_CITY, MARKET_STATE

app = FastAPI(
    title="Dallas Real Estate Development Platform",
    version="0.2.0",
)
app.include_router(proforma.router)
app.include_router(parcels.router)
app.include_router(underwriting.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "market": f"{MARKET_CITY}, {MARKET_STATE}"}
