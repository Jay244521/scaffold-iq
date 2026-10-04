"""SQLAlchemy engine and session setup."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_session() -> Iterator[Session]:
    """Yield a session and close it afterwards (usable as a FastAPI dependency)."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
