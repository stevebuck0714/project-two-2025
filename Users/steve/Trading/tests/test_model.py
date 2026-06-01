import pandas as pd

from trading_rotation.config import FactorConfig, StrategyConfig
from trading_rotation.model import build_rebalance


def test_build_rebalance_filters_large_caps_and_recent_ipos():
    config = StrategyConfig(
        sector_weights={"Financials": 0.40, "Industrials": 0.35, "Healthcare": 0.25},
        min_market_cap=300_000_000,
        max_market_cap=10_000_000_000,
        min_avg_dollar_volume=5_000_000,
        exclude_recent_ipos=True,
        names_per_sector=1,
        factors=[
            FactorConfig("relative_strength_6m", 0.50, True),
            FactorConfig("volatility_6m", 0.50, False),
        ],
        risk_rules={},
    )
    universe = pd.DataFrame(
        [
            {"ticker": "FIN1", "sector": "Financials", "market_cap": 2_000_000_000, "avg_dollar_volume": 8_000_000, "is_recent_ipo": False},
            {"ticker": "FIN2", "sector": "Financials", "market_cap": 20_000_000_000, "avg_dollar_volume": 20_000_000, "is_recent_ipo": False},
            {"ticker": "IND1", "sector": "Industrials", "market_cap": 1_000_000_000, "avg_dollar_volume": 7_000_000, "is_recent_ipo": False},
            {"ticker": "HLTH1", "sector": "Healthcare", "market_cap": 900_000_000, "avg_dollar_volume": 6_000_000, "is_recent_ipo": True},
        ]
    )
    factors = pd.DataFrame(
        [
            {"ticker": "FIN1", "relative_strength_6m": 0.10, "volatility_6m": 0.20},
            {"ticker": "FIN2", "relative_strength_6m": 0.30, "volatility_6m": 0.10},
            {"ticker": "IND1", "relative_strength_6m": 0.15, "volatility_6m": 0.18},
            {"ticker": "HLTH1", "relative_strength_6m": 0.12, "volatility_6m": 0.16},
        ]
    )

    rebalance = build_rebalance(universe, factors, config)

    assert set(rebalance["ticker"]) == {"FIN1", "IND1"}
    assert rebalance.loc[rebalance["ticker"] == "FIN1", "target_weight"].item() == 0.40
    assert rebalance.loc[rebalance["ticker"] == "IND1", "target_weight"].item() == 0.35


def test_build_rebalance_prefers_high_returns_and_low_volatility():
    config = StrategyConfig(
        sector_weights={"Financials": 1.0},
        min_market_cap=300_000_000,
        max_market_cap=10_000_000_000,
        min_avg_dollar_volume=5_000_000,
        exclude_recent_ipos=True,
        names_per_sector=1,
        factors=[
            FactorConfig("relative_strength_6m", 0.50, True),
            FactorConfig("volatility_6m", 0.50, False),
        ],
        risk_rules={},
    )
    universe = pd.DataFrame(
        [
            {"ticker": "BEST", "sector": "Financials", "market_cap": 2_000_000_000, "avg_dollar_volume": 8_000_000, "is_recent_ipo": False},
            {"ticker": "WORST", "sector": "Financials", "market_cap": 2_000_000_000, "avg_dollar_volume": 8_000_000, "is_recent_ipo": False},
        ]
    )
    factors = pd.DataFrame(
        [
            {"ticker": "BEST", "relative_strength_6m": 0.30, "volatility_6m": 0.10},
            {"ticker": "WORST", "relative_strength_6m": -0.30, "volatility_6m": 0.40},
        ]
    )

    rebalance = build_rebalance(universe, factors, config)

    assert rebalance["ticker"].tolist() == ["BEST"]

