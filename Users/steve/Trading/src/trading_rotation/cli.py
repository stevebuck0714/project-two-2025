from __future__ import annotations

import argparse
import json
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Any

from trading_rotation.backtest import write_backtest_outputs
from trading_rotation.config import load_strategy_config
from trading_rotation.fmp import (
    write_benchmark_history,
    write_fmp_inputs,
    write_fmp_inputs_from_seed,
    write_fmp_review_data,
    write_selected_portfolio_history,
)
from trading_rotation.history import find_previous_rebalance
from trading_rotation.model import build_rebalance, build_risk_exclusions, load_factors, load_universe
from trading_rotation.portfolio import execute_paper_account
from trading_rotation.signals import build_trade_signals, load_optional_rebalance


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a monthly sector-rotation rebalance file.")
    parser.add_argument("--config", required=True, help="Path to strategy YAML config.")
    parser.add_argument("--universe", required=True, help="Path to universe CSV.")
    parser.add_argument("--factors", required=True, help="Path to factor CSV.")
    parser.add_argument("--as-of", help="Rebalance date, formatted as YYYY-MM-DD. Defaults to today.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument(
        "--fetch-fmp",
        action="store_true",
        help="Fetch universe and factor CSVs from Financial Modeling Prep before rebalancing.",
    )
    parser.add_argument(
        "--seed-universe",
        help="Optional ticker/sector seed CSV for FMP Basic plans that do not include screeners.",
    )
    parser.add_argument(
        "--max-fmp-tickers",
        type=int,
        default=30,
        help="Maximum number of tickers to enrich from FMP when --fetch-fmp is used.",
    )
    parser.add_argument(
        "--fetch-review-data",
        action="store_true",
        help="Fetch FMP news and insider activity for the generated rebalance output.",
    )
    parser.add_argument("--news-output", default="data/news.fmp.csv", help="Output CSV path for FMP news.")
    parser.add_argument(
        "--insider-output",
        default="data/insider.fmp.csv",
        help="Output CSV path for FMP insider transactions.",
    )
    parser.add_argument(
        "--write-signals",
        action="store_true",
        help="Write rule-based BUY/HOLD/SELL signals from the rebalance output.",
    )
    parser.add_argument(
        "--previous-rebalance",
        help="Prior rebalance CSV used to distinguish BUY, HOLD, and SELL.",
    )
    parser.add_argument(
        "--signals-output",
        default="outputs/trade_signals.csv",
        help="Output CSV path for trade signals.",
    )
    parser.add_argument(
        "--portfolio-value",
        type=float,
        default=10000.0,
        help="Portfolio value used to convert target weights into dollars.",
    )
    parser.add_argument(
        "--save-snapshot",
        action="store_true",
        help="Save dated copies of generated outputs under outputs/history/<as-of>/.",
    )
    parser.add_argument(
        "--daily-run",
        action="store_true",
        help="Run the full daily workflow: FMP fetch, signals, review data, paper portfolio, and snapshot.",
    )
    parser.add_argument(
        "--auto-previous",
        action="store_true",
        help="Automatically find the most recent prior rebalance snapshot.",
    )
    parser.add_argument(
        "--risk-output",
        default="outputs/risk_exclusions.csv",
        help="Output CSV path for stocks excluded by risk rules.",
    )
    parser.add_argument(
        "--paper-portfolio-output",
        default="outputs/paper_portfolio.csv",
        help="Output CSV path for paper portfolio positions.",
    )
    parser.add_argument(
        "--portfolio-history-output",
        default="outputs/portfolio_history.csv",
        help="Output CSV path for paper portfolio value history.",
    )
    parser.add_argument(
        "--trade-log-output",
        default="outputs/paper_trades.csv",
        help="Output CSV path for paper account trade log.",
    )
    parser.add_argument(
        "--status-output",
        default="outputs/last_run_status.json",
        help="Output JSON path for the latest run status.",
    )
    parser.add_argument(
        "--benchmarks",
        default="IWM,IJH,SPY",
        help="Comma-separated benchmark symbols to track.",
    )
    parser.add_argument(
        "--benchmark-output",
        default="outputs/benchmark_history.csv",
        help="Output CSV path for benchmark history.",
    )
    parser.add_argument(
        "--backfill-history",
        action="store_true",
        help="Backfill selected portfolio and benchmark history using FMP daily prices.",
    )
    parser.add_argument(
        "--backfill-days",
        type=int,
        default=365,
        help="Number of calendar days to backfill for selected portfolio and benchmarks.",
    )
    parser.add_argument(
        "--selected-history-output",
        default="outputs/selected_portfolio_history.csv",
        help="Output CSV path for selected portfolio historical backfill.",
    )
    parser.add_argument("--run-backtest", action="store_true", help="Run a monthly historical backtest.")
    parser.add_argument("--backtest-start", default="2025-08-01", help="Backtest start date.")
    parser.add_argument(
        "--backtest-keep-rank-per-sector",
        type=int,
        default=8,
        help="Keep existing backtest holdings if they remain within this sector rank.",
    )
    parser.add_argument(
        "--backtest-bid-ask-spread-bps",
        type=float,
        default=10.0,
        help="Estimated full bid/ask spread in basis points for backtest impact reporting.",
    )
    parser.add_argument(
        "--backtest-capital-gains-tax-rate",
        type=float,
        default=0.24,
        help="Estimated tax rate applied to realized gains in the backtest.",
    )
    parser.add_argument(
        "--backtest-equity-output",
        default="outputs/backtest_equity.csv",
        help="Output CSV path for backtest equity curve.",
    )
    parser.add_argument(
        "--backtest-holdings-output",
        default="outputs/backtest_holdings.csv",
        help="Output CSV path for backtest holdings.",
    )
    parser.add_argument(
        "--backtest-trades-output",
        default="outputs/backtest_trades.csv",
        help="Output CSV path for backtest trades.",
    )
    args = parser.parse_args()
    args.as_of = args.as_of or date.today().isoformat()
    status: dict[str, Any] = {
        "status": "running",
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "as_of": args.as_of,
    }

    try:
        if args.daily_run:
            args.fetch_fmp = True
            args.fetch_review_data = True
            args.write_signals = True
            args.save_snapshot = True
            args.auto_previous = True

        config = load_strategy_config(args.config)

        if args.fetch_fmp:
            if args.seed_universe:
                universe, factors = write_fmp_inputs_from_seed(
                    seed_universe=args.seed_universe,
                    as_of=args.as_of,
                    universe_output=args.universe,
                    factors_output=args.factors,
                    max_tickers=args.max_fmp_tickers,
                )
            else:
                universe, factors = write_fmp_inputs(
                    config=config,
                    as_of=args.as_of,
                    universe_output=args.universe,
                    factors_output=args.factors,
                    max_tickers=args.max_fmp_tickers,
                )
            print(f"Fetched {len(universe)} universe rows and {len(factors)} factor rows from FMP")
        else:
            universe = load_universe(args.universe)
            factors = load_factors(args.factors, args.as_of)
        status["universe_rows"] = len(universe)
        status["factor_rows"] = len(factors)

        if args.run_backtest:
            backtest = write_backtest_outputs(
                universe=universe,
                config=config,
                start_date=args.backtest_start,
                end_date=args.as_of,
                initial_cash=args.portfolio_value,
                max_tickers=args.max_fmp_tickers,
                keep_rank_per_sector=args.backtest_keep_rank_per_sector,
                bid_ask_spread_bps=args.backtest_bid_ask_spread_bps,
                capital_gains_tax_rate=args.backtest_capital_gains_tax_rate,
                equity_output=args.backtest_equity_output,
                holdings_output=args.backtest_holdings_output,
                trades_output=args.backtest_trades_output,
            )
            print(
                f"Wrote backtest: {len(backtest.equity_curve)} equity rows, "
                f"{len(backtest.holdings)} holding rows, {len(backtest.trades)} trade rows"
            )
            status["backtest_equity_rows"] = len(backtest.equity_curve)
            status["backtest_holding_rows"] = len(backtest.holdings)
            status["backtest_trade_rows"] = len(backtest.trades)

        risk_exclusions = build_risk_exclusions(universe, factors, config)
        risk_path = Path(args.risk_output)
        risk_path.parent.mkdir(parents=True, exist_ok=True)
        risk_exclusions.to_csv(risk_path, index=False)
        print(f"Wrote {len(risk_exclusions)} risk exclusions to {risk_path}")
        status["risk_exclusions"] = len(risk_exclusions)

        rebalance = build_rebalance(universe, factors, config)

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        rebalance.to_csv(output_path, index=False)
        print(f"Wrote {len(rebalance)} target positions to {output_path}")
        status["target_positions"] = len(rebalance)

        signals_path: Path | None = None
        paper_portfolio_path: Path | None = None
        portfolio_history_path: Path | None = None
        trade_log_path: Path | None = None
        if args.write_signals:
            previous_rebalance = args.previous_rebalance
            if args.auto_previous and not previous_rebalance:
                previous_path = find_previous_rebalance(args.as_of)
                previous_rebalance = str(previous_path) if previous_path else None
                if previous_rebalance:
                    print(f"Using previous rebalance snapshot: {previous_rebalance}")
                    status["previous_rebalance"] = previous_rebalance
                else:
                    print("No previous rebalance snapshot found; selected positions will be BUY.")

            previous = load_optional_rebalance(previous_rebalance)
            signals = build_trade_signals(
                current_rebalance=rebalance,
                previous_rebalance=previous,
                portfolio_value=args.portfolio_value,
            )
            signals_path = Path(args.signals_output)
            signals_path.parent.mkdir(parents=True, exist_ok=True)
            signals.to_csv(signals_path, index=False)
            print(f"Wrote {len(signals)} trade signals to {signals_path}")
            status["trade_signals"] = len(signals)
            status["buy_signals"] = int((signals["action"] == "BUY").sum()) if "action" in signals else 0
            status["hold_signals"] = int((signals["action"] == "HOLD").sum()) if "action" in signals else 0
            status["sell_signals"] = int((signals["action"] == "SELL").sum()) if "action" in signals else 0
            paper_portfolio_path = Path(args.paper_portfolio_output)
            portfolio_history_path = Path(args.portfolio_history_output)
            trade_log_path = Path(args.trade_log_output)
            portfolio, history, trades = execute_paper_account(
                signals=signals,
                as_of=args.as_of,
                initial_cash=args.portfolio_value,
                positions_output=paper_portfolio_path,
                summary_output=portfolio_history_path,
                trades_output=trade_log_path,
            )
            print(f"Wrote {len(portfolio)} paper account position rows to {paper_portfolio_path}")
            print(f"Wrote {len(history)} paper account history rows to {portfolio_history_path}")
            print(f"Wrote {len(trades)} paper trade log rows to {trade_log_path}")
            status["paper_positions"] = len(portfolio)
            status["paper_trades_total"] = len(trades)
            if not history.empty:
                status["paper_total_value"] = float(history.iloc[-1]["total_value"])

        if args.fetch_review_data:
            news, insider = write_fmp_review_data(
                rebalance_path=output_path,
                news_output=args.news_output,
                insider_output=args.insider_output,
            )
            print(f"Fetched {len(news)} news rows and {len(insider)} insider rows from FMP")
            status["news_rows"] = len(news)
            status["insider_rows"] = len(insider)

        benchmark_path: Path | None = None
        selected_history_path: Path | None = None
        if args.daily_run or args.backfill_history:
            benchmark_symbols = [symbol.strip().upper() for symbol in args.benchmarks.split(",") if symbol.strip()]
            benchmark_path = Path(args.benchmark_output)
            benchmarks = write_benchmark_history(
                benchmark_symbols,
                args.as_of,
                benchmark_path,
                lookback_days=args.backfill_days if args.backfill_history else 10,
            )
            print(f"Wrote {len(benchmarks)} benchmark history rows to {benchmark_path}")
            status["benchmarks"] = benchmark_symbols
            status["benchmark_rows"] = len(benchmarks)

        if args.backfill_history:
            selected_history_path = Path(args.selected_history_output)
            selected_history = write_selected_portfolio_history(
                rebalance_path=output_path,
                as_of=args.as_of,
                portfolio_value=args.portfolio_value,
                output=selected_history_path,
                lookback_days=args.backfill_days,
            )
            print(f"Wrote {len(selected_history)} selected portfolio history rows to {selected_history_path}")
            status["selected_history_rows"] = len(selected_history)

        status["status"] = "success"
        status["finished_at"] = datetime.now().isoformat(timespec="seconds")
        _write_status(args.status_output, status)

        if args.save_snapshot:
            _save_snapshot(
                as_of=args.as_of,
                paths=[
                    output_path,
                    Path(args.universe),
                    Path(args.factors),
                    Path(args.news_output),
                    Path(args.insider_output),
                    signals_path,
                    risk_path,
                    paper_portfolio_path,
                    portfolio_history_path,
                    trade_log_path,
                    benchmark_path,
                    selected_history_path,
                    Path(args.status_output),
                ],
            )
    except Exception as error:
        status["status"] = "failed"
        status["finished_at"] = datetime.now().isoformat(timespec="seconds")
        status["error"] = str(error)
        _write_status(args.status_output, status)
        raise

def _save_snapshot(as_of: str, paths: list[Path | None]) -> None:
    snapshot_dir = Path("outputs") / "history" / as_of
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    for path in paths:
        if path and path.exists():
            shutil.copy2(path, snapshot_dir / path.name)
    print(f"Saved snapshot files to {snapshot_dir}")


def _write_status(path: str | Path, status: dict[str, Any]) -> None:
    status_path = Path(path)
    status_path.parent.mkdir(parents=True, exist_ok=True)
    with status_path.open("w", encoding="utf-8") as file:
        json.dump(status, file, indent=2)


if __name__ == "__main__":
    main()

