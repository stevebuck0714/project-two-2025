from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class FactorConfig:
    name: str
    weight: float
    higher_is_better: bool


@dataclass(frozen=True)
class StrategyConfig:
    sector_weights: dict[str, float]
    min_market_cap: int
    max_market_cap: int
    min_avg_dollar_volume: int
    exclude_recent_ipos: bool
    names_per_sector: int
    factors: list[FactorConfig]
    risk_rules: dict[str, float]


def load_strategy_config(path: str | Path) -> StrategyConfig:
    config_path = Path(path)
    with config_path.open("r", encoding="utf-8") as file:
        raw: dict[str, Any] = yaml.safe_load(file)

    universe = raw["universe"]
    market_cap = universe["market_cap"]

    return StrategyConfig(
        sector_weights={sector: float(weight) for sector, weight in universe["sectors"].items()},
        min_market_cap=int(market_cap["min"]),
        max_market_cap=int(market_cap["max"]),
        min_avg_dollar_volume=int(universe["min_avg_dollar_volume"]),
        exclude_recent_ipos=bool(universe.get("exclude_recent_ipos", True)),
        names_per_sector=int(raw["selection"]["names_per_sector"]),
        factors=[
            FactorConfig(
                name=name,
                weight=float(settings["weight"]),
                higher_is_better=bool(settings["higher_is_better"]),
            )
            for name, settings in raw["factors"].items()
        ],
        risk_rules={name: float(value) for name, value in raw.get("risk_rules", {}).items()},
    )

