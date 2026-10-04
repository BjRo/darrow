import json
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import cast

import pytest

from darrow_artificer import operations, rpc, worker
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim
from darrow_artificer.rpc import Rpc
from test_admission import existing


def prepare_host(
    installation: Installation,
) -> tuple[Claim, Path]:
    claim = existing(installation, 1)
    claim.status = "running"
    claim.worktree = str(installation.root)
    installation.save(claim)
    home = installation.delivery_dir(claim.id) / "native"
    home.mkdir()
    executable = installation.root / "codex-fixture"
    executable.write_text(
        f"#!{sys.executable}\n"
        + Path(__file__).with_name("app_server_stub.py").read_text()
    )
    executable.chmod(0o700)
    grant = installation.grant
    grant.codex = str(executable)
    grant.model = "gpt-6-sol"
    installation.save_grant(grant)
    return claim, home


def test_native_continuation_preserves_identity_before_first_turn(
    installation: Installation,
) -> None:
    claim, home = prepare_host(installation)
    events, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["pr"] == 9
    assert installation.claim(claim.id).native is not None
    evidence = [json.loads(line) for line in events.read_text().splitlines()]
    turns = [event for event in evidence if event.get("method") == "turn/completed"]
    assert [turn["params"]["turn"]["id"] for turn in turns] == [
        "first",
        "native-second",
    ]


def test_native_question_and_same_thread_answer(installation: Installation) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "scenario").write_text("question")
    claim.pending_answer = "Continue with the retained task."
    _, output = worker.execute(installation, claim, home)
    outcome = json.loads(output.read_text())
    assert outcome["status"] == "question"
    assert "Choose a color?" in outcome["question"]
    assert "Violet" in outcome["question"]
    claim.pending_answer = "  violet\nKeep these bytes.\n"
    (home / "scenario").write_text("reply")
    events, output = worker.execute(installation, claim, home)
    messages = [json.loads(line) for line in events.read_text().splitlines()]
    resumes = [
        message for message in messages if message.get("method") == "thread/resume"
    ]
    assert len(resumes) == 1 and resumes[0]["params"]["threadId"] == "original"
    assert json.loads(output.read_text())["status"] == "pr-open"


def test_text_question_while_goal_active(
    installation: Installation,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "scenario").write_text("text-question")
    claim.pending_answer = "Continue the retained task."
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["question"] == "Choose a scope?"


def test_fatal_error_during_result_capture_never_reports_completion(
    installation: Installation,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "scenario").write_text("fatal")
    claim.pending_answer = "Continue the retained task."
    with pytest.raises(RuntimeError, match="Access expired"):
        worker.execute(installation, claim, home)


def message(method: str, **params: object) -> dict[str, object]:
    return {"method": method, "params": {"threadId": "original", **params}}


@pytest.mark.parametrize(
    "overrides,expected",
    [
        (
            {
                "responses": {
                    "thread/resume": {
                        "thread": {"id": "original"},
                        "model": "wrong",
                        "reasoningEffort": "medium",
                        "modelProvider": "openai",
                    }
                }
            },
            "route",
        ),
        (
            {
                "responses": {
                    "thread/resume": {
                        "thread": {"id": "replacement"},
                        "model": "gpt-6-sol",
                        "reasoningEffort": "medium",
                        "modelProvider": "openai",
                    }
                }
            },
            "identity",
        ),
        ({"responses": {"thread/goal/get": {"goal": None}}}, "goal disappeared"),
        (
            {
                "responses": {
                    "thread/goal/get": {
                        "goal": {
                            "threadId": "original",
                            "objective": "A replacement task",
                            "status": "complete",
                        }
                    }
                }
            },
            "objective changed",
        ),
        (
            {
                "responses": {
                    "thread/goal/get": {
                        "goal": {
                            "threadId": "wrong",
                            "objective": "Deliver",
                            "status": "complete",
                        }
                    }
                }
            },
            "identity",
        ),
        (
            {
                "responses": {
                    "thread/goal/get": {
                        "goal": {
                            "threadId": "original",
                            "objective": "Deliver",
                            "status": "unknown",
                        }
                    }
                }
            },
            "goal status",
        ),
        ({"responses": {"thread/read": {"thread": {"id": "wrong"}}}}, "another thread"),
        (
            {"responses": {"thread/read": {"thread": {"id": "original", "turns": []}}}},
            "history",
        ),
        (
            {
                "before": {
                    "turn/start": [
                        message(
                            "turn/completed",
                            turn={"id": "first", "status": "failed", "error": "quota"},
                        )
                    ]
                }
            },
            "quota",
        ),
        ({"before": {"turn/start": [message("thread/goal/cleared")]}}, "cleared"),
        (
            {
                "before": {
                    "turn/start": [
                        {
                            "id": "r",
                            **message("item/tool/requestUserInput", questions=[]),
                        }
                    ]
                }
            },
            "empty",
        ),
        (
            {
                "before": {
                    "turn/start": [
                        {
                            "id": "r",
                            **message(
                                "item/tool/requestUserInput",
                                threadId="child",
                                questions=[{"question": "Decide?"}],
                            ),
                        }
                    ]
                }
            },
            "Unanswered",
        ),
        (
            {
                "before": {
                    "turn/start": [
                        {"id": "r", **message("item/commandExecution/requestApproval")}
                    ]
                }
            },
            "Unanswered",
        ),
        (
            {"errors": {"initialize": {"message": "Protocol unavailable"}}},
            "Protocol unavailable",
        ),
    ],
)
def test_protocol_refusals_preserve_original_identity(
    installation: Installation,
    overrides: dict[str, object],
    expected: str,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    original = claim.native
    home = installation.delivery_dir(claim.id) / "native"
    (home / "overrides.json").write_text(json.dumps(overrides))
    claim.pending_answer = "Continue only the original task."
    with pytest.raises((ValueError, RuntimeError), match=expected):
        worker.execute(installation, claim, home)
    assert installation.claim(claim.id).native == original


def test_child_events_and_retriable_host_errors_do_not_complete_root(
    installation: Installation,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "before": {
                    "turn/start": [
                        message(
                            "turn/completed",
                            threadId="child",
                            turn={"id": "child-turn", "status": "completed"},
                        ),
                        message(
                            "error",
                            willRetry=True,
                            error={"message": "Transient connection failure"},
                        ),
                    ]
                }
            }
        )
    )
    claim.pending_answer = "Continue the original task."
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["pr"] == 9


