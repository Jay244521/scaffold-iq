"""Structured output schema for growth signals extracted from P&Z documents."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal["infrastructure", "zoning", "project"]
ActionStatus = Literal[
    "proposed",
    "public_hearing",
    "tabled",
    "recommended_approval",
    "recommended_denial",
    "approved",
    "denied",
    "withdrawn",
    "unknown",
]
Confidence = Literal["high", "medium", "low"]


class Signal(BaseModel):
  category: Category = Field(
      description=(
          "infrastructure = water/sewer/road/MUD/bond items; zoning = rezoning,"
          " PD, SUP or density changes; project = specific commercial,"
          " industrial, residential or data center developments."
      )
  )
  signal_type: str = Field(
      description=(
          "Short label, e.g. 'MUD formation', 'sewer trunk extension',"
          " 'AG to PD rezoning', 'preliminary plat', 'data center'."
      )
  )
  title: str = Field(description="One-line summary of the agenda item.")
  agenda_item: Optional[str] = Field(
      description="Agenda item number or case number (e.g. 'ZC-2026-014')."
  )
  location: Optional[str] = Field(
      description="Address, intersection, survey/abstract or general area."
  )
  parcel_ids: list[str] = Field(
      description="Parcel, tract or CAD property IDs named in the document."
  )
  acreage: Optional[float] = Field(description="Total acreage if stated.")
  applicant: Optional[str] = Field(
      description="Applicant, owner, developer or engineer named."
  )
  current_zoning: Optional[str]
  requested_zoning: Optional[str]
  action_status: ActionStatus = Field(
      description="Where the item stands as of this document."
  )
  source_page: Optional[int] = Field(
      description="1-indexed PDF page where the item appears."
  )
  evidence: str = Field(
      description="Short verbatim quote from the document supporting this signal."
  )
  strategic_implication: str = Field(
      description="One or two sentences on what this means for land acquisition."
  )
  confidence: Confidence


class AgendaReport(BaseModel):
  meeting_body: Optional[str] = Field(
      description="e.g. 'Planning & Zoning Commission', 'City Council'."
  )
  meeting_date: Optional[str] = Field(description="ISO date (YYYY-MM-DD).")
  signals: list[Signal]
  notes: Optional[str] = Field(
      description="Anything material that didn't fit a signal, or why there are none."
  )
