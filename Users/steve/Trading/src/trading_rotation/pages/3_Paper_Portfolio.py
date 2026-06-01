from pathlib import Path

import streamlit as st

from trading_rotation.dashboard import (
    DEFAULT_FACTORS,
    DEFAULT_HISTORY,
    DEFAULT_PAPER_PORTFOLIO,
    DEFAULT_SIGNALS,
    DEFAULT_TRADE_LOG,
    _format_currency_columns,
    _read_csv,
    _show_paper_portfolio,
    _show_trade_signals,
    show_data_pull_date,
)


st.set_page_config(page_title="Paper Portfolio", layout="wide")
st.title("Paper Portfolio")

signals_path = Path(st.sidebar.text_input("Trade signals CSV", str(DEFAULT_SIGNALS)))
paper_portfolio_path = Path(st.sidebar.text_input("Paper portfolio CSV", str(DEFAULT_PAPER_PORTFOLIO)))
trade_log_path = Path(st.sidebar.text_input("Trade log CSV", str(DEFAULT_TRADE_LOG)))
factors_path = Path(st.sidebar.text_input("Factors CSV", str(DEFAULT_FACTORS)))
history_path = Path(st.sidebar.text_input("Portfolio history CSV", str(DEFAULT_HISTORY)))

signals = _read_csv(signals_path)
paper_portfolio = _read_csv(paper_portfolio_path)
trade_log = _read_csv(trade_log_path)

show_data_pull_date(factors_path, history_path)
_show_trade_signals(signals)
_show_paper_portfolio(paper_portfolio)

st.subheader("Paper Trade Log")
if trade_log.empty:
    st.info("No paper trades have been recorded yet.")
else:
    st.dataframe(_format_currency_columns(trade_log), use_container_width=True, hide_index=True)

