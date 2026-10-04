"""Find under-improved Dallas parcels from DCAD appraisal exports.

Inputs (in data/external/, from https://www.dallascad.org/DataProducts.aspx):
    ACCOUNT_APPRL_YEAR.CSV  land / improvement / total values      (required)
    ACCOUNT_INFO.CSV        situs address, zip, division code      (optional)
    LAND.CSV                land area and zoning, per land section (optional)
    parcel geometries       .shp / .gpkg / .geojson / .zip         (optional)

Pipeline:
    1. Clean the values and merge them with address, land and geometry data.
    2. Compute improvement-to-land value ratio = IMPR_VAL / LAND_VAL.
    3. Keep parcels with ratio < --max-ratio and lot size >= --min-lot-sqft.
    4. Write a CSV to data/processed/ (and optionally upsert into PostgreSQL).

DCAD column names vary between releases, so each field is matched against a
list of known aliases (case-insensitive). Add an alias below if a column is
not found.

Usage:
    python -m scrapers.dcad_ingest
    python -m scrapers.dcad_ingest --max-ratio 0.25 --min-lot-sqft 20000 --to-db
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import geopandas as gpd
import pandas as pd

from config import EXTERNAL_DIR, PROCESSED_DIR

log = logging.getLogger(__name__)

DEFAULT_MAX_RATIO = 0.30
DEFAULT_MIN_LOT_SQFT = 10_000.0
SQFT_PER_ACRE = 43_560.0

# NAD83 / Texas North Central (US survey feet): accurate areas for Dallas County.
AREA_CRS = "EPSG:2276"
LATLON_CRS = "EPSG:4326"

# DCAD account numbers are 17 characters, e.g. "00000776533000000".
ACCOUNT_NUM_WIDTH = 17

APPRAISAL_COLUMNS = {
    "account_num": ["ACCOUNT_NUM", "ACCT", "ACCOUNT"],
    "appraisal_year": ["APPRAISAL_YR", "APPRAISAL_YEAR", "TAX_YR"],
    "land_value": ["LAND_VAL", "LAND_VALUE", "CERT_LAND_VAL"],
    "improvement_value": ["IMPR_VAL", "IMPR_VALUE", "IMPROVEMENT_VAL", "CERT_IMPR_VAL"],
    "total_value": ["TOT_VAL", "TOTAL_VAL", "TOTAL_VALUE", "CERT_TOT_VAL"],
}
ACCOUNT_INFO_COLUMNS = {
    "account_num": ["ACCOUNT_NUM", "ACCT", "ACCOUNT"],
    "appraisal_year": ["APPRAISAL_YR", "APPRAISAL_YEAR"],
    "division": ["DIVISION_CD", "DIVISION"],
    "owner_name": ["OWNER_NAME1", "OWNER_NAME"],
    "street_num": ["STREET_NUM"],
    "street_name": ["FULL_STREET_NAME", "STREET_NAME"],
    "city": ["PROPERTY_CITY", "SITUS_CITY", "CITY"],
    "zip_code": ["PROPERTY_ZIPCODE", "PROPERTY_ZIP", "SITUS_ZIP", "ZIPCODE"],
    "gis_parcel_id": ["GIS_PARCEL_ID"],
}
LAND_COLUMNS = {
    "account_num": ["ACCOUNT_NUM", "ACCT", "ACCOUNT"],
    "appraisal_year": ["APPRAISAL_YR", "APPRAISAL_YEAR"],
    "zoning": ["ZONING", "ZONING_DESC"],
    "area_size": ["AREA_SIZE", "LAND_AREA", "AREA"],
    "area_unit": ["AREA_UOM_DESC", "AREA_UOM", "UOM_DESC"],
}
GEOMETRY_KEY_COLUMNS = {
    "account_num": ["ACCT", "ACCOUNT_NUM", "ACCOUNT", "PARCELID", "PARCEL_ID"],
    "gis_parcel_id": ["GIS_PARCEL_ID", "GIS_PARCEL", "GISPARCELID"],
}

# Output schema handed to the underwriting engine (and the `parcels` table).
OUTPUT_COLUMNS = [
    "account_num",
    "appraisal_year",
    "address",
    "city",
    "zip_code",
    "zoning",
    "division",
    "owner_name",
    "land_value",
    "improvement_value",
    "total_value",
    "impr_land_ratio",
    "lot_sqft",
    "lot_acres",
    "lot_size_source",
    "land_value_per_sqft",
    "latitude",
    "longitude",
]


# --------------------------------------------------------------------------- #
# Cleaning helpers
# --------------------------------------------------------------------------- #
def resolve_columns(available, aliases: dict[str, list[str]]) -> dict[str, str]:
    """Map canonical names to the actual column names present (case-insensitive)."""
    lookup = {str(c).strip().upper(): c for c in available}
    resolved = {}
    for canonical, candidates in aliases.items():
        for alias in candidates:
            if alias.upper() in lookup:
                resolved[canonical] = lookup[alias.upper()]
                break
    return resolved


def read_dcad_csv(path: Path, aliases: dict[str, list[str]], required: list[str]) -> pd.DataFrame:
    """Read only the needed columns of a DCAD CSV and rename them to canonical names."""
    header = pd.read_csv(path, nrows=0, encoding="latin-1").columns
    resolved = resolve_columns(header, aliases)
    missing = [c for c in required if c not in resolved]
    if missing:
        raise ValueError(
            f"{path.name}: missing columns {missing} "
            f"(looked for {[aliases[c] for c in missing]}; file has {list(header)})"
        )
    df = pd.read_csv(
        path,
        usecols=list(resolved.values()),
        dtype=str,
        encoding="latin-1",
        keep_default_na=False,
    )
    return df.rename(columns={v: k for k, v in resolved.items()})


def clean_account_num(s: pd.Series) -> pd.Series:
    """Strip whitespace and restore leading zeros lost when a tool stored the key as a number."""
    s = s.astype(str).str.strip().str.upper().str.replace(r"\.0$", "", regex=True)
    is_digits = s.str.fullmatch(r"\d+")
    return s.where(~is_digits, s.str.zfill(ACCOUNT_NUM_WIDTH))


def clean_money(s: pd.Series) -> pd.Series:
    """'$1,234.00' / ' 1234 ' / '' -> float (NaN when unparseable)."""
    cleaned = s.astype(str).str.replace(r"[$,\s]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce")


def clean_text(s: pd.Series) -> pd.Series:
    s = s.astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    return s.replace("", pd.NA)


def latest_year(df: pd.DataFrame) -> pd.DataFrame:
    """Keep each account's most recent appraisal year."""
    if "appraisal_year" not in df:
        return df
    df = df.assign(appraisal_year=pd.to_numeric(df["appraisal_year"], errors="coerce"))
    max_year = df.groupby("account_num")["appraisal_year"].transform("max")
    return df[(df["appraisal_year"] == max_year) | max_year.isna()]


