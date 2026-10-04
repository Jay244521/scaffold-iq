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

Example underwriting request:

```bash
curl -X POST http://127.0.0.1:8000/underwriting/quick \
  -H 'Content-Type: application/json' \
  -d '{"gross_income":1000000,"vacancy_rate":0.05,"operating_expenses":400000,
       "total_cost":8000000,"market_cap_rate":0.055,"loan_amount":5000000,
       "interest_rate":0.065,"amort_years":30}'
```

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