def test_host_exit_preserves_thread_and_diagnostics(installation: Installation) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    grant = installation.grant
    grant.codex = "/usr/bin/false"
    installation.save_grant(grant)
    claim.pending_answer = "Continue the original task."
    with pytest.raises((BrokenPipeError, RuntimeError)):
        worker.execute(installation, claim, home)
    assert installation.claim(claim.id).native == claim.native
    assert list(home.parent.glob("*-stderr"))


@pytest.mark.parametrize(
    "turn,expected",
    [
        ({"id": "native-second", "status": "failed"}, "did not complete"),
        ({"id": "native-second", "status": "completed"}, "final response"),
        ({"id": "native-second", "status": "completed", "items": []}, "ambiguous"),
        (
            {
                "id": "native-second",
                "status": "completed",
                "items": [
                    {
                        "type": "agentMessage",
                        "phase": "final_answer",
                        "text": "not an outcome",
                    }
                ],
            },
            "validation error",
        ),
    ],
)
def test_malformed_completion_is_retained_as_failure(
    installation: Installation,
    turn: dict[str, object],
    expected: str,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "responses": {
                    "thread/read": {
                        "thread": {"id": "original", "turns": [turn]},
                    }
                }
            }
        )
    )
    claim.pending_answer = "Continue the original task."
    with pytest.raises(ValueError, match=expected):
        worker.execute(installation, claim, home)


def test_simple_native_question_without_options(installation: Installation) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "before": {
                    "turn/start": [
                        {
                            "id": "q",
                            **message(
                                "item/tool/requestUserInput",
                                questions=[{"question": "What scope?"}],
                            ),
                        },
                    ]
                }
            }
        )
    )
    claim.pending_answer = "Continue the original task."
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["question"] == "What scope?"


def test_preflight_resume_empty_goal_snapshot_is_not_goal_loss(
    installation: Installation,
) -> None:
    claim, home = prepare_host(installation)
    (home / "scenario").write_text("text-question")
    (home / "overrides.json").write_text(
        json.dumps({"responses": {"thread/goal/get": {"goal": None}}})
    )
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["status"] == "question"
    claim = installation.claim(claim.id)
    claim.pending_answer = "Violet"
    (home / "scenario").write_text("complete")
    (home / "overrides.json").write_text(
        json.dumps({"before": {"thread/resume": [message("thread/goal/cleared")]}})
    )
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["status"] == "pr-open"


def test_fatal_event_buffered_after_result_prevents_completion(
    installation: Installation,
) -> None:
    claim, home = prepare_host(installation)
    (home / "scenario").write_text("text-question")
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "responses": {"thread/goal/get": {"goal": None}},
                "after_response": {
                    "thread/read": [
                        message(
                            "error",
                            willRetry=False,
                            error={"message": "Buffered fatal error"},
                        ),
                    ]
                },
            }
        )
    )
    with pytest.raises(RuntimeError, match="Buffered fatal error"):
        worker.execute(installation, claim, home)
    assert not list(home.parent.glob("*-result.json"))


