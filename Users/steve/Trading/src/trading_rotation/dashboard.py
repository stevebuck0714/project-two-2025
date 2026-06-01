from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path

import pandas as pd
import streamlit as st


DEFAULT_REBALANCE = Path("outputs/rebalance.fmp.full.csv")
DEFAULT_UNIVERSE = Path("data/universe.fmp.full.csv")
DEFAULT_FACTORS = Path("data/factors.fmp.full.csv")
DEFAULT_NEWS = Path("data/news.fmp.csv")
DEFAULT_INSIDER = Path("data/insider.fmp.csv")
DEFAULT_NOTES = Path("data/review_notes.csv")
DEFAULT_SIGNALS = Path("outputs/trade_signals.csv")
DEFAULT_RISK = Path("outputs/risk_exclusions.csv")
DEFAULT_PAPER_PORTFOLIO = Path("outputs/paper_portfolio.csv")
DEFAULT_HISTORY = Path("outputs/portfolio_history.csv")
DEFAULT_SELECTED_HISTORY = Path("outputs/selected_portfolio_history.csv")
DEFAULT_TRADE_LOG = Path("outputs/paper_trades.csv")
DEFAULT_STATUS = Path("outputs/last_run_status.json")
DEFAULT_BENCHMARKS = Path("outputs/benchmark_history.csv")

BENCHMARK_NAMES = {
    "IWM": "Russell 2000 Small Cap",
    "IJH": "S&P MidCap 400",
    "SPY": "S&P 500",
    "IYF": "U.S. Financials Sector",
    "IYJ": "U.S. Industrials Sector",
    "IYH": "U.S. Healthcare Sector",
    "XLV": "Health Care Select Sector",
    "XLF": "Financial Select Sector",
    "XLI": "Industrial Select Sector",
}

POSITIVE_NEWS_KEYWORDS = {
    "beat",
    "boost",
    "growth",
    "outperform",
    "raises",
    "upgrade",
    "wins",
}
NEGATIVE_NEWS_KEYWORDS = {
    "downgrade",
    "fraud",
    "lawsuit",
    "miss",
    "probe",
    "recall",
    "warning",
}


def benchmark_display_name(symbol: str) -> str:
    normalized = str(symbol).upper()
    name = BENCHMARK_NAMES.get(normalized)
    return f"{name} ({normalized})" if name else normalized


def main() -> None:
    st.set_page_config(page_title="Trading Rotation Review", layout="wide")
    st.title("Trading Rotation Review")
    st.caption("Small/mid-cap sector-rotation model across Financials, Industrials, and Healthcare.")

    rebalance_path = Path(st.sidebar.text_input("Rebalance CSV", str(DEFAULT_REBALANCE)))
    universe_path = Path(st.sidebar.text_input("Universe CSV", str(DEFAULT_UNIVERSE)))
    factors_path = Path(st.sidebar.text_input("Factors CSV", str(DEFAULT_FACTORS)))
    news_path = Path(st.sidebar.text_input("News CSV", str(DEFAULT_NEWS)))
    insider_path = Path(st.sidebar.text_input("Insider CSV", str(DEFAULT_INSIDER)))
    notes_path = Path(st.sidebar.text_input("Review notes CSV", str(DEFAULT_NOTES)))
    signals_path = Path(st.sidebar.text_input("Trade signals CSV", str(DEFAULT_SIGNALS)))
    risk_path = Path(st.sidebar.text_input("Risk exclusions CSV", str(DEFAULT_RISK)))
    paper_portfolio_path = Path(st.sidebar.text_input("Paper portfolio CSV", str(DEFAULT_PAPER_PORTFOLIO)))
    history_path = Path(st.sidebar.text_input("Portfolio history CSV", str(DEFAULT_HISTORY)))
    status_path = Path(st.sidebar.text_input("Last run status JSON", str(DEFAULT_STATUS)))
    portfolio_value = st.sidebar.number_input(
        "Portfolio value",
        min_value=0.0,
        value=10000.0,
        step=5000.0,
        format="%.2f",
    )

    rebalance = _read_csv(rebalance_path)
    universe = _read_csv(universe_path)
    factors = _read_csv(factors_path)
    news = _read_csv(news_path)
    insider = _read_csv(insider_path)
    notes = _read_csv(notes_path)
    signals = _read_csv(signals_path)
    risk_exclusions = _read_csv(risk_path)
    paper_portfolio = _read_csv(paper_portfolio_path)
    history = _read_csv(history_path)

    if rebalance.empty:
        st.warning("No rebalance file found yet. Run the FMP command first.")
        return

    show_data_pull_date(factors_path, history_path)
    _show_last_run_status(status_path)
    _show_summary(rebalance, universe, factors)
    _show_overview_metrics(signals, paper_portfolio, risk_exclusions, history)
    _show_trade_signals(signals)
    _show_paper_portfolio(paper_portfolio)
    st.info("Use the sidebar pages for Recommendations, Risk & Review, Paper Portfolio, and Performance.")


