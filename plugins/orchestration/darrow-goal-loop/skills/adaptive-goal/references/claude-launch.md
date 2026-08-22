# Claude native-goal launch

Use the first boundary that can honor the compiled route.

Use the one ledger started by the parent skill. The `goal-loop step` helper
validates preparation, route selection, runner resolution, staging,
materialization, release, activation, route observation, review, cleanup, and
terminal reporting. Stop when it rejects a missing, duplicate, out-of-order, or
mismatched transition. The ledger validates protocol evidence; it does not
schedule agents or own continuation.

The first protocol-bearing Bash call is the literal standalone `step start`
command below. Resolve the absolute repository and plugin paths with Claude's
native `Read`, `Glob`, or `Grep` before calling Bash, using `ToolSearch` only to
load those native tools when needed. Never use Bash `find`, `ls`, or a
redirected shell inspection to locate them. An exact standalone `true` is
tolerated only as an inert host no-op: it advances no sequence state and
supplies no evidence. Do not use any other placeholder/no-op command or combine
`true` with another command; those are executed boundary events, not a
scratchpad.

The classifier does not run repository tests or implementation commands. Apart
from the exact inert `true` exception, its only Bash calls before the Agent are
the literal standalone step-ledger, temporary-root probe, and runner
commands shown here. Replace placeholders with concrete values directly; do
not introduce assignments or shell expansions. Use Claude's native `Read`,
`Glob`, and `Grep` tools for permitted repository inspection. Never use Bash
for discovery, listing, status, hashing, inspection, tests, or command lists;
even read-only shell inspection invalidates the sole-owner boundary. Stage the
contract only with the one native `Write`; never use `>`, `>>`, a heredoc,
`tee`, or another shell file-creation command.

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step start --repo <absolute-repo> --host claude
/bin/bash <absolute-plugin-bin>/goal-loop step prepare --ledger <absolute-ledger>
```

Then run the route helper as its own tool call:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step route --ledger <absolute-ledger> \
  --workflow <workflow> --risk <risk> --profile <profile> \
  --verification-gate <verification-gate> --review <selected|omitted> \
  [--review-round-limit <explicit-positive-integer>]
```

Only an explicit user route override adds the literal option
`--route 'claude|anthropic|<model>|<effort>'`.

## Materialize the native objective

For a boundary whose goal owner shares this filesystem, use the host's
file-write tool once to put the complete contract at a direct child path inside
the exact mode-0700 `staging_dir` returned by `step start`. The standalone
`/usr/bin/printenv TMPDIR` probe may confirm its temporary-root parent but never
substitutes a broader directory for the returned staging path. Then run:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step stage --ledger <absolute-ledger> \
  --goal-file <absolute-contract-file>
/bin/bash <absolute-plugin-bin>/goal-loop step materialize --ledger <absolute-ledger> \
  --goal-file <absolute-contract-file> \
  --expected-sha256 <step-stage-contract-sha256>
```

Use that one staging Write's exact absolute path as `--goal-file`. The helper's
stage call hashes those exact bytes and returns `contract_sha256`; use that
value in every later expected-digest option. Stop before activation on any path
or digest mismatch. Canonical path aliases and locations outside the
ledger-owned staging directory are not private staging.

Claude step materialization always uses file-backed mode so the Agent call has one stable
objective field regardless of contract size. Pass only the exact returned
`objective_file` path in the one-line Agent body specified below. The
classifier does not read, hash, copy, or reproduce that file; the file-backed
owner reads it and verifies the complete contract before work. An inline result
is invalid on this boundary. Stop before activation if materialization fails.
Never truncate or recompact after a size rejection.

After successful materialization and before Agent activation, release the
caller-created staging file exactly once with:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step release-staging \
  --ledger <absolute-ledger> --goal-file <exact-staging-path> \
  --expected-sha256 <exact-helper-returned-contract-sha256>
```

Only a successful exact release record permits activation. Keep any returned
file-backed attachment readable through paused states and the terminal result,
then release it only with:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step release-objective \
  --ledger <absolute-ledger> \
  --attachment-dir <exact-helper-returned-attachment-dir> \
  --expected-sha256 <exact-helper-returned-contract-sha256>
```

On Claude, invoke all helpers as standalone Bash commands with the concrete
absolute plugin executable, repository, goal-file or attachment path, and
digest substituted literally. Do not use assignments, shell variables,
comments, substitutions, pipelines, command lists, redirects, or extra
arguments. Treat only a successful release record for the exact materialized
attachment as cleanup; a failed or mismatched call does not release it and
must not be retried.

Do not reconstruct deletion commands or retry a staging release, goal, or Agent
call after one begins.
If the launcher fails after activation without confirming a terminal result,
retain the attachment and report the goal identifier, exact attachment path,
and expected digest as resumable lifecycle evidence; do not remove the contract
from a still-active or paused goal. Once terminal status is confirmed, release
the attachment even if later result collection fails.

## Same thread

When the current Claude surface exposes native goal control to the agent, read
its concrete active route and require it to equal the selected route before
setting the compiled contract as the current thread's goal. Set the exact
materialized objective rather than an oversized inline contract. After the
native goal call is accepted, record the boundary:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step activate --ledger <absolute-ledger> \
  --applied-by current-thread --boundary same_thread --agent-id none \
  --effective-route 'claude|anthropic|<model>|<effort>' \
  --route-verified true
```

