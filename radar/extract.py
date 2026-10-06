"""Sends an agenda PDF to Claude and returns structured growth signals."""

import base64

import anthropic

from radar.schema import AgendaReport
from radar.sources import AgendaDocument

MODEL = "claude-opus-5-5"

# Stable across every document so the prefix caches between runs.
SYSTEM_PROMPT = """\
You are the intelligence analyst for DevelopmentCo, a real estate development \
intelligence platform covering the Dallas-Fort Worth growth corridors.

You read municipal agendas, staff reports and minutes (Planning & Zoning \
Commission, City Council, MUD and utility boards) and extract the items that \
signal where land is about to change hands or entitlements are about to move.

Extract three kinds of signal:
1. infrastructure: water line or sewer trunk extensions, lift stations, \
Municipal Utility District (MUD) or PID formations and annexations, \
development agreements, road and thoroughfare expansions, bond or CIP \
approvals.
2. zoning: rezonings (especially out of Agricultural/AG or SF-1 into \
commercial, industrial, multifamily or Planned Development), SUPs, \
annexations, comprehensive plan or future land use amendments, plats.
3. project: named commercial, industrial, logistics, data center, \
multifamily or master-planned residential developments entering the pipeline.

Rules:
- One signal per agenda item. If an item carries both a rezoning and a named \
project, file it under the category that matters more for land acquisition \
and mention the other in strategic_implication.
- Skip routine business: minutes approval, proclamations, staff \
appointments, consent items with no land-use effect.
- Only use facts in the document. Leave a field null rather than guess; set \
confidence to low when the item is vague.
- evidence must be a short verbatim quote from the document.
- strategic_implication is for a land buyer: what is likely to happen \
nearby, and whether to move now, watch, or ignore.
- If the document has no qualifying items, return an empty signals list and \
say why in notes.
"""


class ExtractionError(RuntimeError):
  pass


def extract_signals(
    document: AgendaDocument,
    municipality: str,
    client: anthropic.Anthropic | None = None,
) -> AgendaReport:
  """Runs one Claude call over the full PDF and returns validated signals."""
  client = client or anthropic.Anthropic()
  pdf_b64 = base64.standard_b64encode(document.content).decode("ascii")

  response = client.beta.messages.parse(
      model=MODEL,
      max_tokens=16000,
      system=[{
          "type": "text",
          "text": SYSTEM_PROMPT,
          "cache_control": {"type": "ephemeral"},
      }],
      messages=[{
          "role": "user",
          "content": [
              {
                  "type": "document",
                  "source": {
                      "type": "base64",
                      "media_type": "application/pdf",
                      "data": pdf_b64,
                  },
              },
              {
                  "type": "text",
                  "text": (
                      f"Municipality: {municipality}\n"
                      f"Source: {document.source}\n\n"
                      "Extract the development signals from this document."
                  ),
              },
          ],
      }],
      output_config={"effort": "high"},
      output_format=AgendaReport,
      # On a safety-classifier decline, the API retries on a fallback model
      # inside the same call instead of returning an empty refusal.
      betas=["server-side-fallback-2026-07-01"],
      fallbacks="default",
  )

  if response.stop_reason == "refusal":
    raise ExtractionError(f"Claude declined {document.source}: {response.stop_details}")
  if response.stop_reason == "max_tokens":
    raise ExtractionError(f"Output for {document.source} hit max_tokens")
  if response.parsed_output is None:
    raise ExtractionError(f"No structured output for {document.source}")
  return response.parsed_output
