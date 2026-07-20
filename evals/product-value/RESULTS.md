# Product-value evaluation journal

This file is the durable, reviewable record of product-value evaluation runs.
Raw observations, patches, and harness transcripts remain under `results/` and
are intentionally ignored by Git because they may contain source material or
sensitive output. Numbers in this journal are copied from those immutable local
observations.

This journal covers the product-value evaluation only. Colocated skill-eval
outputs under `evals/results/` are a separate test corpus.

## Current status — 2026-07-20

The current protocol is v5: all three core treatments receive the same minimal
Red/Green TDD implementation policy, while the CLI product treatment runs a
second fresh-context `verify-and-repair` command through the same locked harness
route. V5 changes only deterministic grading: task verifiers run the
oracle-changed tests from their owning package and preflight proves that each
selected historical oracle passes. The top-level requested outcome remains
identical across treatments. The v4 six-cell smoke remains operationally
qualified because its Mynab verifier is unchanged. The first 36-cell model run
is complete and has been re-verified under v5. Strengthened preflight passes all
26 confirmatory tasks; the holdout remains closed pending acceptance of the
pilot calibration. The excluded 12-cell playbook-autonomy diagnostic is also
complete; it isolates one-command workflow ownership from additional model
invocations, but does not yet contain timed human-attention observations.

Raw pilot root: `results/v4-fresh-review-pilot-v1/`

Derived v5 verification root:
`results/v4-fresh-review-pilot-v1/reverification-v5-package-focused/`

- Runner revision for model execution: `b79cce86a1405f87f7b7540e8b69315df198169b`
- Harnesses: Codex CLI 0.144.6 and Claude Code 2.1.185
- Models: `gpt-5.6-sol` and `claude-sonnet-4-6`, medium effort
- Scope: six tasks, both harnesses, three treatments, one repeat (36 cells)
- Execution: 34 completed, two timed out; 3.746 aggregate wall-clock hours
- Usage: 19,606,004 recorded input tokens, 418,271 output tokens, and
  $23.149 known Claude cost; both timed-out cells have incomplete usage
- Corrected deterministic quality: 15/36 passes (0.417), up from the invalid
  repository-wide grading's 8/36
- Blind grading: 42 randomized bundles scored (36 observations plus six
  agreement duplicates); mean rubric score was 0.780 across presented bundles
  and duplicate mean absolute difference was 0.000

### Playbook-autonomy smoke qualification

The excluded `playbook-autonomy-v1` diagnostic now has a qualifying four-cell
smoke on `mynab-flags-now`. Both treatments ran the same implementation and
fresh verification-and-repair command skills with provider-compatible
structured output and one shared 15-minute deadline. The manual arm represents
two operator launches and one handoff; the CLI arm represents one launch and no
handoff. Evaluator automation did not manufacture a human-attention value:
attention remains null in all four observations.

Raw smoke root: `results/playbook-autonomy-smoke-v1/`

- Execution checkout base: `7f7298c`; the pending evaluator content and
  diagnostic configuration are bound into each observation's configuration
  digest
- Scope: `mynab-flags-now`, both harnesses, both operational treatments, one
  repeat (four cells)
- Completion: 4/4 completed, 4/4 passed hidden verification, and every cell
  recorded two model invocations with both playbook stages finished
- Structural autonomy: manual required two launches and one handoff; CLI
  required one launch, no handoff, and completed unattended in both harnesses
- Mean wall time: 266.7 seconds manual and 281.8 seconds CLI (CLI/manual 1.056×)
- Claude: CLI/manual wall time was 1.187×, provider cost 1.344×, and reported
  tokens 1.189×
- Codex: CLI/manual wall time was 0.922× and reported tokens 0.979×
- Darrow's runtime wrapper averaged 3.2 seconds across the two CLI cells; no
  evaluator-started Temporal or worker process remained afterward

This smoke qualifies the matched-playbook route and measurement contract only.
It is too small and too easy to estimate attention savings or product value.
The full diagnostic below supersedes it for descriptive operational evidence.

### Full playbook-autonomy diagnostic