def area_to_sqft(size: pd.Series, unit: pd.Series) -> pd.Series:
    """Convert DCAD land areas to square feet. Units other than sq ft / acres become NaN."""
    size = pd.to_numeric(size.astype(str).str.replace(",", ""), errors="coerce")
    unit = unit.astype(str).str.upper()
    factor = pd.Series(float("nan"), index=size.index)
    factor[unit.str.contains("ACRE")] = SQFT_PER_ACRE
    factor[unit.str.contains("SQ") | unit.str.contains("SF")] = 1.0
    return size * factor


# --------------------------------------------------------------------------- #
# Loaders
# --------------------------------------------------------------------------- #
def load_values(path: Path) -> pd.DataFrame:
    df = read_dcad_csv(path, APPRAISAL_COLUMNS, ["account_num", "land_value", "improvement_value"])
    df["account_num"] = clean_account_num(df["account_num"])
    for col in ("land_value", "improvement_value", "total_value"):
        if col in df:
            df[col] = clean_money(df[col])
    if "total_value" not in df:
        df["total_value"] = df["land_value"] + df["improvement_value"]

    # Missing improvement value on an account with a land value means no improvements.
    df["improvement_value"] = df["improvement_value"].fillna(0.0)

    df = latest_year(df)
    # A handful of accounts appear more than once in a year; keep the highest-value row.
    df = df.sort_values("total_value", ascending=False).drop_duplicates("account_num")
    return df.reset_index(drop=True)


def load_account_info(path: Path) -> pd.DataFrame:
    df = read_dcad_csv(path, ACCOUNT_INFO_COLUMNS, ["account_num"])
    df["account_num"] = clean_account_num(df["account_num"])
    df = latest_year(df).drop(columns="appraisal_year", errors="ignore")
    for col in df.columns.drop("account_num"):
        df[col] = clean_text(df[col])
    if "zip_code" in df:
        df["zip_code"] = df["zip_code"].str.extract(r"(\d{5})", expand=False)
    parts = [df[c] for c in ("street_num", "street_name") if c in df]
    if parts:
        df["address"] = (
            pd.concat(parts, axis=1).fillna("").agg(" ".join, axis=1).str.strip().replace("", pd.NA)
        )
    df = df.drop(columns=["street_num", "street_name"], errors="ignore")
    return df.drop_duplicates("account_num")