def _show_overview_metrics(
    signals: pd.DataFrame,
    paper_portfolio: pd.DataFrame,
    risk_exclusions: pd.DataFrame,
    history: pd.DataFrame,
) -> None:
    st.subheader("Overview")
    buys = _action_count(signals, "BUY")
    holds = _action_count(signals, "HOLD")
    sells = _action_count(signals, "SELL")
    risk_count = len(risk_exclusions)
    portfolio_value = _latest_account_value(paper_portfolio, history)
    cumulative_return = history["cumulative_return"].iloc[-1] if not history.empty and "cumulative_return" in history else 0.0

    col1, col2, col3, col4, col5, col6 = st.columns(6)
    col1.metric("Buys", f"{buys:,}")
    col2.metric("Holds", f"{holds:,}")
    col3.metric("Sells", f"{sells:,}")
    col4.metric("Risk Exclusions", f"{risk_count:,}")
    col5.metric("Paper Value", _format_currency(portfolio_value))
    col6.metric("Cumulative Return", f"{cumulative_return:.2%}")


def _show_last_run_status(status_path: Path) -> None:
    status = _read_json(status_path)
    if not status:
        st.info("No daily run status file found yet.")
        return

    label = "Daily Run Status"
    if status.get("status") == "success":
        st.success(
            f"{label}: success | finished {status.get('finished_at', 'unknown')} | "
            f"targets {status.get('target_positions', 0)} | "
            f"signals {status.get('trade_signals', 0)} | "
            f"value {_format_currency(status.get('paper_total_value', 0))}"
        )
    elif status.get("status") == "failed":
        st.error(f"{label}: failed | {status.get('error', 'unknown error')}")
    else:
        st.info(f"{label}: {status.get('status', 'unknown')}")


def _show_summary(rebalance: pd.DataFrame, universe: pd.DataFrame, factors: pd.DataFrame) -> None:
    st.subheader("Summary")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Target Positions", f"{len(rebalance):,}")
    col2.metric("Universe Rows", f"{len(universe):,}")
    col3.metric("Factor Rows", f"{len(factors):,}")
    col4.metric("Total Target Weight", f"{rebalance['target_weight'].sum():.1%}")

    sector_weights = rebalance.groupby("sector", as_index=False)["target_weight"].sum()
    sector_weights = sector_weights.sort_values("target_weight", ascending=False)

    sector_weights["target_weight"] = sector_weights["target_weight"].map("{:.1%}".format)
    st.dataframe(sector_weights, use_container_width=True, hide_index=True)


def show_data_pull_date(factors_path: Path = DEFAULT_FACTORS, history_path: Path = DEFAULT_HISTORY) -> None:
    factors = _read_csv(factors_path)
    history = _read_csv(history_path)
    data_date = _latest_data_date(factors, history, factors_path)
    st.caption(f"Last FMP data pull: {data_date}")


def _show_targets(rebalance: pd.DataFrame, portfolio_value: float) -> None:
    st.subheader("Recommended Target Positions")

    sector_filter = st.multiselect(
        "Filter sectors",
        sorted(rebalance["sector"].dropna().unique()),
        default=sorted(rebalance["sector"].dropna().unique()),
    )
    filtered = rebalance[rebalance["sector"].isin(sector_filter)].copy()
    filtered["target_dollars"] = filtered["target_weight"] * portfolio_value
    filtered["score"] = filtered["score"].round(4)
    filtered["sector_target_weight"] = filtered["sector_target_weight"].map("{:.1%}".format)
    filtered["target_weight"] = filtered["target_weight"].map("{:.1%}".format)
    filtered = _format_currency_columns(filtered)

    display_columns = [
        "ticker",
        "company_name",
        "sector",
        "score",
        "target_weight",
        "target_dollars",
        "market_cap",
        "avg_dollar_volume",
    ]
    display_columns = [column for column in display_columns if column in filtered.columns]
    st.dataframe(filtered[display_columns], use_container_width=True, hide_index=True)


