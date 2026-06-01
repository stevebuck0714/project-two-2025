from pathlib import Path

import pandas as pd
import streamlit as st

from trading_rotation.dashboard import (
    DEFAULT_BENCHMARKS,
    _format_currency,
    _format_currency_columns,
    _read_csv,
)


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


def benchmark_display_name(symbol: str) -> str:
    normalized = str(symbol).upper()
    name = BENCHMARK_NAMES.get(normalized)
    return f"{name} ({normalized})" if name else normalized


def _backtest_stats(equity: pd.DataFrame, trades: pd.DataFrame) -> dict[str, float | int]:
    returns = equity["daily_return"].astype(float) if "daily_return" in equity else pd.Series(dtype=float)
    value = equity["portfolio_value"].astype(float) if "portfolio_value" in equity else pd.Series(dtype=float)
    drawdown = value / value.cummax() - 1 if not value.empty else pd.Series(dtype=float)
    if not trades.empty:
        turnover = trades[trades["action"].isin(["BUY", "SELL"])].groupby("as_of_date").size()
    else:
        turnover = pd.Series(dtype=float)

    return {
        "max_drawdown": float(drawdown.min()) if not drawdown.empty else 0.0,
        "avg_monthly_turnover": float(turnover.mean()) if not turnover.empty else 0.0,
        "total_turnover_dollars": float(equity["turnover_dollars"].sum()) if "turnover_dollars" in equity else 0.0,
        "total_spread_cost": float(equity["spread_cost"].sum()) if "spread_cost" in equity else 0.0,
        "total_tax_estimate": float(equity["tax_estimate"].sum()) if "tax_estimate" in equity else 0.0,
        "positive_months": int((returns > 0).sum()) if not returns.empty else 0,
        "negative_months": int((returns < 0).sum()) if not returns.empty else 0,
        "best_month": float(returns.max()) if not returns.empty else 0.0,
        "worst_month": float(returns.min()) if not returns.empty else 0.0,
    }


def _benchmark_comparison(equity: pd.DataFrame, benchmarks: pd.DataFrame) -> pd.DataFrame:
    if equity.empty or benchmarks.empty:
        return pd.DataFrame()

    start = pd.Timestamp(equity["as_of_date"].iloc[0])
    end = pd.Timestamp(equity["as_of_date"].iloc[-1])

    portfolio = equity[["as_of_date", "cumulative_return"]].copy()
    portfolio["symbol"] = "BACKTEST"
    portfolio = portfolio.rename(columns={"cumulative_return": "return"})

    benchmark_data = benchmarks.copy()
    benchmark_data["as_of_date"] = pd.to_datetime(benchmark_data["as_of_date"])
    benchmark_data = benchmark_data[
        (benchmark_data["as_of_date"] >= start) & (benchmark_data["as_of_date"] <= end)
    ].copy()
    if benchmark_data.empty:
        return portfolio

    benchmark_data = benchmark_data.sort_values(["symbol", "as_of_date"])
    first_prices = benchmark_data.groupby("symbol")["price"].transform("first")
    benchmark_data["return"] = benchmark_data["price"] / first_prices - 1
    benchmark_data["as_of_date"] = benchmark_data["as_of_date"].dt.date.astype(str)
    return pd.concat([portfolio, benchmark_data[["as_of_date", "symbol", "return"]]], ignore_index=True)


st.set_page_config(page_title="Backtest", layout="wide")
st.title("Backtest")
st.caption(
    "Practical monthly backtest using historical price-based relative strength and volatility. "
    "Point-in-time fundamentals are treated as neutral in this first version."
)

equity_path = Path(st.sidebar.text_input("Backtest equity CSV", "outputs/backtest_equity.csv"))
holdings_path = Path(st.sidebar.text_input("Backtest holdings CSV", "outputs/backtest_holdings.csv"))
trades_path = Path(st.sidebar.text_input("Backtest trades CSV", "outputs/backtest_trades.csv"))
benchmark_path = Path(st.sidebar.text_input("Benchmark history CSV", str(DEFAULT_BENCHMARKS)))

equity = _read_csv(equity_path)
holdings = _read_csv(holdings_path)
trades = _read_csv(trades_path)
benchmarks = _read_csv(benchmark_path)

if equity.empty:
    st.info("No backtest output found yet. Run the CLI with --run-backtest.")
