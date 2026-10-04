import pytest

from underwriting import metrics


def test_noi():
    assert metrics.net_operating_income(1_000_000, 0.05, 400_000) == pytest.approx(550_000)


def test_yield_on_cost_and_spread():
    yoc = metrics.yield_on_cost(550_000, 8_000_000)
    assert yoc == pytest.approx(0.06875)
    assert metrics.development_spread(yoc, 0.055) == pytest.approx(0.01375)


def test_debt_service_and_dscr():
    ds = metrics.annual_debt_service(5_000_000, 0.065, 30)
    assert ds == pytest.approx(379_241, rel=1e-3)
    assert metrics.dscr(550_000, ds) == pytest.approx(1.45, rel=1e-2)
