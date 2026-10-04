"""Streamlit dashboard for the underwriting engine and DCAD parcel sifter.

Run with:  streamlit run app.py

By default it calls the FastAPI backend (API_URL, default http://127.0.0.1:8000). If the
backend is not reachable it runs the same route functions in-process, so results match.
"""

import os

import httpx
import pandas as pd
import pydeck as pdk
import streamlit as st
from fastapi import HTTPException
from pydantic import ValidationError

from api.routes import parcels as parcels_route
from api.routes.proforma import UnderwriteRequest, underwrite
from scrapers import dcad_ingest

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")
DALLAS_CENTER = (32.7767, -96.7970)  # downtown Dallas (lat, lon)
SAMPLE = UnderwriteRequest.model_config["json_schema_extra"]["example"]

st.set_page_config(page_title="Dallas RE Underwriting", page_icon="🏗️", layout="wide")


# --------------------------------------------------------------------------- #
# Formatting
# --------------------------------------------------------------------------- #
def usd(x: float | None) -> str:
    return "n/a" if x is None else f"${x:,.0f}"


def pct(x: float | None) -> str:
    return "n/a" if x is None else f"{x:.2%}"


def mult(x: float | None) -> str:
    return "n/a" if x is None else f"{x:.2f}x"


# --------------------------------------------------------------------------- #
# Backend calls (API first, in-process fallback)
# --------------------------------------------------------------------------- #
def api_available(base_url: str) -> bool:
    try:
        return httpx.get(f"{base_url}/health", timeout=2).status_code == 200
    except httpx.HTTPError:
        return False


def run_underwriting(payload: dict, use_api: bool, base_url: str) -> dict:
    """Return the /underwrite response. Raises ValueError with a readable message on bad input."""
    if use_api:
        resp = httpx.post(f"{base_url}/underwrite", json=payload, timeout=30)
        if resp.status_code == 422:
            raise ValueError(resp.json().get("detail"))
        resp.raise_for_status()
        return resp.json()
    try:
        return underwrite(UnderwriteRequest(**payload))
    except ValidationError as e:
        raise ValueError(e.errors()) from e
    except HTTPException as e:
        raise ValueError(e.detail) from e


def run_sift(params: dict, use_api: bool, base_url: str) -> dict:
    """Return the /sift-parcels response. Raises RuntimeError with the backend's message."""
    if use_api:
        resp = httpx.post(f"{base_url}/sift-parcels", params=params, timeout=600)
        if resp.status_code >= 400:
            raise RuntimeError(resp.json().get("detail", resp.text))
        return resp.json()
    try:
        return parcels_route.sift_parcels(**params)
    except HTTPException as e:
        raise RuntimeError(e.detail) from e


