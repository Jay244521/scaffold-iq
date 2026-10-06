"""DFW Development Radar CLI.

Examples:
  python -m radar.run --municipality "Celina, TX" --url https://.../agenda.pdf
  python -m radar.run --municipality "Celina, TX" --index-url https://.../AgendaCenter --limit 5
  python -m radar.run --municipality "Celina, TX" --pdf ./agenda.pdf
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import anthropic

from radar.extract import ExtractionError, extract_signals
from radar.schema import AgendaReport
from radar.sources import AgendaDocument, discover_agenda_links, fetch_pdf, read_pdf

CATEGORY_HEADINGS = {
    "infrastructure": "Infrastructure & Utilities",
    "zoning": "Zoning & Density Shifts",
    "project": "Major Project Proposals",
}


def slugify(text: str) -> str:
  return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def load_seen(path: Path) -> dict:
  return json.loads(path.read_text()) if path.exists() else {}


def render_markdown(report: AgendaReport, municipality: str, source: str) -> str:
  lines = [
      f"# {municipality} — {report.meeting_body or 'Municipal document'}"
      f" ({report.meeting_date or 'date unknown'})",
      "",
      f"Source: {source}",
      "",
  ]
  for category, heading in CATEGORY_HEADINGS.items():
    signals = [s for s in report.signals if s.category == category]
    if not signals:
      continue
    lines += [f"## {heading}", ""]
    for s in signals:
      lines.append(f"### {s.title}")
      facts = [
          ("Type", s.signal_type),
          ("Item", s.agenda_item),
          ("Status", s.action_status.replace("_", " ")),
          ("Location", s.location),
          ("Parcels", ", ".join(s.parcel_ids) or None),
          ("Acreage", f"{s.acreage:g} ac" if s.acreage is not None else None),
          ("Applicant", s.applicant),
          ("Zoning", f"{s.current_zoning or '?'} → {s.requested_zoning}"
           if s.requested_zoning else s.current_zoning),
          ("Page", s.source_page),
          ("Confidence", s.confidence),
      ]
      lines += [f"- **{k}:** {v}" for k, v in facts if v is not None]
      lines += [f"- **Evidence:** “{s.evidence}”", "", s.strategic_implication, ""]
  if not report.signals:
    lines += ["_No development signals found._", ""]
  if report.notes:
    lines += ["## Notes", "", report.notes, ""]
  return "\n".join(lines)


def process(
    document: AgendaDocument,
    municipality: str,
    out_dir: Path,
    seen: dict,
    force: bool,
    client=None,
) -> bool:
  """Extracts one document and writes its JSON and Markdown. Returns True if processed."""
  if document.sha256 in seen and not force:
    print(f"[=] Already processed: {document.source}")
    return False

  print(f"[*] Analyzing {document.source} ({document.page_count} pages)")
  report = extract_signals(document, municipality, client=client)

  stem = f"{slugify(municipality)}_{report.meeting_date or 'undated'}_{document.sha256[:8]}"
  record = {
      "municipality": municipality,
      "source": document.source,
      "sha256": document.sha256,
      "page_count": document.page_count,
      "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
      **report.model_dump(),
  }
  (out_dir / f"{stem}.json").write_text(json.dumps(record, indent=2))
  (out_dir / f"{stem}.md").write_text(render_markdown(report, municipality, document.source))
  seen[document.sha256] = {"source": document.source, "report": f"{stem}.json"}
  print(f"[+] {len(report.signals)} signals -> {out_dir / stem}.json")
  return True


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description="Extract growth signals from municipal agendas.")
  parser.add_argument("--municipality", required=True, help='e.g. "Celina, TX"')
  source = parser.add_mutually_exclusive_group(required=True)
  source.add_argument("--url", action="append", help="Agenda PDF URL (repeatable)")
  source.add_argument("--index-url", help="Agenda index page to scan for PDF links")
  source.add_argument("--pdf", action="append", help="Local PDF path (repeatable)")
  parser.add_argument("--limit", type=int, default=5, help="Max documents from --index-url")
  parser.add_argument("--out", default="radar_output", help="Output directory")
  parser.add_argument("--force", action="store_true", help="Re-analyze documents already seen")
  args = parser.parse_args(argv)

  out_dir = Path(args.out)
  out_dir.mkdir(parents=True, exist_ok=True)
  seen_path = out_dir / "seen.json"
  seen = load_seen(seen_path)

  if args.index_url:
    urls = discover_agenda_links(args.index_url, args.limit)
    print(f"[*] Found {len(urls)} documents on {args.index_url}")
  else:
    urls = args.url or []

  failures = 0
  for src in urls + (args.pdf or []):
    try:
      document = fetch_pdf(src) if src in urls else read_pdf(src)
      process(document, args.municipality, out_dir, seen, args.force)
    except (ExtractionError, anthropic.APIError, ValueError, OSError) as e:
      # requests.RequestException subclasses OSError.
      failures += 1
      print(f"[-] {src}: {e}", file=sys.stderr)
    finally:
      seen_path.write_text(json.dumps(seen, indent=2))

  return 1 if failures else 0


if __name__ == "__main__":
  sys.exit(main())
