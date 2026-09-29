"""Finalize contextual judgments with file-owned scope and check evidence."""

from __future__ import annotations

from pathlib import Path

from . import report, result, schema, scope, storage, verification
from .common import blob_hash, new_record, record_file, require, serialize
from .records import Record, Records, validate_result


def captured_checks(paths: list[str], run: Path) -> list[Record]:
    rows: list[Record] = []
    for path in paths:
        require(
            Path(path).parent.resolve(strict=True) == run,
            "check record must belong to the current scope run",
            4,
        )
        capture = Records(record_file(path))
        capture.shape("darrow-review-check-v3")
        checks = capture.items("checks")
        code = capture.value("exit_code")
        expected = (
            "pass" if code == "0" else "blocked" if code in ("126", "127") else "fail"
        )
        require(
            len(checks) == 1
            and all(
                row["applicability"] == "applicable"
                and row["status"] == expected
                and row["evidence"].startswith(f"exited {code}: ")
                for row in checks
            ),
            "captured check status or evidence differs from its exit code",
            4,
        )
        rows.extend(checks)
    return rows


def check_evidence(draft: Records, paths: list[str], run: Path) -> list[Record]:
    if paths:
        require(len(paths) == len(set(paths)), "duplicate check record path", 4)
        return captured_checks(paths, run)
    checks = draft.items("checks")
    schema.validate_node(checks, schema.array(schema.CHECK, 1), "checks")
    require(
        all(row["applicability"] == "not_applicable" for row in checks),
        "applicable checks require retained --check records",
        4,
    )
    return checks


def comprehensive(draft: Records, manifest: str) -> dict[str, object]:
    data = {**draft.data, **result.scope_records(manifest), "verdict": "blocked"}
    records = Records(serialize(data))
    records.shape("darrow-review-result-v3")
    statuses = [
        records.value("standards"),
        records.value("spec"),
        *[row["status"] for row in records.items("checks")],
    ]
    data["verdict"] = (
        "fail" if "fail" in statuses else "blocked" if "blocked" in statuses else "pass"
    )
    validate_result(serialize(data))
    return data


def original_binding(path: str) -> dict[str, object]:
    source = Records(record_file(path))
    if source.value("format") == "darrow-review-result-v3":
        original = validate_result(record_file(path))
        return {
            "original_target": original.value("target"),
            "original_findings": result.original_findings(original),
        }
    if source.value("format") == "darrow-review-verification-v3":
        prior = verification.validate_verification(record_file(path), path)
        return {
            "original_target": prior.value("original_target"),
            "original_findings": prior.items("original_findings"),
            "previous_verification": {
                "path": str(Path(path).resolve(strict=True)),
                "checksum": blob_hash(Path(path).read_bytes()),
            },
            "history_targets": list(
                dict.fromkeys(
                    [
                        *prior.strings("history_targets"),
                        prior.value("prior_target"),
                    ]
                )
            ),
        }
    require(not source.value("format"), "unsupported original evidence format", 4)
    require(
        source.data.get("original_target") and "original_findings" in source.data,
        "original handoff requires original_target and original_findings",
        4,
    )
    return {
        name: source.data[name]
        for name in (
            "original_target",
            "original_findings",
            "previous_verification",
            "history_targets",
        )
        if name in source.data
    }


def retained_attempts(draft: Records, previous: Records | None) -> list[Record]:
    current = draft.items("attempts")
    if previous is None:
        return current
    supplied = {row["key"] for row in current}
    carried = [
        row
        for row in previous.items("attempts")
        if row["status"] == "resolved" and row["key"] not in supplied
    ]
    return [*current, *carried]


def repaired(
    draft: Records, manifest: str, original: str, output: str
) -> dict[str, object]:
    require(original, "fix verification requires --original evidence", 4)
    current = scope.manifest(manifest)
    prior_path = current.get("prior_manifest", "")
    require(prior_path, "fix verification requires a pinned prior manifest", 4)
    scope.compare(prior_path, manifest)
    prior = scope.manifest(prior_path)
    binding = original_binding(original)
    previous = verification.prior_input(binding, prior["target"])
    history = (
        list(
            dict.fromkeys(
                [*previous.strings("history_targets"), previous.value("prior_target")]
            )
        )
        if previous
        else []
    )
    data = {
        **draft.data,
        **binding,
        "history_targets": history,
        "attempts": retained_attempts(draft, previous),
        "prior_target": prior["target"],
        "current_target": current["target"],
        "outcome": "blocked",
    }
    data.setdefault("previous_verification", {"checksum": "none", "path": "none"})
    records = Records(serialize(data))
    records.shape("darrow-review-verification-v3")
    findings = verification.originals(records)
    actions = verification.attempts(records, findings)
    data["outcome"] = verification.outcome(records, findings, actions)
    verification.validate_verification(serialize(data), output)
    return data


def finalize(
    manifest: str, draft_path: str, output: str, checks: list[str], original: str = ""
) -> str:
    run = storage.run_for_manifest(Path(manifest))
    require(
        Path(output).is_absolute() and Path(output).parent.resolve(strict=True) == run,
        "final result must belong to the current scope run",
        4,
    )
    draft = Records(record_file(draft_path))
    draft.data["checks"] = check_evidence(draft, checks, run)
    if draft.value("format") == "darrow-review-verification-v3":
        data = repaired(draft, manifest, original, output)
        command, report_name = "render-verification", "verification.md"
    else:
        require(not original, "--original applies only to fix verification", 4)
        data = comprehensive(draft, manifest)
        command, report_name = "render", "review.md"
    path = new_record(output, serialize(data))
    report_path = new_record(str(run / report_name), report.render(command, str(path)))
    return serialize({"result_record": str(path), "report": str(report_path)})
