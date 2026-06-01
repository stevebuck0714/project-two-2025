from pathlib import Path

import pandas as pd
import streamlit as st

from trading_rotation.dashboard import (
    DEFAULT_FACTORS,
    DEFAULT_HISTORY,
    DEFAULT_REBALANCE,
    _format_currency_columns,
    _read_csv,
    _show_factor_review,
    _show_targets,
    show_data_pull_date,
)


st.set_page_config(page_title="Recommendations", layout="wide")
st.title("Recommendations")

rebalance_path = Path(st.sidebar.text_input("Rebalance CSV", str(DEFAULT_REBALANCE)))
factors_path = Path(st.sidebar.text_input("Factors CSV", str(DEFAULT_FACTORS)))
history_path = Path(st.sidebar.text_input("Portfolio history CSV", str(DEFAULT_HISTORY)))
portfolio_value = st.sidebar.number_input(
    "Portfolio value",
    min_value=0.0,
    value=10000.0,
    step=5000.0,
    format="%.2f",
)

rebalance = _read_csv(rebalance_path)
factors = _read_csv(factors_path)

if rebalance.empty:
    st.warning("No rebalance file found yet.")
else:
    show_data_pull_date(factors_path, history_path)
    _show_targets(rebalance, portfolio_value)
    _show_factor_review(rebalance, factors)

    st.subheader("Full Rebalance CSV")
    display = _format_currency_columns(rebalance.copy())
    percent_columns = [column for column in ["sector_target_weight", "target_weight"] if column in display]
    for column in percent_columns:
        display[column] = display[column].map(lambda value: f"{float(value):.1%}")
    st.dataframe(display, use_container_width=True, hide_index=True)

