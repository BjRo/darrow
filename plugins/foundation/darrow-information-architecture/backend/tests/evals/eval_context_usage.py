"""Hidden oracle for real backend invocation and exact requested report copies."""

import argparse
import json
from pathlib import Path


def invocations(root: Path, format_name: str) -> list[Path]:
    captured = []
    for capture in sorted((root / ".fixture-state/context-capture").glob("call.*")):
        if (capture / "status").read_text().strip() != "0":
            continue
        arguments = (capture / "arguments").read_text().splitlines()
        assert "--no-project" in arguments and "ia-context" in arguments, capture
        index = arguments.index("--format")
        if arguments[index + 1] == format_name:
            captured.append(capture)
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


def validate_capture(capture: Path, format_name: str) -> bytes:
    output = (capture / "output").read_bytes()
    assert output, capture
    if format_name == "json":
        json_snapshot(output, (capture / "thread").read_text().strip())
    else:
        assert b"Category" in output and b"Context used (last token_count):" in output
    return output


def verify(root: Path, format_name: str, saved: bool = False) -> None:
    outputs = [
        validate_capture(capture, format_name)
        for capture in invocations(root, format_name)
    ]
    if saved:
        assert (root / ".fixture-state/context-report.txt").read_bytes() in outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("format", choices=("grid", "json", "absent"))
    parser.add_argument("--saved", action="store_true")
    args = parser.parse_args()
    root = Path.cwd().resolve()
    if args.format == "absent":
        assert not (root / ".fixture-state/context-capture").exists(), root
    else:
        verify(root, args.format, args.saved)
    print(f"verified: {root}")


if __name__ == "__main__":
    main()
