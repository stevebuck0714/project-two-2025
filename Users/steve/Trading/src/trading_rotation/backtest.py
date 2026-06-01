from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import pandas as pd

from trading_rotation.config import StrategyConfig
from trading_rotation.fmp import FmpClient
from trading_rotation.model import build_scored_universe
from trading_rotation.signals import build_trade_signals


@dataclass(frozen=True)
class BacktestResult:
    equity_curve: pd.DataFrame
    holdings: pd.DataFrame
    trades: pd.DataFrame


def run_monthly_backtest(
    universe: pd.DataFrame,
    config: StrategyConfig,
    start_date: str,
    end_date: str,
    initial_cash: float,
    max_tickers: int,
    keep_rank_per_sector: int = 8,
    bid_ask_spread_bps: float = 10.0,
    capital_gains_tax_rate: float = 0.24,
) -> BacktestResult:
    candidate_universe = _select_candidates(universe, config, max_tickers)
    price_history = _fetch_candidate_prices(candidate_universe, start_date, end_date)
    rebalance_dates = _month_end_dates(start_date, end_date, price_history)

    previous_rebalance = pd.DataFrame()
    shares: dict[str, float] = {}
    cost_basis: dict[str, float] = {}
    cumulative_spread_cost = 0.0
    cumulative_tax_estimate = 0.0
    holdings_rows = []
    trade_rows = []
    equity_rows = []

    for rebalance_date in rebalance_dates:
        factors = _build_price_factors(candidate_universe, price_history, rebalance_date)
        if factors.empty:
            continue

        scored = build_scored_universe(candidate_universe, factors, config)
        rebalance = _build_turnover_rebalance(
            scored=scored,
            previous_rebalance=previous_rebalance,
            config=config,
            keep_rank_per_sector=keep_rank_per_sector,
        )
        portfolio_value = _portfolio_value(shares, price_history, rebalance_date, initial_cash)
        signals = build_trade_signals(rebalance, previous_rebalance, portfolio_value=portfolio_value)
        target_shares = _rebalance_shares(rebalance, price_history, rebalance_date, portfolio_value)
        friction = _estimate_rebalance_friction(
            current_shares=shares,
            target_shares=target_shares,
            cost_basis=cost_basis,
            prices=price_history,
            as_of_date=rebalance_date,
            bid_ask_spread_bps=bid_ask_spread_bps,
            capital_gains_tax_rate=capital_gains_tax_rate,
        )
        cumulative_spread_cost += friction["spread_cost"]
        cumulative_tax_estimate += friction["tax_estimate"]
        cost_basis = friction["cost_basis"]

        shares = target_shares
        previous_rebalance = rebalance
        gross_value = _portfolio_value(shares, price_history, rebalance_date, 0.0)
        after_tax_spread_value = gross_value - cumulative_spread_cost - cumulative_tax_estimate

        equity_rows.append(
            {
                "as_of_date": rebalance_date,
                "portfolio_value": gross_value,
                "after_tax_spread_value": after_tax_spread_value,
                "turnover_dollars": friction["turnover_dollars"],
                "realized_gain": friction["realized_gain"],
                "spread_cost": friction["spread_cost"],
                "tax_estimate": friction["tax_estimate"],
                "cumulative_spread_cost": cumulative_spread_cost,
                "cumulative_tax_estimate": cumulative_tax_estimate,
            }
        )
        for row in rebalance.to_dict(orient="records"):
            ticker = row["ticker"]
            price = _price_on_or_before(price_history, ticker, rebalance_date)
            position_shares = shares.get(ticker, 0.0)
            holdings_rows.append(
                {
                    "as_of_date": rebalance_date,
                    "ticker": ticker,
                    "company_name": row.get("company_name", ""),
                    "sector": row.get("sector", ""),
                    "score": row.get("score"),
                    "sector_rank": row.get("sector_rank"),
                    "target_weight": row.get("target_weight"),
                    "price": price,
                    "shares": position_shares,
                    "market_value": position_shares * price,
                }
            )
        for row in signals.to_dict(orient="records"):
            trade_rows.append({"as_of_date": rebalance_date, **row})

    equity_curve = pd.DataFrame(equity_rows)
    if not equity_curve.empty:
        equity_curve["daily_return"] = equity_curve["portfolio_value"].pct_change().fillna(0.0)
        first_value = equity_curve["portfolio_value"].iloc[0]
        equity_curve["cumulative_return"] = (
            equity_curve["portfolio_value"] / first_value - 1 if first_value else 0.0
        )
        first_after_tax_value = equity_curve["after_tax_spread_value"].iloc[0]
        equity_curve["after_tax_spread_daily_return"] = (
            equity_curve["after_tax_spread_value"].pct_change().fillna(0.0)
        )
        equity_curve["after_tax_spread_cumulative_return"] = (
            equity_curve["after_tax_spread_value"] / first_after_tax_value - 1
            if first_after_tax_value
            else 0.0
        )

    return BacktestResult(
        equity_curve=equity_curve,
        holdings=pd.DataFrame(holdings_rows),
        trades=pd.DataFrame(trade_rows),
    )


