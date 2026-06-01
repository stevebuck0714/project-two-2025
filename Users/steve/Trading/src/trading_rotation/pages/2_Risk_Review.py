from pathlib import Path

import streamlit as st

from trading_rotation.dashboard import (
    DEFAULT_FACTORS,
    DEFAULT_HISTORY,
    DEFAULT_INSIDER,
    DEFAULT_NEWS,
    DEFAULT_NOTES,
    DEFAULT_REBALANCE,
    DEFAULT_RISK,
    _read_csv,
    _show_insider_activity,
    _show_news,
    _show_review_flags,
    _show_review_notes,
    _show_risk_exclusions,
    show_data_pull_date,
)


st.set_page_config(page_title="Risk & Review", layout="wide")
st.title("Risk & Review")

rebalance_path = Path(st.sidebar.text_input("Rebalance CSV", str(DEFAULT_REBALANCE)))
factors_path = Path(st.sidebar.text_input("Factors CSV", str(DEFAULT_FACTORS)))
history_path = Path(st.sidebar.text_input("Portfolio history CSV", str(DEFAULT_HISTORY)))
risk_path = Path(st.sidebar.text_input("Risk exclusions CSV", str(DEFAULT_RISK)))
news_path = Path(st.sidebar.text_input("News CSV", str(DEFAULT_NEWS)))
insider_path = Path(st.sidebar.text_input("Insider CSV", str(DEFAULT_INSIDER)))
notes_path = Path(st.sidebar.text_input("Review notes CSV", str(DEFAULT_NOTES)))

rebalance = _read_csv(rebalance_path)
risk_exclusions = _read_csv(risk_path)
news = _read_csv(news_path)
insider = _read_csv(insider_path)
notes = _read_csv(notes_path)

if rebalance.empty:
    st.warning("No rebalance file found yet.")
else:
    show_data_pull_date(factors_path, history_path)
    _show_risk_exclusions(risk_exclusions)
    _show_review_flags(rebalance, news, insider, notes)
    _show_review_notes(rebalance, notes, notes_path)
    _show_news(rebalance, news)
    _show_insider_activity(rebalance, insider)

