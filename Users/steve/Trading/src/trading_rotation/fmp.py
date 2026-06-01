from __future__ import annotations

import math
import os
import time
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import urlopen

import pandas as pd
from dotenv import load_dotenv

from trading_rotation.config import StrategyConfig


FMP_BASE_URL = "https://financialmodelingprep.com/stable"
FMP_SECTOR_NAMES = {
    "Financials": "Financial Services",
    "Industrials": "Industrials",
    "Healthcare": "Healthcare",
}


class FmpClient:
    def __init__(self, api_key: str | None = None, base_url: str = FMP_BASE_URL) -> None:
        load_dotenv()
        self.api_key = api_key or os.getenv("FMP_API_KEY")
        if not self.api_key:
            raise ValueError("Set FMP_API_KEY in your environment or a local .env file.")
        self.base_url = base_url.rstrip("/")

    def get(self, endpoint: str, **params: Any) -> Any:
        query = urlencode({**params, "apikey": self.api_key})
        url = f"{self.base_url}/{endpoint.lstrip('/')}?{query}"
        try:
            with urlopen(url, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"FMP request failed for {endpoint}: HTTP {error.code} {body}") from error


def fetch_universe(client: FmpClient, config: StrategyConfig) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []

    for local_sector in config.sector_weights:
        fmp_sector = FMP_SECTOR_NAMES.get(local_sector, local_sector)
        response = client.get(
            "company-screener",
            marketCapMoreThan=config.min_market_cap,
            marketCapLowerThan=config.max_market_cap,
            sector=fmp_sector,
            isEtf="false",
            isFund="false",
            isActivelyTrading="true",
            limit=10000,
        )

        for item in response:
            symbol = item.get("symbol")
            market_cap = item.get("marketCap")
            price = item.get("price")
            volume = item.get("volume") or item.get("volAvg")
            avg_dollar_volume = _safe_float(price) * _safe_float(volume)

            if not symbol or market_cap is None:
                continue

            rows.append(
                {
                    "ticker": symbol,
                    "company_name": item.get("companyName", ""),
                    "sector": local_sector,
                    "price": _safe_float(price),
                    "market_cap": int(market_cap),
                    "avg_dollar_volume": avg_dollar_volume,
                    "is_recent_ipo": False,
                }
            )

    universe = pd.DataFrame(rows).drop_duplicates(subset=["ticker"])
    if universe.empty:
        raise ValueError("FMP returned no universe rows for the configured sectors.")
    return universe


def fetch_factors(
    client: FmpClient,
    universe: pd.DataFrame,
    as_of: str,
    max_tickers: int | None = None,
) -> pd.DataFrame:
    as_of_date = pd.Timestamp(as_of).date()
    start_date = as_of_date - timedelta(days=220)
    rows: list[dict[str, Any]] = []

    tickers = list(universe["ticker"].dropna().unique())
    if max_tickers is not None:
        tickers = tickers[:max_tickers]

    for ticker in tickers:
        prices = _fetch_historical_prices(client, ticker, start_date, as_of_date)
        metrics = _first_or_empty(client.get("key-metrics-ttm", symbol=ticker))
        ratios = _first_or_empty(client.get("ratios-ttm", symbol=ticker))

        rows.append(
            {
                "ticker": ticker,
                "as_of_date": as_of,
                "relative_strength_6m": _relative_strength(prices),
                "earnings_revision": 0.0,
                "fcf_yield": _safe_float(metrics.get("freeCashFlowYieldTTM")),
                "debt_to_ebitda": _safe_float(
                    metrics.get("netDebtToEBITDATTM") or ratios.get("debtEquityRatioTTM")
                ),
                "volatility_6m": _annualized_volatility(prices),
            }
        )
        time.sleep(0.15)

    factors = pd.DataFrame(rows)
    return factors.replace([math.inf, -math.inf], pd.NA).dropna(
        subset=["relative_strength_6m", "fcf_yield", "debt_to_ebitda", "volatility_6m"]
    )


