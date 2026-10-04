"""Backward-compatible alias for database.db (import from there in new code)."""

from database.db import Base, SessionLocal, engine, get_session, session_scope  # noqa: F401