def write_backtest_outputs(
    universe: pd.DataFrame,
    config: StrategyConfig,
    start_date: str,
    end_date: str,
    initial_cash: float,
    max_tickers: int,
    keep_rank_per_sector: int,
    bid_ask_spread_bps: float,
    capital_gains_tax_rate: float,
    equity_output: str | Path,
    holdings_output: str | Path,
    trades_output: str | Path,
) -> BacktestResult:
    result = run_monthly_backtest(
        universe=universe,
        config=config,
        start_date=start_date,
        end_date=end_date,
        initial_cash=initial_cash,
        max_tickers=max_tickers,
        keep_rank_per_sector=keep_rank_per_sector,
        bid_ask_spread_bps=bid_ask_spread_bps,
        capital_gains_tax_rate=capital_gains_tax_rate,
    )
    _write_csv(result.equity_curve, equity_output)
    _write_csv(result.holdings, holdings_output)
    _write_csv(result.trades, trades_output)
    return result


def _build_turnover_rebalance(
    scored: pd.DataFrame,
    previous_rebalance: pd.DataFrame,
    config: StrategyConfig,
    keep_rank_per_sector: int,
) -> pd.DataFrame:
    ranked = scored.sort_values(["sector", "score"], ascending=[True, False]).copy()
    ranked["sector_rank"] = ranked.groupby("sector").cumcount() + 1
    previous_tickers = set(previous_rebalance["ticker"]) if not previous_rebalance.empty else set()
    picks = []

    for sector in config.sector_weights:
        sector_ranked = ranked[ranked["sector"] == sector].copy()
        if sector_ranked.empty:
            continue

        if previous_tickers:
            kept = sector_ranked[
                sector_ranked["ticker"].isin(previous_tickers)
                & (sector_ranked["sector_rank"] <= keep_rank_per_sector)
            ].head(config.names_per_sector)
            slots = config.names_per_sector - len(kept)
            additions = sector_ranked[~sector_ranked["ticker"].isin(kept["ticker"])].head(slots)
            sector_picks = pd.concat([kept, additions], ignore_index=True)
        else:
            sector_picks = sector_ranked.head(config.names_per_sector)

        picks.append(sector_picks)

    if not picks:
        raise ValueError("No stocks passed the configured filters.")

    rebalance = pd.concat(picks, ignore_index=True)
    rebalance["sector_target_weight"] = rebalance["sector"].map(config.sector_weights)
    counts = rebalance.groupby("sector")["ticker"].transform("count")
    rebalance["target_weight"] = rebalance["sector_target_weight"] / counts
    columns = [
        "ticker",
        "company_name",
        "sector",
        "score",
        "sector_rank",
        "sector_target_weight",
        "target_weight",
        "price",
        "market_cap",
        "avg_dollar_volume",
    ]
    for factor in config.factors:
        columns.extend([factor.name, f"{factor.name}_rank"])
    columns = [column for column in columns if column in rebalance.columns]
    return rebalance[columns].sort_values(["sector", "score"], ascending=[True, False])


