from __future__ import annotations

import io
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from darrow_skill_authoring import shell_tests
from darrow_skill_authoring.shell_tests import BashInterpreter, run


def invoke(*arguments: str) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    status = run(list(arguments), stdout=stdout, stderr=stderr)
    return status, stdout.getvalue(), stderr.getvalue()


def test_complete_matrix_runs_each_test_under_both_versions(tmp_path: Path) -> None:
    test = tmp_path / "passing test.sh"
    test.write_text("exit 0\n", encoding="utf-8")
    interpreters = [
        BashInterpreter("bash-3.2", Path("/shell/three"), "3.2.57-test"),
        BashInterpreter("bash-5", Path("/shell/five"), "5.2.0-test"),
    ]
    with (
        patch(
            "darrow_skill_authoring.shell_tests.discover_interpreters",
            return_value=interpreters,
        ),
        patch("darrow_skill_authoring.shell_tests.run_test", return_value=0) as execute,
    ):
        status, output, error = invoke(str(test))

    assert status == 0
    assert error == ""
    assert "format\tdarrow-shell-test-matrix-v1\n" in output
    assert (
        f"interpreter\tbash-3.2\tavailable\t{interpreters[0].path}\t3.2.57-test\n"
    ) in output
    assert (
        f"interpreter\tbash-5\tavailable\t{interpreters[1].path}\t5.2.0-test\n"
    ) in output
    assert output.endswith("matrix_status\tcomplete\n")
    assert execute.call_count == 2


def test_missing_version_is_unverified(tmp_path: Path) -> None:
    test = tmp_path / "passing.sh"
    test.write_text("exit 0\n", encoding="utf-8")
    found = [BashInterpreter("bash-3.2", Path("/shell/three"), "3.2.57-test")]
    with (
        patch(
            "darrow_skill_authoring.shell_tests.discover_interpreters",
            return_value=found,
        ),
        patch("darrow_skill_authoring.shell_tests.run_test", return_value=0),
    ):
        status, output, _ = invoke(str(test))

    assert status == 3
    assert "interpreter\tbash-5\tunavailable\n" in output
    assert output.endswith("matrix_status\tunverified\n")


def test_test_failure_wins_over_missing_version(tmp_path: Path) -> None:
    test = tmp_path / "failing.sh"
    test.write_text("exit 9\n", encoding="utf-8")
    found = [BashInterpreter("bash-5", Path("/shell/five"), "5.2.0-test")]
    with (
        patch(
            "darrow_skill_authoring.shell_tests.discover_interpreters",
            return_value=found,
        ),
        patch("darrow_skill_authoring.shell_tests.run_test", return_value=9),
    ):
        status, output, _ = invoke(str(test))

    assert status == 1
    assert f"test_result\tbash-5\t{test.resolve()}\tfailed\texit=9\n" in output
    assert output.endswith("matrix_status\tfailed\n")


@pytest.mark.parametrize("arguments", [(), ("--shell",), ("--unknown",)])
def test_invalid_invocation_prints_usage(arguments: tuple[str, ...]) -> None:
    status, _, error = invoke(*arguments)
    assert status == 2
    assert error == (
        "usage: verify-shell-tests [--shell <executable>]... -- <test-script>...\n"
    )


def test_missing_test_is_identified_with_exit_two(tmp_path: Path) -> None:
    missing = tmp_path / "missing.sh"
    status, _, error = invoke(str(missing))
    assert status == 2
    assert error == (
        f"verify-shell-tests: test script is not a readable regular file: {missing}\n"
    )


def test_explicit_shell_discovery_error_is_reported(tmp_path: Path) -> None:
    test = tmp_path / "passing.sh"
    test.write_text("exit 0\n", encoding="utf-8")
    with patch(
        "darrow_skill_authoring.shell_tests.discover_interpreters",
        side_effect=ValueError("shell is not executable: missing-bash"),
    ):
        status, _, error = invoke("--shell", "missing-bash", "--", str(test))
    assert status == 2
    assert error == "verify-shell-tests: shell is not executable: missing-bash\n"


def test_duplicate_interpreter_versions_are_run_once(tmp_path: Path) -> None:
    test = tmp_path / "passing.sh"
    test.write_text("exit 0\n", encoding="utf-8")
    found = [
        BashInterpreter("bash-3.2", Path("/shell/first"), "3.2.57"),
        BashInterpreter("bash-5", Path("/shell/five"), "5.2.0"),
    ]
    with (
        patch(
            "darrow_skill_authoring.shell_tests.discover_interpreters",
            return_value=found,
        ),
        patch("darrow_skill_authoring.shell_tests.run_test", return_value=0) as execute,
    ):
        assert invoke(str(test))[0] == 0
    assert execute.call_count == 2


def test_real_interpreter_resolution_accepts_path_and_command(tmp_path: Path) -> None:
    executable = tmp_path / "shell"
    executable.write_text("placeholder\n", encoding="utf-8")
    executable.chmod(0o755)
    assert shell_tests._resolve_interpreter(str(executable)) == executable.resolve()
    with patch(
        "darrow_skill_authoring.shell_tests.shutil.which", return_value=str(executable)
    ):
        assert shell_tests._resolve_interpreter("shell") == executable.resolve()


