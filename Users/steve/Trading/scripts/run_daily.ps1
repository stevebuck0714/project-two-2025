param(
    [double]$PortfolioValue = 10000,
    [int]$MaxFmpTickers = 300,
    [string]$Benchmarks = "IWM,IJH,SPY",
    [int]$BackfillDays = 365
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

python -m trading_rotation.cli `
    --config config/strategy.yaml `
    --universe data/universe.fmp.full.csv `
    --factors data/factors.fmp.full.csv `
    --output outputs/rebalance.fmp.full.csv `
    --daily-run `
    --max-fmp-tickers $MaxFmpTickers `
    --portfolio-value $PortfolioValue `
    --benchmarks $Benchmarks `
    --backfill-history `
    --backfill-days $BackfillDays

