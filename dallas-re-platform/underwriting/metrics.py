"""Core real estate underwriting formulas."""


def net_operating_income(gross_income: float, vacancy_rate: float, operating_expenses: float) -> float:
    """NOI = effective gross income - operating expenses."""
    return gross_income * (1 - vacancy_rate) - operating_expenses


def cap_rate(noi: float, value: float) -> float:
    if value <= 0:
        raise ValueError("value must be positive")
    return noi / value


def yield_on_cost(noi: float, total_cost: float) -> float:
    if total_cost <= 0:
        raise ValueError("total_cost must be positive")
    return noi / total_cost


def annual_debt_service(loan_amount: float, annual_rate: float, amort_years: int) -> float:
    """Annual payment on a fully amortizing loan with monthly payments."""
    n = amort_years * 12
    r = annual_rate / 12
    if r == 0:
        return loan_amount / amort_years
    return loan_amount * r / (1 - (1 + r) ** -n) * 12


def dscr(noi: float, debt_service: float) -> float:
    if debt_service <= 0:
        raise ValueError("debt_service must be positive")
    return noi / debt_service


def development_spread(yoc: float, market_cap_rate: float) -> float:
    """Yield on cost minus market cap rate; positive spread suggests value creation."""
    return yoc - market_cap_rate
