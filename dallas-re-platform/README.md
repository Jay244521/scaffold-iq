# Dallas Real Estate Development Platform

An AI-native platform for finding, analyzing, and underwriting development sites in Dallas, TX.

## Project structure

```
dallas-re-platform/
├── api/                 # FastAPI service
│   ├── main.py          # App entry point (/health)
│   └── routes/
│       ├── proforma.py       # POST /underwrite
│       ├── parcels.py        # POST /sift-parcels
│       └── underwriting.py   # POST /underwriting/quick
├── database/            # SQLAlchemy + PostgreSQL
│   ├── session.py       # Engine, session factory, declarative Base
│   ├── models.py        # ORM models (Parcel, ...)
│   └── init_db.py       # Create tables
├── scrapers/            # Data collection (DCAD parcels, permits, zoning, comps)
│   ├── base.py          # BaseScraper: fetch() -> DataFrame, saved to data/raw/
│   └── dcad_ingest.py   # DCAD exports -> under-improved development candidates
├── underwriting/        # Deal math
│   ├── metrics.py       # NOI, cap rate, yield on cost, DSCR, IRR, loan balance
│   └── proforma.py      # DevelopmentProForma: sources & uses, NOI, levered IRR, equity multiple
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

## API

| Endpoint | What it does |
|---|---|
| `GET /health` | Liveness check |
| `POST /underwrite` | Runs `DevelopmentProForma` and returns sources & uses, per-unit costs, operations, exit, returns and annual cash flows |
| `POST /sift-parcels` | Re-runs the DCAD pipeline on `data/external/` and returns the top candidates |
| `POST /underwriting/quick` | Quick metrics for a stabilized deal |

Interactive docs with request examples: http://127.0.0.1:8000/docs

```bash
curl -X POST http://127.0.0.1:8000/underwrite -H 'Content-Type: application/json' -d '{
  "land_cost": 1500000, "units": 60, "hard_costs": 11000000, "soft_costs": 2200000,
  "loan": {"ltv": 0.65, "interest_rate": 0.07, "amort_years": null, "ltv_basis": "cost"},
  "exit_cap_rate": 0.055,
  "rent_per_unit_month": 2100, "other_income_per_unit_month": 75, "opex_per_unit_year": 7500
}'

# Query params: max_ratio, min_lot_sqft, zip_code (repeatable), limit (default 50, max 1000)
curl -X POST 'http://127.0.0.1:8000/sift-parcels?max_ratio=0.25&min_lot_sqft=20000&zip_code=75215&limit=25'
```

`/underwrite` also accepts `contingency_pct`, `vacancy_rate`, `construction_years`,
`hold_years`, `rent_growth`, `expense_growth` and `selling_costs_pct` (defaults as in the
pro forma). `/sift-parcels` returns 503 until the DCAD export is in `data/external/`; each
call re-reads the full export, so expect it to take a while on the real county files.

## Finding development sites (DCAD ingest)

Download the current-year data files from
[DCAD Data Products](https://www.dallascad.org/DataProducts.aspx) into `data/external/`:

| File | Required | Used for |
|---|---|---|
| `ACCOUNT_APPRL_YEAR.CSV` | yes | land, improvement and total values |
| `ACCOUNT_INFO.CSV` | no | address, zip, owner, division (BPP accounts are excluded) |
| `LAND.CSV` | no | land area (summed across sections) and zoning |
| parcel geometry (`.gpkg`, `.shp`, `.geojson` or `*parcel*.zip`) | no | lot area fallback, centroid lat/lon |

Lot size comes from `LAND.CSV` when available, otherwise from the parcel polygon
area (computed in EPSG:2276). Geometry is joined on the account number, or on
`GIS_PARCEL_ID` through `ACCOUNT_INFO.CSV`.

```bash
python -m scrapers.dcad_ingest                                   # ratio < 0.30, lot >= 10,000 sf
python -m scrapers.dcad_ingest --max-ratio 0.25 --min-lot-sqft 20000
python -m scrapers.dcad_ingest --to-db                           # also upsert into the parcels table
```

Output: `data/processed/dcad_dev_candidates.csv`, sorted by lowest
improvement-to-land ratio, with columns matching the `parcels` table:
`account_num, appraisal_year, address, city, zip_code, zoning, division, owner_name,
land_value, improvement_value, total_value, impr_land_ratio, lot_sqft, lot_acres,
lot_size_source, land_value_per_sqft, latitude, longitude`.

## Development pro forma

```python
from underwriting.proforma import DevelopmentProForma

deal = DevelopmentProForma(
    land_cost=1_500_000, hard_costs=11_000_000, soft_costs=2_200_000,
    contingency_pct=0.05, ltv=0.65, interest_rate=0.07, exit_cap_rate=0.055,
    gross_potential_rent=1_512_000, operating_expenses=450_000,
)
result = deal.run()          # total_capitalization, required_equity, loan_amount, noi,
print(result.summary())      # levered_irr, equity_multiple, cash flows, ...
```

`python -m underwriting.proforma` runs a sample 60-unit Dallas multifamily deal.

The model is annual: equity in at close, `construction_years` with no income
(construction interest is capitalized into total cost), then `hold_years` of
stabilized NOI and a sale at forward NOI / exit cap. `ltv` applies to total
capitalization by default (loan-to-cost); set `ltv_basis="value"` to size the
loan on stabilized value instead. Contingency applies to hard costs.

## Tests

```bash
pip install pytest
pytest
```