def test_interpreter_resolution_rejects_missing_and_nonexecutable(
    tmp_path: Path,
) -> None:
    assert shell_tests._resolve_interpreter(str(tmp_path / "missing")) is None
    candidate = tmp_path / "shell"
    candidate.write_text("placeholder\n", encoding="utf-8")
    candidate.chmod(0o600)
    if os.name != "nt":
        assert shell_tests._resolve_interpreter(str(candidate)) is None
    with patch("darrow_skill_authoring.shell_tests.shutil.which", return_value=None):
        assert shell_tests._resolve_interpreter("missing") is None


@pytest.mark.parametrize(
    ("completed", "expected"),
    [
        (subprocess.CompletedProcess([], 1, "", ""), None),
        (subprocess.CompletedProcess([], 0, "", ""), None),
        (subprocess.CompletedProcess([], 0, "3\t2\n", ""), None),
        (subprocess.CompletedProcess([], 0, "three\t2\tbad\n", ""), None),
        (subprocess.CompletedProcess([], 0, "3\t2\t3.2.57\n", ""), (3, 2, "3.2.57")),
    ],
)
def test_version_output_is_validated(
    completed: subprocess.CompletedProcess[str],
    expected: tuple[int, int, str] | None,
) -> None:
    with patch(
        "darrow_skill_authoring.shell_tests.subprocess.run", return_value=completed
    ):
        assert shell_tests._version(Path("shell")) == expected


def test_version_spawn_failure_is_unavailable() -> None:
    with patch(
        "darrow_skill_authoring.shell_tests.subprocess.run", side_effect=OSError
    ):
        assert shell_tests._version(Path("shell")) is None


def test_version_classification_rejects_explicit_unsupported() -> None:
    path = Path("shell")
    bash_three = shell_tests._classify_version(path, (3, 2, "3.2"), False)
    bash_five = shell_tests._classify_version(path, (5, 3, "5.3"), False)
    assert bash_three is not None
    assert bash_five is not None
    assert bash_three.label == "bash-3.2"
    assert bash_five.label == "bash-5"
    assert shell_tests._classify_version(path, (4, 4, "4.4"), False) is None
    with pytest.raises(ValueError, match="unsupported Bash version"):
        shell_tests._classify_version(path, (4, 4, "4.4"), True)


@pytest.mark.parametrize("explicit", [False, True])
def test_candidate_handles_missing_interpreter(explicit: bool) -> None:
    with patch(
        "darrow_skill_authoring.shell_tests._resolve_interpreter", return_value=None
    ):
        if explicit:
            with pytest.raises(ValueError, match="shell is not executable"):
                shell_tests._inspect_candidate("missing", explicit)
        else:
            assert shell_tests._inspect_candidate("missing", explicit) is None


@pytest.mark.parametrize("explicit", [False, True])
def test_candidate_handles_unreadable_version(explicit: bool) -> None:
    with (
        patch(
            "darrow_skill_authoring.shell_tests._resolve_interpreter",
            return_value=Path("shell"),
        ),
        patch("darrow_skill_authoring.shell_tests._version", return_value=None),
    ):
        if explicit:
            with pytest.raises(ValueError, match="cannot read Bash version"):
                shell_tests._inspect_candidate("shell", explicit)
        else:
            assert shell_tests._inspect_candidate("shell", explicit) is None


def test_discovery_deduplicates_labels_and_skips_unknown() -> None:
    values = [
        BashInterpreter("bash-3.2", Path("first"), "3.2"),
        BashInterpreter("bash-3.2", Path("second"), "3.2"),
        None,
        BashInterpreter("bash-5", Path("five"), "5.2"),
    ]
    with patch(
        "darrow_skill_authoring.shell_tests._inspect_candidate", side_effect=values
    ):
        found = shell_tests.discover_interpreters(["a", "b", "c", "d"], explicit=False)
    assert [item.label for item in found] == ["bash-3.2", "bash-5"]
    assert found[0].path == Path("first")


def test_test_file_resolution_failure_is_translated(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    test = tmp_path / "test.sh"
    test.write_text("exit 0\n", encoding="utf-8")

    def fail(_: str) -> Path:
        raise OSError

    monkeypatch.setattr(shell_tests, "_canonical_file", fail)
    with pytest.raises(ValueError, match="cannot resolve test script"):
        shell_tests._test_files([str(test)])


def test_run_test_reports_process_status_and_spawn_failure(tmp_path: Path) -> None:
    test = tmp_path / "test.py"
    test.write_text("raise SystemExit(7)\n", encoding="utf-8")
    interpreter = BashInterpreter("bash-5", Path(sys.executable), "test")
    assert shell_tests.run_test(interpreter, test) == 7
    with patch(
        "darrow_skill_authoring.shell_tests.subprocess.run", side_effect=OSError
    ):
        assert shell_tests.run_test(interpreter, test) == 127
    with patch(
        "darrow_skill_authoring.shell_tests.subprocess.run",
        return_value=subprocess.CompletedProcess([], -9),
    ):
        assert shell_tests.run_test(interpreter, test) == 137


def test_entrypoint_returns_run_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["verify-shell-tests"])
    with pytest.raises(SystemExit) as raised:
        shell_tests.entrypoint()
    assert raised.value.code == 2
