# ADR-0018: Run Claude Adaptive Goal without a native goal

Status: Accepted
Date: 2026-11-28
Summary: On Claude Code, run Adaptive Goal in the main thread without a native goal, because a skill cannot start one there; Codex keeps native goal activation.
Partially supersedes: ADR-0012
Revisit when: Claude Code gives skills a documented way to start a goal in interactive, `claude -p` and Agent SDK sessions.

## Context

[ADR-0012](ADR-0012-keep-native-goal-ownership-in-the-main-thread.md) keeps the
native goal in the original main thread. On Codex, Adaptive Goal starts it with
`create_goal` after preflight and readiness.

Claude Code 2.1.330 gives a skill no way to start a goal from inside a turn:

- The Skill tool refuses `goal`: "goal is a UI command, not a skill."
- `SetGoal` and its alias `ProposeGoal` are not offered in `claude -p`, Agent
  SDK clients, T3 Code, or the interactive session where this was checked. The
  public Claude Code documentation does not describe them.
- A scheduled `/goal` prompt arrives as plain text and sets no goal.

Only a prompt that starts with `/goal` sets a goal. Adaptive Goal therefore
stopped every Claude run at `Status: launch_required` and asked the user or
client to send a `/goal` line
([#377](https://github.com/BjRo/darrow/pull/377), commit
[2c2219a](https://github.com/BjRo/darrow/commit/2c2219a6d749b838e4c3b9e1e7863d3d2b618776)).
One invocation could not deliver a request.

## Decision

On Claude Code, Adaptive Goal runs without a native goal. One invocation runs
preflight, readiness, implementation, assessment and completion in the main
thread. The thread keeps working until the definition of done or a documented
stop. When the session already has a goal, for example one a client started
with `/goal`, the skill keeps it.

The main thread still owns acceptance criteria, user decisions and completion,
and delegates only bounded assignments, as ADR-0012 decides. Codex keeps native
goal activation unchanged.

Darrow adds no replacement goal: no plugin Stop hook, goal state, evaluator or
nested host.

Alternatives considered:

- **Goal-first entry.** Start Claude sessions with `/goal <invocation>`. It keeps
  host persistence but replaces the skill's own entry command.
- **Darrow-owned goal.** A plugin Stop hook blocks stopping until the skill
  records a terminal state. It matches the Codex flow but adds the second
  controller that ADR-0012 excludes.
- **Keep the `/goal` handoff.** Every Claude run needs a second message.

## Authority and provenance

- **User statement, 2026-11-28:** "I don't want to build a Goal ourselves. and I
  want to be able to just launch everything with "/adaptive-goal"." and "remove
  the "/goal" requirement from the claude-code path and let's this work without
  the goal (while codex still uses the goal)."
- **Observed host behavior, 2026-11-28:** the Claude Code 2.1.330 checks above.
  A `/goal` prompt works in `claude -p` and in a resumed session; nothing a
  skill does inside a turn starts a goal.

## Consequences

- Claude has no host-enforced continuation. A session can end before completion
  or a documented stop; the user sends `continue` in the same session.
- Claude-only Adaptive Goal and Ticket-to-PR evals invoke the skill directly and
  declare `native_goal: forbidden`. A case that starts with `/goal` tests a goal
  the skill keeps.
- ADR-0012's native-goal clause applies to Codex only. Its main-thread ownership
  decision holds on both hosts.
