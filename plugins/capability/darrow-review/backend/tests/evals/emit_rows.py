"""Expose JSON fixture records to existing field-oriented shell assertions.

This is an eval-only adapter. Review artifacts and model output remain JSON.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def emit(path: Path) -> str:
    records = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(records, list)
    assert all(
        isinstance(row, list) and row and all(isinstance(field, str) for field in row)
        for row in records
    )
    return "".join(
        "\t".join(
            field.replace("\t", "\\t").replace("\r", "\\r").replace("\n", "\\n")
            for field in row
        )
        + "\n"
        for row in records
    )


if __name__ == "__main__":
    sys.stdout.write(emit(Path(sys.argv[1])))