The committed 12-cell diagnostic completed on the fixed simple task and two
orchestrated pilot tasks. Manual and CLI treatments each ran the same two
command skills through fresh model sessions under one shared 15-minute cell
deadline. The evaluator automated the manual handoff for repeatability, so the
structural operator-action comparison is observed while human-attention minutes
remain null.

Raw result root: `results/playbook-autonomy-v1/`

- Runner revision: `0d5be6518f10afbf76b263a8b1e2f8c7c0ec2879`
- Scope: three tasks, both harnesses, two treatments, one repeat (12 cells)
- Execution: 9/12 completed and 3/12 failed; 1.704 aggregate wall-clock hours
- Recorded usage: 13,876,447 total tokens and $10.579 known Claude cost
- Trace completeness: all cells retained both model invocations; CLI runtime
  wrapper time averaged 3.2 seconds and was 0.66% of CLI harness time

| Treatment       | Completed | Quality | Mean wall | Mean tokens | Mean Claude cost | Finished stages | Unattended completion |
| --------------- | --------: | ------: | --------: | ----------: | ---------------: | --------------: | --------------------: |
| Manual playbook |       4/6 |   0.500 |   530.3 s |      1.113M |           $1.819 |           10/12 |                   0/6 |
| CLI playbook    |       5/6 |   0.667 |   491.9 s |      1.199M |           $1.708 |           11/12 |                   5/6 |

Paired `cli - manual` deterministic quality was +0.167. CLI/manual wall time
was 0.928×, known Claude cost was 0.939×, and recorded tokens were 1.077×. By
harness, Claude quality was 0.667 CLI versus 0.333 manual; Codex quality was
0.667 in both treatments. Claude CLI used 0.899× manual wall time, 0.939× cost,
and 0.835× reported tokens. Codex CLI used 0.958× wall time and 1.079× tokens.

The quality difference is not broad: it comes entirely from
`credfolio-github-profile` under Claude, where CLI passed and manual failed the
hidden test. Both treatments passed `mynab-flags-now` in both harnesses. Every
`mynab-import-commit-backend` cell failed hidden verification. Its two manual
cells timed out after executing both stages but finishing only the first; Codex
CLI completed both stages but failed the hidden test, while Claude CLI finished
implementation and then had its review result correctly rejected because it
claimed `verified: true` while reporting a failing verdict check.

The operational signal is nevertheless concrete: for the same two model
sessions, the product treatment reduced the user-facing contract from two
launches plus a handoff to one launch, completed the full playbook unattended in
five of six cells, and had fewer operational failures. This automated run does
not establish a percentage reduction in active human minutes. That requires a
separate timed operator exercise; elapsed model waiting must not be backfilled
as attention.

### V5 deterministic pilot calibration

| Harness | Treatment | Passes | Quality | Wall time | Cost / token fallback | Operational failures |
| ------- | --------- | -----: | ------: | --------: | --------------------: | -------------------: |
| Claude  | Native    |    2/6 |   0.333 | 34.79 min |                $7.416 |                  0/6 |
| Claude  | Plugins   |    2/6 |   0.333 | 41.61 min |          $6.244 known |                  1/6 |
| Claude  | CLI       |    3/6 |   0.500 | 47.17 min |                $9.489 |                  0/6 |
| Codex   | Native    |    2/6 |   0.333 | 24.69 min |         5.591M tokens |                  0/6 |
| Codex   | Plugins   |    3/6 |   0.500 | 23.29 min |         5.574M tokens |                  0/6 |
| Codex   | CLI       |    3/6 |   0.500 | 53.21 min |   8.575M known tokens |                  1/6 |

### V5 mixed-quality pilot calibration

The single blinded grader scored all four frozen rubric items for 42 randomized
bundles before the private treatment map was opened. The six repeated bundles
received identical mean scores, for an intra-grader mean absolute difference of
0.000. Across the 36 distinct observations, mean blinded rubric quality was
0.785.

