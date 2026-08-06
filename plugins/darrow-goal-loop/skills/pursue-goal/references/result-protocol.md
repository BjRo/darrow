# Telemetry and result protocol

## Emit telemetry

Use `telemetry-emit` for the controller, every child invocation, deterministic
gate, repair, verification, and human-wait boundary. Correlate all spans with
the stable run ID. Supply available role, harness, provider, model, effort,
outcome, duration, token classes, and a non-`none` duplicate key whenever native
telemetry may cover the same child call.

Emit exactly one child-role span for each invoked planner, executor, verifier,
or repair role. When a verifier child is the independent-verification boundary,
its one child span represents both facts; do not emit another `role=verifier`
span. If a distinct controller-only gate or verification boundary merits its
own span, use `role=controller` so it cannot be mistaken for another child
invocation.

Record actual cost only when the provider supplies it. An estimated cost
requires `--estimated-cost` and a versioned `--pricing-source`; unknown remains
unknown, never zero. Exclude prompts, code, tool output, environment values, and
secrets. Content capture stays off.

On the final controller span, also pass repair count, verification outcome,
supervision interruption count, and final state. In best-effort mode, record
export failure as degraded without changing the code verdict. In strict mode,
preflight must already have blocked the run if export readiness failed.

## Assemble the result

Write one transient record outside the target repository:

```text
format<TAB>darrow-goal-loop-result-v1
run_id<TAB>id
status<TAB>verified|needs_human|blocked|failed|budget_exhausted
objective<TAB>objective
base_revision<TAB>oid
pre_existing_change<TAB>status record or none
changed_file<TAB>absolute path or none
route<TAB>role<TAB>harness<TAB>provider<TAB>model<TAB>effort<TAB>fallback
gate<TAB>name<TAB>command<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence
verification<TAB>required|not_required<TAB>pass|fail|blocked|not_run<TAB>evidence
finding<TAB>severity<TAB>location or command<TAB>criterion<TAB>evidence
repair_count<TAB>0|1
permission<TAB>write<TAB>local_worktree|none
permission<TAB>publication<TAB>none
budget<TAB>name<TAB>configured<TAB>consumed or unknown
telemetry<TAB>off|best_effort|strict<TAB>trace id or none<TAB>correlation id or none<TAB>exported|degraded|disabled|ready|blocked<TAB>evidence
risk<TAB>risk or none observed
next_action<TAB>smallest decision or none
```

Repeat collection fields as needed. Copy every `changed_file` record from the
final snapshot, including preserved pre-existing paths, so the result describes
the whole final working tree.

Derive status from final evidence. `verified` requires every applicable gate
and required independent verification to pass. The mechanical fast path uses
`verification<TAB>not_required<TAB>not_run` with its oracle evidence. Keep
telemetry degradation separate from the code status. A pre-write stop may omit
snapshot or role artifacts that do not exist.

Validate a completed run with the preflight, final snapshot, and every
packet/result pair in invocation order:

```sh
bash "$goal_loop" validate-result "$result" "$preflight" "$final_snapshot" \
  "$planner_packet" "$planner_result" \
  "$executor_packet" "$executor_result" \
  "$verifier_packet" "$verifier_result" \
  "$repair_packet" "$repair_result" \
  "$reverifier_packet" "$reverifier_result"
```

Omit role pairs that were not invoked. Validation must bind routes, changed
paths, gates, objective, final snapshot, and fresh-role sequence to their source
artifacts. Correct the evidence or status when validation refuses; never weaken
or bypass it.

**Complete when:** telemetry is reconciled without content leakage and the
result validates against every artifact from the actual invocation sequence.
