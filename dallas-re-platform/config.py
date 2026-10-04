"""Shared settings, read from environment variables."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/dallas_re",
)
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
EXTERNAL_DIR = DATA_DIR / "external"

# Dallas, TX market defaults
MARKET_CITY = "Dallas"
MARKET_STATE = "TX"
MARKET_COUNTY = "Dallas County"