| Harness | Treatment | Deterministic | Blinded rubric | Final mixed quality |
| ------- | --------- | ------------: | -------------: | ------------------: |
| Claude  | Native    |         0.333 |          0.792 |               0.471 |
| Claude  | Plugins   |         0.333 |          0.646 |               0.427 |
| Claude  | CLI       |         0.500 |          0.729 |               0.569 |
| Codex   | Native    |         0.333 |          0.813 |               0.477 |
| Codex   | Plugins   |         0.500 |          0.771 |               0.581 |
| Codex   | CLI       |         0.500 |          0.958 |               0.638 |

Across both harnesses, final mixed quality was 0.603 for CLI, 0.504 for direct
plugins, and 0.474 for native. At the preregistered task level, mixed-quality
`cli - plugins` was +0.099 with a seeded 95% task-bootstrap interval of
[+0.016, +0.241] and a two-sided sign-flip p-value of 0.057. The effect was
+0.173 on orchestrated tasks and +0.025 on simple tasks. `plugins - native` was
+0.030.

The CLI-minus-plugin effect was nonnegative on every pilot task, but it was
highly concentrated: `credfolio-finding-index` contributed +0.444. The other
five task differences ranged from 0.000 to +0.056. This is a useful calibration
signal for orchestration, not evidence that the effect is broad or stable.

One Claude/plugins timeout and one Codex/CLI timeout have missing usage, so
their economic totals are incomplete. On the five complete Claude task pairs,
CLI/provider cost was 1.39× direct plugins. Codex CLI already used 1.54× direct
plugin tokens before counting its timed-out cell, and used 2.28× wall time.
Across both harnesses CLI used 1.55× direct-plugin wall time. CLI's operational
failure rate was 1/12 (8.3%), above the 5% confirmatory ceiling in this small
calibration sample.

At the preregistered task level, corrected deterministic `cli - plugins` is
+0.083 overall: +0.167 on the three orchestrated tasks and 0.000 on the three
simple tasks. `plugins - native` is also +0.083 overall. The only CLI-over-plugin
quality difference is `credfolio-finding-index` under Claude; the corresponding
Codex block is all-zero. The winning Claude verification session reported no
finding or repair, so the difference came from the CLI implementation path, not
an observed second-pass repair. Of 11 completed CLI review sessions, three
reported and fixed a material finding; none created a unique hidden-test win.

The runtime wrapper remains negligible. Across the six Claude CLI cells it used
20.1 seconds (0.75% of harness time); across six Codex CLI cells it used 15.3
seconds (0.50%). The extra time is model execution, including the mandated
second invocation, not host-side Darrow machinery.

These are calibration results, not the final decision. Mixed quality is more
encouraging than deterministic pass/fail alone: the overall +0.099 point
estimate is effectively at the preregistered +0.100 useful-gain target, and the
orchestrated subgroup exceeds it. The evidence remains only six tasks and is
dominated by one task. Codex's known token ratio and the CLI operational-failure
rate also remain above their confirmatory ceilings. All 26 holdout oracle
verifiers pass strengthened preflight; opening the holdout is now a product and
budget decision rather than an evaluator-readiness blocker.

Qualifying v4 smoke evidence root: `results/v4-fresh-review-smoke-v4/`

- Runner revision: `384c8dd180f9cbf6705a1105396b6e42146871a3`
- Harnesses: Codex CLI 0.144.6 and Claude Code 2.1.185
- Models: `gpt-5.6-sol` and `claude-sonnet-4-6`, medium effort
- Task: `mynab-flags-now`, one repeat
- Preflight: both isolated inference probes passed; the exact Temporal worker
  bundled with Bun 1.3.13; Temporal 1.8.0 was available

### V4 smoke results

| Harness | Treatment | Status    | Quality | Wall time | Input tokens | Output tokens | Provider cost | Invocations |
| ------- | --------- | --------- | ------: | --------: | -----------: | ------------: | ------------: | ----------: |
| Claude  | Native    | completed |    1.00 |   194.2 s |           27 |         9,391 |        $0.619 |           1 |
| Claude  | Plugins   | completed |    1.00 |   211.8 s |           21 |        10,536 |        $0.581 |           1 |
| Claude  | CLI       | completed |    1.00 |   413.2 s |           59 |        19,272 |        $1.101 |           2 |
| Codex   | Native    | completed |    1.00 |   104.8 s |      305,395 |         3,803 |             — |           1 |
| Codex   | Plugins   | completed |    1.00 |   136.3 s |      443,754 |         4,579 |             — |           1 |
| Codex   | CLI       | completed |    1.00 |   176.0 s |      554,592 |         5,663 |             — |           2 |

