from pathlib import Path

import pandas as pd
import streamlit as st

from trading_rotation.dashboard import (
    DEFAULT_BENCHMARKS,
    DEFAULT_FACTORS,
    DEFAULT_HISTORY,
    _format_currency,
    _read_csv,
    show_data_pull_date,
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


st.set_page_config(page_title="Performance", layout="wide")
st.title("Performance")

DEFAULT_SELECTED_HISTORY = Path("outputs/selected_portfolio_history.csv")
history_path = Path(st.sidebar.text_input("Portfolio history CSV", str(DEFAULT_HISTORY)))
selected_history_path = Path(st.sidebar.text_input("Selected portfolio history CSV", str(DEFAULT_SELECTED_HISTORY)))
benchmark_path = Path(st.sidebar.text_input("Benchmark history CSV", str(DEFAULT_BENCHMARKS)))
factors_path = Path(st.sidebar.text_input("Factors CSV", str(DEFAULT_FACTORS)))
history = _read_csv(history_path)
selected_history = _read_csv(selected_history_path)
benchmarks = _read_csv(benchmark_path)

performance_history = selected_history if not selected_history.empty else history

if performance_history.empty:
    st.info("No portfolio history yet. Run the daily workflow to populate this page.")
else:
    show_data_pull_date(factors_path, history_path)
    latest = performance_history.iloc[-1]
    value_column = "total_value" if "total_value" in performance_history else "portfolio_value"
    history_label = (
        "Current Selection Backfill" if not selected_history.empty else "Paper Account"
    )
    st.caption(f"Performance series: {history_label}")
    col1, col2, col3 = st.columns(3)
    col1.metric("Latest Date", str(latest["as_of_date"]))
    col2.metric("Portfolio Value", _format_currency(latest[value_column]))
    col3.metric("Cumulative Return", f"{float(latest['cumulative_return']):.2%}")

    st.subheader("Portfolio Value")
    st.line_chart(performance_history, x="as_of_date", y=value_column)

    st.subheader("Returns")
    st.line_chart(performance_history, x="as_of_date", y="cumulative_return")

    if not benchmarks.empty:
        st.subheader("Portfolio vs Benchmarks")
        portfolio_returns = performance_history[["as_of_date", "cumulative_return"]].copy()
        portfolio_returns["symbol"] = "PORTFOLIO"
        portfolio_returns = portfolio_returns.rename(columns={"cumulative_return": "return"})

        benchmark_returns = benchmarks[["as_of_date", "symbol", "benchmark_cumulative_return"]].copy()
        benchmark_returns = benchmark_returns.rename(columns={"benchmark_cumulative_return": "return"})
        combined = pd.concat([portfolio_returns, benchmark_returns], ignore_index=True)
        combined["benchmark"] = combined["symbol"].map(benchmark_display_name)
        st.line_chart(combined, x="as_of_date", y="return", color="benchmark")

        latest_portfolio_return = float(performance_history.iloc[-1]["cumulative_return"])
        latest_benchmarks = benchmarks.sort_values("as_of_date").groupby("symbol", as_index=False).tail(1)
        latest_benchmarks["relative_return"] = latest_portfolio_return - latest_benchmarks[
            "benchmark_cumulative_return"
        ]
        display_benchmarks = latest_benchmarks[
            ["symbol", "price", "benchmark_cumulative_return", "relative_return"]
        ].copy()
        display_benchmarks.insert(0, "benchmark", display_benchmarks["symbol"].map(benchmark_display_name))
        display_benchmarks["price"] = display_benchmarks["price"].map(_format_currency)
        display_benchmarks["benchmark_cumulative_return"] = display_benchmarks[
            "benchmark_cumulative_return"
        ].map(lambda value: f"{float(value):.2%}")
        display_benchmarks["relative_return"] = display_benchmarks["relative_return"].map(
            lambda value: f"{float(value):.2%}"
        )
        st.dataframe(display_benchmarks, use_container_width=True, hide_index=True)

    display = performance_history.copy()
    for column in ["portfolio_value", "cash", "positions_value", "total_value"]:
        if column in display:
            display[column] = display[column].map(_format_currency)
    display["daily_return"] = display["daily_return"].map(lambda value: f"{float(value):.2%}")
    display["cumulative_return"] = display["cumulative_return"].map(lambda value: f"{float(value):.2%}")
    st.dataframe(display, use_container_width=True, hide_index=True)

