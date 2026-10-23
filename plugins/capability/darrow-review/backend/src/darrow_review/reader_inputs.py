"""Generate isolated reader inputs and messages from retained evidence."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, cast

from . import finalization, routing, schema, scope, storage
from .common import (
    blob_hash,
    command_line,
    document,
    entrypoint,
    new_record,
    package_root,
    read_text,
    record_file,
    require,
    serialize,
)
from .reader_repairs import repair_input
from .records import Records

CONTEXT = {
    "type": "object",
    "properties": {
        "sources": schema.array(schema.string()),
        "objective": schema.string(),
        "attempted": schema.array(schema.string()),
        "checks": schema.array(schema.CHECK, 1),
    },
    "required": ["sources"],
    "additionalProperties": False,
}
REQUEST = {
    "type": "object",
    "properties": {
        "manifest": schema.string(),
        "axis": schema.string(schema.AXIS),
        "context": CONTEXT,
        "check_records": schema.array(schema.string()),
        "original": {"type": "string"},
    },
    "required": ["manifest", "axis", "context", "check_records", "original"],
    "additionalProperties": False,
}


def validate_context(value: dict[str, object]) -> dict[str, Any]:
    schema.validate_node(value, CONTEXT, "reader context")
    return value


def context_argument(
    path: str, sources: list[str], objective: str, reason: str
) -> dict[str, Any]:
    require(
        not path or not (sources or objective or reason),
        "context file cannot be combined with intent inputs",
    )
    if path:
        return validate_context(document(record_file(path)))
    value: dict[str, object] = {"sources": sources}
    if objective:
        value["objective"] = objective
    if reason:
        value["checks"] = [
            {
                "command": "none",
                "applicability": "not_applicable",
                "status": "not_applicable",
                "evidence": reason,
            }
        ]
    return validate_context(value)


def source(path: str) -> dict[str, str]:
    require(Path(path).is_absolute(), f"reader source path must be absolute: {path}", 4)
    raw = read_text(path, "reader source")
    require(raw.strip(), f"reader source is empty: {path}", 4)
    return {"path": path, "checksum": blob_hash(Path(path).read_bytes()), "text": raw}


def attempted_keys(original: str, axis: str) -> list[str]:
    require(original, "copying attempted keys requires original evidence")
    handoff = document(record_file(original))
    value = handoff.get("attempted", [])
    schema.validate_node(value, schema.array(schema.string()), "attempted")
    attempted = cast(list[str], value)
    binding = Records(serialize(finalization.original_binding(original)))
    findings = {row["key"]: row for row in binding.items("original_findings")}
    require(
        len(attempted) == len(set(attempted))
        and all(key in findings for key in attempted),
        "handoff attempted keys must be unique original finding keys",
    )
    return [key for key in attempted if findings[key]["axis"] == axis]


def scope_input(path: str) -> dict[str, object]:
    storage.run_for_manifest(Path(path))
    scope.show(path)
    raw = record_file(path)
    record = document(raw)
    properties = {
        name: schema.string()
        for name in ("repository", "base", "target", "changed_count")
    }
    properties["changed_files"] = schema.array(schema.string())
    identity = {name: record[name] for name in properties if name in record}
    schema.validate_node(
        identity,
        {
            "type": "object",
            "properties": properties,
            "required": list(properties),
            "additionalProperties": False,
        },
        "reader scope",
    )
    files = cast(list[str], record["changed_files"])
    require(
        record["changed_count"] == str(len(files))
        and len(files) == len(set(files))
        and all(Path(file).is_absolute() for file in files),
        "reader scope has inconsistent changed files",
        4,
    )
    result = {name: record[name] for name in properties}
    result.update(
        {
            "manifest": path,
            "checksum": blob_hash(Path(path).read_bytes()),
            "show_command": command_line(
                entrypoint("review-scope", "show", "--manifest", path)
            ),
        }
    )
    if record.get("prior_manifest"):
        result["repair_show_command"] = command_line(
            entrypoint(
                "review-scope",
                "compare",
                "--prior-manifest",
                str(record["prior_manifest"]),
                "--current-manifest",
                path,
            )
        )
    return result


def evidence(request: dict[str, Any]) -> dict[str, object]:
    manifest, axis = request["manifest"], request["axis"]
    context = validate_context(request["context"])
    run = storage.run_for_manifest(Path(manifest))
    sources = context["sources"]
    require(len(sources) == len(set(sources)), "duplicate reader source", 4)
    checks = finalization.check_evidence(
        Records(serialize(context)), request["check_records"], run
    )
    result: dict[str, object] = {
        "axis": axis,
        "mode": "fix-verification" if request["original"] else "comprehensive",
        "scope": scope_input(manifest),
        "sources": [source(path) for path in sources],
        "objective": context.get("objective", ""),
        "checks": checks,
        "check_records": [source(path) for path in request["check_records"]],
        "instructions": template(
            axis, "fix-verification" if request["original"] else "comprehensive"
        ),
    }
    if axis == "standards":
        result["baseline"] = source(
            str(
                package_root().parent / "skills/code-review/references/design-smells.md"
            )
        )
    if request["original"]:
        result["repair"] = repair_input(request["original"], manifest, axis, context)
    else:
        require(not context.get("attempted"), "attempted keys require fix evidence", 4)
        require(
            axis != "spec" or sources or context.get("objective", "").strip(),
            "Spec reader requires an originating source",
            4,
        )
    return result


def template(axis: str, mode: str) -> str:
    title = {"standards": "Standards", "spec": "Spec"}[axis]
    title += " fix verifier" if mode == "fix-verification" else " reviewer"
    path = package_root().parent / "skills/code-review/references/axis-prompts.md"
    match = re.search(
        r"^## " + re.escape(title) + r"\n+```text\n(.*?)\n```",
        record_file(str(path)),
        re.M | re.S,
    )
    require(match is not None, f"reader template is missing: {title}", 4)
    return cast(re.Match[str], match).group(1)


def launch_message(path: str, packet: dict[str, object]) -> str:
    axis, mode = str(packet["axis"]), str(packet["mode"])
    command = command_line(entrypoint("review-result", "read-reader", "--input", path))
    return (
        f"- review_axis: {axis}\n"
        f"You are the isolated {axis} reader for {mode}. Remain read-only; "
        "do not run Git/GitHub, write files, or delegate.\n"
        "Run this exact command, then follow the complete instructions in its "
        "validated output and return only the requested axis JSON:\n"
        f"{command}\n"
        "This is a delegated reader assignment, not the code-review coordinator "
        "workflow. Do not load or restart that workflow."
    )


def codex_launch(
    route_record: str, run: Path, axis: str, message: str
) -> dict[str, str]:
    require(
        Path(route_record) == run / "reviewer-route.json",
        "launch route must belong to the current scope run",
        4,
    )
    route = routing.load_route(route_record, "codex")
    identity = blob_hash(str(run).encode("utf-8"), sha256=True)[:12]
    return {
        "task_name": f"review_{axis}_{identity}",
        "fork_turns": "none",
        "model": route.model,
        "reasoning_effort": route.effort,
        "message": message,
    }


def prepare(
    manifest: str,
    axis: str,
    context: str | dict[str, Any],
    checks: list[str],
    original: str,
    route_record: str = "",
) -> str:
    request: dict[str, object] = {
        "manifest": manifest,
        "axis": axis,
        "context": validate_context(document(record_file(context)))
        if isinstance(context, str)
        else validate_context(context),
        "check_records": checks,
        "original": original,
    }
    schema.validate_node(request, REQUEST, "reader request")
    packet = evidence(request)
    run = storage.run_for_manifest(Path(manifest))
    path = run / f"{axis}-input.json"
    message = launch_message(str(path), packet)
    response: dict[str, object] = {
        "input": str(path),
        "message": message,
        "reader_record": str(run / f"{axis}.json"),
    }
    if route_record:
        response["launch"] = codex_launch(route_record, run, axis, message)
        response["confirm_command"] = command_line(
            entrypoint(
                "review-route",
                "confirm-codex",
                "--route-record",
                route_record,
                "--axis",
                axis,
                "--agent-id",
                "<accepted-child-id>",
                "--application-record",
                str(run / f"{axis}-route.json"),
            )
        )
    new_record(
        str(path),
        serialize(
            {
                "format": "darrow-review-reader-input-v1",
                "request": request,
                "evidence": packet,
            }
        ),
    )
    return serialize(response)


def load(path: str) -> dict[str, object]:
    packet = document(record_file(path))
    require(
        set(packet) == {"format", "request", "evidence"}
        and packet["format"] == "darrow-review-reader-input-v1",
        "invalid reader input",
        4,
    )
    schema.validate_node(packet["request"], REQUEST, "reader request")
    request = cast(dict[str, Any], packet["request"])
    run = storage.run_for_manifest(Path(request["manifest"]))
    require(
        Path(path) == run / f"{request['axis']}-input.json",
        "reader input belongs to another run or axis",
        4,
    )
    current = evidence(request)
    require(
        packet["evidence"] == current, "reader input differs from bound evidence", 4
    )
    return current


def read(path: str) -> str:
    return serialize(load(path))
