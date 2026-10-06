# DFW Development Radar

Pulls municipal agenda PDFs (P&Z, City Council, MUD boards) and uses Claude to extract growth
signals: infrastructure and utility moves, zoning and density shifts, and major project proposals.
Each document produces a JSON record and a Markdown brief.

## Setup
```bash
pip install -r radar/requirements.txt
export ANTHROPIC_API_KEY=...
```

## Run
From the repo root:
```bash
# One or more agenda PDFs
python -m radar.run --municipality "Celina, TX" --url https://.../agenda.pdf

# Scan an agenda index page (CivicPlus AgendaCenter, Legistar, Granicus) for the latest PDFs
python -m radar.run --municipality "Celina, TX" --index-url https://www.celina-tx.com/AgendaCenter --limit 5

# Local files
python -m radar.run --municipality "Celina, TX" --pdf ./agenda.pdf
```

Output goes to `radar_output/` (change it with `--out`):
- `<city>_<meeting-date>_<hash>.json`: every signal with category, type, agenda item, location,
  parcels, acreage, applicant, current and requested zoning, status, page, a verbatim evidence
  quote, the strategic implication, and confidence.
- `<city>_<meeting-date>_<hash>.md`: the same signals as a brief, grouped by category.
- `seen.json`: SHA-256 hashes of documents already analyzed. Re-runs skip them, so the command
  is safe to schedule; pass `--force` to re-analyze.

A document that fails (not a PDF, over the API's 32 MB / 600 page limit, a network or API error)
is reported and skipped, and the run exits 1.

## How it works
| File | Role |
|---|---|
| `sources.py` | Downloads PDFs, checks size and page limits, finds agenda links on index pages |
| `schema.py` | Pydantic models for the structured output |
| `extract.py` | One Claude call per document |
| `run.py` | CLI, deduplication, JSON and Markdown output |

The whole PDF goes to Claude as a document block instead of pypdf-extracted text, so scanned
pages, tables and site maps are read too and nothing is cut off. The response is
constrained to the `AgendaReport` schema with `messages.parse`, and the system prompt is
cached across documents. Server-side refusal fallback is on: if a safety classifier declines
a document, the API retries it on a fallback model within the same call.

## Tests
```bash
python -m pytest radar
```
The tests mock the Claude client and the network.
