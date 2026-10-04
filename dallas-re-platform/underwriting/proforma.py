"""Ground-up development pro forma: sources & uses, stabilized NOI, levered returns.

Annual model:
    Year 0                 Close: land bought, loan and equity committed.
    Years 1..C             Construction (C = construction_years). No income. Interest on
                           the loan is funded from an interest reserve that is part of
                           total capitalization.
    Years C+1..C+H         Stabilized operations (H = hold_years). Cash flow = NOI - debt service.
    Year C+H               Sale at forward NOI / exit cap, less selling costs and loan payoff.

Simplifications to be aware of:
    * All equity is contributed at close (year 0), not drawn over construction.
    * The property is stabilized in its first operating year (no lease-up period).
    * Contingency applies to hard costs only.
    * Construction interest assumes the loan is drawn evenly (`avg_draw_pct` outstanding on average).

Run `python -m underwriting.proforma` for a sample Dallas multifamily deal.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

from underwriting import metrics


@dataclass
class ProFormaResult:
    # Sources & uses
    land_cost: float
    hard_costs: float
    soft_costs: float
    contingency: float
    construction_interest: float
    total_capitalization: float
    loan_amount: float
    required_equity: float
    # Operations
    noi: float  # stabilized year-1 NOI
    yield_on_cost: float
    annual_debt_service: float
    dscr: float | None
    # Exit
    exit_value: float
    net_sale_proceeds: float  # after selling costs and loan payoff
    # Returns
    levered_irr: float | None
    unlevered_irr: float | None
    equity_multiple: float
    profit: float
    levered_cash_flows: list[float] = field(repr=False)
    unlevered_cash_flows: list[float] = field(repr=False)

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        def pct(x: float | None) -> str:
            return "n/a" if x is None else f"{x:.2%}"

        rows = [
            ("Land acquisition", f"${self.land_cost:,.0f}"),
            ("Hard costs", f"${self.hard_costs:,.0f}"),
            ("Soft costs", f"${self.soft_costs:,.0f}"),
            ("Contingency", f"${self.contingency:,.0f}"),
            ("Construction interest", f"${self.construction_interest:,.0f}"),
            ("Total capitalization", f"${self.total_capitalization:,.0f}"),
            ("Loan amount", f"${self.loan_amount:,.0f}"),
            ("Required equity", f"${self.required_equity:,.0f}"),
            ("Stabilized NOI (yr 1)", f"${self.noi:,.0f}"),
            ("Yield on cost", pct(self.yield_on_cost)),
            ("Annual debt service", f"${self.annual_debt_service:,.0f}"),
            ("DSCR", "n/a" if self.dscr is None else f"{self.dscr:.2f}x"),
            ("Exit value", f"${self.exit_value:,.0f}"),
            ("Net sale proceeds", f"${self.net_sale_proceeds:,.0f}"),
            ("Unlevered IRR", pct(self.unlevered_irr)),
            ("Levered IRR", pct(self.levered_irr)),
            ("Equity multiple", f"{self.equity_multiple:.2f}x"),
            ("Profit", f"${self.profit:,.0f}"),
        ]
        width = max(len(label) for label, _ in rows)
        lines = [f"{label:<{width}}  {value:>14}" for label, value in rows]
        lines.append("Levered cash flows: " + ", ".join(f"{cf:,.0f}" for cf in self.levered_cash_flows))
        return "\n".join(lines)


@dataclass
class DevelopmentProForma:
    # --- Required: costs and financing -----------------------------------
    land_cost: float
    hard_costs: float
    soft_costs: float
    contingency_pct: float  # of hard costs, e.g. 0.05
    ltv: float  # loan-to-value, e.g. 0.65 (see ltv_basis)
    interest_rate: float  # annual, e.g. 0.07
    exit_cap_rate: float  # e.g. 0.055

    # --- Income: needed to compute NOI ------------------------------------
    gross_potential_rent: float = 0.0  # annual, at stabilization
    other_income: float = 0.0  # annual (parking, fees, ...)
    vacancy_rate: float = 0.05
    operating_expenses: float = 0.0  # annual, incl. taxes and insurance

    # --- Timeline and growth ---------------------------------------------
    construction_years: int = 2
    hold_years: int = 5  # years of stabilized operations before sale
    rent_growth: float = 0.03
    expense_growth: float = 0.03

    # --- Debt and exit details -------------------------------------------
    ltv_basis: Literal["cost", "value"] = "cost"  # "cost" = loan-to-cost on total capitalization
    amort_years: int | None = None  # None = interest-only
    avg_draw_pct: float = 0.5  # average share of the loan outstanding during construction
    selling_costs_pct: float = 0.02

    def __post_init__(self) -> None:
        for name in ("land_cost", "hard_costs", "soft_costs", "gross_potential_rent",
                     "other_income", "operating_expenses"):
            if getattr(self, name) < 0:
                raise ValueError(f"{name} cannot be negative")
        for name in ("contingency_pct", "vacancy_rate", "selling_costs_pct", "avg_draw_pct"):
            if not 0 <= getattr(self, name) < 1:
                raise ValueError(f"{name} must be in [0, 1)")
        if not 0 <= self.ltv < 1:
            raise ValueError("ltv must be in [0, 1)")
        if not 0 <= self.interest_rate < 1:
            raise ValueError("interest_rate must be in [0, 1)")
        if not 0 < self.exit_cap_rate < 1:
            raise ValueError("exit_cap_rate must be in (0, 1)")
        if self.construction_years < 0 or self.hold_years < 1:
            raise ValueError("construction_years must be >= 0 and hold_years >= 1")
        if self.ltv_basis not in ("cost", "value"):
            raise ValueError("ltv_basis must be 'cost' or 'value'")

    # ------------------------------------------------------------------ #
    # Operations
    # ------------------------------------------------------------------ #
    def noi(self, operating_year: int = 1) -> float:
        """NOI in a given operating year (1 = first stabilized year)."""
        g = operating_year - 1
        income = (self.gross_potential_rent + self.other_income) * (1 + self.rent_growth) ** g
        expenses = self.operating_expenses * (1 + self.expense_growth) ** g
        return metrics.net_operating_income(income, self.vacancy_rate, expenses)

    # ------------------------------------------------------------------ #
    # Sources & uses
    # ------------------------------------------------------------------ #
    @property
    def contingency(self) -> float:
        return self.hard_costs * self.contingency_pct

    @property
    def base_cost(self) -> float:
        """Total cost before construction interest."""
        return self.land_cost + self.hard_costs + self.soft_costs + self.contingency

    def _interest_factor(self) -> float:
        """Construction interest as a share of the loan amount."""
        return self.interest_rate * self.construction_years * self.avg_draw_pct

    def _capital_stack(self) -> tuple[float, float, float]:
        """Return (total_capitalization, loan_amount, construction_interest).

        Construction interest depends on the loan, and on a cost basis the loan
        depends on total cost, so solve: total = base + ltv * total * k.
        """
        k = self._interest_factor()
        if self.ltv_basis == "cost":
            total = self.base_cost / (1 - self.ltv * k)
            loan = self.ltv * total
        else:
            stabilized_value = max(self.noi(1), 0.0) / self.exit_cap_rate
            loan = self.ltv * stabilized_value
            # Never lend more than the project costs (that would mean negative equity).
            loan = min(loan, self.base_cost / (1 - k) if k < 1 else self.base_cost)
            total = self.base_cost + loan * k
        return total, loan, loan * k

    @property
    def total_capitalization(self) -> float:
        return self._capital_stack()[0]

    @property
    def loan_amount(self) -> float:
        return self._capital_stack()[1]

    @property
    def required_equity(self) -> float:
        total, loan, _ = self._capital_stack()
        return total - loan

    def annual_debt_service(self) -> float:
        loan = self.loan_amount
        if self.amort_years is None:
            return loan * self.interest_rate
        return metrics.annual_debt_service(loan, self.interest_rate, self.amort_years)

    # ------------------------------------------------------------------ #
    # Cash flows and returns
    # ------------------------------------------------------------------ #
    def exit_value(self) -> float:
        """Gross sale price: next year's NOI capped at the exit cap rate."""
        return self.noi(self.hold_years + 1) / self.exit_cap_rate

    def cash_flows(self) -> tuple[list[float], list[float]]:
        """(unlevered, levered) annual cash flows, year 0 through sale year."""
        total, loan, interest = self._capital_stack()
        equity = total - loan
        debt_service = self.annual_debt_service()
        sale = self.exit_value() * (1 - self.selling_costs_pct)
        payoff = metrics.loan_balance(loan, self.interest_rate, self.amort_years, self.hold_years)

        # Unlevered: all project costs at year 0 (construction interest excluded: no debt).
        unlevered = [-(total - interest)] + [0.0] * self.construction_years
        levered = [-equity] + [0.0] * self.construction_years
        for year in range(1, self.hold_years + 1):
            noi = self.noi(year)
            unlevered.append(noi)
            levered.append(noi - debt_service)
        unlevered[-1] += sale
        levered[-1] += sale - payoff
        return unlevered, levered

    def levered_irr(self) -> float | None:
        return metrics.irr(self.cash_flows()[1])

    def equity_multiple(self) -> float:
        levered = self.cash_flows()[1]
        equity = -levered[0]
        if equity <= 0:
            raise ValueError("required equity is zero; equity multiple is undefined")
        return sum(levered[1:]) / equity

    def run(self) -> ProFormaResult:
        total, loan, interest = self._capital_stack()
        unlevered, levered = self.cash_flows()
        noi = self.noi(1)
        ds = self.annual_debt_service()
        sale = self.exit_value()
        payoff = metrics.loan_balance(loan, self.interest_rate, self.amort_years, self.hold_years)
        equity = total - loan
        return ProFormaResult(
            land_cost=self.land_cost,
            hard_costs=self.hard_costs,
            soft_costs=self.soft_costs,
            contingency=self.contingency,
            construction_interest=interest,
            total_capitalization=total,
            loan_amount=loan,
            required_equity=equity,
            noi=noi,
            yield_on_cost=metrics.yield_on_cost(noi, total),
            annual_debt_service=ds,
            dscr=metrics.dscr(noi, ds) if ds > 0 else None,
            exit_value=sale,
            net_sale_proceeds=sale * (1 - self.selling_costs_pct) - payoff,
            levered_irr=metrics.irr(levered),
            unlevered_irr=metrics.irr(unlevered),
            equity_multiple=self.equity_multiple() if equity > 0 else float("nan"),
            profit=sum(levered),
            levered_cash_flows=levered,
            unlevered_cash_flows=unlevered,
        )