Claude reports cache creation/read tokens separately; its provider cost is the
economic measure above. Codex has no provider cost, so total input plus output
tokens remain the fallback. Across all six cells the smoke used 1,303,848 input
tokens, 53,244 output tokens, and $2.301 of known Claude provider cost.

Relative to direct plugins, CLI used 1.95× wall time and 1.90× provider cost on
Claude, and 1.29× wall time and 1.25× total tokens on Codex. Relative to native,
CLI used 2.13× wall time and 1.78× provider cost on Claude, and 1.68× wall time
and 1.81× total tokens on Codex. The CLI treatment intentionally performs two
model invocations, so these ratios measure the added fresh review as well as the
runtime.

The trace separates those effects. Claude CLI spent 404.17 s in model
invocations and 3.24 s in the runtime wrapper; Codex CLI spent 166.91 s in model
invocations and 2.76 s in the runtime wrapper. Runtime-wrapper work was therefore
about 0.8% and 1.6% of harness time respectively. Both CLI traces retained both
transcripts and aggregated usage across both invocations. No Temporal service or
Darrow worker remained after the smoke; six stale `/tmp/darrow-e2e-*` Temporal
test services discovered during the audit were terminated separately.

Three preceding v4 roots are excluded calibration evidence. V1 exposed Claude's
unsupported root schema combinator and Codex's auto-written project trust entry.
V2 fixed those and exposed the equivalent Codex root-combinator restriction. V3
reached both Codex model invocations and exposed an ambiguous flat verification
verdict contract. The qualifying v4 root uses provider-compatible projections,
predeclared trust, full runtime validation, and structurally linked
`diagnosticChecks`.

The completed six-cell smoke below belongs to the superseded one-command v3 CLI
treatment. All three v3 treatments passed deterministic verification in both
Codex and Claude Code. Those results remain operational history only and are not
product evidence or qualification for v4.

Superseded v3 evidence root: `results/shared-tdd-codex-v2/`

- Runner revision: `9ea1ab273a9d4f93cf3fc095265c7f67629fdac5`
- Harnesses: Codex CLI 0.144.6 and Claude Code 2.1.185
- Models: `gpt-5.6-sol` and `claude-sonnet-4-6`, medium effort
- Task: `mynab-flags-now`, one repeat

### Codex

| Treatment | Status    | Deterministic quality | Wall time | Input tokens | Output tokens | Commands |
| --------- | --------- | --------------------: | --------: | -----------: | ------------: | -------: |
| Native    | completed |                  1.00 |   117.3 s |      302,751 |         3,247 |       12 |
| Plugins   | completed |                  1.00 |   188.0 s |      382,745 |         4,465 |       14 |
| CLI       | completed |                  1.00 |   124.5 s |      325,647 |         3,217 |       12 |

Provider cost was unavailable, so tokens are the economic fallback. Relative
to direct plugins, the CLI used 0.66× wall time and 0.85× total tokens. Relative
to native, it used 1.06× wall time and 1.07× total tokens.

The CLI cell spent 0.46 s in treatment setup and 2.96 s in the runtime wrapper;
115.35 s was model invocation. Measured host-side CLI machinery therefore
accounted for about 2.7% of its wall time.

### Claude Code

| Treatment | Status    | Deterministic quality | Wall time | Provider cost | Output tokens | Commands |
| --------- | --------- | --------------------: | --------: | ------------: | ------------: | -------: |
| Native    | completed |                  1.00 |   135.1 s |        $0.393 |         6,122 |       11 |
| Plugins   | completed |                  1.00 |   153.9 s |        $0.460 |         7,019 |       12 |
| CLI       | completed |                  1.00 |   157.7 s |        $0.485 |         6,780 |       15 |

