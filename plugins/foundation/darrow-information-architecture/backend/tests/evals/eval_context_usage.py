"""Hidden oracle: the backend really ran for this thread and returned a report."""

import argparse
import json
from pathlib import Path


def invocations(root: Path, format_name: str) -> list[tuple[Path, str]]:
    captured = []
    for capture in sorted((root / ".fixture-state/context-capture").glob("call.*")):
        if (capture / "status").read_text().strip() != "0":
            continue
        arguments = (capture / "arguments").read_text().splitlines()
        assert "--no-project" in arguments and "ia-context" in arguments, capture
        used = (
            arguments[arguments.index("--format") + 1]
            if "--format" in arguments
            else "grid"
        )
        if format_name in ("any", used):
            captured.append((capture, used))
    assert captured, root
    return captured


def json_snapshot(output: bytes, thread: str) -> None:
    data = json.loads(output)
    assert data["schema_version"] == 1
    path = Path(data["rollout_path"])
    assert path.is_absolute() and path.name.endswith(f"-{thread}.jsonl")
    assert all(
        type(value) is int and value >= 0 for value in data["categories"].values()
    )
    if data["exact_total_tokens"] is not None:
        assert (
            sum(data["categories"].values()) + data["remainder_tokens"]
            == data["exact_total_tokens"]
        )


def validate_capture(capture: Path, format_name: str) -> None:
    output = (capture / "output").read_bytes()
    assert output, capture
    if format_name == "json":
        json_snapshot(output, (capture / "thread").read_text().strip())
    else:
        assert b"Category" in output and b"Context used (last token_count):" in output


def verify(root: Path, format_name: str) -> None:
    for capture, used in invocations(root, format_name):
        validate_capture(capture, used)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("format", choices=("grid", "json", "any"))
    args = parser.parse_args()
    root = Path.cwd().resolve()
    verify(root, args.format)
    print(f"verified: {root}")


if __name__ == "__main__":
    main()
