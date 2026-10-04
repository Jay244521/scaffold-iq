"""Base class every scraper builds on."""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from config import RAW_DIR


class BaseScraper(ABC):
    """Fetch records from a source and save them to data/raw/."""

    #: Short source name, used for output file names (e.g. "dcad_parcels").
    source: str = "base"

    @abstractmethod
    def fetch(self) -> pd.DataFrame:
        """Pull records from the source and return them as a DataFrame."""

    def save(self, df: pd.DataFrame, out_dir: Path = RAW_DIR) -> Path:
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = out_dir / f"{self.source}_{stamp}.csv"
        df.to_csv(path, index=False)
        return path

    def run(self) -> Path:
        return self.save(self.fetch())
