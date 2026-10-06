import json
from io import BytesIO
from types import SimpleNamespace
from unittest import mock

import pytest
from pypdf import PdfWriter

from radar import extract, run, sources
from radar.schema import AgendaReport, Signal


def make_pdf(pages: int = 2) -> bytes:
  writer = PdfWriter()
  for _ in range(pages):
    writer.add_blank_page(width=612, height=792)
  buf = BytesIO()
  writer.write(buf)
  return buf.getvalue()


SAMPLE_REPORT = AgendaReport(
    meeting_body="Planning & Zoning Commission",
    meeting_date="2026-09-15",
    signals=[
        Signal(
            category="zoning",
            signal_type="AG to PD rezoning",
            title="Rezone 212 acres at FM 455 and Preston Rd from AG to PD",
            agenda_item="ZC-2026-014",
            location="NE corner FM 455 & Preston Rd",
            parcel_ids=["R-1234-000-0010-1"],
            acreage=212.4,
            applicant="Example Land Partners LLC",
            current_zoning="AG",
            requested_zoning="PD (SF-7, MF-2, C-2)",
            action_status="public_hearing",
            source_page=3,
            evidence="request to rezone approximately 212.4 acres from AG",
            strategic_implication="Watch adjacent AG tracts along FM 455.",
            confidence="high",
        ),
        Signal(
            category="infrastructure",
            signal_type="MUD formation",
            title="Consent to creation of MUD No. 9",
            agenda_item="7",
            location=None,
            parcel_ids=[],
            acreage=None,
            applicant=None,
            current_zoning=None,
            requested_zoning=None,
            action_status="recommended_approval",
            source_page=5,
            evidence="consent to the creation of Municipal Utility District No. 9",
            strategic_implication="Utilities will reach the district within 24 months.",
            confidence="medium",
        ),
    ],
    notes=None,
)


def fake_client(report=SAMPLE_REPORT, stop_reason="end_turn"):
  response = SimpleNamespace(
      stop_reason=stop_reason, stop_details=None, parsed_output=report
  )
  client = mock.Mock()
  client.beta.messages.parse.return_value = response
  return client


def test_load_pdf_rejects_non_pdf():
  with pytest.raises(ValueError, match="not a PDF"):
    sources.load_pdf(b"<html>", "x")


def test_load_pdf_counts_pages():
  doc = sources.load_pdf(make_pdf(3), "agenda.pdf")
  assert doc.page_count == 3
  assert len(doc.sha256) == 64


def test_discover_agenda_links_civicplus_and_legistar():
  html = """
    <a href="/AgendaCenter/ViewFile/Agenda/_09152026-812">Agenda</a>
    <a href="/AgendaCenter/ViewFile/Agenda/_09152026-812">dup</a>
    <a href='https://city.legistar.com/View.ashx?M=A&amp;ID=1&amp;GUID=abc'>L</a>
    <a href="/files/staff-report.PDF">Report</a>
    <a href="/about">About</a>
  """
  with mock.patch.object(sources, "_get", return_value=SimpleNamespace(text=html)):
    links = sources.discover_agenda_links("https://www.example-tx.gov/AgendaCenter")
  assert links == [
      "https://www.example-tx.gov/AgendaCenter/ViewFile/Agenda/_09152026-812",
      "https://city.legistar.com/View.ashx?M=A&ID=1&GUID=abc",
      "https://www.example-tx.gov/files/staff-report.PDF",
  ]


def test_extract_sends_pdf_document_and_schema():
  client = fake_client()
  doc = sources.load_pdf(make_pdf(), "agenda.pdf")
  report = extract.extract_signals(doc, "Celina, TX", client=client)

  assert report is SAMPLE_REPORT
  kwargs = client.beta.messages.parse.call_args.kwargs
  assert kwargs["model"] == "claude-opus-5-5"
  assert kwargs["output_format"] is AgendaReport
  content = kwargs["messages"][0]["content"]
  assert content[0]["type"] == "document"
  assert content[0]["source"]["media_type"] == "application/pdf"
  assert "Celina, TX" in content[1]["text"]


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_extract_raises_on_bad_stop(stop_reason):
  doc = sources.load_pdf(make_pdf(), "agenda.pdf")
  with pytest.raises(extract.ExtractionError):
    extract.extract_signals(doc, "Celina, TX", client=fake_client(stop_reason=stop_reason))


def test_process_writes_outputs_and_skips_seen(tmp_path):
  doc = sources.load_pdf(make_pdf(), "agenda.pdf")
  seen = {}
  client = fake_client()

  assert run.process(doc, "Celina, TX", tmp_path, seen, force=False, client=client)
  assert not run.process(doc, "Celina, TX", tmp_path, seen, force=False, client=client)
  assert client.beta.messages.parse.call_count == 1

  stem = f"celina-tx_2026-09-15_{doc.sha256[:8]}"
  record = json.loads((tmp_path / f"{stem}.json").read_text())
  assert record["sha256"] == doc.sha256
  assert [s["category"] for s in record["signals"]] == ["zoning", "infrastructure"]

  md = (tmp_path / f"{stem}.md").read_text()
  assert "## Zoning & Density Shifts" in md
  assert "## Infrastructure & Utilities" in md
  assert "212.4 ac" in md
  assert "AG → PD (SF-7, MF-2, C-2)" in md


def test_main_continues_after_failure(tmp_path, capsys):
  bad = tmp_path / "bad.pdf"
  bad.write_bytes(b"not a pdf")
  good = tmp_path / "good.pdf"
  good.write_bytes(make_pdf())

  with mock.patch.object(run, "extract_signals", return_value=SAMPLE_REPORT):
    code = run.main([
        "--municipality", "Celina, TX",
        "--pdf", str(bad), "--pdf", str(good),
        "--out", str(tmp_path / "out"),
    ])

  assert code == 1
  assert "not a PDF" in capsys.readouterr().err
  assert len(json.loads((tmp_path / "out" / "seen.json").read_text())) == 1
