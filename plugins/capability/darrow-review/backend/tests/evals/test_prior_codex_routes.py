"""Historical route authorization consumes real pinned assessment protocols."""

import json
from pathlib import Path

import pytest
from prior_codex_routes import prior_bindings

from conftest import git
from darrow_review import result, scope
from darrow_review.common import document, read_text, serialize
from darrow_review.records import validate_result
from fixtures import result_record, verification_record, write

ROUTE = {
    "host": "codex",
    "provider": "openai",
    "model": "gpt-6.1-sol",
    "effort": "xhigh",
}


def history(repo: Path) -> tuple[Path, Path]:
    (repo / "file.txt").write_text("broken\n")
    git(repo, "add", "file.txt")
    git(repo, "commit", "-qm", "broken")
    original = git(repo, "rev-parse", "HEAD")
    prior = Path(
        str(
            document(
                scope.prepare(
                    scope.ScopeOptions(
                        repo=str(repo),
                        base="HEAD^",
                        target=original,
                    )
                )
            )["manifest"]
        )
    )
    record = result_record()
    record.update(result.scope_records(str(prior)))
    write(prior.parent / "result.json", record)
    write(prior.parent / "reviewer-route.json", {"selected_route": ROUTE})
    for axis in ("standards", "spec"):
        write(
            prior.parent / f"{axis}-route.json",
            {
                "axis": axis,
                "requested_route": ROUTE,
                "route_bound": "true",
                "agent_id": f"old-{axis}",
            },
        )
    (repo / "file.txt").write_text("repaired\n")
    current = Path(
        str(
            document(
                scope.prepare(
                    scope.ScopeOptions(
                        repo=str(repo),
                        target="WORKTREE",
                        prior_manifest=str(prior),
                        allow_empty=True,
                    )
                )
            )["manifest"]
        )
    )
    verified = verification_record()
    findings = result.original_findings(validate_result(serialize(record)))
    verified.update(
        original_target=original,
        prior_target=original,
        current_target=document(read_text(current))["target"],
        original_findings=findings,
    )
    verified["attempts"][0]["key"] = findings[0]["key"]
    write(current.parent / "verification.json", verified)
    return current.parent, prior.parent


def test_real_prior_scope_authorizes_distinct_bound_readers(repo: Path) -> None:
    current, _ = history(repo)
    assert prior_bindings(current) == [
        (
            {"standards": "old-standards", "spec": "old-spec"},
            ["codex", "openai", "gpt-6.1-sol", "xhigh"],
        )
    ]


@pytest.mark.parametrize(
    "mutation",
    ["unbound route", "reused reader", "changed findings", "ambiguous assessment"],
)
def test_prior_assessment_cannot_authorize_invalid_route_history(
    repo: Path, mutation: str
) -> None:
    current, prior = history(repo)
    if mutation == "ambiguous assessment":
        (prior / "verification.json").write_text("{}")
    elif mutation == "changed findings":
        record = json.loads((current / "verification.json").read_text())
        record["original_findings"][0]["evidence"] = "changed"
        write(current / "verification.json", record)
    else:
        path = prior / "spec-route.json"
        record = json.loads(path.read_text())
        record["route_bound" if mutation == "unbound route" else "agent_id"] = (
            "false" if mutation == "unbound route" else "old-standards"
        )
        write(path, record)
    with pytest.raises(AssertionError):
        prior_bindings(current)


def test_external_handoff_does_not_fabricate_prior_reader_bindings(repo: Path) -> None:
    current, prior = history(repo)
    (prior / "result.json").unlink()
    assert prior_bindings(current) == []


def test_absent_scope_cannot_authorize_any_prior_reader(tmp_path: Path) -> None:
    assert prior_bindings(tmp_path) == []


def test_prior_comprehensive_assessment_cannot_bind_an_unavailable_axis(
    repo: Path,
) -> None:
    current, prior = history(repo)
    record = json.loads((prior / "result.json").read_text())
    record["standards"] = "fail"
    record["spec"] = "not_available"
    record["spec_source"] = "not_available"
    record["findings"][0]["axis"] = "standards"
    write(prior / "result.json", record)
    verification = json.loads((current / "verification.json").read_text())
    findings = result.original_findings(validate_result(serialize(record)))
    verification["original_findings"] = findings
    verification["attempts"][0]["key"] = findings[0]["key"]
    write(current / "verification.json", verification)
    with pytest.raises(AssertionError, match="axes do not match"):
        prior_bindings(current)


def test_authored_prior_record_without_native_routes_cannot_authorize_children(
    repo: Path,
) -> None:
    current, prior = history(repo)
    (prior / "reviewer-route.json").unlink()
    assert prior_bindings(current) == []
