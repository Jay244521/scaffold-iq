"""Enable PostGIS and create all tables. Run with: python -m database.init_db"""

from database.db import init_db

if __name__ == "__main__":
    init_db()
    print("PostGIS enabled; tables and spatial indexes created.")