# --------------------------------------------------------------------------- #
# Sidebar: assumptions
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.header("Underwriting assumptions")

    st.subheader("Costs")
    land_cost = st.number_input("Land cost ($)", 0, value=SAMPLE["land_cost"], step=100_000)
    hard_costs = st.number_input("Hard costs ($)", 0, value=SAMPLE["hard_costs"], step=250_000)
    soft_costs = st.number_input("Soft costs ($)", 0, value=SAMPLE["soft_costs"], step=100_000)
    contingency_pct = st.slider("Contingency (% of hard)", 0.0, 20.0, 5.0, 0.5, format="%.1f%%") / 100

    st.subheader("Financing & exit")
    ltv = st.slider("Loan-to-cost (LTV)", 0.0, 90.0, 65.0, 1.0, format="%.0f%%") / 100
    interest_rate = st.slider("Interest rate", 0.0, 15.0, 7.0, 0.125, format="%.3f%%") / 100
    exit_cap_rate = st.slider("Exit cap rate", 3.0, 10.0, 5.5, 0.05, format="%.2f%%") / 100

    with st.expander("Revenue & timeline"):
        units = st.number_input("Units", 1, value=SAMPLE["units"], step=1)
        rent = st.number_input("Rent / unit / month ($)", 0, value=SAMPLE["rent_per_unit_month"], step=25)
        other = st.number_input(
            "Other income / unit / month ($)", 0, value=SAMPLE["other_income_per_unit_month"], step=5
        )
        opex = st.number_input("Opex / unit / year ($)", 0, value=SAMPLE["opex_per_unit_year"], step=100)
        vacancy = st.slider("Vacancy", 0.0, 25.0, 5.0, 0.5, format="%.1f%%") / 100
        construction_years = st.slider("Construction (years)", 0, 5, 2)
        hold_years = st.slider("Hold after stabilization (years)", 1, 15, 5)
        rent_growth = st.slider("Rent growth", -5.0, 10.0, 3.0, 0.25, format="%.2f%%") / 100
        expense_growth = st.slider("Expense growth", -5.0, 10.0, 3.0, 0.25, format="%.2f%%") / 100

    st.divider()
    st.subheader("Backend")
    base_url = st.text_input("API URL", API_URL).rstrip("/")
    api_up = api_available(base_url)
    use_api = st.toggle("Use backend API", value=api_up, disabled=not api_up)
    if api_up:
        st.caption(f"🟢 Connected to {base_url}")
    else:
        st.caption("🔴 API unreachable: using the local underwriting engine")

payload = {
    "land_cost": land_cost,
    "units": units,
    "hard_costs": hard_costs,
    "soft_costs": soft_costs,
    "contingency_pct": contingency_pct,
    "loan": {"ltv": ltv, "interest_rate": interest_rate},
    "exit_cap_rate": exit_cap_rate,
    "rent_per_unit_month": rent,
    "other_income_per_unit_month": other,
    "opex_per_unit_year": opex,
    "vacancy_rate": vacancy,
    "construction_years": construction_years,
    "hold_years": hold_years,
    "rent_growth": rent_growth,
    "expense_growth": expense_growth,
}

# --------------------------------------------------------------------------- #
# Main view: underwriting results
# --------------------------------------------------------------------------- #
st.title("Dallas Development Underwriting")
st.caption(
    f"{units} units · {construction_years}-yr build · {hold_years}-yr hold · "
    f"source: {'API ' + base_url if use_api else 'local engine'}"
)

try:
    result = run_underwriting(payload, use_api, base_url)
except ValueError as e:
    st.error(f"Could not underwrite this deal: {e}")
    st.stop()
except httpx.HTTPError as e:
    st.error(f"API request failed: {e}")
    st.stop()

su, ops, ret, ex = result["sources_and_uses"], result["operations"], result["returns"], result["exit"]

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Capitalization", usd(su["total_capitalization"]), f"{usd(result['per_unit']['total_cost'])} / unit",
          delta_color="off", delta_arrow="off", border=True)
c2.metric("Levered IRR", pct(ret["levered_irr"]), f"Unlevered {pct(ret['unlevered_irr'])}",
          delta_color="off", delta_arrow="off", border=True)
c3.metric("Equity Multiple", mult(ret["equity_multiple"]), f"Profit {usd(ret['profit'])}",
          delta_color="off", delta_arrow="off", border=True)
spread = ops["development_spread"]
c4.metric("Yield on Cost", pct(ops["yield_on_cost"]),
          None if spread is None else f"{spread * 10_000:+.0f} bps vs exit cap", border=True)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Required Equity", usd(su["required_equity"]), border=True)
c2.metric("Loan Amount", usd(su["loan_amount"]), border=True)
c3.metric("Stabilized NOI (yr 1)", usd(ops["noi"]), border=True)
c4.metric("DSCR", mult(ops["dscr"]), border=True)

