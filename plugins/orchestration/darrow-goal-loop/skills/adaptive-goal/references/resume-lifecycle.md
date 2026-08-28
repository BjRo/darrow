# Resumable blocked lifecycle

Use this lifecycle whenever an activated verified owner must settle blocked or
the user responds to its recorded blocker.

## Record blockage

Before blocked settlement, record exactly one current blocker:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step block \
  --ledger <absolute-ledger> \
  --kind <decision|permission|operation|review|gate|dependency> \
  --operation <stable-one-line-operation-id> \
  --retry <one-attempt|observe-first|evidence-change|forbidden> \
  --waiver <discretionary|forbidden> \
  [--evidence-sha256 <current-failure-or-review-evidence-digest>]
```

Use `one-attempt` when a later unqualified `retry` may authorize exactly one
additional attempt at that operation. Use `observe-first` for an external
effect whose prior result may already have succeeded. Use `evidence-change`
for a deterministic failure or review finding, and record its current evidence
digest. Use `forbidden` when retry cannot resolve the blocker.

Mark waiver `discretionary` only for a nonessential gate selected by Darrow
itself. User-selected or repository-required gates, policy, safety,
authorization, and truthful acceptance or publication requirements are
`forbidden`.

Render `step report --status blocked` without releasing a file-backed objective
or closing the owner. That output is a resumable snapshot: the ledger remains
`blocked`, `reported` remains false, and the objective and enclosing
orchestration stay attached for the host thread's lifetime. If the host
requires native blocked-status settlement, settle that same persisted goal only
after the blocker and snapshot exist.

## Resume the same owner

On a later response in the same host thread, first confirm it unambiguously
targets the recorded blocker and grants no broader authority. Resume through
exactly one transition before repository or external mutation:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step resume \
  --ledger <absolute-ledger> --mode <answer|continue|retry|waive> \
  [--observation <completed|not-completed>] \
  [--evidence-sha256 <changed-evidence-digest>]
```

- `answer` or `continue` is valid only when the response resolves or authorizes
  the recorded blocker. Re-run a selected readiness gate after its blocker is
  resolved; the helper returns that ledger to `readiness-pending`.
- `retry` grants one attempt at the exact recorded operation. For
  `observe-first`, inspect current external state first: use `completed` with
  `continue` and do not repeat the effect, use `not-completed` with `retry`, and
  remain blocked on ambiguous correlation. Show and record these as two exact
  transitions; never put `<completed|not-completed>` after `--mode retry`. For
  `evidence-change`, supply a new digest; unchanged evidence is refused.
- `waive` corresponds only to the exact phrase `ignore this and continue` or an
  equally explicit waiver. It is valid only for a recorded discretionary gate.
  Record the waiver; never turn an essential acceptance condition into a
  verified-completion claim. Ask for an explicitly revised outcome instead.

The host resumes the same owner with the same objective and route. A current-
thread owner continues on the user's turn; a host API reactivates that exact
thread and objective; a delegated owner receives the response through its
matching follow-up or resume control. Never retry goal creation, launch a new
owner, or run a background continuation loop.

## Retain and clean up

Retain a blocked owner until completion. Only an explicit abandonment or
supersession, or destruction of the host thread, ends it before completion:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step end --ledger <absolute-ledger> \
  --reason <abandoned|superseded|thread-destroyed>
```

After that transition, close or interrupt the exact owner when the host exposes
the matching control and release its file-backed objective once. A fresh
conversation has no implicit continuation authority; an explicitly invoked
enclosing recipe may reuse only unambiguously correlated repository and
external state.