def _show_factor_review(rebalance: pd.DataFrame, factors: pd.DataFrame) -> None:
    st.subheader("Why These Stocks Passed")
    selected = rebalance.copy()
    factor_columns = [
        column
        for column in selected.columns
        if column.endswith("_rank")
        or column
        in {
            "relative_strength_6m",
            "earnings_revision",
            "fcf_yield",
            "debt_to_ebitda",
            "volatility_6m",
        }
    ]
    display_columns = ["ticker", "company_name", "sector", "score", *factor_columns]
    display_columns = [column for column in display_columns if column in selected.columns]

    if not factor_columns and not factors.empty:
        st.info("This rebalance was created before factor ranks were added. Regenerate it to see factor evidence.")
        return

    rank_columns = [column for column in selected.columns if column.endswith("_rank")]
    for column in rank_columns:
        selected[column] = selected[column].map("{:.0%}".format)

    numeric_factor_columns = [column for column in factor_columns if column in selected.columns and not column.endswith("_rank")]
    for column in numeric_factor_columns:
        selected[column] = selected[column].map("{:.4f}".format)

    st.dataframe(selected[display_columns], use_container_width=True, hide_index=True)


def _show_trade_signals(signals: pd.DataFrame) -> None:
    st.subheader("Rule-Based Trade Signals")
    if signals.empty:
        st.info("No trade signal file found yet. Run the model with --write-signals.")
        return

    action_counts = signals.groupby("action", as_index=False)["ticker"].count()
    action_counts = action_counts.rename(columns={"ticker": "count"})
    st.bar_chart(action_counts, x="action", y="count")

    display = _format_currency_columns(signals)
    if "target_weight" in display:
        display["target_weight"] = display["target_weight"].map(lambda value: f"{float(value):.1%}")
    display_columns = [
        "action",
        "ticker",
        "company_name",
        "sector",
        "reason",
        "score",
        "target_weight",
        "target_dollars",
        "price",
    ]
    display_columns = [column for column in display_columns if column in display.columns]
    st.dataframe(display[display_columns], use_container_width=True, hide_index=True)


def _show_paper_portfolio(paper_portfolio: pd.DataFrame) -> None:
    st.subheader("Paper Portfolio")
    if paper_portfolio.empty:
        st.info("No paper portfolio file found yet. Run the daily workflow.")
        return

    display = _format_currency_columns(paper_portfolio)
    value_column = "market_value" if "market_value" in paper_portfolio else "position_value"
    if value_column in paper_portfolio:
        st.metric("Paper Portfolio Value", _format_currency(paper_portfolio[value_column].sum()))
    if "target_weight" in display:
        display["target_weight"] = display["target_weight"].map(lambda value: f"{float(value):.1%}")
    if "shares" in display:
        display["shares"] = display["shares"].map(lambda value: f"{float(value):,.4f}")
    st.dataframe(display, use_container_width=True, hide_index=True)


def _show_risk_exclusions(risk_exclusions: pd.DataFrame) -> None:
    st.subheader("Risk Rule Exclusions")
    if risk_exclusions.empty:
        st.info("No stocks were excluded by the configured risk rules.")
        return

    display = risk_exclusions.copy()
    if "score" in display:
        display["score"] = display["score"].round(4)
    st.dataframe(display, use_container_width=True, hide_index=True)


