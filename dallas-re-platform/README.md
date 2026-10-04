# Dallas Real Estate Development Platform

An AI-native platform for finding, analyzing, and underwriting development sites in Dallas, TX.

## Project structure

```
dallas-re-platform/
├── api/                 # FastAPI service
│   ├── main.py          # App entry point (/health)
│   └── routes/
│       └── underwriting.py   # POST /underwriting/quick
├── database/            # SQLAlchemy + PostgreSQL
│   ├── session.py       # Engine, session factory, declarative Base
│   ├── models.py        # ORM models (Parcel, ...)
│   └── init_db.py       # Create tables
├── scrapers/            # Data collection (DCAD parcels, permits, zoning, comps)
│   ├── base.py          # BaseScraper: fetch() -> DataFrame, saved to data/raw/
│   └── dallas_parcels.py
├── underwriting/        # Deal math: NOI, cap rate, yield on cost, DSCR
│   └── metrics.py
├── data/
│   ├── raw/             # Scraper output (git-ignored)
│   ├── processed/       # Cleaned / joined datasets (git-ignored)
│   └── external/        # Third-party downloads, shapefiles (git-ignored)
├── tests/
├── config.py            # Settings from environment variables
├── requirements.txt
└── .env.example
```

## Getting started

```bash
cd dallas-re-platform
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL

python -m database.init_db      # create tables (needs a running PostgreSQL)
uvicorn api.main:app --reload   # http://127.0.0.1:8000/docs
```

Example underwriting request:

```bash
curl -X POST http://127.0.0.1:8000/underwriting/quick \
  -H 'Content-Type: application/json' \
  -d '{"gross_income":1000000,"vacancy_rate":0.05,"operating_expenses":400000,
       "total_cost":8000000,"market_cap_rate":0.055,"loan_amount":5000000,
       "interest_rate":0.065,"amort_years":30}'
```

## Tests

```bash
pip install pytest
pytest
```
