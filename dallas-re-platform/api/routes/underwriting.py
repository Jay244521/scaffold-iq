from fastapi import APIRouter
from pydantic import BaseModel, Field

from underwriting import metrics

router = APIRouter(prefix="/underwriting", tags=["underwriting"])


class DealInput(BaseModel):
    gross_income: float = Field(gt=0)
    vacancy_rate: float = Field(ge=0, lt=1)
    operating_expenses: float = Field(ge=0)
    total_cost: float = Field(gt=0)
    market_cap_rate: float = Field(gt=0, lt=1)
    loan_amount: float = Field(ge=0)
    interest_rate: float = Field(ge=0, lt=1)
    amort_years: int = Field(default=30, gt=0)


class DealOutput(BaseModel):
    noi: float
    yield_on_cost: float
    stabilized_value: float
    development_spread: float
    annual_debt_service: float
    dscr: float | None


@router.post("/quick", response_model=DealOutput)
def quick_underwrite(deal: DealInput) -> DealOutput:
    noi = metrics.net_operating_income(deal.gross_income, deal.vacancy_rate, deal.operating_expenses)
    yoc = metrics.yield_on_cost(noi, deal.total_cost)
    ds = metrics.annual_debt_service(deal.loan_amount, deal.interest_rate, deal.amort_years)
    return DealOutput(
        noi=round(noi, 2),
        yield_on_cost=round(yoc, 4),
        stabilized_value=round(noi / deal.market_cap_rate, 2),
        development_spread=round(metrics.development_spread(yoc, deal.market_cap_rate), 4),
        annual_debt_service=round(ds, 2),
        dscr=round(metrics.dscr(noi, ds), 2) if ds > 0 else None,
    )
