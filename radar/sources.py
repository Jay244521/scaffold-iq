"""Fetching agenda PDFs from municipal portals."""

import hashlib
import re
from dataclasses import dataclass
from io import BytesIO
from urllib.parse import urljoin

import requests
from pypdf import PdfReader

USER_AGENT = "DFW-Development-Radar/0.1 (+municipal agenda research)"

# Most DFW cities run CivicPlus (AgendaCenter / DocumentCenter), Legistar or
# Granicus. These patterns catch PDF links from all three index pages.
AGENDA_LINK_PATTERN = re.compile(
    r"""href=["']([^"']*(?:"""
    r"""/AgendaCenter/ViewFile/(?:Agenda|Minutes)/[^"']+"""
    r"""|/DocumentCenter/View/\d+[^"']*"""
    r"""|View\.ashx\?M=[AM][^"']*"""
    r"""|MetaViewer\.php\?[^"']+"""
    r"""|\.pdf(?:\?[^"']*)?"""
    r"""))["']""",
    re.IGNORECASE,
)

# The Messages API accepts PDFs up to 32 MB per request and 600 pages.
MAX_PDF_BYTES = 32 * 1024 * 1024
MAX_PDF_PAGES = 600


@dataclass
class AgendaDocument:
  source: str
  content: bytes
  page_count: int

  @property
  def sha256(self) -> str:
    return hashlib.sha256(self.content).hexdigest()


def _get(url: str) -> requests.Response:
  response = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
  response.raise_for_status()
  return response


def discover_agenda_links(index_url: str, limit: int = 10) -> list[str]:
  """Scrapes an agenda index page and returns absolute document URLs, in page order."""
  html = _get(index_url).text
  links = []
  for href in AGENDA_LINK_PATTERN.findall(html):
    url = urljoin(index_url, href.replace("&amp;", "&"))
    if url not in links:
      links.append(url)
  return links[:limit]


def load_pdf(content: bytes, source: str) -> AgendaDocument:
  """Validates PDF bytes and wraps them with their page count."""
  if not content.startswith(b"%PDF"):
    raise ValueError(f"{source} is not a PDF")
  if len(content) > MAX_PDF_BYTES:
    raise ValueError(f"{source} is {len(content) / 1e6:.1f} MB; the API limit is 32 MB")
  page_count = len(PdfReader(BytesIO(content)).pages)
  if page_count > MAX_PDF_PAGES:
    raise ValueError(f"{source} has {page_count} pages; the API limit is {MAX_PDF_PAGES}")
  return AgendaDocument(source=source, content=content, page_count=page_count)


def fetch_pdf(url: str) -> AgendaDocument:
  return load_pdf(_get(url).content, url)


def read_pdf(path: str) -> AgendaDocument:
  with open(path, "rb") as f:
    return load_pdf(f.read(), path)