def write_fmp_inputs(
    config: StrategyConfig,
    as_of: str,
    universe_output: str | Path,
    factors_output: str | Path,
    max_tickers: int | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    client = FmpClient()
    universe = fetch_universe(client, config)
    factor_universe = _limit_by_sector(universe, max_tickers)
    factors = fetch_factors(client, factor_universe, as_of)

    universe_path = Path(universe_output)
    factors_path = Path(factors_output)
    universe_path.parent.mkdir(parents=True, exist_ok=True)
    factors_path.parent.mkdir(parents=True, exist_ok=True)
    universe.to_csv(universe_path, index=False)
    factors.to_csv(factors_path, index=False)
    return universe, factors


def write_fmp_inputs_from_seed(
    seed_universe: str | Path,
    as_of: str,
    universe_output: str | Path,
    factors_output: str | Path,
    max_tickers: int | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    client = FmpClient()
    seed = pd.read_csv(seed_universe)
    _require_seed_columns(seed)
    universe = _enrich_seed_universe(client, seed, max_tickers=max_tickers)
    factors = fetch_factors(client, universe, as_of, max_tickers=max_tickers)

    universe_path = Path(universe_output)
    factors_path = Path(factors_output)
    universe_path.parent.mkdir(parents=True, exist_ok=True)
    factors_path.parent.mkdir(parents=True, exist_ok=True)
    universe.to_csv(universe_path, index=False)
    factors.to_csv(factors_path, index=False)
    return universe, factors


def write_fmp_review_data(
    rebalance_path: str | Path,
    news_output: str | Path,
    insider_output: str | Path,
    news_limit: int = 5,
    insider_limit: int = 25,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    client = FmpClient()
    rebalance = pd.read_csv(rebalance_path)
    tickers = list(rebalance["ticker"].dropna().unique())

    news = fetch_stock_news(client, tickers, limit=news_limit)
    insider = fetch_insider_trades(client, tickers, limit=insider_limit)

    news_path = Path(news_output)
    insider_path = Path(insider_output)
    news_path.parent.mkdir(parents=True, exist_ok=True)
    insider_path.parent.mkdir(parents=True, exist_ok=True)
    news.to_csv(news_path, index=False)
    insider.to_csv(insider_path, index=False)
    return news, insider


def write_benchmark_history(
    symbols: list[str],
    as_of: str,
    output: str | Path,
    lookback_days: int = 10,
) -> pd.DataFrame:
    client = FmpClient()
    rows = []
    as_of_date = pd.Timestamp(as_of).date()
    start_date = as_of_date - timedelta(days=lookback_days)

    for symbol in symbols:
        prices = _fetch_historical_price_frame(client, symbol, start_date, as_of_date)
        if prices.empty:
            continue
        rows.extend(
            {
                "as_of_date": row["date"].date().isoformat(),
                "symbol": symbol,
                "price": float(row["close"]),
            }
            for row in prices.to_dict(orient="records")
        )
        time.sleep(0.15)

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    latest = pd.DataFrame(rows)
    history = latest

    if history.empty:
        history.to_csv(output_path, index=False)
        return history

    history = history.sort_values(["symbol", "as_of_date"])
    history["benchmark_return"] = history.groupby("symbol")["price"].pct_change().fillna(0.0)
    first_prices = history.groupby("symbol")["price"].transform("first")
    history["benchmark_cumulative_return"] = history["price"] / first_prices - 1
    history.to_csv(output_path, index=False)
    return history


def write_selected_portfolio_history(
    rebalance_path: str | Path,
    as_of: str,
    portfolio_value: float,
    output: str | Path,
    lookback_days: int = 365,
) -> pd.DataFrame:
    client = FmpClient()
    rebalance = pd.read_csv(rebalance_path)
    as_of_date = pd.Timestamp(as_of).date()
    start_date = as_of_date - timedelta(days=lookback_days)
    price_frames = []

    for row in rebalance.to_dict(orient="records"):
        ticker = row["ticker"]
        prices = _fetch_historical_price_frame(client, ticker, start_date, as_of_date)
        if prices.empty:
            continue
        prices = prices[["date", "close"]].copy()
        prices["ticker"] = ticker
        prices["target_weight"] = float(row["target_weight"])
        price_frames.append(prices)
        time.sleep(0.15)

    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not price_frames:
        empty = pd.DataFrame()
        empty.to_csv(output_path, index=False)
        return empty

    price_data = pd.concat(price_frames, ignore_index=True)
    prices = price_data.pivot(index="date", columns="ticker", values="close").sort_index().ffill()
    first_prices = prices.apply(lambda column: column.dropna().iloc[0] if not column.dropna().empty else math.nan)
    normalized = prices / first_prices
    weights = rebalance.set_index("ticker")["target_weight"].reindex(normalized.columns).fillna(0.0)
    portfolio_index = normalized.mul(weights, axis=1).sum(axis=1)

    history = pd.DataFrame(
        {
            "as_of_date": portfolio_index.index.date.astype(str),
            "cash": 0.0,
            "positions_value": portfolio_value * portfolio_index.values,
            "total_value": portfolio_value * portfolio_index.values,
        }
    )
    history["daily_return"] = history["total_value"].pct_change().fillna(0.0)
    first_value = history["total_value"].iloc[0]
    history["cumulative_return"] = (history["total_value"] / first_value - 1) if first_value else 0.0
    history["source"] = "current_selection_backfill"
    history.to_csv(output_path, index=False)
    return history


def fetch_stock_news(client: FmpClient, tickers: list[str], limit: int = 5) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for ticker in tickers:
        response = client.get("news/stock", symbols=ticker, limit=limit)
        for item in _as_list(response):
            rows.append(
                {
                    "ticker": ticker,
                    "published_date": item.get("publishedDate") or item.get("date", ""),
                    "title": item.get("title", ""),
                    "site": item.get("site") or item.get("publisher", ""),
                    "url": item.get("url", ""),
                    "text": item.get("text") or item.get("summary", ""),
                }
            )
        time.sleep(0.15)
    return pd.DataFrame(rows)


def fetch_insider_trades(client: FmpClient, tickers: list[str], limit: int = 25) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for ticker in tickers:
        response = client.get("insider-trading/search", symbol=ticker, limit=limit)
        for item in _as_list(response):
            transaction_type = str(
                item.get("transactionType")
                or item.get("transactionTypeCode")
                or item.get("typeOfOwner")
                or ""
            )
            securities = _safe_float(item.get("securitiesTransacted") or item.get("shares"))
            price = _safe_float(item.get("price"))
            rows.append(
                {
                    "ticker": ticker,
                    "filing_date": item.get("filingDate", ""),
                    "transaction_date": item.get("transactionDate", ""),
                    "reporting_name": item.get("reportingName", ""),
                    "type_of_owner": item.get("typeOfOwner", ""),
                    "transaction_type": transaction_type,
                    "securities_transacted": securities,
                    "price": price,
                    "transaction_value": securities * price,
                    "is_purchase": _is_purchase(transaction_type),
                }
            )
        time.sleep(0.15)
    return pd.DataFrame(rows)


def _fetch_historical_prices(
    client: FmpClient,
    ticker: str,
    start_date: date,
    end_date: date,
) -> pd.Series:
    response = client.get(
        "historical-price-eod/full",
        symbol=ticker,
        **{"from": start_date.isoformat(), "to": end_date.isoformat()},
    )
    historical = response.get("historical", []) if isinstance(response, dict) else response
    prices = pd.DataFrame(historical)
    if prices.empty or "close" not in prices:
        return pd.Series(dtype=float)
    prices["date"] = pd.to_datetime(prices["date"])
    prices = prices.sort_values("date")
    return prices["close"].astype(float)


def _fetch_historical_price_frame(
    client: FmpClient,
    ticker: str,
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    response = client.get(
        "historical-price-eod/full",
        symbol=ticker,
        **{"from": start_date.isoformat(), "to": end_date.isoformat()},
    )
    historical = response.get("historical", []) if isinstance(response, dict) else response
    prices = pd.DataFrame(historical)
    if prices.empty or "close" not in prices:
        return pd.DataFrame(columns=["date", "close"])
    prices["date"] = pd.to_datetime(prices["date"])
    return prices[["date", "close"]].sort_values("date")


def _enrich_seed_universe(
    client: FmpClient,
    seed: pd.DataFrame,
    max_tickers: int | None = None,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    seed_rows = seed.dropna(subset=["ticker", "sector"])
    if max_tickers is not None:
        seed_rows = seed_rows.head(max_tickers)

    for row in seed_rows.to_dict(orient="records"):
        ticker = str(row["ticker"]).upper()
        profile = _first_or_empty(client.get("profile", symbol=ticker))
        market_cap = profile.get("marketCap")
        price = profile.get("price")
        volume = profile.get("volAvg") or profile.get("volume")

        if not market_cap:
            continue

        rows.append(
            {
                "ticker": ticker,
                "company_name": profile.get("companyName", ""),
                "sector": row["sector"],
                "price": _safe_float(price),
                "market_cap": int(market_cap),
                "avg_dollar_volume": _safe_float(price) * _safe_float(volume),
                "is_recent_ipo": False,
            }
        )
        time.sleep(0.15)

    universe = pd.DataFrame(rows)
    if universe.empty:
        raise ValueError("FMP returned no profile rows for the seed universe.")
    return universe


def _relative_strength(prices: pd.Series) -> float:
    if len(prices) < 2:
        return math.nan
    return float(prices.iloc[-1] / prices.iloc[0] - 1)


def _annualized_volatility(prices: pd.Series) -> float:
    returns = prices.pct_change().dropna()
    if returns.empty:
        return math.nan
    return float(returns.std() * math.sqrt(252))


def _first_or_empty(response: Any) -> dict[str, Any]:
    if isinstance(response, list) and response:
        return response[0]
    return {}


def _as_list(response: Any) -> list[dict[str, Any]]:
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if isinstance(response, dict):
        return [response]
    return []


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _require_seed_columns(seed: pd.DataFrame) -> None:
    missing = sorted({"ticker", "sector"} - set(seed.columns))
    if missing:
        raise ValueError(f"Missing seed universe columns: {', '.join(missing)}")


def _limit_by_sector(universe: pd.DataFrame, max_tickers: int | None) -> pd.DataFrame:
    if max_tickers is None or len(universe) <= max_tickers:
        return universe

    sector_count = universe["sector"].nunique()
    per_sector = max(1, math.ceil(max_tickers / sector_count))
    return (
        universe.sort_values(["sector", "market_cap"], ascending=[True, False])
        .groupby("sector", group_keys=False)
        .head(per_sector)
        .head(max_tickers)
        .copy()
    )


def _is_purchase(transaction_type: str) -> bool:
    normalized = transaction_type.lower()
    return normalized in {"p", "purchase"} or "purchase" in normalized

