from __future__ import annotations

from pathlib import Path

import pandas as pd


POSITION_COLUMNS = [
    "as_of_date",
    "ticker",
    "company_name",
    "sector",
    "shares",
    "avg_cost",
    "last_price",
    "market_value",
    "unrealized_pnl",
    "last_action",
]
SUMMARY_COLUMNS = ["as_of_date", "cash", "positions_value", "total_value", "daily_return", "cumulative_return"]
TRADE_COLUMNS = [
    "as_of_date",
    "ticker",
    "company_name",
    "action",
    "shares",
    "price",
    "trade_value",
    "cash_after",
    "reason",
]


def build_paper_portfolio(signals: pd.DataFrame, as_of: str) -> pd.DataFrame:
    if signals.empty:
        return pd.DataFrame()

    active = signals[signals["action"].isin(["BUY", "HOLD"])].copy()
    if active.empty:
        return pd.DataFrame(columns=["as_of_date", "ticker", "company_name", "sector", "target_dollars"])

    active["as_of_date"] = as_of
    if "price" in active:
        active["shares"] = active.apply(_calculate_shares, axis=1)
        active["position_value"] = active["shares"] * active["price"]

    columns = [
        "as_of_date",
        "ticker",
        "company_name",
        "sector",
        "target_weight",
        "target_dollars",
        "price",
        "shares",
        "position_value",
        "action",
    ]
    columns = [column for column in columns if column in active.columns]
    return active[columns].sort_values(["sector", "ticker"])


def write_paper_portfolio(signals: pd.DataFrame, as_of: str, output: str | Path) -> pd.DataFrame:
    portfolio = build_paper_portfolio(signals, as_of)
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    portfolio.to_csv(output_path, index=False)
    return portfolio