def test_revocation_serializes_with_native_turn_submission(
    installation: Installation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim, home = prepare_host(installation)
    monkeypatch.setattr(installation, "verify_binding", lambda: None)
    started, finished = threading.Event(), threading.Event()
    submitted_after_revoke: list[bool] = []

    def revoke() -> None:
        started.set()
        operations.revoke(installation)
        finished.set()

    revoker = threading.Thread(target=revoke)
    original = Rpc.call

    def at_submission(
        self: Rpc, method: str, params: dict[str, object]
    ) -> dict[str, object]:
        if method == "turn/start":
            revoker.start()
            assert started.wait(1)
            submitted_after_revoke.append(finished.wait(0.2))
        return original(self, method, params)

    monkeypatch.setattr(Rpc, "call", at_submission)
    try:
        worker.execute(installation, claim, home)
    finally:
        revoker.join(timeout=2)
    assert finished.is_set()
    assert submitted_after_revoke == [False]


def test_revoked_grant_cannot_resume_a_native_thread(
    installation: Installation,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    grant = installation.grant
    grant.enabled = False
    installation.save_grant(grant)
    claim.pending_answer = "Continue the original task."
    before = set(home.parent.glob("*-events.jsonl"))
    with pytest.raises(ValueError, match="cancelled or revoked"):
        worker.execute(installation, claim, home)
    (events,) = set(home.parent.glob("*-events.jsonl")) - before
    methods = [
        json.loads(line).get("method") for line in events.read_text().splitlines()
    ]
    assert "thread/resume" not in methods
    assert "turn/start" not in methods


def test_unresponsive_host_is_stopped_after_result(
    installation: Installation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim, home = prepare_host(installation)
    (home / "overrides.json").write_text(json.dumps({"ignore_termination": True}))
    original = cast(
        Callable[[subprocess.Popen[bytes], float | None], int], subprocess.Popen.wait
    )

    def short_wait(self: subprocess.Popen[bytes], timeout: float | None = None) -> int:
        return original(self, 0.05 if timeout == 10 else timeout)

    monkeypatch.setattr(subprocess.Popen, "wait", short_wait)
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["status"] == "pr-open"


def test_later_native_question_takes_precedence_over_captured_response(
    installation: Installation,
) -> None:
    claim, home = prepare_host(installation)
    (home / "scenario").write_text("text-question")
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "after_response": {
                    "thread/read": [
                        message(
                            "thread/status/changed",
                            threadId="child",
                            status={"type": "idle"},
                        ),
                        message(
                            "thread/goal/updated",
                            goal={
                                "threadId": "original",
                                "objective": "Deliver the bounded task",
                                "status": "active",
                            },
                        ),
                        {
                            "id": "late-question",
                            **message(
                                "item/tool/requestUserInput",
                                questions=[{"question": "Confirm the revised scope?"}],
                            ),
                        },
                    ]
                }
            }
        )
    )
    _, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["question"] == "Confirm the revised scope?"
    assert installation.claim(claim.id).goal_objective == "Deliver the bounded task"


def test_feedback_can_join_resumed_native_turn_without_schema_override(
    installation: Installation,
) -> None:
    test_native_continuation_preserves_identity_before_first_turn(installation)
    claim = installation.claims()[0]
    home = installation.delivery_dir(claim.id) / "native"
    (home / "scenario").write_text("reply")
    (home / "overrides.json").write_text(json.dumps({"active_schema_none": True}))
    claim.pending_answer = "  violet\nKeep these bytes.\n"
    events, output = worker.execute(installation, claim, home)
    assert json.loads(output.read_text())["status"] == "pr-open"
    attempts = [json.loads(row) for row in events.read_text().splitlines()]
    assert len([row for row in attempts if row.get("method") == "turn/start"]) == 1


def test_healthy_native_continuation_can_exceed_one_hour(
    installation: Installation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim, home = prepare_host(installation)
    (home / "overrides.json").write_text(json.dumps({"turn_delay": 0.05}))
    actual_monotonic = time.monotonic
    elapsed = [0.0]
    monkeypatch.setattr(time, "monotonic", lambda: actual_monotonic() + elapsed[0])
    original = Rpc.call

    def advance_after_submission(
        self: Rpc, method: str, params: dict[str, object]
    ) -> dict[str, object]:
        result = original(self, method, params)
        if method == "turn/start":
            elapsed[0] += 3601
        return result

    monkeypatch.setattr(Rpc, "call", advance_after_submission)
    events, output = worker.execute(installation, claim, home)
    assert elapsed[0] > 3600
    assert json.loads(output.read_text())["status"] == "pr-open"
    observed = [json.loads(row) for row in events.read_text().splitlines()]
    assert len([row for row in observed if row.get("method") == "turn/completed"]) == 2


def test_individual_protocol_request_still_has_a_timeout(
    installation: Installation,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claim, home = prepare_host(installation)
    (home / "overrides.json").write_text(json.dumps({"no_reply": ["thread/goal/get"]}))
    monkeypatch.setattr(rpc, "REQUEST_TIMEOUT_SECONDS", 0.05)
    with pytest.raises(TimeoutError, match="observation timed out"):
        worker.execute(installation, claim, home)
    assert installation.claim(claim.id).native is not None
