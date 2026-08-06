---
name: pursue-goal
description: Pursue a user-requested bounded engineering goal through adaptive planning when needed, one write-capable executor, independent verification, at most one repair, and a verified local-working-tree result. Invoke only when the user explicitly names or selects pursue-goal; never trigger it implicitly for ordinary implementation work because it spends multiple model calls and may edit files.
disable-model-invocation: true
---

# Pursue goal

Act as the non-writing controller for one bounded adaptive goal-loop run. Delegate all
product-file edits to the executor or repair executor. You may inspect the
repository, run the bundled deterministic mechanics, create transient run
artifacts outside the repository, invoke children, and assemble the result.
Never implement or repair the product change yourself.

The publication boundary is the local working tree. Do not create or switch
branches or worktrees, commit, push, open a pull request, merge, release,
deploy, or mutate an external system unless the user separately requests that
capability after this run.

## 1. Preflight and criteria

Locate the bundled CLI relative to this file and use an absolute path:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" preflight --repo "$repo" --telemetry best_effort
```

Use `--telemetry strict` only when the user selected strict telemetry. In that
mode, preflight performs an authenticated network readiness check and binds its
hashed artifact into every packet; stop as `blocked` if preflight cannot create
that artifact. With `best_effort`, an export failure degrades telemetry but
does not change the code verdict.

Keep the returned run ID and absolute preflight path. Treat every recorded
pre-existing change and path fingerprint as user-owned. If the requested scope
overlaps one of those paths, stop for the user's direction instead of guessing
how to merge it. Do not clean, reset, revert, overwrite, or hide it merely to
make the run pass. A verified result requires the final snapshot to prove those
fingerprints are unchanged.

State observable acceptance criteria without changing product intent. Identify
scope, explicit non-goals, applicable repository instruction and accepted
decision paths, and deterministic gates from instructions, manifests, CI, and
component practice. An undiscovered lint, type, or test gate is represented by
one explicit `not_applicable` gate with discovery evidence; it is not a pass.
Refuse unreadable applicable configuration.

## 2. Select the shortest safe path

Skip the planner when objective, scope, behavior, and verification are already
clear. Use one fresh read-only planner when the task crosses architectural
boundaries, changes a public contract or schema, has material product
ambiguity, or needs a non-obvious test strategy. Do not spend a model call on a
router.

Before writing, request the smallest human decision and stop as `needs_human`
when a plan includes an irreversible operation, destructive migration,
security or privacy policy choice, external publication, materially ambiguous
product behavior, or authority absent from the request. Destructive data,
authentication or authorization, secrets, privacy, billing, broad migrations,
and weakly verifiable external effects require an approved plan. An already
approved specification or plan satisfies this gate.

Choose routes mechanically:

```sh
bash "$goal_loop" route --host <codex|claude> --role <planner|executor|verifier|repair> \
  --profile <fast|standard|deep> --native <yes|no|unknown>
```

Use `standard` for every source, test, configuration, schema, dependency, or
observable-behavior implementation and its normal verification. Use `deep` for
architectural or ambiguous planning and independent verification of risky
work. Use `fast` only for prose, formatting, generated, or otherwise
mechanical transformations with a complete deterministic oracle; a small code
change is still `standard`. Pass a
user-pinned route as `--route 'harness|provider|model|effort'`; if unavailable,
stop rather than substitute. A policy route may use only the declared fallback
printed by the CLI, and the substitution must remain visible in the result.

## 3. Create isolated task packets

Create every packet with `packet-create`; do not forward the parent transcript,
hidden reasoning, broad source content, environment values, or secrets. Include
the stable run ID through the preflight record, objective, at least one
criterion, scope, non-goals, absolute instruction and decision paths, approved
plan or `none`, base revision, pre-existing changes, route, gates, and explicit
budgets. Each `--gate` consumes four quoted arguments: name, command,
`applicable` or `not_applicable`, and discovery evidence.

```sh
bash "$goal_loop" packet-create \
  --preflight "$preflight" --role executor --objective "$objective" \
  --criterion "$criterion" --scope "$scope" --non-goal "$non_goal" \
  --instruction "$absolute_instruction_or_none" \
  --decision "$absolute_decision_or_none" --plan "$approved_plan_or_none" \
  --gate "$gate_name" "$gate_command" "$applicability" "$gate_evidence" \
  --route 'harness|provider|model|effort|fallback' \
  --time-seconds 1800 --token-limit 200000 --repair-limit 1 \
  --invocation-limit 5 --output "$absolute_packet"
