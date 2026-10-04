"""Create all tables. Run with: python -m database.init_db"""

from database import models  # noqa: F401  (registers models on Base.metadata)
from database.session import Base, engine


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Tables created.")
