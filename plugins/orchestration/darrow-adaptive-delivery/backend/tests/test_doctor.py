from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from darrow_adaptive_delivery import cli, doctor


def diagnose_codex(
    config: Path,
    *,
    backend: str = "v2",
    context: str = "effective",
    environment: dict[str, str] | None = None,
    project_root: Path | None = None,
    cwd: Path | None = None,
) -> str:
    project_args = [] if project_root is None else ["--project-root", str(project_root)]
    return doctor.run(
        [
            "codex",
            "--config",
            str(config),
            "--backend",
            backend,
            "--context",
            context,
            *project_args,
        ],
        environment=environment or {},
        cwd=cwd,
    )


def write_config(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def test_codex_v2_reports_adequate_capacity_and_ignores_depth(tmp_path: Path) -> None:
    config = write_config(
        tmp_path / "codex home/config.toml",
        """[agents]
enabled = true
max_concurrent_threads_per_session = 5
max_depth = 1
""",
    )

    output = diagnose_codex(config)

    assert f"configuration_source: {config.resolve()}" in output
    assert "configuration_context: effective" in output
    assert "concurrency: adequate (5; full path requires 5)" in output
    assert (
        "nesting: not-applicable (agents.max_depth=1 is V1-only and ignored by V2)"
        in output
    )
    assert "baseline_owner_only: supported" in output
    assert "full_required_assessment: supported" in output


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        (
            "[agents]\nenabled = false\nmax_concurrent_threads_per_session = 99\n",
            "baseline_owner_only: unsupported",
        ),
        (
            "[agents]\nenabled = true\nmax_concurrent_threads_per_session = 4\n",
            "full_required_assessment: unsupported",
        ),
    ],
)
def test_codex_reports_disabled_or_inadequate_capacity(
    tmp_path: Path, content: str, expected: str
) -> None:
    output = diagnose_codex(write_config(tmp_path / "config.toml", content))
    assert expected in output


def test_codex_disabled_guidance_includes_other_known_inadequate_controls(
    tmp_path: Path,
) -> None:
    config = write_config(
        tmp_path / "config.toml",
        """[agents]
enabled = false
max_concurrent_threads_per_session = 4
max_depth = 3
""",
    )
    output = diagnose_codex(config, backend="v1")
    assert "guidance: set agents.enabled = true" in output
    assert "agents.max_concurrent_threads_per_session = 5 or greater" in output
    assert "agents.max_depth = 4 or greater" in output


@pytest.mark.parametrize(
    "content",
    [
        "[agents]\nmax_concurrent_threads_per_session = 'nope'\n",
        '{"agents":{"max_concurrent_threads_per_session":5}}\n',
        "agents:\n  max_concurrent_threads_per_session: 5\n",
        "[agents]\nenabled = true\nenabled = false\n",
    ],
)
def test_codex_rejects_malformed_or_wrongly_typed_toml(
    tmp_path: Path, content: str
) -> None:
    config = write_config(tmp_path / "config.toml", content)
    with pytest.raises(doctor.DiagnosisError, match="status: malformed") as failure:
        diagnose_codex(config)
    assert "invalid or duplicate Adaptive Delivery agent setting" in str(failure.value)


def test_codex_accepts_unrelated_nested_toml(tmp_path: Path) -> None:
    config = write_config(
        tmp_path / "config.toml",
        '''model = "gpt-test"
experimental_values = [
  ["one ] bracket"],
  ["two"]]
instructions = """
Keep this valid multiline TOML.
"""
[agents]
enabled = false
max_concurrent_threads_per_session = 5
''',
    )
    output = diagnose_codex(config)
    assert "status: valid" in output
    assert "delegation: disabled" in output


def test_codex_absent_is_unknown_and_names_isolated_source(tmp_path: Path) -> None:
    config = tmp_path / "codex home/config.toml"
    config.parent.mkdir()
    output = diagnose_codex(config, context="isolated-eval")
    assert "status: absent" in output
    assert "configuration_context: isolated-eval" in output
    assert "configuration_sources_used: \n" in output
    assert "checkout_config_used: no" in output
    assert "full_required_assessment: unknown" in output