def execute_paper_account(
    signals: pd.DataFrame,
    as_of: str,
    initial_cash: float,
    positions_output: str | Path,
    summary_output: str | Path,
    trades_output: str | Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    positions_path = Path(positions_output)
    summary_path = Path(summary_output)
    trades_path = Path(trades_output)
    positions = _load_positions(positions_path)
    cash = _load_cash(summary_path, initial_cash)
    trades: list[dict[str, object]] = []

    for signal in signals.to_dict(orient="records"):
        ticker = signal["ticker"]
        action = signal["action"]
        price = float(signal.get("price") or 0)
        if price <= 0:
            continue

        existing = positions[positions["ticker"] == ticker]
        existing_shares = float(existing["shares"].iloc[0]) if not existing.empty else 0.0

        if action == "SELL" and existing_shares > 0:
            trade_value = existing_shares * price
            cash += trade_value
            positions = positions[positions["ticker"] != ticker].copy()
            trades.append(_trade_row(as_of, signal, action, existing_shares, price, trade_value, cash))
        elif action == "BUY" and existing_shares == 0:
            target_dollars = min(float(signal.get("target_dollars") or 0), cash)
            shares = target_dollars / price if price else 0.0
            if shares <= 0:
                continue
            cash -= target_dollars
            positions = pd.concat(
                [
                    positions,
                    pd.DataFrame(
                        [
                            {
                                "as_of_date": as_of,
                                "ticker": ticker,
                                "company_name": signal.get("company_name", ""),
                                "sector": signal.get("sector", ""),
                                "shares": shares,
                                "avg_cost": price,
                                "last_price": price,
                                "market_value": shares * price,
                                "unrealized_pnl": 0.0,
                                "last_action": action,
                            }
                        ]
                    ),
                ],
                ignore_index=True,
            )
            trades.append(_trade_row(as_of, signal, action, shares, price, target_dollars, cash))

    positions = _mark_to_market(positions, signals, as_of)
    summary = _update_summary(summary_path, positions, cash, as_of)
    all_trades = _append_trades(trades_path, trades)

    positions_path.parent.mkdir(parents=True, exist_ok=True)
    positions.to_csv(positions_path, index=False)
    return positions, summary, all_trades


def write_portfolio_history(portfolio: pd.DataFrame, as_of: str, output: str | Path) -> pd.DataFrame:
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    total_value = _portfolio_value(portfolio)
    row = pd.DataFrame([{"as_of_date": as_of, "portfolio_value": total_value}])
    if output_path.exists():
        history = pd.read_csv(output_path)
        history = history[history["as_of_date"] != as_of]
        history = pd.concat([history, row], ignore_index=True)
    else:
        history = row

    history = history.sort_values("as_of_date")
    history["daily_return"] = history["portfolio_value"].pct_change().fillna(0.0)
    first_value = history["portfolio_value"].iloc[0]
    history["cumulative_return"] = (history["portfolio_value"] / first_value - 1) if first_value else 0.0
    history.to_csv(output_path, index=False)
    return history


def _calculate_shares(row: pd.Series) -> float:
    price = row.get("price", 0)
    if price is None or price <= 0:
        return 0.0
    return float(row.get("target_dollars", 0) / price)


def _portfolio_value(portfolio: pd.DataFrame) -> float:
    if portfolio.empty:
        return 0.0
    if "position_value" in portfolio:
        return float(portfolio["position_value"].sum())
    if "target_dollars" in portfolio:
        return float(portfolio["target_dollars"].sum())
    return 0.0


def _load_positions(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=POSITION_COLUMNS)
    positions = pd.read_csv(path)
    if not set(POSITION_COLUMNS).issubset(positions.columns):
        return pd.DataFrame(columns=POSITION_COLUMNS)
    return positions[POSITION_COLUMNS]


def _load_cash(summary_path: Path, initial_cash: float) -> float:
    if not summary_path.exists():
        return initial_cash
    summary = pd.read_csv(summary_path)
    if summary.empty or "cash" not in summary:
        return initial_cash
    return float(summary.iloc[-1]["cash"])


def _mark_to_market(positions: pd.DataFrame, signals: pd.DataFrame, as_of: str) -> pd.DataFrame:
    if positions.empty:
        return pd.DataFrame(columns=POSITION_COLUMNS)

    price_map = signals.set_index("ticker")["price"].to_dict() if "price" in signals else {}
    marked = positions.copy()
    marked["as_of_date"] = as_of
    marked["last_price"] = marked.apply(
        lambda row: float(price_map.get(row["ticker"], row.get("last_price", 0)) or 0),
        axis=1,
    )
    marked["market_value"] = marked["shares"] * marked["last_price"]
    marked["unrealized_pnl"] = (marked["last_price"] - marked["avg_cost"]) * marked["shares"]
    return marked[POSITION_COLUMNS].sort_values(["sector", "ticker"])


def _update_summary(summary_path: Path, positions: pd.DataFrame, cash: float, as_of: str) -> pd.DataFrame:
    positions_value = float(positions["market_value"].sum()) if not positions.empty else 0.0
    total_value = cash + positions_value
    row = pd.DataFrame(
        [{"as_of_date": as_of, "cash": cash, "positions_value": positions_value, "total_value": total_value}]
    )

    if summary_path.exists():
        summary = pd.read_csv(summary_path)
        summary = summary[summary["as_of_date"] != as_of]
        summary = pd.concat([summary, row], ignore_index=True)
    else:
        summary = row

    summary = summary.sort_values("as_of_date")
    summary["daily_return"] = summary["total_value"].pct_change().fillna(0.0)
    first_value = summary["total_value"].iloc[0]
    summary["cumulative_return"] = (summary["total_value"] / first_value - 1) if first_value else 0.0
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary[SUMMARY_COLUMNS].to_csv(summary_path, index=False)
    return summary[SUMMARY_COLUMNS]


def _append_trades(trades_path: Path, trades: list[dict[str, object]]) -> pd.DataFrame:
    new_trades = pd.DataFrame(trades, columns=TRADE_COLUMNS)
    if trades_path.exists():
        existing = pd.read_csv(trades_path)
        all_trades = pd.concat([existing, new_trades], ignore_index=True)
    else:
        all_trades = new_trades
    trades_path.parent.mkdir(parents=True, exist_ok=True)
    all_trades.to_csv(trades_path, index=False)
    return all_trades


def _trade_row(
    as_of: str,
    signal: dict[str, object],
    action: str,
    shares: float,
    price: float,
    trade_value: float,
    cash_after: float,
) -> dict[str, object]:
    return {
        "as_of_date": as_of,
        "ticker": signal.get("ticker"),
        "company_name": signal.get("company_name", ""),
        "action": action,
        "shares": shares,
        "price": price,
        "trade_value": trade_value,
        "cash_after": cash_after,
        "reason": signal.get("reason", ""),
    }