def load_land(path: Path) -> pd.DataFrame:
    """Sum land area across each account's land sections; zoning from the largest section."""
    df = read_dcad_csv(path, LAND_COLUMNS, ["account_num", "area_size", "area_unit"])
    df["account_num"] = clean_account_num(df["account_num"])
    df = latest_year(df)
    df["section_sqft"] = area_to_sqft(df["area_size"], df["area_unit"])

    lot = df.groupby("account_num", as_index=False)["section_sqft"].sum(min_count=1)
    lot = lot.rename(columns={"section_sqft": "land_sqft"})
    if "zoning" in df:
        df["zoning"] = clean_text(df["zoning"])
        zoning = (
            df.dropna(subset=["zoning"])
            .sort_values("section_sqft", ascending=False)
            .drop_duplicates("account_num")[["account_num", "zoning"]]
        )
        lot = lot.merge(zoning, on="account_num", how="left")
    return lot


def load_geometry(path: Path) -> pd.DataFrame:
    """Parcel polygons -> one row per key with polygon area (sq ft) and centroid lat/lon."""
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        raise ValueError(f"{path.name} has no CRS; cannot compute areas")
    keys = resolve_columns(gdf.columns, GEOMETRY_KEY_COLUMNS)
    if not keys:
        raise ValueError(
            f"{path.name}: no parcel key column found "
            f"(looked for {GEOMETRY_KEY_COLUMNS}; file has {list(gdf.columns)})"
        )
    key = "account_num" if "account_num" in keys else "gis_parcel_id"
    gdf = gdf.rename(columns={keys[key]: key})[[key, "geometry"]]
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    if key == "account_num":
        gdf[key] = clean_account_num(gdf[key])
    else:
        gdf[key] = clean_text(gdf[key])

    gdf = gdf.to_crs(AREA_CRS).dissolve(by=key, as_index=False)
    centroids = gdf.geometry.centroid.to_crs(LATLON_CRS)
    return pd.DataFrame(
        {
            key: gdf[key],
            "geom_sqft": gdf.geometry.area,
            "latitude": centroids.y.round(6),
            "longitude": centroids.x.round(6),
        }
    )


def find_geometry_file(directory: Path) -> Path | None:
    for pattern in ("*.gpkg", "*.shp", "*.geojson", "*parcel*.zip"):
        matches = sorted(directory.glob(pattern))
        if matches:
            return matches[0]
    return None


def find_file(directory: Path, name: str) -> Path | None:
    """Case-insensitive lookup (DCAD ships upper-case file names)."""
    for p in directory.iterdir() if directory.exists() else []:
        if p.name.upper() == name.upper():
            return p
    return None