If a material decision first emerges after activation, leave the goal active,
pause repository and external mutation, and ask the user the smallest concrete
question. Pending feedback is neither completion nor blockage. Continue the
same goal after the explicit answer arrives, count the question once, and keep
any file-backed objective attached while paused.

Do not treat a `claude` executable on `PATH` as evidence of same-thread control.

**Complete when:** the current thread reports the materialized objective as its
active native goal and the selected route is effective.

## Observable native Agent runner

When same-thread activation cannot honor the selected route and the runtime
exposes Claude's `Agent` tool, use one plugin-shipped Adaptive Goal Loop runner.
This is a host-visible Claude subagent, not a recursive CLI process.

Reject the boundary before spawning when any of these conditions holds:

- the selected harness is not `claude` or the active provider differs from the
  selected provider;
- live host metadata does not prove that the selected concrete model and effort
  are available without substitution;
- the exact selected model/effort tuple has no runner in the table below;
- `CLAUDE_CODE_SUBAGENT_MODEL` is set to any value other than the selected
  concrete model; or
- `CLAUDE_CODE_EFFORT_LEVEL` is set to any value other than the selected effort.

`inherit` is not accepted because older Claude Code versions interpret it as a
forced parent-model override. `auto` is not concrete effort evidence. A
conflicting environment override wins over agent frontmatter, so it is a stop
rather than a silent substitution.

Resolve the runner and validate those environment boundaries before invoking
Agent:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step runner --ledger <absolute-ledger> \
  --provider anthropic --model <claude-sonnet-5|claude-opus-5> \
  --effort <low|medium|high>
```

Use the exact `subagent_type` and absolute `agent_file` from that output. A
nonzero exit is `launch_required`; do not spawn anyway.

Select exactly one namespaced runner from the exact selected route:

| Selected model    | Effort   | `subagent_type`                                  |
| ----------------- | -------- | ------------------------------------------------ |
| `claude-sonnet-5` | `low`    | `darrow-goal-loop:adaptive-goal-sonnet-5-low`    |
| `claude-sonnet-5` | `medium` | `darrow-goal-loop:adaptive-goal-sonnet-5-medium` |
| `claude-opus-5`   | `high`   | `darrow-goal-loop:adaptive-goal-opus-5-high`     |

These runners cover every bundled Claude policy route. A repository override or
explicit user route with another tuple requires a supported same-thread/API
boundary or stops as `launch_required`; do not reduce a full model ID to a
family alias.

Materialize the objective before invoking the `Agent` tool exactly once with:

- a task whose first line is the exact ownership marker
  `- phase: adaptive-goal-runner`;
- `subagent_type` set to that exact namespaced runner;
- `run_in_background` set to `false`;
- no per-invocation `model` override, because the selected full model ID and
  effort are pinned together in the runner definition;
- no `resume` or worktree isolation; and
- a task body bound only to the successful materialization as described below.

After the ownership marker, put either the exact complete contract bytes whose
digest equals the materialization record or, for file-backed materialization,
exactly `- objective_file: <helper-returned-absolute-objective_file>`. Do not
read that file in the classifier turn or add copied proof fields, omitted text,
or explanations. The routed Agent reads the bounded objective and verifies the
complete contract before work. The exact file-backed reference is the sole task
authority; any appended task text invalidates the launch. The
compiled contract already contains the
workflow, risk gates, feedback protocol, review clause, reporting contract, and
sole-owner instructions. Do not restate or append them in the Agent task. A
marker-only task is not an executable goal.

Wait for that same foreground Agent call to return, then verify what actually
ran before recording anything. Selecting a namespaced `subagent_type` whose
frontmatter pins a model is necessary but not sufficient evidence that the
host applied it: the Agent call can be accepted and run to completion on a
different model than its own frontmatter names, and a misrouted runner will
still confidently self-report the selected model. Prompt text and runner
self-report prove neither model nor effort. Derive the effective route from
the child's own transcript instead:

After the Agent returns, do not call `Bash`, `Read`, `Edit`, `Write`, `Glob`,
`Grep`, or another repository tool to inspect, test, or restate its work. The
only permitted post-return tools are one exact `claude-route-gate` call and the
exact `release-objective` cleanup above when an attachment exists. The gate
binds the Agent tool result's host-reported id to transcript observation and
route confirmation in one deterministic operation. Changed-file, check,
review, and remaining-risk statements come from the collected Agent result;
route verification and attachment cleanup neither authorize parent
revalidation nor invalidate those collected facts.

Before interpreting the child as terminally successful, also reconcile its
result against the compiled independent-review clause. A selected gate requires
evidence of one comprehensive initial review and, after any repair, a closed-set
fix-verification chain whose prior artifacts and pinned repair deltas remain
continuous and that is clear for the exact final content. Preserve edits
but report the run incomplete or blocked when verification was unavailable,
inconclusive, no-progress, explicitly capped, or left blockers or regressions,
even if deterministic checks passed or route verification separately failed.
Interpret the capability's ordinary response; do not parse or reproduce its output format.

Invoke the gate as exactly one standalone Bash command after the Agent result,
replacing every placeholder with a concrete literal. Do not use assignments,
shell variables, comments, substitutions, pipelines, command lists, redirects,
or extra arguments in this call:

```sh
/bin/bash <absolute-plugin-bin>/claude-route-gate --repo <absolute-repo> \
  --agent-id <host-reported-agent-id> \
  --selected 'claude|anthropic|<model>|<effort>' \
  --ledger <absolute-ledger>
