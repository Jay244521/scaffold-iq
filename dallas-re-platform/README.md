# Dallas Real Estate Development Platform

An AI-native platform for finding, analyzing, and underwriting development sites in Dallas, TX.

## Project structure

```
dallas-re-platform/
├── api/                 # FastAPI service
│   ├── main.py          # App entry point (/health)
│   └── routes/
│       ├── proforma.py       # POST /underwrite
│       ├── parcels.py        # POST /sift-parcels, GET /parcels
│       └── underwriting.py   # POST /underwriting/quick
├── database/            # SQLAlchemy + PostgreSQL/PostGIS (GeoAlchemy2)
│   ├── db.py            # Engine, sessions (get_session, session_scope), init_db
│   ├── models.py        # Parcel (polygon + centroid), UnderwrittenDeal
│   ├── queries.py       # query_parcels: filters, bbox and radius search
│   └── init_db.py       # Enable PostGIS, create tables and spatial indexes
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
├── app.py               # Streamlit dashboard
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

python -m database.init_db      # enable PostGIS + create tables (needs PostgreSQL with PostGIS)
uvicorn api.main:app --reload   # http://127.0.0.1:8000/docs
```

## Dashboard

```bash
uvicorn api.main:app --reload   # optional: the dashboard falls back to the local engine
streamlit run app.py            # http://localhost:8501
```

`app.py` is a Streamlit front end: underwriting assumptions in the sidebar, key returns
(total capitalization, levered IRR, equity multiple, yield on cost) as metric cards, annual
cash flows, and sifted DCAD parcel candidates in a table plus an interactive pydeck map of
Dallas (colored by improvement/land ratio, sized by lot, with land-value tooltips). It calls the API at
`API_URL` (default `http://127.0.0.1:8000`) and runs the same route code in-process when the
API is down.

## API

| Endpoint | What it does |
|---|---|
| `GET /health` | Liveness check |
| `POST /underwrite` | Runs `DevelopmentProForma` and returns sources & uses, per-unit costs, operations, exit, returns and annual cash flows |
| `POST /sift-parcels` | Re-runs the DCAD pipeline on `data/external/` and returns the top candidates (`persist=true` also upserts them into PostGIS) |
| `GET /parcels` | Queries persisted candidates in PostGIS: `max_ratio`, `min_lot_sqft`, `zip_code`, `bbox`, `lat`+`lon`+`radius_m`, `include_geometry` |
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

# From PostGIS: within 1.5 km of downtown, nearest first, with GeoJSON polygons
curl 'http://127.0.0.1:8000/parcels?lat=32.7767&lon=-96.797&radius_m=1500&include_geometry=true'
curl 'http://127.0.0.1:8000/parcels?bbox=-96.83,32.73,-96.76,32.80&max_ratio=0.1'
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
python -m scrapers.dcad_ingest --no-db                           # CSV only, no database needed
```

By default the candidates are upserted into the PostGIS `parcels` table (keyed on
`account_num`; re-runs refresh values and `sifted_at`). Each row stores the parcel
polygon (`geom`, MultiPolygon) and centroid (`centroid`, Point), both EPSG:4326 with GiST
indexes, plus a geography index on the centroid for metre-based radius searches. A CSV
snapshot is also written to `data/processed/dcad_dev_candidates.csv`, sorted by lowest
improvement-to-land ratio, with these columns:
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

## Database

`database/models.py` defines two tables:

- `parcels`: one row per sifted DCAD account, with the attributes above plus `geom`, `centroid`, `sifted_at` and `updated_at`.
- `underwritten_deals`: pro forma runs. Key assumptions and outputs (total capitalization,
  loan, equity, NOI, yield on cost, DSCR, exit value, levered/unlevered IRR, equity multiple,
  profit) are typed columns; the full request, cash flows and response are JSONB. An optional
  `parcel_id` links a deal to its site.

```python
from database.db import session_scope
from database.models import UnderwrittenDeal
from database.queries import query_parcels

with session_scope() as s:                      # commits, or rolls back on error
    sites = query_parcels(s, near=(32.7767, -96.797), radius_m=2_000, max_ratio=0.1)
    s.add(UnderwrittenDeal.from_response(underwrite_response, parcel_id=..., name="Elm St 60u"))
```

There are no migrations yet: `init_db` only creates missing tables. If you created
`parcels` with an earlier version of this repo, drop it (or add the new columns) first.

## Tests

```bash
pip install pytest httpx
pytest
```

`tests/test_database.py` runs against `TEST_DATABASE_URL` (default
`postgresql+psycopg2://postgres:postgres@localhost:5432/dallas_re_test`, created if missing)
and is skipped when no PostGIS server is reachable.
