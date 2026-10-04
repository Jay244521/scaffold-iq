import math

import pytest

from underwriting import metrics
from underwriting.proforma import DevelopmentProForma, run_sample, sample_deal


def simple_deal(**overrides):
    """Round numbers that are easy to check by hand."""
    params = dict(
        land_cost=1_000_000,
        hard_costs=8_000_000,
        soft_costs=1_000_000,
        contingency_pct=0.0,
        ltv=0.60,
        interest_rate=0.05,
        exit_cap_rate=0.06,
        gross_potential_rent=1_000_000,
        vacancy_rate=0.0,
        operating_expenses=300_000,
        construction_years=0,
        hold_years=1,
        rent_growth=0.0,
        expense_growth=0.0,
        selling_costs_pct=0.0,
    )
    params.update(overrides)
    return DevelopmentProForma(**params)


def test_hand_checked_one_year_deal():
    r = simple_deal().run()
    assert r.total_capitalization == pytest.approx(10_000_000)
    assert r.loan_amount == pytest.approx(6_000_000)
    assert r.required_equity == pytest.approx(4_000_000)
    assert r.noi == pytest.approx(700_000)
    # Year 1: NOI 700k - interest 300k + sale (700k / 6% = 11.667M) - loan 6M
    expected_cf1 = 700_000 - 300_000 + 700_000 / 0.06 - 6_000_000
    assert r.levered_cash_flows == pytest.approx([-4_000_000, expected_cf1])
    assert r.levered_irr == pytest.approx(expected_cf1 / 4_000_000 - 1)
    assert r.equity_multiple == pytest.approx(expected_cf1 / 4_000_000)


def test_contingency_and_construction_interest_are_capitalized():
    deal = simple_deal(contingency_pct=0.10, construction_years=2, avg_draw_pct=0.5)
    r = deal.run()
    base = 1_000_000 + 8_000_000 * 1.10 + 1_000_000
    assert r.contingency == pytest.approx(800_000)
    # Interest = loan * 5% * 2 yrs * 50% drawn, and loan = 60% of total including that interest.
    assert r.construction_interest == pytest.approx(r.loan_amount * 0.05)
    assert r.total_capitalization == pytest.approx(base + r.construction_interest)
    assert r.loan_amount == pytest.approx(0.60 * r.total_capitalization)
    assert r.levered_cash_flows[1:3] == [0.0, 0.0]


def test_ltv_on_value_basis():
    r = simple_deal(ltv_basis="value", ltv=0.50).run()
    # Stabilized value 700k / 6% = 11.667M -> loan 5.833M
    assert r.loan_amount == pytest.approx(0.5 * 700_000 / 0.06)
    assert r.required_equity == pytest.approx(10_000_000 - r.loan_amount)


def test_value_basis_loan_never_exceeds_cost():
    r = simple_deal(ltv_basis="value", ltv=0.95, exit_cap_rate=0.03).run()
    assert r.loan_amount == pytest.approx(r.total_capitalization)
    assert r.required_equity == pytest.approx(0, abs=1e-6)
    assert math.isnan(r.equity_multiple)


def test_amortizing_loan_reduces_payoff():
    io = simple_deal(hold_years=5).run()
    amort = simple_deal(hold_years=5, amort_years=30).run()
    assert amort.annual_debt_service > io.annual_debt_service
    assert amort.net_sale_proceeds > io.net_sale_proceeds


def test_leverage_raises_irr_when_unlevered_return_beats_rate():
    low = simple_deal(ltv=0.0, hold_years=5).run()
    high = simple_deal(ltv=0.70, hold_years=5).run()
    assert low.levered_irr == pytest.approx(low.unlevered_irr)
    assert high.levered_irr > low.levered_irr


def test_invalid_inputs_rejected():
    with pytest.raises(ValueError):
        simple_deal(exit_cap_rate=0)
    with pytest.raises(ValueError):
        simple_deal(ltv=1.2)
    with pytest.raises(ValueError):
        simple_deal(land_cost=-1)


def test_irr_and_loan_balance_helpers():
    assert metrics.irr([-100, 110]) == pytest.approx(0.10)
    assert metrics.irr([-100, 0, 121]) == pytest.approx(0.10)
    assert metrics.irr([100, 100]) is None
    assert metrics.loan_balance(1_000_000, 0.06, None, 5) == 1_000_000
    assert metrics.loan_balance(1_000_000, 0.06, 30, 30) == pytest.approx(0, abs=1e-6)
    assert 900_000 < metrics.loan_balance(1_000_000, 0.06, 30, 5) < 1_000_000


def test_sample_deal(capsys):
    result = run_sample()
    assert "Levered IRR" in capsys.readouterr().out
    assert result.total_capitalization > sample_deal().base_cost
