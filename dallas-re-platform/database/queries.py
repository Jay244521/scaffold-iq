"""Read-side queries over the PostGIS tables, shared by the API and the dashboard."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import SRID, Parcel

# Columns returned for each parcel (everything but the raw geometries and bookkeeping).
PARCEL_FIELDS = [
    "account_num", "appraisal_year", "address", "city", "zip_code", "zoning", "division",
    "owner_name", "land_value", "improvement_value", "total_value", "impr_land_ratio",
    "lot_sqft", "lot_acres", "lot_size_source", "land_value_per_sqft", "latitude", "longitude",
]


def query_parcels(
    session: Session,
    *,
    max_ratio: float | None = None,
    min_lot_sqft: float | None = None,
    zip_codes: list[str] | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    near: tuple[float, float] | None = None,
    radius_m: float | None = None,
    include_geometry: bool = False,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Development candidates from the `parcels` table, lowest ratio / largest lot first.

    bbox:  (min_lon, min_lat, max_lon, max_lat), matched against the GiST-indexed centroid.
    near:  (lat, lon) with radius_m: parcels within that many metres, nearest first, with
           a `distance_m` field.
    include_geometry: add the parcel polygon as a GeoJSON dict under `geometry`.
    """
    columns = [getattr(Parcel, f) for f in PARCEL_FIELDS]
    stmt = select(*columns)

    if max_ratio is not None:
        stmt = stmt.where(Parcel.impr_land_ratio < float(max_ratio))
    if min_lot_sqft is not None:
        stmt = stmt.where(Parcel.lot_sqft >= float(min_lot_sqft))
    if zip_codes:
        stmt = stmt.where(Parcel.zip_code.in_([str(z) for z in zip_codes]))
    if bbox is not None:
        envelope = func.ST_MakeEnvelope(*(float(v) for v in bbox), SRID)
        stmt = stmt.where(Parcel.centroid.intersects(envelope))

    order = [Parcel.impr_land_ratio.asc().nulls_last(), Parcel.lot_sqft.desc().nulls_last()]
    if near is not None:
        if radius_m is None:
            raise ValueError("radius_m is required with near")
        lat, lon = float(near[0]), float(near[1])  # numpy floats don't bind in psycopg2
        here = func.geography(func.ST_SetSRID(func.ST_MakePoint(lon, lat), SRID))
        centroid = func.geography(Parcel.centroid)  # same expression as ix_parcels_centroid_geog
        distance = func.ST_Distance(centroid, here)
        stmt = stmt.add_columns(distance.label("distance_m")).where(
            func.ST_DWithin(centroid, here, float(radius_m))
        )
        order = [distance.asc()]

    if include_geometry:
        stmt = stmt.add_columns(func.ST_AsGeoJSON(Parcel.geom, 6).label("geometry"))

    rows = session.execute(stmt.order_by(*order).limit(limit)).mappings()
    out = []
    for row in rows:
        rec = {k: (float(v) if k in ("land_value", "improvement_value", "total_value") and v is not None else v)
               for k, v in row.items()}
        if "distance_m" in rec and rec["distance_m"] is not None:
            rec["distance_m"] = round(rec["distance_m"], 1)
        if include_geometry:
            rec["geometry"] = json.loads(rec["geometry"]) if rec["geometry"] else None
        out.append(rec)
    return out


def count_parcels(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Parcel)) or 0