Relative to direct plugins, the Claude CLI used 1.03× wall time and 1.05×
provider cost. Relative to native, it used 1.17× wall time and 1.23× provider
cost. The CLI cell spent 0.43 s in treatment setup and 4.32 s in the runtime
wrapper; 147.36 s was model invocation. Measured host-side CLI machinery
accounted for about 3.0% of its wall time.

The first Claude CLI attempt in the detached evaluator checkout is preserved
under `excluded/`. The checkout lacked evaluator `node_modules`, so Temporal's
worker failed to bundle before model invocation; the outer invocation then
timed out with no transcript or patch. This is classified as evaluator
infrastructure, not a product outcome. After installing the frozen evaluator
dependencies, the same scheduled cell completed successfully as reported
above.

Process inspection after the block found 16 Temporal `start-dev` services and
16 matching workers tied to older `darrow-product-eval-*` workspaces. They were
shut down gracefully before pilot work; verification found no product-eval
service remaining. Six unrelated `darrow-e2e-*` service pairs were left
untouched at that checkpoint and were later terminated during the v4 audit.
Neither the excluded attempt nor its valid replacement leaked a process.

### Replication signal

The earlier policy-matched Codex checkpoint at runner revision `3acfcf5` also
passed all three deterministic checks, but the treatment ranking changed:

| Treatment | Earlier wall time | Current wall time | Earlier total tokens | Current total tokens |
| --------- | ----------------: | ----------------: | -------------------: | -------------------: |
| Native    |           163.5 s |           117.3 s |              426,656 |              305,998 |
| Plugins   |           111.7 s |           188.0 s |              286,917 |              387,210 |
| CLI       |           159.7 s |           124.5 s |              435,514 |              328,864 |

Direct plugins moved from fastest to slowest despite unchanged task, policy,
harness version, model, and plugin digest. These opportunistic checkpoints are
not preregistered repeats and must not be pooled into a product estimate, but
the reversal shows that a one-run smoke cannot rank treatment efficiency.

### V3 interpretation

- All six valid treatments passed the deterministic smoke check.
- The CLI remained approximately level with native in both Codex checkpoints.
- CLI-versus-plugins time and token rankings reversed between checkpoints, so
  the earlier apparent plugin advantage was not stable.
- In Claude, CLI versus direct plugins was close: 3% more wall time and 5% more
  provider cost. Both stayed below the preregistered 1.75× time and 1.50× cost
  ceilings on this smoke task.
- Measured CLI setup/runtime work was about 3% of CLI wall time in both
  harnesses. Most variation occurred during model execution; the smoke does not
  isolate structured-result prompting from other instruction effects within
  that time.
- One simple smoke task cannot reveal orchestration value. The product case
  depends on pilot tasks where runtime orchestration can unlock behavior that
  native or direct-plugin treatments cannot reliably provide.
- The smoke passes operational qualification after the explicit infrastructure
  exclusion. No product-value conclusion is admissible from it.

## Operational checkpoint and excluded diagnostic history

As of 2026-07-20, 76 local observation files exist across the roots below. They
are retained as infrastructure evidence but must not be pooled with the current
protocol. Counts refer to finalized `observation.json` files, not attempted
shell invocations.