def test_codex_effective_context_uses_project_override_and_reports_source(
    tmp_path: Path,
) -> None:
    user_config = tmp_path / "codex-home/config.toml"
    user_config.parent.mkdir()
    project_config = write_config(
        tmp_path / "checkout/.codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )

    output = diagnose_codex(
        user_config,
        project_root=project_config.parents[1],
        cwd=project_config.parents[1],
    )

    assert f"configuration_sources_used: {project_config.resolve()}" in output
    assert "checkout_config_used: yes" in output
    assert "concurrency: adequate (5; full path requires 5)" in output
    assert "baseline_owner_only: supported" in output
    assert "full_required_assessment: supported" in output


def test_codex_effective_project_layers_override_user_and_report_all_contributors(
    tmp_path: Path,
) -> None:
    user_config = write_config(
        tmp_path / "codex-home/config.toml",
        "[agents]\nenabled = false\nmax_concurrent_threads_per_session = 2\n",
    )
    root_config = write_config(
        tmp_path / "checkout/.codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 4\n",
    )
    nested_config = write_config(
        tmp_path / "checkout/nested/.codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )

    output = diagnose_codex(
        user_config,
        project_root=root_config.parents[1],
        cwd=nested_config.parents[1],
    )

    assert (
        "configuration_sources_used: "
        f"{user_config.resolve()} | {nested_config.resolve()}"
    ) in output
    assert (
        str(root_config.resolve())
        in output.split("configuration_sources_checked: ", maxsplit=1)[1].splitlines()[
            0
        ]
    )
    assert "checkout_config_used: yes" in output
    assert "delegation: disabled" in output
    assert "concurrency: adequate (5; full path requires 5)" in output
    assert "baseline_owner_only: unsupported" in output


def test_codex_isolated_context_never_uses_project_config(tmp_path: Path) -> None:
    user_config = write_config(
        tmp_path / "isolated-home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 4\n",
    )
    project_config = write_config(
        tmp_path / "checkout/.codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 99\n",
    )

    output = diagnose_codex(
        user_config,
        context="isolated-eval",
        project_root=project_config.parents[1],
        cwd=project_config.parents[1],
    )

    assert f"configuration_sources_used: {user_config.resolve()}" in output
    assert "checkout_config_used: no" in output
    assert str(project_config.resolve()) not in output
    assert (
        "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
        in output
    )
    assert "concurrency: adequate (99" not in output


def test_codex_v2_depth_only_project_layer_is_checked_but_not_used(
    tmp_path: Path,
) -> None:
    user_config = write_config(
        tmp_path / "codex-home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )
    checkout = tmp_path / "checkout"
    project_config = write_config(
        checkout / ".codex/config.toml",
        "[agents]\nmax_depth = 20\n",
    )

    output = diagnose_codex(
        user_config,
        project_root=checkout,
        cwd=checkout,
    )

    assert f"configuration_sources_used: {user_config.resolve()}" in output
    assert (
        str(project_config.resolve())
        in output.split("configuration_sources_checked: ", maxsplit=1)[1].splitlines()[
            0
        ]
    )
    assert "checkout_config_used: no" in output


def test_codex_no_control_source_does_not_invent_user_or_checkout_use(
    tmp_path: Path,
) -> None:
    user_config = tmp_path / "codex-home/config.toml"
    user_config.parent.mkdir()
    checkout = tmp_path / "checkout"
    project_config = write_config(
        checkout / ".codex/config.toml",
        'model = "gpt-test"\n',
    )

    output = diagnose_codex(
        user_config,
        project_root=checkout,
        cwd=checkout,
    )

    assert "configuration_sources_used: \n" in output
    assert f"configuration_source: {user_config.resolve()}" in output
    assert f"configuration_sources_checked: {user_config.resolve()}" in output
    assert (
        str(project_config.resolve())
        in output.split("configuration_sources_checked: ", maxsplit=1)[1].splitlines()[
            0
        ]
    )
    assert "checkout_config_used: no" in output


def test_codex_malformed_project_does_not_claim_checked_layers_were_used(
    tmp_path: Path,
) -> None:
    user_config = write_config(
        tmp_path / "codex-home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )
    checkout = tmp_path / "checkout"
    project_config = write_config(
        checkout / ".codex/config.toml",
        "[agents\n",
    )

    with pytest.raises(doctor.DiagnosisError) as failure:
        diagnose_codex(user_config, project_root=checkout, cwd=checkout)

    assert "configuration_sources_used: \n" in failure.value.output
    assert "checkout_config_used: no" in failure.value.output
    assert str(project_config.resolve()) in failure.value.output


@pytest.mark.parametrize("project_root", [Path("relative"), Path("/not-an-ancestor")])
def test_codex_rejects_invalid_effective_project_root(
    tmp_path: Path, project_root: Path
) -> None:
    user_config = write_config(
        tmp_path / "codex-home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )
    checkout = tmp_path / "checkout"
    checkout.mkdir()

    with pytest.raises(doctor.DiagnosisError, match="project root"):
        diagnose_codex(user_config, project_root=project_root, cwd=checkout)


def test_codex_refuses_project_config_discovery_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    user_config = write_config(
        tmp_path / "codex-home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )
    checkout = tmp_path / "checkout"
    candidate = checkout / ".codex/config.toml"
    candidate.parent.mkdir(parents=True)
    original = Path.lstat

    def fail_candidate(path: Path) -> os.stat_result:
        if path == candidate:
            raise PermissionError("secret detail")
        return original(path)

    monkeypatch.setattr(Path, "lstat", fail_candidate)

    with pytest.raises(doctor.DiagnosisError) as failure:
        diagnose_codex(user_config, project_root=checkout, cwd=checkout)

    assert "status: unavailable" in failure.value.diagnostic
    assert str(candidate) in failure.value.diagnostic
    assert "secret detail" not in failure.value.diagnostic


def test_codex_uses_codex_home_instead_of_checkout(tmp_path: Path) -> None:
    checkout = tmp_path / "checkout"
    checkout_config = write_config(
        checkout / ".codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 99\n",
    )
    home_config = write_config(
        tmp_path / "home/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 4\n",
    )
    assert checkout_config.exists()

    output = doctor.run(
        ["codex", "--backend", "v2", "--context", "isolated-eval"],
        environment={"CODEX_HOME": str(home_config.parent)},
        cwd=checkout,
    )

    assert f"configuration_source: {home_config.resolve()}" in output
    assert (
        "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
        in output
    )
    assert "concurrency: adequate (99" not in output


def test_codex_uses_userprofile_on_native_windows(tmp_path: Path) -> None:
    config = write_config(
        tmp_path / ".codex/config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 5\n",
    )
    output = doctor.run(
        ["codex", "--backend", "v2"],
        environment={"USERPROFILE": str(tmp_path)},
    )
    assert f"configuration_source: {config.resolve()}" in output
    assert "full_required_assessment: supported" in output


def test_codex_requires_a_resolvable_default_source(tmp_path: Path) -> None:
    with pytest.raises(
        doctor.DiagnosisError,
        match="HOME, USERPROFILE, and CODEX_HOME are unset",
    ):
        doctor.run(["codex", "--backend", "v2"], environment={}, cwd=tmp_path)
    with pytest.raises(
        doctor.DiagnosisError,
        match="configuration parent directory cannot be resolved",
    ):
        diagnose_codex(tmp_path / "missing/config.toml")


def test_codex_rejects_non_file_and_read_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    directory = tmp_path / "config.toml"
    directory.mkdir()
    with pytest.raises(doctor.DiagnosisError, match="readable regular file"):
        diagnose_codex(directory)

    config = write_config(tmp_path / "real.toml", "[agents]\nenabled = true\n")
    original = Path.read_bytes

    def fail_read(path: Path) -> bytes:
        if path == config:
            raise PermissionError("secret detail")
        return original(path)

    monkeypatch.setattr(Path, "read_bytes", fail_read)
    with pytest.raises(doctor.DiagnosisError, match="failed while reading") as failure:
        diagnose_codex(config)
    assert "secret detail" not in str(failure.value)


@pytest.mark.parametrize(
    ("backend", "depth", "expected"),
    [
        ("v1", None, "baseline_owner_only: unknown"),
        ("v1", 0, "baseline_owner_only: unsupported"),
        ("v1", 3, "full_required_assessment: unsupported"),
        ("v1", 4, "full_required_assessment: supported"),
        ("unknown", 4, "full_required_assessment: unknown"),
    ],
)
def test_codex_keeps_v1_and_unknown_depth_results_distinct(
    tmp_path: Path, backend: str, depth: int | None, expected: str
) -> None:
    depth_line = "" if depth is None else f"max_depth = {depth}\n"
    config = write_config(
        tmp_path / f"{backend}-{depth}.toml",
        "[agents]\nenabled = true\nmax_concurrent_threads_per_session = 5\n"
        + depth_line,
    )
    assert expected in diagnose_codex(config, backend=backend)


def diagnose_claude(
    version: str | None,
    environment: dict[str, str] | None = None,
    *,
    probe: doctor.VersionProbe | None = None,
) -> str:
    args = ["claude"] if version is None else ["claude", "--version", version]
    return doctor.run(args, environment=environment or {}, version_probe=probe)


def test_claude_supported_controls_report_full_capacity() -> None:
    output = diagnose_claude(
        "2.1.219",
        {
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "5",
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "4",
        },
    )
    assert "concurrency_control_applicability: supported" in output
    assert "nesting_control_applicability: supported" in output
    assert "concurrency: adequate (5; full path requires 5)" in output
    assert "nesting: adequate (4; full path requires 4)" in output
    assert "full_required_assessment: supported" in output


def test_claude_inadequate_and_default_capacity() -> None:
    inadequate = diagnose_claude(
        "2.1.219",
        {
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "4",
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "3",
        },
    )
    defaults = diagnose_claude(
        "2.1.219",
        {
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "",
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "",
        },
    )
    assert (
        "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
        in inadequate
    )
    assert (
        "nesting: inadequate (3; baseline requires 1, full path requires 4)"
        in inadequate
    )
    assert "concurrency: adequate (20; full path requires 5)" in defaults
    assert (
        "nesting: inadequate (3; baseline requires 1, full path requires 4)" in defaults
    )


@pytest.mark.parametrize(
    ("version", "nesting", "full"),
    [
        (
            "2.1.216",
            "nesting: adequate (host default 5; control not supported by this version)",
            "full_required_assessment: unknown",
        ),
        (
            "2.1.171",
            "nesting: unknown (version predates documented nesting behavior)",
            "full_required_assessment: unknown",
        ),
        (
            "2.1.218",
            "nesting: inadequate (1; baseline requires 1, full path requires 4)",
            "full_required_assessment: unsupported",
        ),
    ],
)
def test_claude_version_boundaries(version: str, nesting: str, full: str) -> None:
    output = diagnose_claude(version)
    assert nesting in output
    assert full in output


def test_claude_discovers_or_reports_unknown_version() -> None:
    discovered = diagnose_claude(None, probe=lambda: "Claude Code 2.1.219 (stable)")
    unknown = diagnose_claude(None, probe=lambda: "unparseable")
    assert "host_version: 2.1.219" in discovered
    assert "status: version-unknown" in unknown
    assert "baseline_owner_only: unknown" in unknown


@pytest.mark.parametrize(
    ("key", "value", "message"),
    [
        (
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
            "secret-token",
            "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS must be a positive whole number",
        ),
        (
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH",
            "0",
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH must be a positive whole number",
        ),
    ],
)
def test_claude_rejects_invalid_controls_without_leaking_values(
    key: str, value: str, message: str
) -> None:
    with pytest.raises(doctor.DiagnosisError, match=message) as failure:
        diagnose_claude("2.1.219", {key: value})
    assert value not in str(failure.value)


@pytest.mark.parametrize(
    "args",
    [[], ["other"], ["codex", "--backend"], ["codex", "--backend", "v3"]],
)
def test_usage_rejects_invalid_arguments(args: list[str]) -> None:
    with pytest.raises(doctor.UsageError):
        doctor.run(args, environment={})


def test_cli_preserves_diagnosis_exit_contract(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config = write_config(
        tmp_path / "config.toml",
        "[agents]\nmax_concurrent_threads_per_session = 'secret-token'\n",
    )
    monkeypatch.setattr(
        sys, "argv", ["host-config-doctor", "codex", "--config", str(config)]
    )

    assert cli.host_doctor() == 1
    captured = capsys.readouterr()
    assert "configuration_source:" in captured.out
    assert "status: malformed" in captured.err
    assert "secret-token" not in captured.err


def test_cli_prints_usage_and_returns_two(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["host-config-doctor"])
    assert cli.host_doctor() == 2
    assert "usage: host-config-doctor codex" in capsys.readouterr().err


def test_default_claude_probe_handles_missing_binary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PATH", os.devnull)
    assert "status: version-unknown" in diagnose_claude(None)
