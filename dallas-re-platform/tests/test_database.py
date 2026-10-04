"""PostGIS persistence tests. They need a PostgreSQL server with PostGIS available and are
skipped otherwise. They use their own database (TEST_DATABASE_URL, default
postgresql+psycopg2://postgres:postgres@localhost:5432/dallas_re_test), created if missing.
"""

import os

import geopandas as gpd
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import box
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

import database.db as db
from api.main import app
from database.db import get_session
from database.models import Parcel, UnderwrittenDeal
from database.queries import query_parcels
from scrapers import dcad_ingest as ing

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/dallas_re_test"
)


def _ensure_database(url: str) -> None:
    """Create the test database if the server is reachable but the database is missing."""
    admin = create_engine(make_url(url).set(database="postgres"), isolation_level="AUTOCOMMIT",
                          connect_args={"connect_timeout": 3})
    name = make_url(url).database
    with admin.connect() as conn:
        if not conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name}):
            conn.execute(text(f'CREATE DATABASE "{name}"'))
    admin.dispose()


@pytest.fixture(scope="module")
def pg_engine():
    try:
        _ensure_database(TEST_DATABASE_URL)
        engine = create_engine(TEST_DATABASE_URL, connect_args={"connect_timeout": 3})
        db.init_db(engine)
    except Exception as e:  # no server, no PostGIS, no permissions
        pytest.skip(f"PostGIS not available: {e.__class__.__name__}")
    yield engine
    engine.dispose()


@pytest.fixture
def pg(pg_engine, monkeypatch):
    """Point the app's engine / sessions at the empty test database."""
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE underwritten_deals, parcels RESTART IDENTITY CASCADE"))
    monkeypatch.setattr(db, "engine", pg_engine)
    monkeypatch.setattr(db, "SessionLocal", sessionmaker(bind=pg_engine, expire_on_commit=False))
    yield pg_engine


@pytest.fixture
def with_geometry(external_dir):
    (external_dir / "LAND.CSV").unlink()
    gpd.GeoDataFrame(
        {"GIS_PARCEL_ID": ["G1", "G2"]},
        geometry=[box(2_490_000, 6_970_000, 2_490_100, 6_970_150),   # 15,000 sf
                  box(2_491_000, 6_971_000, 2_491_200, 6_971_100)],  # 20,000 sf
        crs=ing.AREA_CRS,
    ).to_file(external_dir / "parcels.gpkg")
    return external_dir


def test_schema_has_spatial_indexes(pg):
    with pg.connect() as conn:
        indexes = dict(conn.execute(text(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'parcels'")).all())
    gist = {name for name, ddl in indexes.items() if "USING gist" in ddl}
    assert {"idx_parcels_geom", "idx_parcels_centroid", "ix_parcels_centroid_geog"} <= gist


def test_ingest_upserts_parcels_with_geometry(pg, with_geometry, tmp_path):
    result = ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    assert len(result) == 2

    with pg.connect() as conn:
        rows = conn.execute(text(
            "SELECT account_num, ST_GeometryType(geom), ST_SRID(geom), "
            "ST_Area(ST_Transform(geom, 2276)) AS sqft, ST_X(centroid), ST_Y(centroid), latitude "
            "FROM parcels ORDER BY account_num")).all()
    assert [r[0] for r in rows] == ["00000000001000000", "00000000002000000"]
    first = rows[0]
    assert first[1:3] == ("ST_MultiPolygon", 4326)
    assert first.sqft == pytest.approx(15_000, rel=1e-3)
    assert first[5] == pytest.approx(first.latitude) and -97.2 < first[4] < -96.4

    # Re-running is an upsert: no duplicates, values refreshed.
    ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    with pg.connect() as conn:
        assert conn.scalar(text("SELECT count(*) FROM parcels")) == 2


def test_upsert_keeps_existing_polygon_when_run_has_none(pg, with_geometry, external_dir, tmp_path):
    ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    candidates = ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv")
    candidates.loc[:, "land_value"] = 999_999.0
    ing.write_to_db(candidates, geoms=None)
    with pg.connect() as conn:
        row = conn.execute(text("SELECT land_value, geom IS NOT NULL FROM parcels LIMIT 1")).one()
    assert float(row[0]) == 999_999 and row[1]


def test_query_parcels_filters_and_spatial(pg, with_geometry, tmp_path):
    result = ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    lat, lon = result.set_index("account_num").loc["00000000001000000", ["latitude", "longitude"]]

    with db.session_scope() as s:
        assert [p["account_num"] for p in query_parcels(s)] == ["00000000002000000", "00000000001000000"]
        assert len(query_parcels(s, max_ratio=0.1)) == 1
        assert len(query_parcels(s, min_lot_sqft=18_000)) == 1
        assert [p["zip_code"] for p in query_parcels(s, zip_codes=["75201"])] == ["75201"]
        assert len(query_parcels(s, bbox=(-97.2, 32.5, -96.4, 33.2))) == 2
        assert query_parcels(s, bbox=(-95.5, 29.5, -95.0, 30.0)) == []  # Houston

        near = query_parcels(s, near=(lat, lon), radius_m=50, include_geometry=True)
        assert [p["account_num"] for p in near] == ["00000000001000000"]
        assert near[0]["distance_m"] < 1
        assert near[0]["geometry"]["type"] == "MultiPolygon"


def test_parcels_endpoint(pg, with_geometry, tmp_path):
    ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    client = TestClient(app)
    body = client.get("/parcels", params={"bbox": "-97.2,32.5,-96.4,33.2", "limit": 1}).json()
    assert body["returned"] == 1 and body["parcels"][0]["account_num"] == "00000000002000000"
    assert client.get("/parcels", params={"lat": 32.7}).status_code == 422
    assert client.get("/parcels", params={"bbox": "1,2,3"}).status_code == 422


def test_underwritten_deal_round_trip(pg, with_geometry, tmp_path):
    from api.routes.proforma import UnderwriteRequest, underwrite

    ing.run(external_dir=with_geometry, out_path=tmp_path / "o.csv", to_db=True)
    example = UnderwriteRequest.model_config["json_schema_extra"]["example"]
    response = underwrite(UnderwriteRequest(**example))

    with db.session_scope() as s:
        parcel = s.scalars(select(Parcel).where(Parcel.account_num == "00000000001000000")).one()
        s.add(UnderwrittenDeal.from_response(response, parcel_id=parcel.id, name="Main St 60u"))

    with db.session_scope() as s:
        deal = s.scalars(select(UnderwrittenDeal)).one()
        assert deal.parcel.account_num == "00000000001000000"
        assert deal.levered_irr == pytest.approx(response["returns"]["levered_irr"])
        assert float(deal.total_capitalization) == pytest.approx(
            response["sources_and_uses"]["total_capitalization"])
        assert deal.inputs["units"] == 60 and len(deal.cash_flows) == 8
        assert s.scalar(select(func.count()).select_from(UnderwrittenDeal)
                        .where(UnderwrittenDeal.levered_irr > 0.1)) == 1


def test_parcels_endpoint_without_database(monkeypatch):
    dead = create_engine("postgresql+psycopg2://postgres:postgres@localhost:5999/none",
                         connect_args={"connect_timeout": 1})

    def broken_session():
        session = sessionmaker(bind=dead)()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = broken_session
    try:
        resp = TestClient(app).get("/parcels")
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 503
    assert "unavailable" in resp.json()["detail"]
