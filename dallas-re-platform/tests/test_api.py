import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routes import parcels
from underwriting.proforma import sample_deal

client = TestClient(app)

DEAL = {
    "land_cost": 1_500_000,
    "units": 60,
    "hard_costs": 11_000_000,
    "soft_costs": 2_200_000,
    "contingency_pct": 0.05,
    "loan": {"ltv": 0.65, "interest_rate": 0.07},
    "exit_cap_rate": 0.055,
    "rent_per_unit_month": 2_100,
    "other_income_per_unit_month": 75,
    "opex_per_unit_year": 7_500,
}


def test_underwrite_matches_engine():
    resp = client.post("/underwrite", json=DEAL)
    assert resp.status_code == 200
    body = resp.json()
    expected = sample_deal().run()  # same deal as DEAL

    assert body["sources_and_uses"]["total_capitalization"] == pytest.approx(expected.total_capitalization, abs=0.01)
    assert body["sources_and_uses"]["loan_amount"] == pytest.approx(expected.loan_amount, abs=0.01)
    assert body["sources_and_uses"]["required_equity"] == pytest.approx(expected.required_equity, abs=0.01)
    assert body["operations"]["noi"] == pytest.approx(expected.noi, abs=0.01)
    assert body["returns"]["levered_irr"] == pytest.approx(expected.levered_irr, abs=1e-6)
    assert body["returns"]["equity_multiple"] == pytest.approx(expected.equity_multiple, abs=1e-6)
    assert body["per_unit"]["total_cost"] == pytest.approx(expected.total_capitalization / 60, abs=0.01)

    flows = body["cash_flows"]
    assert [f["phase"] for f in flows] == ["close", "construction", "construction"] + ["operations"] * 4 + [
        "operations + sale"
    ]
    assert [f["levered_cash_flow"] for f in flows] == pytest.approx(expected.levered_cash_flows, abs=0.01)


def test_underwrite_amortizing_value_basis():
    deal = {**DEAL, "loan": {"ltv": 0.6, "interest_rate": 0.065, "amort_years": 30, "ltv_basis": "value"}}
    body = client.post("/underwrite", json=deal).json()
    assert body["inputs"]["loan"]["amort_years"] == 30
    assert body["operations"]["dscr"] is not None


@pytest.mark.parametrize(
    "change",
    [{"units": 0}, {"land_cost": -1}, {"exit_cap_rate": 0}, {"loan": {"ltv": 1.5}}],
)
def test_underwrite_rejects_bad_input(change):
    assert client.post("/underwrite", json={**DEAL, **change}).status_code == 422


def test_underwrite_requires_income_inputs():
    deal = {k: v for k, v in DEAL.items() if k != "rent_per_unit_month"}
    assert client.post("/underwrite", json=deal).status_code == 422


@pytest.fixture
def dcad_api(external_dir, tmp_path, monkeypatch):
    monkeypatch.setattr(parcels, "EXTERNAL_DIR", external_dir)
    monkeypatch.setattr(parcels, "OUTPUT_CSV", tmp_path / "out" / "dcad_dev_candidates.csv")
    return tmp_path / "out" / "dcad_dev_candidates.csv"


def test_sift_parcels_returns_ranked_candidates(dcad_api):
    resp = client.post("/sift-parcels")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_candidates"] == 2
    ids = [c["account_num"] for c in body["candidates"]]
    assert ids == ["00000000002000000", "00000000001000000"]
    first = body["candidates"][1]
    assert first["impr_land_ratio"] == pytest.approx(0.2)
    assert first["latitude"] is None  # NaN serialized as null
    assert first["appraisal_year"] == 2025
    assert dcad_api.exists()


def test_sift_parcels_filters_and_limit(dcad_api):
    body = client.post("/sift-parcels", params={"min_lot_sqft": 15_000}).json()
    assert [c["account_num"] for c in body["candidates"]] == ["00000000002000000"]

    body = client.post("/sift-parcels", params={"zip_code": "75201"}).json()
    assert [c["zip_code"] for c in body["candidates"]] == ["75201"]

    body = client.post("/sift-parcels", params={"limit": 1}).json()
    assert body["returned"] == 1 and body["total_candidates"] == 2


def test_sift_parcels_without_data(tmp_path, monkeypatch):
    monkeypatch.setattr(parcels, "EXTERNAL_DIR", tmp_path / "empty")
    resp = client.post("/sift-parcels")
    assert resp.status_code == 503
    assert "ACCOUNT_APPRL_YEAR.CSV" in resp.json()["detail"]