tab_cf, tab_su = st.tabs(["Cash flows", "Sources & uses"])
with tab_cf:
    cf = pd.DataFrame(result["cash_flows"]).set_index("year")
    st.bar_chart(cf[["levered_cash_flow"]], height=240)
    st.dataframe(
        cf,
        width="stretch",
        column_config={
            c: st.column_config.NumberColumn(format="dollar")
            for c in ("noi", "debt_service", "unlevered_cash_flow", "levered_cash_flow")
        },
    )
with tab_su:
    uses = pd.DataFrame(
        {
            "Item": ["Land", "Hard costs", "Soft costs", "Contingency", "Construction interest",
                     "Total capitalization", "Loan", "Equity", "Exit value", "Net sale proceeds"],
            "Amount": [su["land_cost"], su["hard_costs"], su["soft_costs"], su["contingency"],
                       su["construction_interest"], su["total_capitalization"], su["loan_amount"],
                       su["required_equity"], ex["exit_value"], ex["net_sale_proceeds"]],
        }
    )
    st.dataframe(uses, hide_index=True, width="stretch",
                 column_config={"Amount": st.column_config.NumberColumn(format="dollar")})

# --------------------------------------------------------------------------- #
# Parcel candidates
# --------------------------------------------------------------------------- #
def ratio_color(ratio: float, max_ratio: float) -> list[int]:
    """Green (vacant / barely improved) through amber to red (near the ratio cutoff)."""
    t = 0.0 if max_ratio <= 0 or pd.isna(ratio) else min(max(ratio / max_ratio, 0.0), 1.0)
    if t < 0.5:  # green -> amber
        r, g, b = 26 + (245 - 26) * t * 2, 152 + (166 - 152) * t * 2, 80 - 45 * t * 2
    else:  # amber -> red
        r, g, b = 245 - (245 - 215) * (t - 0.5) * 2, 166 - (166 - 48) * (t - 0.5) * 2, 35 + (39 - 35) * (t - 0.5) * 2
    return [int(r), int(g), int(b), 200]


def parcel_map(candidates: pd.DataFrame) -> None:
    """Plot candidates on a pydeck map of Dallas, colored by improvement/land ratio."""
    if not {"latitude", "longitude"} <= set(candidates.columns):
        st.caption("No coordinates in this run. Add the DCAD parcel geometry file to `data/external/` to map parcels.")
        return
    points = candidates.dropna(subset=["latitude", "longitude"]).copy()
    unmapped = len(candidates) - len(points)
    if points.empty:
        st.caption("None of these parcels have coordinates. Add the DCAD parcel geometry file to `data/external/`.")
        return

    ratio = points.get("impr_land_ratio", pd.Series(float("nan"), index=points.index))
    acres = points.get("lot_acres", pd.Series(float("nan"), index=points.index))
    scale = ratio.max() if ratio.notna().any() else 0.0
    points["color"] = [ratio_color(r, scale) for r in ratio]
    # Dot area grows with lot size (in screen pixels, so it stays readable at any zoom).
    points["radius"] = 4 + 2.5 * acres.fillna(0).clip(upper=25) ** 0.5
    points["tip_address"] = points.get("address", pd.Series("", index=points.index)).fillna("Unknown address")
    points["tip_land"] = points.get("land_value", pd.Series(float("nan"), index=points.index)).map(
        lambda v: "n/a" if pd.isna(v) else f"${v:,.0f}")
    points["tip_ratio"] = ratio.map(lambda v: "n/a" if pd.isna(v) else f"{v:.3f}")
    points["tip_acres"] = acres.map(lambda v: "n/a" if pd.isna(v) else f"{v:.2f} ac")
    points["tip_zoning"] = points.get("zoning", pd.Series("", index=points.index)).fillna("n/a")
    cols = ["longitude", "latitude", "color", "radius",
            "tip_address", "tip_land", "tip_ratio", "tip_acres", "tip_zoning"]

    layer = pdk.Layer(
        "ScatterplotLayer",
        data=points[cols],
        get_position=["longitude", "latitude"],
        get_fill_color="color",
        get_radius="radius",
        radius_units='"pixels"',  # quoted: pydeck treats bare strings as JS expressions
        stroked=True,
        get_line_color=[255, 255, 255, 180],
        line_width_min_pixels=1,
        pickable=True,
        auto_highlight=True,
    )
    tooltip = {
        "html": "<b>{tip_address}</b><br/>Land value: {tip_land}<br/>"
                "Improvement / land: {tip_ratio}<br/>Lot: {tip_acres} · Zoning: {tip_zoning}",
        "style": {"fontSize": "12px"},
    }
    view = pdk.ViewState(latitude=DALLAS_CENTER[0], longitude=DALLAS_CENTER[1], zoom=10)
    st.pydeck_chart(pdk.Deck(layers=[layer], initial_view_state=view, tooltip=tooltip), height=480)

    note = f"🟢 low → 🔴 high improvement/land ratio (0–{scale:.2f}); dot size = lot size."
    if unmapped:
        note += f" {unmapped:,} parcel(s) without coordinates are listed below but not mapped."
    st.caption(note)


