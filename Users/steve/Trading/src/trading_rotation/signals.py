from __future__ import annotations

from pathlib import Path

import pandas as pd


def load_optional_rebalance(path: str | Path | None) -> pd.DataFrame:
    if not path:
        return pd.DataFrame()
    rebalance_path = Path(path)
    if not rebalance_path.exists():
        return pd.DataFrame()
    return pd.read_csv(rebalance_path)


def build_trade_signals(
    current_rebalance: pd.DataFrame,
    previous_rebalance: pd.DataFrame | None = None,
    portfolio_value: float = 100000.0,
) -> pd.DataFrame:
    previous = previous_rebalance if previous_rebalance is not None else pd.DataFrame()
    current = current_rebalance.copy()
    current["target_dollars"] = current["target_weight"] * portfolio_value

    previous_tickers = set(previous["ticker"]) if not previous.empty and "ticker" in previous else set()
    current_tickers = set(current["ticker"])

    buy_hold_rows = []
    for row in current.to_dict(orient="records"):
        ticker = row["ticker"]
        action = "HOLD" if ticker in previous_tickers else "BUY"
        buy_hold_rows.append(
            {
                "ticker": ticker,
                "company_name": row.get("company_name", ""),
                "sector": row.get("sector", ""),
                "action": action,
                "reason": "Still selected by model" if action == "HOLD" else "Entered selected model portfolio",
                "score": row.get("score"),
                "target_weight": row.get("target_weight"),
                "target_dollars": row.get("target_dollars"),
                "price": row.get("price"),
            }
        )

    sell_rows = []
    if not previous.empty:
        removed = previous[~previous["ticker"].isin(current_tickers)].copy()
        for row in removed.to_dict(orient="records"):
            sell_rows.append(
                {
                    "ticker": row["ticker"],
                    "company_name": row.get("company_name", ""),
                    "sector": row.get("sector", ""),
                    "action": "SELL",
                    "reason": "Dropped out of selected model portfolio",
                    "score": row.get("score"),
                    "target_weight": 0.0,
                    "target_dollars": 0.0,
                    "price": row.get("price"),
                }
            )

    signals = pd.DataFrame([*buy_hold_rows, *sell_rows])
    if signals.empty:
        return signals

    action_order = {"BUY": 0, "HOLD": 1, "SELL": 2}
    signals["_action_order"] = signals["action"].map(action_order)
    signals = signals.sort_values(["_action_order", "sector", "score"], ascending=[True, True, False])
    return signals.drop(columns=["_action_order"])

