---
name: independent-code-review
description: Independently review one exact current change and report its findings and outcome. Use when an explicit goal contract requires independent review before commit or publication. Remain read-only.
---

# Independently review the current change

Accept the originating acceptance, standards, exact candidate and current
successful checks. Execute provider coordination in the supported caller's context.
Launch separate fresh Standards and Acceptance
readers; keep coordination separate from their assessments.

On Codex use native `spawn_agent` with `fork_turns: "none"`,
`model: "gpt-6.1-sol"` and `reasoning_effort: "xhigh"` for both readers.
On Claude use fresh native Agent contexts pinned to Opus/high. Emit both
Agent calls in the same assistant message with `run_in_background: false`,
before either result. Wait for both foreground results. Background or
sequential launches cannot satisfy this fixture contract. Keep the
caller's provider-coordinator route unchanged. Supply each reader its axis,
absolute repository, exact candidate, acceptance, constraints and successful
checks. Readers execute this bounded read-only command once and return its
complete output; they do not coordinate another review or launch agents:

`independent-review-protocol`

Retain the complete native command result, including its process/session ID and
exit status. If it is still running, poll that same process through the host's
continuation tool until terminal exit, accumulating every output chunk; an empty
initial chunk is not completion. Return the accumulated output and terminal
status. Never re-execute the command to recover output or delegate its execution
to the coordinator.

Before launching, query the current target with
`independent-review-protocol --target`. This read-only mode prints the Git
target without running tests, assessing content or writing a review receipt.
Use this mode for coordinator target reconciliation as well. Never run the
no-argument reader command as coordinator, including to inspect or pipe its
output.

Start both readers before waiting. Require both complete results to name
the same current target; return both unchanged outputs inline with their
axis labels. Failed, missing, stale or conflicting evidence cannot clear.
This fixture supports initial assessment. Closed follow-up returns
unavailable and preserves the supplied finding and repair history.
Do not execute the protocol as coordinator, implement, commit or publish.
