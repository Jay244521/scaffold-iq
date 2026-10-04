"""Dallas Central Appraisal District (DCAD) parcel data.

DCAD publishes bulk appraisal exports at https://www.dallascad.org/DataProducts.aspx.
Download the export to data/external/ and point this scraper at the CSV.
"""

from pathlib import Path

import pandas as pd

from config import EXTERNAL_DIR
from scrapers.base import BaseScraper


class DallasParcelScraper(BaseScraper):
    source = "dcad_parcels"

    def __init__(self, export_path: Path = EXTERNAL_DIR / "dcad_account_info.csv"):
        self.export_path = export_path

    def fetch(self) -> pd.DataFrame:
        df = pd.read_csv(self.export_path, dtype=str)
        df.columns = [c.strip().lower() for c in df.columns]
        return df
