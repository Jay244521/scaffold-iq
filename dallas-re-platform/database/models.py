"""ORM models: DCAD parcels (with PostGIS geometry) and underwritten deals.

Spatial columns are stored in WGS84 (EPSG:4326). GeoAlchemy2 creates a GiST index on each
geometry column, so bounding-box and radius queries hit the index, e.g.:

    from geoalchemy2 import Geography
    from sqlalchemy import cast, func, select
    here = func.ST_SetSRID(func.ST_MakePoint(-96.797, 32.777), 4326)
    select(Parcel).where(
        func.ST_DWithin(cast(Parcel.centroid, Geography), cast(here, Geography), 1_600)  # metres
    )

database.queries.query_parcels wraps the common filters.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.db import Base

SRID = 4326


class Parcel(Base):
    """A DCAD account that passed the development-site sift.

    Attribute columns match scrapers.dcad_ingest.OUTPUT_COLUMNS; `geom` is the parcel
    polygon and `centroid` its centroid point (both EPSG:4326, GiST-indexed).
    """

    __tablename__ = "parcels"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    account_num: Mapped[str] = mapped_column(String(32), unique=True)
    appraisal_year: Mapped[int | None] = mapped_column(Integer)
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(64))
    zip_code: Mapped[str | None] = mapped_column(String(10), index=True)
    zoning: Mapped[str | None] = mapped_column(String(64))
    division: Mapped[str | None] = mapped_column(String(8))
    owner_name: Mapped[str | None] = mapped_column(String(255))

    land_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    improvement_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    total_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    impr_land_ratio: Mapped[float | None] = mapped_column(Float)
    lot_sqft: Mapped[float | None] = mapped_column(Float)
    lot_acres: Mapped[float | None] = mapped_column(Float)
    lot_size_source: Mapped[str | None] = mapped_column(String(32))
    land_value_per_sqft: Mapped[float | None] = mapped_column(Float)

    # Plain lat/lon kept for clients that don't speak PostGIS (dashboard, CSV export).
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    geom: Mapped[WKBElement | None] = mapped_column(
        Geometry("MULTIPOLYGON", srid=SRID, spatial_index=True)
    )
    centroid: Mapped[WKBElement | None] = mapped_column(
        Geometry("POINT", srid=SRID, spatial_index=True)
    )

    sifted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    deals: Mapped[list[UnderwrittenDeal]] = relationship(back_populates="parcel")

    __table_args__ = (
        # The sift's natural ordering and filter: lowest ratio, largest lot.
        Index("ix_parcels_ratio_lot", "impr_land_ratio", "lot_sqft"),
        # Geography index so metre-based radius searches (ST_DWithin) also use GiST.
        Index("ix_parcels_centroid_geog", text("(centroid::geography)"), postgresql_using="gist"),
    )

    def __repr__(self) -> str:
        return f"<Parcel {self.account_num} {self.address!r} ratio={self.impr_land_ratio}>"


class UnderwrittenDeal(Base):
    """One run of the development pro forma, optionally tied to a parcel.

    Headline outputs are typed columns so they can be filtered and sorted in SQL; the
    full POST /underwrite request and response are kept as JSONB for reproducibility.
    """

    __tablename__ = "underwritten_deals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    parcel_id: Mapped[int | None] = mapped_column(
        ForeignKey("parcels.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Key assumptions
    units: Mapped[int | None] = mapped_column(Integer)
    land_cost: Mapped[float | None] = mapped_column(Numeric(14, 2))
    hard_costs: Mapped[float | None] = mapped_column(Numeric(14, 2))
    soft_costs: Mapped[float | None] = mapped_column(Numeric(14, 2))
    ltv: Mapped[float | None] = mapped_column(Float)
    interest_rate: Mapped[float | None] = mapped_column(Float)
    exit_cap_rate: Mapped[float | None] = mapped_column(Float)

    # Sources & uses
    total_capitalization: Mapped[float | None] = mapped_column(Numeric(14, 2))
    loan_amount: Mapped[float | None] = mapped_column(Numeric(14, 2))
    required_equity: Mapped[float | None] = mapped_column(Numeric(14, 2))

    # Operations, exit and returns (NULL where the model returns n/a)
    noi: Mapped[float | None] = mapped_column(Numeric(14, 2))
    yield_on_cost: Mapped[float | None] = mapped_column(Float)
    development_spread: Mapped[float | None] = mapped_column(Float)
    dscr: Mapped[float | None] = mapped_column(Float)
    exit_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    levered_irr: Mapped[float | None] = mapped_column(Float, index=True)
    unlevered_irr: Mapped[float | None] = mapped_column(Float)
    equity_multiple: Mapped[float | None] = mapped_column(Float)
    profit: Mapped[float | None] = mapped_column(Numeric(14, 2))

    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB)
    cash_flows: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB)

    parcel: Mapped[Parcel | None] = relationship(back_populates="deals")

    @classmethod
    def from_response(
        cls, response: dict[str, Any], *, parcel_id: int | None = None, name: str | None = None
    ) -> UnderwrittenDeal:
        """Build a row from a POST /underwrite response (api.routes.proforma.underwrite)."""
        inputs = response["inputs"]
        su, ops = response["sources_and_uses"], response["operations"]
        ex, ret = response["exit"], response["returns"]
        return cls(
            parcel_id=parcel_id,
            name=name,
            units=inputs.get("units"),
            land_cost=inputs.get("land_cost"),
            hard_costs=inputs.get("hard_costs"),
            soft_costs=inputs.get("soft_costs"),
            ltv=inputs.get("loan", {}).get("ltv"),
            interest_rate=inputs.get("loan", {}).get("interest_rate"),
            exit_cap_rate=inputs.get("exit_cap_rate"),
            total_capitalization=su["total_capitalization"],
            loan_amount=su["loan_amount"],
            required_equity=su["required_equity"],
            noi=ops["noi"],
            yield_on_cost=ops["yield_on_cost"],
            development_spread=ops["development_spread"],
            dscr=ops["dscr"],
            exit_value=ex["exit_value"],
            levered_irr=ret["levered_irr"],
            unlevered_irr=ret["unlevered_irr"],
            equity_multiple=ret["equity_multiple"],
            profit=ret["profit"],
            inputs=inputs,
            cash_flows=response.get("cash_flows"),
            result=response,
        )

    def __repr__(self) -> str:
        return f"<UnderwrittenDeal {self.id} {self.name!r} irr={self.levered_irr}>"