def _show_review_flags(
    rebalance: pd.DataFrame,
    news: pd.DataFrame,
    insider: pd.DataFrame,
    notes: pd.DataFrame,
) -> None:
    st.subheader("Review Flags")
    flags = rebalance[["ticker", "company_name", "sector", "score"]].copy()
    flags = flags.merge(_build_news_flags(news), on="ticker", how="left")
    flags = flags.merge(_build_insider_flags(insider), on="ticker", how="left")
    if not notes.empty and "ticker" in notes:
        flags = flags.merge(notes, on="ticker", how="left")

    fill_values = {
        "recent_news_count": 0,
        "positive_news_flag": False,
        "negative_news_flag": False,
        "insider_purchase_count": 0,
        "insider_purchase_dollars": 0.0,
    }
    flags = flags.fillna(fill_values)
    flags["insider_purchase_dollars"] = flags["insider_purchase_dollars"].map(_format_currency)
    display_columns = [
        "ticker",
        "company_name",
        "sector",
        "score",
        "recent_news_count",
        "positive_news_flag",
        "negative_news_flag",
        "insider_purchase_count",
        "insider_purchase_dollars",
        "decision",
        "notes",
    ]
    display_columns = [column for column in display_columns if column in flags.columns]
    st.dataframe(flags[display_columns], use_container_width=True, hide_index=True)


def _show_review_notes(rebalance: pd.DataFrame, notes: pd.DataFrame, notes_path: Path) -> None:
    st.subheader("Decision Notes")
    editable = rebalance[["ticker", "company_name", "sector"]].copy()
    if not notes.empty and "ticker" in notes:
        editable = editable.merge(notes, on="ticker", how="left")
    if "decision" not in editable:
        editable["decision"] = "watch"
    if "notes" not in editable:
        editable["notes"] = ""
    editable["decision"] = editable["decision"].fillna("watch")
    editable["notes"] = editable["notes"].fillna("")

    edited = st.data_editor(
        editable[["ticker", "company_name", "sector", "decision", "notes"]],
        use_container_width=True,
        hide_index=True,
        column_config={
            "decision": st.column_config.SelectboxColumn(
                "decision",
                options=["watch", "approved", "skip"],
                required=True,
            )
        },
        disabled=["ticker", "company_name", "sector"],
    )

    if st.button("Save decision notes"):
        notes_path.parent.mkdir(parents=True, exist_ok=True)
        edited[["ticker", "decision", "notes"]].to_csv(notes_path, index=False)
        st.success(f"Saved notes to {notes_path}")


def _show_universe(universe: pd.DataFrame) -> None:
    st.subheader("Universe")
    if universe.empty:
        st.info("No universe file found.")
        return

    st.write("Universe by Sector")
    sector_counts = universe.groupby("sector", as_index=False)["ticker"].count()
    sector_counts = sector_counts.rename(columns={"ticker": "count"})
    st.bar_chart(sector_counts, x="sector", y="count")

    st.dataframe(_format_currency_columns(universe), use_container_width=True, hide_index=True)


def _show_news(rebalance: pd.DataFrame, news: pd.DataFrame) -> None:
    st.subheader("Recent Company News")
    if news.empty:
        st.info("No news file found yet. Run the FMP review-data command to populate this section.")
        return

    selected = news[news["ticker"].isin(rebalance["ticker"])].copy()
    if "published_date" in selected:
        selected = selected.sort_values(["ticker", "published_date"], ascending=[True, False])
    display_columns = ["ticker", "published_date", "title", "site", "url"]
    display_columns = [column for column in display_columns if column in selected.columns]
    st.dataframe(selected[display_columns], use_container_width=True, hide_index=True)


