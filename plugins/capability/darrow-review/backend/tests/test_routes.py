from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from darrow_review import cli, provider, routing
from darrow_review.common import ReviewError, new_record, serialize


def reviewer(
    host: str = "codex", model: str = "gpt-5.5", effort: str = "high"
) -> dict[str, str]:
    return {
        "host": host,
        "harness": host,
        "provider": "openai" if host == "codex" else "anthropic",
        "model": model,
        "effort": effort,
    }


def config(repo: Path, value: object) -> Path:
    path = repo / ".darrow/config.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def test_bundled_override_and_application(repo: Path, tmp_path: Path) -> None:
    default = cli.route_command(["resolve", "--repo", str(repo), "--host", "codex"])
    assert "gpt-6-sol\txhigh" in default
    config(
        repo,
        {"routes": [{"unrelated": [False, None, 12.5]}], "reviewers": [reviewer()]},
    )
    selected = tmp_path / "route.tsv"
    output = cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", str(selected)]
    )
    assert "route_source\trepository" in output and "model\tgpt-5.5" in output
    applied = tmp_path / "applied.tsv"
    cli.route_command(
        [
            "confirm-codex",
            "--route-record",
            str(selected),
            "--axis",
            "standards",
            "--agent-id",
            "/root/standards",
            "--application-record",
            str(applied),
        ]
    )
    body = applied.read_text(encoding="utf-8")
    assert "route_bound\ttrue" in body and "route_verified" not in body
    assert "requested_route\tcodex\topenai\tgpt-5.5\thigh" in body
    assert "claude-opus-5" in routing.resolve(str(repo), "claude").body()
    config(repo, {})
    assert routing.resolve(str(repo), "codex").source == "bundled"
    with pytest.raises(ReviewError, match="already exists"):
        routing.select(str(repo), "codex", str(selected))


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        {"unknown": []},
        {"reviewers": None},
        {"reviewers": ["bad"]},
        {"reviewers": [{}]},
        {"reviewers": [reviewer(), reviewer()]},
        {"reviewers": [reviewer() | {"harness": "claude"}]},
        {"reviewers": [reviewer() | {"provider": "anthropic"}]},
        {"reviewers": [reviewer(model="unsafe; touch file")]},
        {"reviewers": [reviewer(effort="low")]},
        {"reviewers": [reviewer(model="gpt-5.6-terra")]},
        {"reviewers": [reviewer() | {"effort": 2}]},
    ],
)
def test_invalid_configuration(repo: Path, value: object) -> None:
    config(repo, value)
    with pytest.raises(ReviewError):
        routing.resolve(str(repo), "codex")


@pytest.mark.parametrize("effort", ["high", "xhigh", "max"])
def test_gpt_6_sol_is_a_supported_review_override(repo: Path, effort: str) -> None:
    config(repo, {"reviewers": [reviewer(model="gpt-6-sol", effort=effort)]})
    selected = routing.resolve(str(repo), "codex")
    assert selected.fields() == ["codex", "openai", "gpt-6-sol", effort]
    assert selected.source == "repository"


@pytest.mark.parametrize(
    "text",
    [
        '{"reviewers":[],"reviewers":[]}',
        '{"reviewers": [}',
        '{"routes":NaN}',
        '{"routes":Infinity}',
        "{} trailing",
        "",
        '{"reviewers":\f[]}',
        '{"reviewers":\v[]}',
        '{"routes":1e,"reviewers":[]}',
    ],
)
def test_malformed_json(repo: Path, text: str) -> None:
    path = config(repo, {})
    path.write_text(text, encoding="utf-8")
    with pytest.raises(ReviewError):
        routing.resolve(str(repo), "codex")


