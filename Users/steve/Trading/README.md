# Trading

Small/mid-cap sector-rotation research system.

The first version builds a monthly rebalance model across three sectors:

- Financials: 40%
- Industrials: 35%
- Healthcare: 25%

The model is designed for small to mid cap stocks, not large cap names. It filters the universe, ranks eligible stocks inside each sector, and creates target portfolio weights.

## Strategy

Universe rules:

- Include only Financials, Industrials, and Healthcare.
- Prefer small to mid cap stocks.
- Exclude low-liquidity stocks.
- Exclude recent IPOs when factor history is limited.

Ranking factors:

- 6-month relative strength
- Earnings revisions
- Free cash flow yield
- Debt ratios
- Volatility

Portfolio construction:

- Rank stocks within each sector.
- Keep only names that pass every configured filter.
- Select the top names per sector.
- Rebalance monthly to sector target weights.

## Project Layout

```text
config/strategy.yaml          Strategy settings
data/universe.example.csv     Example universe input format
data/factors.example.csv      Example factor input format
src/trading_rotation/         Python package
tests/                        Unit tests
```

## Run

Install dependencies:

```powershell
python -m pip install -e .
```

Create a local `.env` file for your FMP key:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` so it contains:

```text
FMP_API_KEY=your_real_key_here
```

Generate a rebalance file:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --universe data/universe.example.csv `
  --factors data/factors.example.csv `
  --as-of 2026-05-31 `
  --output outputs/rebalance.csv
```

Fetch fresh data from Financial Modeling Prep and generate a rebalance file:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --universe data/universe.fmp.csv `
  --factors data/factors.fmp.csv `
  --as-of 2026-05-31 `
  --output outputs/rebalance.fmp.csv `
  --fetch-fmp `
  --max-fmp-tickers 30
```

The Basic FMP plan has a low daily call limit, so the default FMP run enriches only 30 tickers. Increase `--max-fmp-tickers` after upgrading or when you are ready for a broader run.

If you are on the Basic FMP plan, use a seed universe because full screeners are restricted:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --seed-universe data/universe.seed.csv `
  --universe data/universe.fmp.csv `
  --factors data/factors.fmp.csv `
  --as-of 2026-05-31 `
  --output outputs/rebalance.fmp.csv `
  --fetch-fmp `
  --max-fmp-tickers 9
```

## Review Dashboard

Start the local review site:

```powershell
python -m streamlit run src/trading_rotation/dashboard.py
```

The dashboard reads the latest generated CSVs from `outputs/` and `data/`.

Dashboard pages:

- Overview
- Recommendations
- Risk & Review
- Paper Portfolio
- Performance

Fetch FMP news and insider activity for the latest recommendations:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --universe data/universe.fmp.full.csv `
  --factors data/factors.fmp.full.csv `
  --as-of 2026-05-31 `
  --output outputs/rebalance.fmp.full.csv `
  --fetch-review-data
```

Generate rule-based trade signals and save a dated daily snapshot:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --universe data/universe.fmp.full.csv `
  --factors data/factors.fmp.full.csv `
  --as-of 2026-05-31 `
  --output outputs/rebalance.fmp.full.csv `
  --write-signals `
  --portfolio-value 10000 `
  --fetch-review-data `
  --save-snapshot
```

Use `--previous-rebalance path\to\prior.csv` to distinguish new buys from existing holds and dropped sells.

Run the full daily workflow in one command:

```powershell
python -m trading_rotation.cli `
  --config config/strategy.yaml `
  --universe data/universe.fmp.full.csv `
  --factors data/factors.fmp.full.csv `
  --output outputs/rebalance.fmp.full.csv `
  --daily-run `
  --max-fmp-tickers 300 `
  --portfolio-value 10000
```

The daily workflow fetches FMP data, applies risk rules, creates trade signals, updates the paper portfolio, fetches review data, and saves a dated snapshot. It defaults to today's date and automatically uses the most recent prior snapshot when available.
It also tracks benchmark ETFs by default: `IWM`, `IJH`, and `SPY`.
It also backfills one year of the current selected portfolio and benchmarks for the Performance page.

Run the daily workflow with the wrapper script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_daily.ps1
```

Optional arguments:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_daily.ps1 -PortfolioValue 10000 -MaxFmpTickers 300 -Benchmarks "IWM,IJH,SPY" -BackfillDays 365
```

Schedule it in Windows Task Scheduler after market close:

- Program: `powershell.exe`
- Arguments: `-ExecutionPolicy Bypass -File "C:\Users\steve\Trading\scripts\run_daily.ps1"`
- Start in: `C:\Users\steve\Trading`

The latest run status is written to `outputs/last_run_status.json` and shown on the dashboard Overview page.

## Data Needed Next

To move beyond the example files, we need a data provider for:

- Small/mid-cap sector membership
- Market cap
- Liquidity
- Price history
- Earnings revisions
- Free cash flow yield
- Debt metrics
- Volatility