def _select_candidates(universe: pd.DataFrame, config: StrategyConfig, max_tickers: int) -> pd.DataFrame:
    allowed = universe[universe["sector"].isin(config.sector_weights)].copy()
    per_sector = max(1, max_tickers // max(1, len(config.sector_weights)))
    return (
        allowed.sort_values(["sector", "market_cap"], ascending=[True, False])
        .groupby("sector", group_keys=False)
        .head(per_sector)
        .head(max_tickers)
        .copy()
    )


def _fetch_candidate_prices(universe: pd.DataFrame, start_date: str, end_date: str) -> pd.DataFrame:
    client = FmpClient()
    start = pd.Timestamp(start_date).date() - timedelta(days=240)
    end = pd.Timestamp(end_date).date()
    rows = []

    for ticker in universe["ticker"].dropna().unique():
        response = client.get(
            "historical-price-eod/full",
            symbol=ticker,
            **{"from": start.isoformat(), "to": end.isoformat()},
        )
        historical = response.get("historical", []) if isinstance(response, dict) else response
        for item in historical:
            rows.append({"ticker": ticker, "date": item.get("date"), "close": item.get("close")})

    prices = pd.DataFrame(rows)
    if prices.empty:
        return pd.DataFrame(columns=["ticker", "date", "close"])
    prices["date"] = pd.to_datetime(prices["date"])
    prices["close"] = prices["close"].astype(float)
    return prices.sort_values(["ticker", "date"])


def _month_end_dates(start_date: str, end_date: str, prices: pd.DataFrame) -> list[str]:
    if prices.empty:
        return []
    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    trading_days = prices[(prices["date"] >= start) & (prices["date"] <= end)]["date"].drop_duplicates()
    if trading_days.empty:
        return []
    month_ends = trading_days.groupby([trading_days.dt.year, trading_days.dt.month]).max()
    return [date.date().isoformat() for date in month_ends]


def _build_price_factors(universe: pd.DataFrame, prices: pd.DataFrame, as_of_date: str) -> pd.DataFrame:
    rows = []
    as_of = pd.Timestamp(as_of_date)
    lookback_start = as_of - pd.Timedelta(days=190)

    for ticker in universe["ticker"].dropna().unique():
        ticker_prices = prices[(prices["ticker"] == ticker) & (prices["date"] <= as_of)].copy()
        recent = ticker_prices[ticker_prices["date"] >= lookback_start]
        if len(recent) < 30:
            continue
        close = recent["close"]
        returns = close.pct_change().dropna()
        rows.append(
            {
                "ticker": ticker,
                "as_of_date": as_of_date,
                "relative_strength_6m": float(close.iloc[-1] / close.iloc[0] - 1),
                "earnings_revision": 0.0,
                "fcf_yield": 0.0,
                "debt_to_ebitda": 0.0,
                "volatility_6m": float(returns.std() * (252**0.5)) if not returns.empty else 0.0,
            }
        )

    return pd.DataFrame(rows)


def _rebalance_shares(
    rebalance: pd.DataFrame,
    prices: pd.DataFrame,
    as_of_date: str,
    portfolio_value: float,
) -> dict[str, float]:
    shares = {}
    for row in rebalance.to_dict(orient="records"):
        price = _price_on_or_before(prices, row["ticker"], as_of_date)
        target_dollars = portfolio_value * float(row["target_weight"])
        shares[row["ticker"]] = target_dollars / price if price else 0.0
    return shares


def _estimate_rebalance_friction(
    current_shares: dict[str, float],
    target_shares: dict[str, float],
    cost_basis: dict[str, float],
    prices: pd.DataFrame,
    as_of_date: str,
    bid_ask_spread_bps: float,
    capital_gains_tax_rate: float,
) -> dict[str, float | dict[str, float]]:
    turnover_dollars = 0.0
    realized_gain = 0.0
    updated_cost_basis: dict[str, float] = {}

    for ticker in set(current_shares) | set(target_shares):
        price = _price_on_or_before(prices, ticker, as_of_date)
        current_quantity = current_shares.get(ticker, 0.0)
        target_quantity = target_shares.get(ticker, 0.0)
        traded_quantity = target_quantity - current_quantity
        turnover_dollars += abs(traded_quantity) * price

        current_basis = cost_basis.get(ticker, price)
        if traded_quantity < 0:
            sold_quantity = abs(traded_quantity)
            realized_gain += max((price - current_basis) * sold_quantity, 0.0)
            if target_quantity > 0:
                updated_cost_basis[ticker] = current_basis
        elif traded_quantity > 0:
            current_cost = current_quantity * current_basis
            added_cost = traded_quantity * price
            updated_cost_basis[ticker] = (current_cost + added_cost) / target_quantity if target_quantity else price
        elif target_quantity > 0:
            updated_cost_basis[ticker] = current_basis

    spread_cost = turnover_dollars * (bid_ask_spread_bps / 10000) / 2
    tax_estimate = realized_gain * capital_gains_tax_rate
    return {
        "turnover_dollars": turnover_dollars,
        "realized_gain": realized_gain,
        "spread_cost": spread_cost,
        "tax_estimate": tax_estimate,
        "cost_basis": updated_cost_basis,
    }


def _portfolio_value(
    shares: dict[str, float],
    prices: pd.DataFrame,
    as_of_date: str,
    default_value: float,
) -> float:
    if not shares:
        return default_value
    return sum(shares * _price_on_or_before(prices, ticker, as_of_date) for ticker, shares in shares.items())


def _price_on_or_before(prices: pd.DataFrame, ticker: str, as_of_date: str) -> float:
    ticker_prices = prices[(prices["ticker"] == ticker) & (prices["date"] <= pd.Timestamp(as_of_date))]
    if ticker_prices.empty:
        return 0.0
    return float(ticker_prices.iloc[-1]["close"])


def _write_csv(frame: pd.DataFrame, path: str | Path) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False)