st.divider()
st.header("Sifted parcel candidates")
st.caption("Under-improved Dallas County parcels from the DCAD pipeline, lowest improvement/land ratio first.")

with st.form("sift_form"):
    f1, f2, f3, f4 = st.columns(4)
    max_ratio = f1.number_input("Max improvement / land", 0.01, 5.0, dcad_ingest.DEFAULT_MAX_RATIO, 0.05)
    min_lot = f2.number_input("Min lot (sq ft)", 0, value=int(dcad_ingest.DEFAULT_MIN_LOT_SQFT), step=1_000)
    zips = f3.text_input("ZIP codes (comma-separated)", placeholder="75215, 75210")
    limit = f4.number_input("Max rows", 1, 1000, 50)
    submitted = st.form_submit_button("Sift parcels")

if submitted:
    params = {"max_ratio": max_ratio, "min_lot_sqft": float(min_lot), "limit": int(limit),
              "zip_code": [z.strip() for z in zips.split(",") if z.strip()] or None}
    with st.spinner("Running DCAD pipeline (can take a while on full county files)..."):
        try:
            st.session_state["sift"] = run_sift(params, use_api, base_url)
            st.session_state.pop("sift_error", None)
        except (RuntimeError, httpx.HTTPError) as e:
            st.session_state["sift_error"] = str(e)
            st.session_state.pop("sift", None)

if "sift_error" in st.session_state:
    st.warning(st.session_state["sift_error"])

sift = st.session_state.get("sift")
if sift is not None:
    candidates = pd.DataFrame(sift["candidates"])
    st.write(f"Showing **{sift['returned']:,}** of **{sift['total_candidates']:,}** candidates.")
elif parcels_route.OUTPUT_CSV.exists():
    candidates = pd.read_csv(parcels_route.OUTPUT_CSV, dtype={"zip_code": str, "account_num": str})
    st.write(f"Showing the last saved run ({len(candidates):,} candidates). Click **Sift parcels** to refresh.")
else:
    candidates = None
    st.info("No parcel candidates yet. Download the DCAD export into `data/external/`, then click **Sift parcels**.")

if candidates is not None and not candidates.empty:
    parcel_map(candidates)
    st.dataframe(
        candidates,
        hide_index=True,
        width="stretch",
        column_config={
            "land_value": st.column_config.NumberColumn(format="dollar"),
            "improvement_value": st.column_config.NumberColumn(format="dollar"),
            "total_value": st.column_config.NumberColumn(format="dollar"),
            "land_value_per_sqft": st.column_config.NumberColumn(format="$%.2f"),
            "impr_land_ratio": st.column_config.NumberColumn(format="%.3f"),
            "lot_sqft": st.column_config.NumberColumn(format="localized"),
            "lot_acres": st.column_config.NumberColumn(format="%.2f"),
        },
    )
elif candidates is not None:
    st.info("No parcels matched these filters.")
