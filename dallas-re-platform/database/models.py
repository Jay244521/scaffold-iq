"""ORM models for Dallas development sites."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database.session import Base


class Parcel(Base):
    """A DCAD account; columns match scrapers.dcad_ingest.OUTPUT_COLUMNS."""

    __tablename__ = "parcels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_num: Mapped[str] = mapped_column(String(32), unique=True, index=True)
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
    impr_land_ratio: Mapped[float | None] = mapped_column(Float, index=True)
    lot_sqft: Mapped[float | None] = mapped_column(Float)
    lot_acres: Mapped[float | None] = mapped_column(Float)
    lot_size_source: Mapped[str | None] = mapped_column(String(32))
    land_value_per_sqft: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
