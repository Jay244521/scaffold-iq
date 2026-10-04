"""POST /sift-parcels: run the DCAD ingest and return the top development candidates."""

import math

from fastapi import APIRouter, HTTPException, Query

from config import EXTERNAL_DIR, PROCESSED_DIR
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
) -> dict:
    """Re-run the DCAD pipeline on the files in data/external/ and return the best candidates.

    Candidates are ordered by lowest improvement-to-land ratio, then largest lot. The full
    filtered set is also written to data/processed/dcad_dev_candidates.csv.
    """
    try:
        candidates = dcad_ingest.run(
            external_dir=EXTERNAL_DIR,
            out_path=OUTPUT_CSV,
            max_ratio=max_ratio,
            min_lot_sqft=min_lot_sqft,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"{e}. Download the DCAD export into data/external/ first.",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Could not read DCAD files: {e}") from e

    if zip_code:
        candidates = candidates[candidates["zip_code"].isin(zip_code)]

    top = candidates.head(limit)
    return {
        "filters": {"max_ratio": max_ratio, "min_lot_sqft": min_lot_sqft, "zip_code": zip_code},
        "total_candidates": len(candidates),
        "returned": len(top),
        "output_csv": f"data/processed/{OUTPUT_CSV.name}",
        "candidates": [
            {k: _clean(v) for k, v in row.items()} for row in top.to_dict("records")
        ],
    }
