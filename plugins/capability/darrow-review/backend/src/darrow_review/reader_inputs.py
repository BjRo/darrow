"""Generate isolated reader inputs and messages from retained evidence."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, cast

from . import finalization, schema, scope, storage
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


def source(path: str) -> dict[str, str]:
    require(Path(path).is_absolute(), f"reader source path must be absolute: {path}", 4)
    raw = read_text(path, "reader source")
    require(raw.strip(), f"reader source is empty: {path}", 4)
    return {"path": path, "checksum": blob_hash(Path(path).read_bytes()), "text": raw}


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
    prompt = template(axis, mode)
    require(
        prompt.count("[READER_INPUT_COMMAND]") == 1,
        "invalid reader command placeholder",
        4,
    )
    return f"- review_axis: {axis}\n" + prompt.replace(
        "[READER_INPUT_COMMAND]", command
    )


def prepare(
    manifest: str, axis: str, context: str, checks: list[str], original: str
) -> str:
    request: dict[str, object] = {
        "manifest": manifest,
        "axis": axis,
        "context": validate_context(document(record_file(context))),
        "check_records": checks,
        "original": original,
    }
    schema.validate_node(request, REQUEST, "reader request")
    packet = evidence(request)
    path = storage.run_for_manifest(Path(manifest)) / f"{axis}-input.json"
    message = launch_message(str(path), packet)
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
    return serialize({"input": str(path), "message": message})


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