```

Give each child the packet plus only these role instructions and the result
wire format below. A child is fresh: on Codex use a new child with no forked
conversation turns; on Claude use a new isolated subagent without inherited
conversation. Pin or deliberately inherit the selected model and effort at
spawn time. Record the actual route.

- Planner: read only. Return decisions, assumptions, file-level intent, risks,
  and verification strategy. Do not edit or expand scope.
- Executor: the sole active writer. Pursue the packet goal autonomously, use a
  native goal primitive when available, run every applicable gate, and stop at
  the budget or an honest boundary. Do not invoke another workflow or
  discipline plugin. A requested discipline such as TDD is intent only.
- Verifier: fresh and read only with respect to product files. Inspect the
  controller-supplied final diff, check both acceptance criteria and repository
  correctness, and run or validate applicable deterministic gates. Tools settle
  mechanical questions; judgment covers behavior, missing cases, unsafe
  assumptions, and design fit. Do not fail preferences lacking a requirement.
- Repair: a fresh sole writer after the first executor has ended. Receive the
  original packet, final diff path, and structured findings, but no hidden
  verifier reasoning or transcript.

Only one write-capable child may be active. Wait for the executor to end before
starting a repair. Do not start parallel implementation agents.

Each child returns only this tab-separated record, with one-line tab-free
fields and no Markdown fence:

```text
format<TAB>darrow-goal-loop-role-result-v1
run_id<TAB>same run identifier
role<TAB>planner|executor|verifier|repair
outcome<TAB>complete|needs_human|blocked|failed|budget_exhausted
summary<TAB>concise evidence-based summary
plan<TAB>decision or file-level intent                              # optional, repeat
assumption<TAB>explicit assumption                                 # optional, repeat
changed_file<TAB>absolute path                                     # optional, repeat
gate<TAB>name<TAB>command<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence  # optional, repeat
finding<TAB>critical|high|medium|low<TAB>location or command<TAB>violated criterion<TAB>concrete evidence # optional, repeat
route<TAB>harness<TAB>provider<TAB>model<TAB>effort<TAB>fallback
usage<TAB>input_tokens|output_tokens|reasoning_tokens|cached_tokens|actual_cost_usd|estimated_cost_usd<TAB>value|unknown # optional, repeat
risk<TAB>risk or none observed                                     # optional, repeat
next_action<TAB>smallest authorized next step or none
```

First run `normalize-role-result ROLE RAW_FILE NORMALIZED_FILE PACKET`, then
validate the normalized record with `validate-role-result ROLE FILE PACKET`.
The canonicalizer may restore newline boundaries from fixed record arities; it
does not add or change evidence. Invalid or missing semantics are `blocked`;
never invent fields, judgment, or evidence.

## 4. Execute, snapshot, verify, and repair once

For a native role, use the host's fresh-child primitive. For a foreign role,
use the bundled adapter, which passes the packet through stdin and reuses the
installed harness authentication:

```sh
bash "$goal_loop" bridge --harness <codex|claude> --packet "$packet" \
  --output "$role_result" --model "$model" --effort "$effort"
