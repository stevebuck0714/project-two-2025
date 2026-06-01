from __future__ import annotations

from pathlib import Path

import pandas as pd

from trading_rotation.config import StrategyConfig


REQUIRED_UNIVERSE_COLUMNS = {
    "ticker",
    "sector",
    "market_cap",
    "avg_dollar_volume",
    "is_recent_ipo",
}


def load_universe(path: str | Path) -> pd.DataFrame:
    universe = pd.read_csv(path)
    _require_columns(universe, REQUIRED_UNIVERSE_COLUMNS, "universe")
    universe["is_recent_ipo"] = universe["is_recent_ipo"].astype(bool)
    return universe


def load_factors(path: str | Path, as_of: str) -> pd.DataFrame:
    factors = pd.read_csv(path, parse_dates=["as_of_date"])
    factors = factors[factors["as_of_date"] == pd.Timestamp(as_of)].copy()
    if factors.empty:
        raise ValueError(f"No factor rows found for as_of_date={as_of}")
    return factors


def build_rebalance(universe: pd.DataFrame, factors: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    scored = build_scored_universe(universe, factors, config)

    picks = (
        scored.sort_values(["sector", "score"], ascending=[True, False])
        .groupby("sector", group_keys=False)
        .head(config.names_per_sector)
        .copy()
    )

    if picks.empty:
        raise ValueError("No stocks passed the configured filters.")

    picks["sector_target_weight"] = picks["sector"].map(config.sector_weights)
    counts = picks.groupby("sector")["ticker"].transform("count")
    picks["target_weight"] = picks["sector_target_weight"] / counts

    columns = [
        "ticker",
        "company_name",
        "sector",
        "score",
        "sector_target_weight",
        "target_weight",
        "price",
        "market_cap",
        "avg_dollar_volume",
    ]
    for factor in config.factors:
        columns.extend([factor.name, f"{factor.name}_rank"])
    columns = [column for column in columns if column in picks.columns]
    return picks[columns].sort_values(["sector", "score"], ascending=[True, False])


def build_scored_universe(universe: pd.DataFrame, factors: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    eligible = _filter_universe(universe, config)
    scored = _score_stocks(eligible, factors, config)
    scored, _ = _apply_risk_rules(scored, config)
    return scored


def build_risk_exclusions(universe: pd.DataFrame, factors: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    eligible = _filter_universe(universe, config)
    scored = _score_stocks(eligible, factors, config)
    _, exclusions = _apply_risk_rules(scored, config)
    return exclusions


def _filter_universe(universe: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    allowed_sectors = set(config.sector_weights)
    filtered = universe[
        universe["sector"].isin(allowed_sectors)
        & universe["market_cap"].between(config.min_market_cap, config.max_market_cap)
        & (universe["avg_dollar_volume"] >= config.min_avg_dollar_volume)
    ].copy()

    if config.exclude_recent_ipos:
        filtered = filtered[~filtered["is_recent_ipo"]].copy()

    return filtered


def _score_stocks(universe: pd.DataFrame, factors: pd.DataFrame, config: StrategyConfig) -> pd.DataFrame:
    merged = universe.merge(factors, on="ticker", how="inner")
    required_factor_columns = {factor.name for factor in config.factors}
    _require_columns(merged, required_factor_columns, "factors")

    for factor in config.factors:
        rank_column = f"{factor.name}_rank"
        merged[rank_column] = merged.groupby("sector")[factor.name].rank(
            pct=True,
            ascending=factor.higher_is_better,
        )

    merged["score"] = sum(
        merged[f"{factor.name}_rank"] * factor.weight for factor in config.factors
    )
    return merged


def _apply_risk_rules(scored: pd.DataFrame, config: StrategyConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    if scored.empty or not config.risk_rules:
        return scored, pd.DataFrame()

    failures: list[dict[str, object]] = []
    rules = config.risk_rules
    for row in scored.to_dict(orient="records"):
        reasons = []
        if row.get("volatility_6m", 0) > rules.get("max_volatility_6m", float("inf")):
            reasons.append("volatility above limit")
        if row.get("debt_to_ebitda", 0) > rules.get("max_debt_to_ebitda", float("inf")):
            reasons.append("debt above limit")
        if row.get("fcf_yield", 0) < rules.get("min_fcf_yield", float("-inf")):
            reasons.append("free cash flow yield below limit")
        if row.get("relative_strength_6m", 0) < rules.get("min_relative_strength_6m", float("-inf")):
            reasons.append("relative strength below limit")

        if reasons:
            failures.append(
                {
                    "ticker": row.get("ticker"),
                    "company_name": row.get("company_name", ""),
                    "sector": row.get("sector"),
                    "score": row.get("score"),
                    "risk_reason": "; ".join(reasons),
                }
            )

    if not failures:
        return scored, pd.DataFrame()

    exclusions = pd.DataFrame(failures)
    passed = scored[~scored["ticker"].isin(exclusions["ticker"])].copy()
    return passed, exclusions


def _require_columns(frame: pd.DataFrame, required: set[str], label: str) -> None:
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Missing {label} columns: {', '.join(missing)}")

