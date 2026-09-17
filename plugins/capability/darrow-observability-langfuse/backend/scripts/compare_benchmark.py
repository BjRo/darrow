from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"benchmark output is not an object: {path}")
    return value


def verify(control: dict[str, Any], candidate: dict[str, Any]) -> None:
    matched = ("turns", "input_sha256", "observations", "acknowledged_turns")
    for key in matched:
        if control.get(key) != candidate.get(key):
            raise ValueError(f"benchmark workloads differ for {key}")
    if candidate["bytes_read"] >= control["bytes_read"]:
        raise ValueError("candidate incremental reads are not bounded below control")
    if candidate["exporter_requests"] > control["exporter_requests"]:
        raise ValueError("candidate exporter batching regressed")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("control", type=Path)
    parser.add_argument("candidate", type=Path)
    arguments = parser.parse_args()
    control = _load(arguments.control)
    candidate = _load(arguments.candidate)
    verify(control, candidate)
    print(json.dumps({"control": control, "candidate": candidate}, sort_keys=True))


if __name__ == "__main__":
    main()
