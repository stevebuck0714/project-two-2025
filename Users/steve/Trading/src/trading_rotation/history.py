from __future__ import annotations

from pathlib import Path


def find_previous_rebalance(as_of: str, history_dir: str | Path = "outputs/history") -> Path | None:
    root = Path(history_dir)
    if not root.exists():
        return None

    candidates = []
    for snapshot_dir in root.iterdir():
        if not snapshot_dir.is_dir() or snapshot_dir.name >= as_of:
            continue
        rebalance_path = snapshot_dir / "rebalance.fmp.full.csv"
        if rebalance_path.exists():
            candidates.append((snapshot_dir.name, rebalance_path))

    if not candidates:
        return None

    return sorted(candidates, key=lambda item: item[0])[-1][1]

