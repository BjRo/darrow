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
only for an exact deterministic failure or review finding with a current
hashable evidence artifact, and record that digest. Use `forbidden` when retry
cannot resolve the blocker. Lack of material progress, an implementation
stall, or remaining delivery work is not an evidence-change operation. When
the owner needs a user choice, keep the owner active and use the human-feedback
pause; when one more attempt at an exact operation is permissible, record that
operation with `one-attempt`. Never package diagnosis or remaining delivery
work into the blocker operation id.

Mark waiver `discretionary` only for a nonessential gate selected by Darrow
itself. Independent review selected solely by Darrow's risk heuristic is
`discretionary`; user-selected or repository-required review remains
`forbidden`. Policy, safety, authorization, and truthful acceptance or
publication requirements are also `forbidden`.

Render `step report --status blocked` without releasing a file-backed objective
or closing the owner. That output is a resumable snapshot: the ledger remains
`blocked`, `reported` remains false, and the objective and enclosing
orchestration stay attached for the host thread's lifetime. If the host
requires native blocked-status settlement, settle that same persisted goal only
after the blocker and snapshot exist. The snapshot lists only the continuation
responses currently valid for its blocker kind, retry policy, waiver policy,
and source phase. Re-rendering an unchanged blocked snapshot is idempotent.

## Resume the same owner

On a later response in the same host thread, first confirm it unambiguously
targets the recorded blocker and grants no broader authority. Resume through
exactly one transition before repository or external mutation:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step resume \
  --ledger <absolute-ledger> --mode <answer|continue|retry|waive> \
  [--observation <completed|not-completed>] \
  [--evidence-sha256 <changed-evidence-digest>] \
  [--conditions-changed <nonempty-reason>]
```

- `answer` or `continue` is valid only when the response resolves or authorizes
  the recorded blocker. Re-run a selected readiness gate after its blocker is
  resolved; the helper returns that ledger to `readiness-pending`.
- `retry` grants one attempt at the exact recorded operation. For
  `observe-first`, inspect current external state first: use `completed` with
  `continue` and do not repeat the effect, use `not-completed` with `retry`, and
  remain blocked on ambiguous correlation. Show and record these as two exact
  transitions; never put `<completed|not-completed>` after `--mode retry`. For
  `evidence-change`, either retry with a new digest or continue with
  `--conditions-changed <nonempty-reason>`. The helper records that reason in
  the ledger. An unchanged digest or unqualified `continue` is refused. When
  both evidence and conditions are unchanged, do not retry or run the operation
  again; remain blocked.
- `waive` corresponds only to the exact phrase `ignore this and continue` or an
  equally explicit waiver. It is valid only for a recorded discretionary gate.
  Record the waiver; never turn an essential acceptance condition into a
  verified-completion claim. Ask for an explicitly revised outcome instead.

If `step resume` refuses the response, perform no repository, external, owner,
or goal-state mutation. Relay the helper's stderr verbatim, then call `step
report --status blocked` again and return the unchanged canonical snapshot. The
helper permits this idempotent re-render; do not improvise a replacement report
or claim that continuation is generally available.

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
