"""POST /underwrite: run DevelopmentProForma on a deal and return the full breakdown."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from underwriting.proforma import DevelopmentProForma, ProFormaResult

router = APIRouter(tags=["underwriting"])


class LoanTerms(BaseModel):
    ltv: float = Field(0.65, ge=0, lt=1, description="Loan-to-value (on cost by default)")
    interest_rate: float = Field(0.07, ge=0, lt=1)
    amort_years: int | None = Field(None, gt=0, description="None = interest-only")
    ltv_basis: Literal["cost", "value"] = "cost"


class UnderwriteRequest(BaseModel):
    land_cost: float = Field(ge=0)
    units: int = Field(gt=0)
    hard_costs: float = Field(ge=0, description="Total hard costs ($)")
    soft_costs: float = Field(ge=0, description="Total soft costs ($)")
    contingency_pct: float = Field(0.05, ge=0, lt=1, description="Share of hard costs")
    loan: LoanTerms = LoanTerms()
    exit_cap_rate: float = Field(0.055, gt=0, lt=1)

    rent_per_unit_month: float = Field(ge=0)
    other_income_per_unit_month: float = Field(0, ge=0)
    opex_per_unit_year: float = Field(ge=0, description="Incl. property taxes and insurance")
    vacancy_rate: float = Field(0.05, ge=0, lt=1)

    construction_years: int = Field(2, ge=0, le=10)
    hold_years: int = Field(5, ge=1, le=30)
    rent_growth: float = Field(0.03, gt=-1, lt=1)
    expense_growth: float = Field(0.03, gt=-1, lt=1)
    selling_costs_pct: float = Field(0.02, ge=0, lt=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "land_cost": 1_500_000,
                "units": 60,
                "hard_costs": 11_000_000,
                "soft_costs": 2_200_000,
                "contingency_pct": 0.05,
                "loan": {"ltv": 0.65, "interest_rate": 0.07},
                "exit_cap_rate": 0.055,
                "rent_per_unit_month": 2_100,
                "other_income_per_unit_month": 75,
                "opex_per_unit_year": 7_500,
            }
        }
    }

    def to_proforma(self) -> DevelopmentProForma:
        return DevelopmentProForma(
            land_cost=self.land_cost,
            hard_costs=self.hard_costs,
            soft_costs=self.soft_costs,
            contingency_pct=self.contingency_pct,
            ltv=self.loan.ltv,
            interest_rate=self.loan.interest_rate,
            exit_cap_rate=self.exit_cap_rate,
            gross_potential_rent=self.units * self.rent_per_unit_month * 12,
            other_income=self.units * self.other_income_per_unit_month * 12,
            vacancy_rate=self.vacancy_rate,
            operating_expenses=self.units * self.opex_per_unit_year,
            construction_years=self.construction_years,
            hold_years=self.hold_years,
            rent_growth=self.rent_growth,
            expense_growth=self.expense_growth,
            ltv_basis=self.loan.ltv_basis,
            amort_years=self.loan.amort_years,
            selling_costs_pct=self.selling_costs_pct,
        )


def _finite(x: float | None) -> float | None:
    """JSON has no NaN/inf; send null instead."""
    return None if x is None or x != x or x in (float("inf"), float("-inf")) else round(x, 6)


def _cash_flow_table(deal: DevelopmentProForma, r: ProFormaResult) -> list[dict]:
    rows = []
    for year, (unlev, lev) in enumerate(zip(r.unlevered_cash_flows, r.levered_cash_flows)):
        op_year = year - deal.construction_years
        if year == 0:
            phase, noi = "close", 0.0
        elif op_year <= 0:
            phase, noi = "construction", 0.0
        else:
            phase, noi = "operations", deal.noi(op_year)
        is_sale = year == len(r.levered_cash_flows) - 1
        rows.append(
            {
                "year": year,
                "phase": "operations + sale" if is_sale and phase == "operations" else phase,
                "noi": round(noi, 2),
                "debt_service": round(r.annual_debt_service, 2) if op_year > 0 else 0.0,
                "unlevered_cash_flow": round(unlev, 2),
                "levered_cash_flow": round(lev, 2),
            }
        )
    return rows


@router.post("/underwrite")
def underwrite(req: UnderwriteRequest) -> dict:
    try:
        deal = req.to_proforma()
        r = deal.run()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    per_unit = lambda x: round(x / req.units, 2)  # noqa: E731
    return {
        "sources_and_uses": {
            "land_cost": round(r.land_cost, 2),
            "hard_costs": round(r.hard_costs, 2),
            "soft_costs": round(r.soft_costs, 2),
            "contingency": round(r.contingency, 2),
            "construction_interest": round(r.construction_interest, 2),
            "total_capitalization": round(r.total_capitalization, 2),
            "loan_amount": round(r.loan_amount, 2),
            "required_equity": round(r.required_equity, 2),
            "ltv_on_total_cost": _finite(r.loan_amount / r.total_capitalization),
        },
        "per_unit": {
            "total_cost": per_unit(r.total_capitalization),
            "land_cost": per_unit(r.land_cost),
            "hard_costs": per_unit(r.hard_costs),
            "equity": per_unit(r.required_equity),
            "noi": per_unit(r.noi),
        },
        "operations": {
            "gross_potential_rent": round(deal.gross_potential_rent, 2),
            "other_income": round(deal.other_income, 2),
            "operating_expenses": round(deal.operating_expenses, 2),
            "noi": round(r.noi, 2),
            "yield_on_cost": _finite(r.yield_on_cost),
            "development_spread": _finite(r.yield_on_cost - req.exit_cap_rate),
            "annual_debt_service": round(r.annual_debt_service, 2),
            "dscr": _finite(r.dscr),
        },
        "exit": {
            "exit_value": round(r.exit_value, 2),
            "net_sale_proceeds": round(r.net_sale_proceeds, 2),
        },
        "returns": {
            "levered_irr": _finite(r.levered_irr),
            "unlevered_irr": _finite(r.unlevered_irr),
            "equity_multiple": _finite(r.equity_multiple),
            "profit": round(r.profit, 2),
        },
        "cash_flows": _cash_flow_table(deal, r),
        "inputs": req.model_dump(),
    }
