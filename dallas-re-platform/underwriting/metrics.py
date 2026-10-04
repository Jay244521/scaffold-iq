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


def loan_balance(loan_amount: float, annual_rate: float, amort_years: int | None, years_paid: int) -> float:
    """Remaining principal after `years_paid` years of monthly payments (interest-only if amort_years is None)."""
    if amort_years is None or years_paid <= 0:
        return loan_amount
    n = amort_years * 12
    k = min(years_paid * 12, n)
    r = annual_rate / 12
    if r == 0:
        return loan_amount * (1 - k / n)
    return loan_amount * ((1 + r) ** n - (1 + r) ** k) / ((1 + r) ** n - 1)


def npv(rate: float, cash_flows: list[float]) -> float:
    """Net present value of cash flows at t = 0, 1, 2, ..."""
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))


def irr(cash_flows: list[float], low: float = -0.99, high: float = 10.0, tol: float = 1e-10) -> float | None:
    """Internal rate of return by bisection. None when NPV never changes sign in [low, high]."""
    f_low, f_high = npv(low, cash_flows), npv(high, cash_flows)
    if f_low * f_high > 0:
        return None
    for _ in range(300):
        mid = (low + high) / 2
        f_mid = npv(mid, cash_flows)
        if abs(f_mid) < tol or high - low < tol:
            return mid
        if f_low * f_mid < 0:
            high = mid
        else:
            low, f_low = mid, f_mid
    return (low + high) / 2