| Local result root                            | Observations | What it established                                                                                                         | Why excluded                                                                                                    |
| -------------------------------------------- | -----------: | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `results/runs/`                              |            9 | Initial pilot exposed CLI startup and Claude authentication failures.                                                       | Predates protocol v2 and evaluator repairs.                                                                     |
| `results/repair-smoke/`, `-2`–`-4`           |            7 | Iterative Codex CLI repair ended with a runnable CLI cell.                                                                  | Targeted repair runs, not a balanced treatment block.                                                           |
| `results/repair-smoke-claude/`               |            2 | Claude CLI cells stopped waiting for input and exposed launcher/authentication problems.                                    | Incomplete targeted repair runs.                                                                                |
| `results/repair-smoke-claude-2/`             |            0 | No finalized observation was written.                                                                                       | No result to analyze.                                                                                           |
| `results/protocol-v2/`                       |            6 | Codex ran, but the CLI appeared dramatically slower; all deterministic checks failed and all Claude cells failed at launch. | Confounded delivery policy and broken Claude execution.                                                         |
| `results/protocol-v2-invalid-high-effort/`   |            2 | Reproduced the large Codex CLI gap under the wrong effort setting.                                                          | Invalid high-effort smoke configuration.                                                                        |
| `results/workspace-parity-v1/`               |            1 | Showed that allocating a second CLI worktree discarded prepared ignored dependencies and disadvantaged the CLI.             | Targeted evaluator diagnostic; fixed by shared prepared workspaces.                                             |
| `results/insight-v1/`, `results/insight-v2/` |            2 | Exercised compact timing and tool-trace instrumentation.                                                                    | Trace diagnostics with failed verification.                                                                     |
| `results/policy-diagnostic-v1/`              |            2 | Attempted to isolate the cost of prescriptive TDD instructions.                                                             | Both cells failed verification, so neither is a valid overhead baseline.                                        |
| `results/policy-diagnostic-v2/`              |            5 | Added native/plugin controls and made the policy mismatch visible.                                                          | TDD and CLI cells failed; the comparison is not a valid policy-cost estimate.                                   |
| `results/portable-implement-smoke-v1/`       |            6 | All direct Codex/Claude cells passed; Claude CLI timed out after using capabilities unavailable to direct Claude.           | Treatment tool parity was broken.                                                                               |
| `results/portable-implement-smoke-v2/`       |            6 | All six deterministic checks passed after simplifying the implementation skill.                                             | Predates the shared TDD policy and final Claude trace/launcher repairs.                                         |
| `results/claude-cli-tools-repair-v1`–`v5`    |            5 | Repaired bounded Claude tools, cleanup, usage recovery, and tracing; v5 completed with quality 1.                           | Targeted sequential repair attempts, not a balanced block.                                                      |
| `results/shared-tdd-smoke-v1/`               |            3 | First policy-matched Codex checkpoint; all three deterministic checks passed.                                               | Earlier operational checkpoint; not pooled with the current rerun.                                              |
| `results/shared-tdd-codex-v2/`               |            7 | Complete v3 six-cell smoke plus one preserved evaluator-infrastructure exclusion; all six valid checks passed.              | Superseded by the two-command v4 CLI treatment; excluded from product inference.                                |
| `results/v4-fresh-review-smoke-v1/`          |            6 | First v4 block exposed Claude schema projection and Codex trust-lock incompatibilities.                                     | Four cells completed; two CLI cells failed before review for evaluator compatibility reasons.                   |
| `results/v4-fresh-review-smoke-v2/`          |            6 | Claude CLI completed and Codex reached its second command boundary.                                                         | Codex CLI still used an unsupported provider root combinator.                                                   |
| `results/v4-fresh-review-smoke-v3/`          |            1 | Codex CLI ran both model invocations and passed hidden verification.                                                        | Flat verification evidence could not audit whether failed diagnostics were covered by a relevant passing check. |

The historical diagnostics support four evaluator changes now encoded in the
protocol and preregistration:

1. use the same minimal Red/Green TDD policy in every core treatment;
2. give every treatment the same prepared disposable checkout;
3. bound direct and CLI Claude runs to the same tool and session policy; and
4. capture comparable compact tool traces without relying on model-authored
   evidence files.

They do **not** provide a reliable numerical estimate of Red/Green TDD overhead:
the matched diagnostic cells needed for that comparison failed verification.

## Next checkpoint

Before deciding whether the current quality and autonomy signals justify the
projected 312-cell confirmatory spend, run a small timed operator exercise for
the manual two-launch/handoff workflow and the one-command Darrow workflow.
Keep it separate from the completed automated observations: their null
attention values are correct and must not be backfilled from a different run.
Then evaluate the quality, reliability, model economics, and active-attention
evidence together. The confirmatory holdout remains closed. Do not overwrite or
pool the original v4 quality fields; the digest-bound v5 re-verification and
derived grading overlay remain the authoritative pilot grades.
