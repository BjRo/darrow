# Child protocol

Use this protocol for every planner, executor, verifier, and repair invocation.

## Create the packet

Create the packet with the bundled CLI; do not hand-author it:

```sh
bash "$goal_loop" packet-create \
  --preflight "$preflight" --role <planner|executor|verifier|repair> \
  --objective "$objective" --criterion "$criterion" \
  --scope "$scope" --non-goal "$non_goal" \
  --instruction "$absolute_instruction_or_none" \
  --decision "$absolute_decision_or_none" --plan "$approved_plan_or_none" \
  --gate "$gate_name" "$gate_command" "$applicability" "$gate_evidence" \
  --route 'harness|provider|model|effort|fallback' \
  --time-seconds 1800 --token-limit 200000 --repair-limit 1 \
  --invocation-limit 5 --output "$absolute_packet"
```

Repeat `--criterion`, `--scope`, `--non-goal`, `--instruction`, `--decision`,
and `--gate` as needed. Each `--gate` takes exactly four quoted values: name,
command, `applicable|not_applicable`, and discovery evidence.

Include only the stable preflight/run, objective, criteria, scope, non-goals,
absolute authority paths, approved plan or `none`, base and pre-existing state,
routes, gates, and budgets. Never forward the parent transcript, hidden
reasoning, broad source content, environment values, or secrets.

## Invoke the role

Use a fresh child with only the packet, the applicable role instruction below,
and the result format. On Codex, spawn without forked conversation turns. On
Claude, use a new isolated subagent without inherited conversation. Pin or
deliberately inherit the selected model and effort at spawn time and record the
actual route.

- **Planner:** remain read-only. Return decisions, assumptions, file-level
  intent, risks, and verification strategy without expanding scope.
- **Executor:** act as the sole writer. Pursue the packet autonomously, use a
  native goal primitive when available, run every applicable gate, and stop at
  the budget or an honest boundary. Treat requested TDD or another discipline
  as implementation intent; do not discover or invoke another workflow plugin.
- **Verifier:** remain read-only with respect to product files. Inspect the
  controller-supplied final diff; check acceptance criteria and repository
  correctness; run or validate gates. Use tools for mechanical questions and
  judgment for behavior, missing cases, unsafe assumptions, and design fit.
  Preferences without a requirement do not fail the run.
- **Repair:** follow `repair-protocol.md` in addition to this protocol.

### Gate outcomes

Classify every declared gate from its command evidence:

- `pass`: the applicable command completed successfully on the final tree.
- `fail`: the command ran with its required environment available and detected
  a product, test, lint, type, build, or configuration defect.
- `blocked`: a required tool, service, credential, network dependency, fixture,
  permission, or other environmental prerequisite was unavailable. Use
  `blocked` even when the shell process launched and returned a nonzero status.
- `not_applicable`: repository discovery proved that no such gate applies; cite
  that discovery rather than a command result.

Never convert `fail` or `blocked` into `pass`. A blocked gate makes the run
non-verified and names the smallest prerequisite to restore.

Use the host's native fresh-child primitive when it can supply the selected
route. For a foreign route, use:

```sh
bash "$goal_loop" bridge --harness <codex|claude> --packet "$packet" \
  --output "$raw_role_result" --model "$model" --effort "$effort"
```

Missing foreign tooling disables that route only. Describe a bridged worker as
a foreign child, never a native subagent of the host.

## Normalize and validate the result

Require only this tab-separated, tab-safe record with no Markdown fence:

```text
format<TAB>darrow-goal-loop-role-result-v1
run_id<TAB>same run identifier
role<TAB>planner|executor|verifier|repair
outcome<TAB>complete|needs_human|blocked|failed|budget_exhausted
summary<TAB>concise evidence-based summary
plan<TAB>decision or file-level intent
assumption<TAB>explicit assumption
changed_file<TAB>absolute path
gate<TAB>name<TAB>command<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence
finding<TAB>critical|high|medium|low<TAB>location or command<TAB>violated criterion<TAB>concrete evidence
route<TAB>harness<TAB>provider<TAB>model<TAB>effort<TAB>fallback
usage<TAB>input_tokens|output_tokens|reasoning_tokens|cached_tokens|actual_cost_usd|estimated_cost_usd<TAB>value|unknown
risk<TAB>risk or none observed
next_action<TAB>smallest authorized next step or none
```

The first five fields, `route`, `risk`, and `next_action` are required;
`plan`, `assumption`, `changed_file`, `gate`, `finding`, and `usage` repeat when
applicable.

Run:

```sh
bash "$goal_loop" normalize-role-result <role> "$raw_role_result" "$normalized_result" "$packet"
bash "$goal_loop" validate-role-result <role> "$normalized_result" "$packet"
```

Normalization restores only fixed record boundaries; it never creates
evidence. Missing or invalid semantics make the role `blocked`. Never invent a
field, verdict, route, usage value, or evidence to make validation pass.

**Complete when:** the packet validates by construction, the selected isolated
role has ended, and its normalized result validates against that exact packet.
