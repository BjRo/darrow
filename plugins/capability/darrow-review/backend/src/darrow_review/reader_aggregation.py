"""Copy bound independent judgments into a finalization draft without rewriting."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from . import finalization, reader_inputs, routing, scope, storage, verification
from .common import document, record_file, require, serialize
from .records import Records, validate_axis, validate_fix_axis


def application(run: Path, axis: str) -> str:
    record = document(record_file(str(run / f"{axis}-route.json")))
    host = "claude" if "observed_route" in record else "codex"
    selected = routing.load_route(str(run / "reviewer-route.json"), host)
    require(
        record.get("format") == "darrow-reviewer-route-application-v3"
        and record.get("axis") == axis
        and record.get("route_bound") == "true"
        and record.get("route_applied_by") == "native-subagent",
        f"invalid {axis} route application",
        4,
    )
    require(
        record.get("selected_route") == selected.as_object()
        and record.get("observed_route", record.get("requested_route"))
        == selected.as_object(),
        f"{axis} route application differs from selected route",
        4,
    )
    agent = record.get("agent_id")
    require(isinstance(agent, str) and agent.strip(), f"missing {axis} child ID", 4)
    return str(agent)


def reader(
    path: str, manifest: str, checks: list[str], original: str
) -> tuple[Records, str, dict[str, object]]:
    run = storage.run_for_manifest(Path(manifest))
    require(
        Path(path).is_absolute() and Path(path).parent.resolve(strict=True) == run,
        "reader record must belong to the current scope run",
        4,
    )
    raw = record_file(path)
    axis = Records(raw).value("axis")
    require(axis in ("standards", "spec"), "reader axis must be standards or spec", 4)
    packet = cast(dict[str, Any], reader_inputs.load(str(run / f"{axis}-input.json")))
    scope = packet["scope"]
    require(
        isinstance(scope, dict)
        and scope.get("manifest") == manifest
        and packet["mode"] == ("fix-verification" if original else "comprehensive"),
        "reader input belongs to another scope or mode",
        4,
    )
    sources = packet["check_records"]
    require(
        isinstance(sources, list)
        and all(isinstance(row, dict) and row.get("path") in checks for row in sources),
        "reader check evidence is missing from finalization",
        4,
    )
    record = validate_fix_axis(raw, axis) if original else validate_axis(raw, axis)
    if original:
        repair = packet["repair"]
        require(isinstance(repair, dict), "missing bound repair input", 4)
        require(
            repair.get("original_source", {}).get("path") == original
            and set(record.strings("originals")) == set(repair["attempted"]),
            "fix reader differs from bound original evidence or attempted keys",
            4,
        )
        require(
            {row["key"]: row["caused_by"] for row in record.items("prior_regressions")}
            == {row["key"]: row["caused_by"] for row in repair["regressions"]},
            "fix reader differs from bound carried regressions",
            4,
        )
    return record, application(run, axis), packet


def draft(
    manifest: str,
    paths: list[str],
    checks: list[str],
    next_action: str,
    risks: list[str],
    original: str = "",
    spec_not_available: bool = False,
) -> dict[str, Any]:
    axes: dict[str, Records] = {}
    children: set[str] = set()
    packets = []
    for path in paths:
        record, child, packet = reader(path, manifest, checks, original)
        axis = record.value("axis")
        require(axis not in axes, f"duplicate {axis} reader", 4)
        require(child not in children, "review axes require distinct child IDs", 4)
        axes[axis] = record
        children.add(child)
        packets.append(packet)
    if original:
        require(not spec_not_available, "Spec omission flag is comprehensive-only", 4)
        run = storage.run_for_manifest(Path(manifest))
        expected = {
            axis
            for axis in ("standards", "spec")
            if (run / f"{axis}-input.json").exists()
        }
        require(set(axes) == expected, "every prepared fix reader is required", 4)
        data = fix_draft(axes, next_action, manifest, original)
    else:
        data = comprehensive_draft(
            axes, manifest, next_action, risks, spec_not_available
        )
    if not checks:
        data["checks"] = explicit_inapplicability(packets)
    return data


def explicit_inapplicability(packets: list[dict[str, object]]) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for packet in packets:
        rows = packet["checks"]
        require(isinstance(rows, list), "missing reader check evidence", 4)
        for row in cast(list[dict[str, str]], rows):
            if row not in result:
                result.append(row)
    return result


def comprehensive_draft(
    axes: dict[str, Records],
    manifest: str,
    next_action: str,
    risks: list[str],
    spec_not_available: bool,
) -> dict[str, Any]:
    expected = {"standards"} if spec_not_available else {"standards", "spec"}
    require(set(axes) == expected, "every applicable reader is required", 4)
    run = storage.run_for_manifest(Path(manifest))
    require(
        not spec_not_available or not (run / "spec-input.json").exists(),
        "cannot omit a prepared Spec reader",
        4,
    )
    return {
        "format": "darrow-review-result-v3",
        "standards": axes["standards"].value("status"),
        "standards_sources": axes["standards"].strings("sources"),
        "spec": axes["spec"].value("status") if "spec" in axes else "not_available",
        "spec_source": "\n".join(axes["spec"].strings("sources"))
        if "spec" in axes
        else "not_available",
        "findings": [
            {"axis": axis, **finding}
            for axis in axes
            for finding in axes[axis].items("findings")
        ],
        "risks": risks or ["No additional coordinator risk assessment supplied."],
        "next_action": next_action,
    }


def carried_regressions(
    axes: dict[str, Records], manifest: str, original: str
) -> list[dict[str, str]]:
    current = scope.manifest(manifest)
    prior_scope = scope.manifest(current["prior_manifest"])
    prior = verification.prior_input(
        finalization.original_binding(original), prior_scope["target"]
    )
    carried = prior.items("regressions") if prior else []
    actions = {
        row["key"]: row
        for record in axes.values()
        for row in record.items("regression_attempts")
    }
    require(
        all(row["key"] in actions for row in carried),
        "missing current carried-regression judgment",
        4,
    )
    return [{**row, **actions[row["key"]]} for row in carried]


def fix_draft(
    axes: dict[str, Records], next_action: str, manifest: str, original: str
) -> dict[str, Any]:
    carried = carried_regressions(axes, manifest, original)
    return {
        "format": "darrow-review-verification-v3",
        "attempts": [
            item for record in axes.values() for item in record.items("attempts")
        ],
        "regressions": [*carried, *new_regressions(axes, carried, original)],
        "evidence_gaps": [
            item for record in axes.values() for item in record.strings("evidence_gaps")
        ],
        "next_action": next_action,
    }


def new_regressions(
    axes: dict[str, Records], carried: list[dict[str, str]], original: str
) -> list[dict[str, str]]:
    source = Records(serialize(finalization.original_binding(original)))
    findings = {row["key"]: row for row in source.items("original_findings")}
    reported = [row for record in axes.values() for row in record.items("regressions")]
    reported.sort(key=lambda row: int(findings[row["caused_by"]]["order"]))
    start = max((int(row["order"]) for row in carried), default=0) + 1
    return [
        {
            **row,
            "key": f"regression:{order}:{row['caused_by']}",
            "order": str(order),
            "axis": findings[row["caused_by"]]["axis"],
            "status": "unresolved",
            "progress": "progressing",
        }
        for order, row in enumerate(reported, start)
    ]