else:
    latest = equity.iloc[-1]
    stats = _backtest_stats(equity, trades)
    after_tax_value = latest.get("after_tax_spread_value", latest["portfolio_value"])
    after_tax_return = latest.get("after_tax_spread_cumulative_return", latest["cumulative_return"])
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Latest Date", str(latest["as_of_date"]))
    col2.metric("Gross Value", _format_currency(latest["portfolio_value"]))
    col3.metric("After Tax/Spread", _format_currency(after_tax_value))
    col4.metric("Max Drawdown", f"{stats['max_drawdown']:.2%}")
    col5.metric("Avg Monthly Turnover", f"{stats['avg_monthly_turnover']:.1f}")

    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Gross Return", f"{float(latest['cumulative_return']):.2%}")
    col2.metric("After Tax/Spread Return", f"{float(after_tax_return):.2%}")
    col3.metric("Spread Impact", _format_currency(stats["total_spread_cost"]))
    col4.metric("Tax Estimate", _format_currency(stats["total_tax_estimate"]))
    col5.metric("Turnover Dollars", _format_currency(stats["total_turnover_dollars"]))

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Positive Months", f"{stats['positive_months']:,}")
    col2.metric("Negative Months", f"{stats['negative_months']:,}")
    col3.metric("Best Month", f"{stats['best_month']:.2%}")
    col4.metric("Worst Month", f"{stats['worst_month']:.2%}")

    st.subheader("Backtest Equity Curve")
    value_columns = ["portfolio_value"]
    if "after_tax_spread_value" in equity:
        value_columns.append("after_tax_spread_value")
    st.line_chart(equity, x="as_of_date", y=value_columns)

    st.subheader("Backtest Returns")
    return_columns = ["cumulative_return"]
    if "after_tax_spread_cumulative_return" in equity:
        return_columns.append("after_tax_spread_cumulative_return")
    st.line_chart(equity, x="as_of_date", y=return_columns)

    if not benchmarks.empty:
        st.subheader("Backtest vs Benchmarks")
        comparison = _benchmark_comparison(equity, benchmarks)
        if comparison.empty:
            st.info("Benchmark history does not overlap the backtest dates.")
        else:
            comparison["benchmark"] = comparison["symbol"].map(benchmark_display_name)
            st.line_chart(comparison, x="as_of_date", y="return", color="benchmark")
            latest_portfolio_return = float(equity.iloc[-1]["cumulative_return"])
            latest_benchmarks = comparison[comparison["symbol"] != "BACKTEST"].groupby("symbol", as_index=False).tail(1)
            latest_benchmarks["relative_return"] = latest_portfolio_return - latest_benchmarks["return"]
            display_benchmarks = latest_benchmarks[["symbol", "return", "relative_return"]].copy()
            display_benchmarks.insert(0, "benchmark", display_benchmarks["symbol"].map(benchmark_display_name))
            display_benchmarks["return"] = display_benchmarks["return"].map(lambda value: f"{float(value):.2%}")
            display_benchmarks["relative_return"] = display_benchmarks["relative_return"].map(
                lambda value: f"{float(value):.2%}"
            )
            st.dataframe(display_benchmarks, use_container_width=True, hide_index=True)

    display_equity = equity.copy()
    for column in [
        "portfolio_value",
        "after_tax_spread_value",
        "turnover_dollars",
        "realized_gain",
        "spread_cost",
        "tax_estimate",
        "cumulative_spread_cost",
        "cumulative_tax_estimate",
    ]:
        if column in display_equity:
            display_equity[column] = display_equity[column].map(_format_currency)
    for column in ["daily_return", "cumulative_return", "after_tax_spread_daily_return", "after_tax_spread_cumulative_return"]:
        if column in display_equity:
            display_equity[column] = display_equity[column].map(lambda value: f"{float(value):.2%}")
    st.dataframe(display_equity, use_container_width=True, hide_index=True)

st.subheader("Backtest Holdings")
if holdings.empty:
    st.info("No holdings output found.")
else:
    st.dataframe(_format_currency_columns(holdings), use_container_width=True, hide_index=True)

st.subheader("Backtest Trades")
if trades.empty:
    st.info("No trades output found.")
else:
    st.dataframe(_format_currency_columns(trades), use_container_width=True, hide_index=True)

