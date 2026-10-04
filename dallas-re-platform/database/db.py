"""SQLAlchemy engine, session management and schema setup for PostgreSQL + PostGIS.

    from database.db import session_scope
    with session_scope() as session:          # commits on success, rolls back on error
        session.add(...)

    @app.get(...)
    def route(session: Session = Depends(get_session)): ...   # FastAPI dependency

The engine is created on import but does not connect until first use, so importing this
module (and the models) works without a running database.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DATABASE_URL

log = logging.getLogger(__name__)

engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 5},  # fail fast when the DB is down (API / dashboard fallbacks)
)
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


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope: commit if the block succeeds, roll back if it raises."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db(bind: Engine = engine) -> None:
    """Enable PostGIS and create all tables and indexes (including GiST spatial indexes).

    Idempotent: safe to run on every deploy or before every ingest.
    """
    from database import models  # noqa: F401  (registers models on Base.metadata)

    with bind.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.create_all(bind=bind)


def check_connection(bind: Engine = engine) -> bool:
    """True if the database is reachable and has PostGIS installed."""
    try:
        with bind.connect() as conn:
            conn.execute(text("SELECT postgis_version()"))
        return True
    except SQLAlchemyError as e:  # unreachable, bad credentials, or PostGIS missing
        log.debug("Database check failed: %s", e)
        return False