```

Never call the foreign bridge merely for symmetry. Missing foreign tooling
disables that route only. Describe a bridged worker as a foreign child, not a
native subagent of the host.

After execution, capture final-tree evidence with
`snapshot --preflight "$preflight" --output "$unique_snapshot_path"`. Give
every snapshot a distinct external output path so earlier evidence is never
overwritten. This produces an absolute diff path,
changed paths, status, and fingerprint without writing the target repository.
Give that final diff to the verifier; do not rely on the executor's success
claim or an intermediate test result.

After every read-only planner or verifier ends, take another snapshot with
`--expect-fingerprint` set to the fingerprint captured immediately before that
role. Any mismatch is a boundary violation and blocks the run. The snapshot
taken after the final verifier is the `final_snapshot` supplied to result
validation; this prevents a verifier mutation or moved `HEAD` from hiding
behind stale evidence.

Source, configuration, dependency, schema, build, test, or observable behavior
changes require a fresh verifier. Omit it only for prose-only, formatting-only,
or generated mechanical work completely covered by a deterministic oracle;
record the exception and oracle evidence. Uncertainty requires verification.

Run applicable gates through `goal-loop gate` when the controller must obtain or
confirm deterministic evidence. A configured gate that cannot run is
`blocked`, not passed. Distinguish a proven pre-existing failure from a
regression. Changed tests prove behavior only after they pass on the final
tree. For every applicable gate, use an absolute evidence path outside the
repository and copy the command's `result_evidence` value into the gate record;
role validation checks that artifact and its hash. Narrative-only evidence is
valid only for a `not_applicable` gate.

If verification fails with actionable findings, permit at most one repair.
Create a repair packet with `--original-packet`, `--diff`, and repeated
`--finding` evidence. Snapshot again after repair, then invoke a fresh verifier
and audit it with a matching post-role snapshot. Any repair invalidates the
earlier verdict. A second failed verification ends
as `failed` or `needs_human`; never continue a self-healing loop.

## 5. Telemetry and final result

Emit one correlated span for the controller, each child invocation, each
deterministic gate, repair, verification, and human-wait boundary with
`telemetry-emit`. Supply available role, harness, provider, model, effort,
outcome, duration, token classes, and a duplicate key when native telemetry may
cover the same call. Record actual cost only when supplied. Estimated cost
requires `--estimated-cost` and a versioned `--pricing-source`; unknown cost
stays unknown. Never pass prompts, code, tool output, environment values, or
secrets. Content capture is off by default.

On the final controller span also pass repair count, verification outcome,
supervision interruption count, and final state with the corresponding CLI
options so run-level telemetry is complete.

Assemble a transient `darrow-goal-loop-result-v1` record outside the target
repository. For a verified result, validate it with the preflight, final
snapshot, and every role-result file in invocation order:

```sh
bash "$goal_loop" validate-result "$result" "$preflight" "$final_snapshot" \
  "$executor_packet" "$executor_result" \
  "$verifier_packet" "$verifier_result"
```

Include each optional planner, repair, and re-verifier as its packet/result
pair in invocation order. A non-verified pre-write stop may omit unavailable
snapshot or role artifacts. The validator binds every role result back to its
packet, then binds verified routes, changed paths, final gates, objective, and
the fresh-role sequence to those artifacts. Copy every `changed_file` record
from the final snapshot, including preserved pre-existing paths, so the result
describes the whole final working tree. The result must contain:

```text
format<TAB>darrow-goal-loop-result-v1
run_id<TAB>id
status<TAB>verified|needs_human|blocked|failed|budget_exhausted
objective<TAB>objective
base_revision<TAB>oid
pre_existing_change<TAB>status record or none                       # repeat
changed_file<TAB>absolute path or none                              # repeat when present
route<TAB>role<TAB>harness<TAB>provider<TAB>model<TAB>effort<TAB>fallback # repeat
gate<TAB>name<TAB>command<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence # repeat
verification<TAB>required|not_required<TAB>pass|fail|blocked|not_run<TAB>evidence
finding<TAB>severity<TAB>location or command<TAB>criterion<TAB>evidence # repeat when present
repair_count<TAB>0|1
permission<TAB>write<TAB>local_worktree|none
permission<TAB>publication<TAB>none
budget<TAB>name<TAB>configured<TAB>consumed or unknown              # repeat
telemetry<TAB>off|best_effort|strict<TAB>trace id or none<TAB>correlation id or none<TAB>exported|degraded|disabled|ready|blocked<TAB>evidence
risk<TAB>risk or none observed                                      # repeat
next_action<TAB>smallest decision or none
```

Derive the status from final evidence. `verified` requires all applicable
gates and required independent verification to pass. Telemetry degradation is
reported separately. In the final response, lead with the outcome, summarize
changed files, gates, independent findings and repair, routes, telemetry, and
remaining risks, then provide the absolute validated result path and reproduce
the validated record verbatim in one `tsv` code fence so evaluation can
reconcile invocations and outcomes. Say clearly that `verified` is local only
and implies no publication.