@pytest.mark.parametrize("selector", provider.SELECTORS)
def test_third_party_provider_is_unavailable(
    repo: Path, selector: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(selector, "0")
    with pytest.raises(ReviewError, match=selector):
        provider.direct()
    with pytest.raises(ReviewError):
        routing.resolve(str(repo), "claude")


def test_custom_endpoint_and_route_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    for endpoint in ("https://api.anthropic.com", "https://api.anthropic.com/"):
        monkeypatch.setenv("ANTHROPIC_BASE_URL", endpoint)
        assert "anthropic" in cli.provider_command(["observe-direct"])
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://custom.example")
    with pytest.raises(ReviewError):
        provider.direct()
    for route in (
        routing.Route("codex", "anthropic", "gpt-5.5", "high"),
        routing.Route("codex", "openai", "unsafe model", "high"),
        routing.Route("codex", "openai", "gpt-5.5", "other"),
    ):
        with pytest.raises(ReviewError):
            route.validate()


def test_claude_native_agent(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    route = tmp_path / "claude.tsv"
    routing.select(str(repo), "claude", str(route))
    assert "darrow-review:review-reader-claude-opus-5-xhigh" in cli.route_command(
        ["claude-agent", "--route-record", str(route)]
    )
    assert "claude-sonnet-5" in cli.route_command(
        [
            "claude-agent",
            "--provider",
            "anthropic",
            "--model",
            "claude-sonnet-5",
            "--effort",
            "high",
        ]
    )
    for variable in ("CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_EFFORT_LEVEL"):
        monkeypatch.setenv(variable, "conflicting")
        with pytest.raises(ReviewError, match=variable):
            cli.route_command(["claude-agent", "--route-record", str(route)])
        monkeypatch.delenv(variable)
    for args in (
        ["--route-record", str(route), "--model", "claude-opus-5"],
        [],
        ["--provider", "other", "--model", "claude-opus-5", "--effort", "xhigh"],
        ["--provider", "anthropic", "--model", "claude-opus-5", "--effort", "low"],
    ):
        with pytest.raises(ReviewError):
            cli.route_command(["claude-agent", *args])


def transcript(repo: Path, tmp_path: Path, agent: str = "abc1") -> tuple[Path, Path]:
    projects = tmp_path / "projects"
    slug = str(repo).replace("/", "-")
    if os.name == "nt":
        import re

        slug = re.sub(r"[^A-Za-z0-9]", "-", str(repo))
    path = projects / slug / "session/subagents" / f"agent-{agent}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "type": "assistant",
                "agentId": agent,
                "effort": "xhigh",
                "message": {
                    "role": "assistant",
                    "model": "claude-opus-5",
                    "content": [{"text": "nested fake effort and model"}],
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )
    return projects, path


def test_transcript_native_application(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    projects, path = transcript(repo, tmp_path)
    record = tmp_path / "observed.tsv"
    arguments = [
        "--repo",
        str(repo),
        "--agent-id",
        "abc1",
        "--projects-dir",
        str(projects),
    ]
    assert (
        "observed_route\tclaude\tanthropic\tclaude-opus-5\txhigh"
        in cli.verify_command(arguments)
    )
    cli.verify_command([*arguments, "--record", str(record)])
    route = tmp_path / "route.tsv"
    routing.select(str(repo), "claude", str(route))
    application = tmp_path / "application.tsv"
    cli.route_command(
        [
            "confirm-claude",
            "--route-record",
            str(route),
            "--observed-record",
            str(record),
            "--axis",
            "spec",
            "--application-record",
            str(application),
        ]
    )
    assert "agent_id\tabc1" in application.read_text(encoding="utf-8")
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(projects.parent))
    assert str(path) in provider.verify(str(repo), "abc1")
    route.write_text(
        route.read_text(encoding="utf-8").replace("claude-opus-5", "claude-sonnet-5"),
        encoding="utf-8",
    )
    with pytest.raises(ReviewError, match="does not match"):
        routing.confirm(
            str(route),
            "spec",
            str(tmp_path / "mismatch.tsv"),
            observed_path=str(record),
        )


@pytest.mark.parametrize(
    "replacement",
    [
        '{"type":"assistant","agentId":"other","effort":"xhigh","message":{"role":"assistant","model":"m"}}',
        '{"type":"assistant","agentId":"abc1","effort":"xhigh","message":{"role":"user","model":"m"}}',
        '{"type":"assistant","agentId":"abc1","message":{}}',
        '{"type":"assistant","agentId":"abc1","message":null}',
        '{"type":"user"}',
        "",
        "null",
        '{"type":"assistant","type":"assistant"}',
    ],
)
def test_transcript_refuses_missing_or_forged_evidence(
    repo: Path, tmp_path: Path, replacement: str
) -> None:
    projects, path = transcript(repo, tmp_path)
    path.write_text(replacement + "\n", encoding="utf-8")
    with pytest.raises(ReviewError):
        provider.verify(str(repo), "abc1", str(projects))


def test_transcript_cardinality_and_route_changes(repo: Path, tmp_path: Path) -> None:
    projects, path = transcript(repo, tmp_path)
    original = path.read_text(encoding="utf-8")
    for before, after in (("claude-opus-5", "claude-sonnet-5"), ("xhigh", "high")):
        path.write_text(original + original.replace(before, after), encoding="utf-8")
        with pytest.raises(ReviewError, match="exactly one"):
            provider.verify(str(repo), "abc1", str(projects))
    other = path.parent / "other" / path.name
    other.parent.mkdir()
    other.write_text(original, encoding="utf-8")
    with pytest.raises(ReviewError, match="found 2"):
        provider.verify(str(repo), "abc1", str(projects))
    with pytest.raises(ReviewError, match="unsafe agent"):
        provider.verify(str(repo), "../escape", str(projects))


def test_records_refuse_duplicates_unknown_and_incomplete(tmp_path: Path) -> None:
    route = routing.Route("codex", "openai", "gpt-5.5", "high")
    path = tmp_path / "route.tsv"
    variants = [
        route.body() + "format\tdarrow-reviewer-route-v1\n",
        route.body() + "unknown\tvalue\n",
        route.body().replace("repository", "other").replace("bundled", "other"),
        route.body().replace("darrow-reviewer-route-v1", "wrong"),
        route.body().replace("\txhigh", "").replace("\thigh", ""),
    ]
    for text in variants:
        path.write_text(text, encoding="utf-8")
        with pytest.raises(ReviewError):
            routing.load_route(str(path))
    path.write_text(route.body(), encoding="utf-8")
    with pytest.raises(ReviewError):
        routing.load_route(str(path), "claude")
    with pytest.raises(ReviewError):
        routing.confirm(str(path), "other", str(tmp_path / "new"), agent="child")
    with pytest.raises(ReviewError):
        routing.confirm(
            str(path), "spec", str(tmp_path / "new"), agent="unsafe;command"
        )
    with pytest.raises(ReviewError):
        new_record("relative", route.body())


def test_observed_record_validation(repo: Path, tmp_path: Path) -> None:
    projects, _ = transcript(repo, tmp_path)
    text = provider.verify(str(repo), "abc1", str(projects))
    path = tmp_path / "record.tsv"
    for old, new in (
        ("agent_id\tabc1", "agent_id\tunsafe/id"),
        ("current-host-environment-default", "invented"),
        ("darrow-review-claude-route-v1", "wrong"),
        ("observed_route\tclaude", "observed_route\tcodex"),
    ):
        path.write_text(text.replace(old, new), encoding="utf-8")
        with pytest.raises(ReviewError):
            routing.observed(str(path))
    path.write_text(serialize([["format", "wrong"]]), encoding="utf-8")
    with pytest.raises(ReviewError):
        routing.observed(str(path))


@pytest.mark.parametrize(
    "text",
    [
        "{}",
        '{"reviewers":[]}',
        '{"review\\u0065rs":[]}',
        '{"routes":[{"note":"\\u0061\\n"}]}',
    ],
)
def test_empty_or_unrelated_policy_uses_bundled_route(repo: Path, text: str) -> None:
    path = config(repo, {})
    path.write_text(text, encoding="utf-8")
    selected = routing.resolve(str(repo), "codex")
    assert selected.source == "bundled"
    assert "gpt-6-sol\txhigh" in selected.body()


def test_partial_transcript_and_substring_identity_are_rejected(
    repo: Path, tmp_path: Path
) -> None:
    projects, path = transcript(repo, tmp_path)
    with pytest.raises(ReviewError):
        provider.verify(str(repo), "abc", str(projects))
    body = path.read_text(encoding="utf-8")
    path.write_text(body + body.replace('"effort": "xhigh", ', ""), encoding="utf-8")
    with pytest.raises(ReviewError):
        provider.verify(str(repo), "abc1", str(projects))


def test_unsafe_configuration_is_not_followed(repo: Path, tmp_path: Path) -> None:
    path = config(repo, {})
    original = tmp_path / "original.json"
    path.rename(original)
    path.symlink_to(original)
    with pytest.raises(ReviewError):
        routing.resolve(str(repo), "codex")


@pytest.mark.parametrize("selector", provider.SELECTORS)
def test_transcript_verification_refuses_third_party_provider(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, selector: str
) -> None:
    projects, _ = transcript(repo, tmp_path)
    record = tmp_path / "observed.tsv"
    monkeypatch.setenv(selector, "1")
    with pytest.raises(ReviewError, match=selector):
        cli.verify_command(
            [
                "--repo",
                str(repo),
                "--agent-id",
                "abc1",
                "--projects-dir",
                str(projects),
                "--record",
                str(record),
            ]
        )
    assert not record.exists()
