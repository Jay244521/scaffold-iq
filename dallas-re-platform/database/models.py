"""ORM models for Dallas development sites."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database.session import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_num: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    address: Mapped[str | None] = mapped_column(String(255))
    zip_code: Mapped[str | None] = mapped_column(String(10), index=True)
    zoning: Mapped[str | None] = mapped_column(String(64))
    land_sqft: Mapped[float | None] = mapped_column(Float)
    appraised_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