def sample_deal() -> DevelopmentProForma:
    """A 60-unit Dallas garden multifamily deal on a ~1.4-acre infill lot."""
    units = 60
    return DevelopmentProForma(
        land_cost=1_500_000,
        hard_costs=11_000_000,  # ~$183k / unit
        soft_costs=2_200_000,  # 20% of hard costs
        contingency_pct=0.05,
        ltv=0.65,
        interest_rate=0.07,
        exit_cap_rate=0.055,
        gross_potential_rent=units * 2_100 * 12,  # $2,100 / unit / month
        other_income=units * 75 * 12,
        vacancy_rate=0.05,
        operating_expenses=units * 7_500,  # $7,500 / unit / year incl. taxes
        construction_years=2,
        hold_years=5,
    )


def run_sample() -> ProFormaResult:
    """Underwrite the sample deal, print the summary, and sanity-check the results."""
    deal = sample_deal()
    result = deal.run()
    print(result.summary())

    assert abs(result.loan_amount + result.required_equity - result.total_capitalization) < 0.01
    assert abs(result.loan_amount / result.total_capitalization - deal.ltv) < 1e-9
    assert abs(metrics.npv(result.levered_irr, result.levered_cash_flows)) < 1.0
    assert result.equity_multiple > 1 and result.levered_irr > result.unlevered_irr > 0
    return result


if __name__ == "__main__":
    run_sample()
