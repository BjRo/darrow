"""Preserve one axis's closed repair evidence without coordinator transcription."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from . import finalization, schema, scope, verification
from .common import blob_hash, require, serialize
from .records import Records


def repair_input(
    original: str, manifest: str, axis: str, context: dict[str, Any]
) -> dict[str, object]:
    current = scope.manifest(manifest)
    prior_path = current.get("prior_manifest", "")
    require(prior_path, "reader fix verification requires a prior manifest", 4)
    scope.compare(prior_path, manifest)
    prior_scope = scope.manifest(prior_path)
    binding = finalization.original_binding(original)
    schema.validate_node(
        binding,
        {
            "type": "object",
            "properties": {
                "original_target": schema.string(),
                "original_findings": schema.array(schema.ORIGINAL_FINDING, 1),
                "previous_verification": schema.object_schema(("path", "checksum")),
                "history_targets": schema.array(schema.string()),
            },
            "required": ["original_target", "original_findings"],
            "additionalProperties": False,
        },
        "original reader binding",
    )
    records = Records(serialize(binding))
    findings = verification.originals(records)
    attempted = context.get("attempted", [])
    records.check(
        len(attempted) == len(set(attempted)),
        "reader requires unique attempted keys",
    )
    records.check(
        all(key in findings and findings[key]["axis"] == axis for key in attempted),
        "reader attempted keys must belong to its original axis",
    )
    records.finish()
    prior = verification.prior_input(binding, prior_scope["target"])
    regressions = prior.items("regressions") if prior else []
    own_regressions = [row for row in regressions if row["axis"] == axis]
    require(
        attempted or own_regressions,
        "reader requires attempted keys or carried regressions",
        4,
    )
    history = (
        list(
            dict.fromkeys(
                [*prior.strings("history_targets"), prior.value("prior_target")]
            )
        )
        if prior
        else []
    )
    return {
        "original_source": {
            "path": original,
            "checksum": blob_hash(Path(original).read_bytes()),
        },
        "original_target": binding["original_target"],
        "original_findings": [
            row for row in records.items("original_findings") if row["axis"] == axis
        ],
        "attempted": attempted,
        "regressions": own_regressions,
        "history_targets": history,
        "previous_verification": binding.get(
            "previous_verification", {"path": "none", "checksum": "none"}
        ),
        "prior_scope": {
            "manifest": prior_path,
            "target": prior_scope["target"],
            "checksum": blob_hash(Path(prior_path).read_bytes()),
        },
    }