# --------------------------------------------------------------------------- #
# Merge, ratio, filter
# --------------------------------------------------------------------------- #
def merge_sources(
    values: pd.DataFrame,
    info: pd.DataFrame | None = None,
    land: pd.DataFrame | None = None,
    geometry: pd.DataFrame | None = None,
) -> pd.DataFrame:
    df = values
    if info is not None:
        df = df.merge(info, on="account_num", how="left")
    if land is not None:
        df = df.merge(land, on="account_num", how="left")
    if geometry is not None:
        key = "account_num" if "account_num" in geometry else "gis_parcel_id"
        if key not in df:
            log.warning("Geometry is keyed by %s but ACCOUNT_INFO.CSV was not loaded; skipping", key)
        else:
            df = df.merge(geometry, on=key, how="left")

    # Lot size: DCAD's appraised land area first, polygon area as fallback.
    land_sqft = df["land_sqft"] if "land_sqft" in df else pd.Series(float("nan"), index=df.index)
    geom_sqft = df["geom_sqft"] if "geom_sqft" in df else pd.Series(float("nan"), index=df.index)
    df["lot_sqft"] = land_sqft.where(land_sqft > 0, geom_sqft)
    df["lot_size_source"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df.loc[land_sqft > 0, "lot_size_source"] = "dcad_land"
    df.loc[~(land_sqft > 0) & (geom_sqft > 0), "lot_size_source"] = "parcel_geometry"
    return df


def add_metrics(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "appraisal_year" in df:
        df["appraisal_year"] = df["appraisal_year"].astype("Int64")
    land = df["land_value"].where(df["land_value"] > 0)
    df["impr_land_ratio"] = (df["improvement_value"] / land).round(4)
    df["lot_acres"] = (df["lot_sqft"] / SQFT_PER_ACRE).round(4)
    df["land_value_per_sqft"] = (land / df["lot_sqft"].where(df["lot_sqft"] > 0)).round(2)
    df["lot_sqft"] = df["lot_sqft"].round(0)
    return df


def filter_candidates(
    df: pd.DataFrame,
    max_ratio: float = DEFAULT_MAX_RATIO,
    min_lot_sqft: float = DEFAULT_MIN_LOT_SQFT,
) -> pd.DataFrame:
    """Under-improved, development-sized land parcels, lowest ratio first."""
    mask = (
        (df["land_value"] > 0)
        & (df["impr_land_ratio"] < max_ratio)
        & (df["lot_sqft"] >= min_lot_sqft)
    )
    if "division" in df:
        # Business personal property (BPP) accounts carry no land.
        mask &= df["division"].fillna("").str.upper() != "BPP"
    out = df[mask].sort_values(["impr_land_ratio", "lot_sqft"], ascending=[True, False])
    return out.reindex(columns=OUTPUT_COLUMNS).reset_index(drop=True)


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
def write_to_db(df: pd.DataFrame) -> int:
    """Upsert candidates into the `parcels` table, keyed on account_num."""
    from sqlalchemy.dialects.postgresql import insert

    from database.models import Parcel
    from database.session import Base, engine

    Base.metadata.create_all(bind=engine, tables=[Parcel.__table__])
    table_cols = {c.name for c in Parcel.__table__.columns} - {"id", "updated_at"}
    subset = df[[c for c in df.columns if c in table_cols]]
    records = subset.astype(object).where(subset.notna(), None).to_dict("records")
    if not records:
        return 0
    with engine.begin() as conn:
        for start in range(0, len(records), 5_000):
            stmt = insert(Parcel.__table__).values(records[start : start + 5_000])
            stmt = stmt.on_conflict_do_update(
                index_elements=["account_num"],
                set_={c: stmt.excluded[c] for c in records[0] if c != "account_num"},
            )
            conn.execute(stmt)
    return len(records)


def run(
    external_dir: Path = EXTERNAL_DIR,
    out_path: Path = PROCESSED_DIR / "dcad_dev_candidates.csv",
    max_ratio: float = DEFAULT_MAX_RATIO,
    min_lot_sqft: float = DEFAULT_MIN_LOT_SQFT,
    geometry_path: Path | None = None,
    to_db: bool = False,
) -> pd.DataFrame:
    values_path = find_file(external_dir, "ACCOUNT_APPRL_YEAR.CSV")
    if values_path is None:
        raise FileNotFoundError(f"ACCOUNT_APPRL_YEAR.CSV not found in {external_dir}")

    values = load_values(values_path)
    log.info("Loaded values for %s accounts", f"{len(values):,}")

    info_path = find_file(external_dir, "ACCOUNT_INFO.CSV")
    info = load_account_info(info_path) if info_path else None

    land_path = find_file(external_dir, "LAND.CSV")
    land = load_land(land_path) if land_path else None

    geometry_path = geometry_path or find_geometry_file(external_dir)
    geometry = load_geometry(geometry_path) if geometry_path else None

    for name, frame in (("ACCOUNT_INFO.CSV", info), ("LAND.CSV", land), ("parcel geometry", geometry)):
        log.info("%s: %s", name, f"{len(frame):,} rows" if frame is not None else "not found, skipped")
    if land is None and geometry is None:
        log.warning("No LAND.CSV or parcel geometry: lot size unknown, nothing will pass the filter")

    merged = add_metrics(merge_sources(values, info, land, geometry))
    candidates = filter_candidates(merged, max_ratio=max_ratio, min_lot_sqft=min_lot_sqft)
    log.info(
        "%s of %s parcels have ratio < %.2f and lot >= %s sq ft",
        f"{len(candidates):,}", f"{len(merged):,}", max_ratio, f"{min_lot_sqft:,.0f}",
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    candidates.to_csv(out_path, index=False)
    log.info("Wrote %s", out_path)

    if to_db:
        log.info("Upserted %s rows into parcels", f"{write_to_db(candidates):,}")
    return candidates


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--external-dir", type=Path, default=EXTERNAL_DIR)
    parser.add_argument("--geometry", type=Path, help="Parcel geometry file (default: first match in --external-dir)")
    parser.add_argument("--out", type=Path, default=PROCESSED_DIR / "dcad_dev_candidates.csv")
    parser.add_argument("--max-ratio", type=float, default=DEFAULT_MAX_RATIO)
    parser.add_argument("--min-lot-sqft", type=float, default=DEFAULT_MIN_LOT_SQFT)
    parser.add_argument("--to-db", action="store_true", help="Also upsert results into PostgreSQL")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    run(
        external_dir=args.external_dir,
        out_path=args.out,
        max_ratio=args.max_ratio,
        min_lot_sqft=args.min_lot_sqft,
        geometry_path=args.geometry,
        to_db=args.to_db,
    )


if __name__ == "__main__":
    main()