def _show_insider_activity(rebalance: pd.DataFrame, insider: pd.DataFrame) -> None:
    st.subheader("Management Stock Purchases / Insider Activity")
    if insider.empty:
        st.info("No insider file found yet. Run the FMP review-data command to populate this section.")
        return

    selected = insider[insider["ticker"].isin(rebalance["ticker"])].copy()
    if "is_purchase" in selected:
        purchase_count = int(selected["is_purchase"].fillna(False).sum())
        st.metric("Potential Purchase Rows", f"{purchase_count:,}")
    if "transaction_date" in selected:
        selected = selected.sort_values(["ticker", "transaction_date"], ascending=[True, False])
    selected = _format_currency_columns(selected)
    display_columns = [
        "ticker",
        "transaction_date",
        "reporting_name",
        "type_of_owner",
        "transaction_type",
        "securities_transacted",
        "price",
        "transaction_value",
        "is_purchase",
    ]
    display_columns = [column for column in display_columns if column in selected.columns]
    st.dataframe(selected[display_columns], use_container_width=True, hide_index=True)


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def _read_json(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _latest_data_date(factors: pd.DataFrame, history: pd.DataFrame, fallback_path: Path) -> str:
    if not factors.empty and "as_of_date" in factors:
        latest = pd.to_datetime(factors["as_of_date"], errors="coerce").max()
        if pd.notna(latest):
            return latest.date().isoformat()

    if not history.empty and "as_of_date" in history:
        latest = pd.to_datetime(history["as_of_date"], errors="coerce").max()
        if pd.notna(latest):
            return latest.date().isoformat()

    if fallback_path.exists():
        modified = datetime.fromtimestamp(fallback_path.stat().st_mtime)
        return f"{modified.date().isoformat()} (file modified)"

    return "unknown"


def _format_currency_columns(frame: pd.DataFrame) -> pd.DataFrame:
    formatted = frame.copy()
    for column in [
        "market_cap",
        "avg_dollar_volume",
        "target_dollars",
        "price",
        "avg_cost",
        "last_price",
        "market_value",
        "position_value",
        "unrealized_pnl",
        "transaction_value",
        "trade_value",
        "cash",
        "positions_value",
        "total_value",
        "cash_after",
    ]:
        if column in formatted:
            formatted[column] = formatted[column].map(_format_currency)
    return formatted


def _format_currency(value: object) -> str:
    if pd.isna(value):
        return ""
    return f"${float(value):,.2f}"


def _build_news_flags(news: pd.DataFrame) -> pd.DataFrame:
    if news.empty or "ticker" not in news:
        return pd.DataFrame(columns=["ticker", "recent_news_count", "positive_news_flag", "negative_news_flag"])

    enriched = news.copy()
    text = (
        enriched.get("title", pd.Series("", index=enriched.index)).fillna("")
        + " "
        + enriched.get("text", pd.Series("", index=enriched.index)).fillna("")
    ).str.lower()
    enriched["positive_news_flag"] = text.map(lambda value: _contains_keyword(value, POSITIVE_NEWS_KEYWORDS))
    enriched["negative_news_flag"] = text.map(lambda value: _contains_keyword(value, NEGATIVE_NEWS_KEYWORDS))

    return (
        enriched.groupby("ticker", as_index=False)
        .agg(
            recent_news_count=("ticker", "size"),
            positive_news_flag=("positive_news_flag", "max"),
            negative_news_flag=("negative_news_flag", "max"),
        )
    )


def _build_insider_flags(insider: pd.DataFrame) -> pd.DataFrame:
    if insider.empty or "ticker" not in insider:
        return pd.DataFrame(columns=["ticker", "insider_purchase_count", "insider_purchase_dollars"])

    enriched = insider.copy()
    if "is_purchase" not in enriched:
        enriched["is_purchase"] = False
    if "transaction_value" not in enriched:
        enriched["transaction_value"] = 0.0

    purchases = enriched[enriched["is_purchase"].fillna(False)].copy()
    if purchases.empty:
        return pd.DataFrame(
            {
                "ticker": sorted(enriched["ticker"].dropna().unique()),
                "insider_purchase_count": 0,
                "insider_purchase_dollars": 0.0,
            }
        )

    return (
        purchases.groupby("ticker", as_index=False)
        .agg(
            insider_purchase_count=("ticker", "size"),
            insider_purchase_dollars=("transaction_value", "sum"),
        )
    )


def _contains_keyword(value: str, keywords: set[str]) -> bool:
    return any(keyword in value for keyword in keywords)


def _action_count(signals: pd.DataFrame, action: str) -> int:
    if signals.empty or "action" not in signals:
        return 0
    return int((signals["action"] == action).sum())


def _latest_account_value(paper_portfolio: pd.DataFrame, history: pd.DataFrame) -> float:
    if not history.empty and "total_value" in history:
        return float(history.iloc[-1]["total_value"])
    if not history.empty and "portfolio_value" in history:
        return float(history.iloc[-1]["portfolio_value"])
    if "market_value" in paper_portfolio:
        return float(paper_portfolio["market_value"].sum())
    if "position_value" in paper_portfolio:
        return float(paper_portfolio["position_value"].sum())
    return 0.0


if __name__ == "__main__":
    main()