```

The gate returns either one observed route with an explicit `confirmed` or
`rejected` result, or an `unavailable` observation with no confirmation. It
validates that the verifier's agent id exactly equals the id in both this
command and the completed Agent result. If observation is unavailable or
confirmation is rejected because the effective route differs from the
selected one, this boundary has failed even though the Agent call itself
succeeded. In that case:

- do not record `route_verified: true`, and do not report the child's work as
  having run on the selected route;
- when no transcript route is observable, use `harness: claude`,
  `model: anthropic > unknown`, and `effort: unknown` in the human report; when
  a mismatched route is observable, report that exact effective harness,
  provider, model, and effort. Never copy the selected model or effort into the
  report after failed verification;
- preserve the independently observable accepted Agent boundary as
  `route_applied_by: native-subagent` and `evaluation_child_invocations: 1`;
  unavailable route arguments do not erase the child invocation that occurred;
- preserve whatever the child already wrote to the working tree without
  discarding it silently, and tell the user plainly which model actually ran
  instead of the selected one, citing the observed route;
- record `launch_required`, naming the unavailable capability (for example,
  "claude-opus-5 is not currently applicable through this subagent boundary on
  this host/account — it silently substituted claude-sonnet-5"); and
- render exactly one complete `darrow-native-goal-report-v1` block from the
  contract even on this stop, with `route_verified: false` and
  `launch_boundary: launch_required`; and
- stop rather than continue the contract as if the selected route had run. A
  failed verification is a stop, not a retry loop — do not launch a second
  runner or substitute a nested process to try again.

After the route gate and required attachment cleanup, render the collected
Agent result immediately. Begin with the raw `format:` report line, never a
Markdown code fence. Do not call another tool. If the Agent omitted a
changed-file, check, review, risk, or publication fact, report that omission;
never fill it by inspecting the repository.

Only once `claude-route-gate` reports an explicitly confirmed,
transcript-derived effective route equal to the selected route may you record:

```text
launch_boundary\tnative_subagent
route_applied_by\tnative-subagent
route_verified\ttrue
evaluation_child_invocations\t1
```

Do not launch a second runner or substitute a nested process after the child
has started.

Claude does not expose its session-scoped `/goal` command as an Agent tool or a
child-session API. The delegated contract is therefore the native Agent
runner's task, not an undisclosed `/goal` evaluator. Do not claim `/goal`
persistence, evaluator turns, or status telemetry for this boundary.

**Complete when:** the accepted Agent call names the exact selected-route
runner, the visible runner returns terminally, `claude-route-gate` proves the
host-reported Agent id and observed transcript route equal the selected route,
and the result proves the contract and final-tree checks complete.

## Enclosing launcher

An external client that performed preflight before starting Claude may invoke
one native `/goal` session with the complete staging file; the launcher
materializes the bounded objective before starting the process:

```sh
bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider "$provider" \
  --model "$model" --effort "$effort" --allow-nested
```

This boundary is not available to a skill already running inside Claude:
recursive Claude processes may not inherit the active session's authentication
or control state. `--allow-nested` must reflect explicit user authorization; it
is never inferred from route mismatch. An enclosing launcher records
`nested_session` and one child, waits for the result, and removes the temporary
contract.

**Complete when:** the external launcher—not an active Claude agent—owns the one
session and its authentication is proven before product work begins.

## Unavailable launch

When the active Claude surface exposes neither matching same-thread goal
control nor the required Agent runner, preserve the compiled contract, record
the stop with `goal-loop step launch-stop --ledger <absolute-ledger> --reason
launch-unavailable`, release any materialized objective, render
`launch_required`, name the missing capability, and stop without editing
product files. Do not probe a recursive `claude` process with a paid model call.

**Complete when:** the user has one exact external launch action rather than a
simulated or unauthenticated goal run.
