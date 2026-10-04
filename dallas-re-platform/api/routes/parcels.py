"""Development-site endpoints.

    POST /sift-parcels   re-run the DCAD ingest (optionally persisting to PostGIS)
    GET  /parcels        query persisted candidates from PostGIS (filters, bbox, radius)
"""

import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from config import EXTERNAL_DIR, PROCESSED_DIR
from database.db import get_session
from database.queries import query_parcels
from scrapers import dcad_ingest

router = APIRouter(tags=["parcels"])

OUTPUT_CSV = PROCESSED_DIR / "dcad_dev_candidates.csv"


def _clean(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is not None and not isinstance(value, (str, int, float, bool)):
        try:  # numpy / pandas scalars and NA
            return None if value != value else value.item()
        except (AttributeError, TypeError, ValueError):
            return None
    return value


@router.post("/sift-parcels")
def sift_parcels(
    max_ratio: float = Query(dcad_ingest.DEFAULT_MAX_RATIO, gt=0, le=5, description="Max improvement / land value"),
    min_lot_sqft: float = Query(dcad_ingest.DEFAULT_MIN_LOT_SQFT, ge=0),
    zip_code: list[str] | None = Query(None, description="Only these 5-digit zips (repeatable)"),
    limit: int = Query(50, ge=1, le=1000),
    persist: bool = Query(False, description="Also upsert the full candidate set into PostGIS"),
) -> dict:
    """Re-run the DCAD pipeline on the files in data/external/ and return the best candidates.

    Candidates are ordered by lowest improvement-to-land ratio, then largest lot. The full
    filtered set is also written to data/processed/dcad_dev_candidates.csv and, with
    `persist=true`, upserted into the `parcels` table.
    """
    try:
        candidates = dcad_ingest.run(
            external_dir=EXTERNAL_DIR,
            out_path=OUTPUT_CSV,
            max_ratio=max_ratio,
            min_lot_sqft=min_lot_sqft,
            to_db=persist,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"{e}. Download the DCAD export into data/external/ first.",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Could not read DCAD files: {e}") from e
    except SQLAlchemyError as e:
        raise HTTPException(status_code=503, detail=f"Could not save to the database: {e.__class__.__name__}") from e

    if zip_code:
        candidates = candidates[candidates["zip_code"].isin(zip_code)]

    top = candidates.head(limit)
    return {
        "filters": {"max_ratio": max_ratio, "min_lot_sqft": min_lot_sqft, "zip_code": zip_code},
        "total_candidates": len(candidates),
        "returned": len(top),
        "output_csv": f"data/processed/{OUTPUT_CSV.name}",
        "persisted": persist,
        "candidates": [
            {k: _clean(v) for k, v in row.items()} for row in top.to_dict("records")
        ],
    }


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    if bbox is None:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = (float(v) for v in bbox.split(","))
    except ValueError:
        raise HTTPException(422, "bbox must be 'min_lon,min_lat,max_lon,max_lat'") from None
    if min_lon >= max_lon or min_lat >= max_lat:
        raise HTTPException(422, "bbox minimums must be below maximums")
    return min_lon, min_lat, max_lon, max_lat


@router.get("/parcels")
def list_parcels(
    max_ratio: float | None = Query(None, gt=0, le=5, description="Max improvement / land value"),
    min_lot_sqft: float | None = Query(None, ge=0),
    zip_code: list[str] | None = Query(None, description="Only these 5-digit zips (repeatable)"),
    bbox: str | None = Query(None, description="min_lon,min_lat,max_lon,max_lat (WGS84)"),
    lat: float | None = Query(None, ge=-90, le=90, description="Radius search centre"),
    lon: float | None = Query(None, ge=-180, le=180),
    radius_m: float | None = Query(None, gt=0, le=100_000, description="Radius in metres (with lat/lon)"),
    include_geometry: bool = Query(False, description="Include parcel polygons as GeoJSON"),
    limit: int = Query(100, ge=1, le=5000),
    session: Session = Depends(get_session),
) -> dict:
    """Persisted development candidates from PostGIS (run the ingest with the DB enabled first).

    Ordered by lowest improvement-to-land ratio, then largest lot; radius searches are
    ordered nearest first and include `distance_m`. Spatial filters use GiST indexes.
    """
    if len({lat is None, lon is None, radius_m is None}) > 1:
        raise HTTPException(422, "lat, lon and radius_m must be given together")
    try:
        rows = query_parcels(
            session,
            max_ratio=max_ratio,
            min_lot_sqft=min_lot_sqft,
            zip_codes=zip_code,
            bbox=_parse_bbox(bbox),
            near=(lat, lon) if lat is not None else None,
            radius_m=radius_m,
            include_geometry=include_geometry,
            limit=limit,
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Parcel database unavailable ({e.__class__.__name__}). "
                   "Start PostGIS and run `python -m scrapers.dcad_ingest`.",
        ) from e
    # GeoJSON dicts pass through; scalars are cleaned of NaN / numpy types.
    parcels = [{k: v if k == "geometry" else _clean(v) for k, v in r.items()} for r in rows]
    return {"returned": len(parcels), "parcels": parcels}
