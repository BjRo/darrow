# Product-value evaluation journal

This file is the durable, reviewable record of product-value evaluation runs.
Raw observations, patches, and harness transcripts remain under `results/` and
are intentionally ignored by Git because they may contain source material or
sensitive output. Numbers in this journal are copied from those immutable local
observations.

This journal covers the product-value evaluation only. Colocated skill-eval
outputs under `evals/results/` are a separate test corpus.

## Current status — 2026-07-20

The current protocol is v4: all three core treatments receive the same minimal
Red/Green TDD implementation policy, while the CLI product treatment runs a
second fresh-context `verify-and-repair` command through the same locked harness
route. The top-level requested outcome remains identical across treatments. The
fresh v4 six-cell smoke is now operationally qualified: every cell
completed, every hidden deterministic check scored 1.00, both CLI traces contain
two real model invocations, and no evaluator-owned process remains. Pilot work
may begin, but this one-task smoke is not product-value evidence.

Qualifying v4 evidence root: `results/v4-fresh-review-smoke-v4/`

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

Run the preregistered 36-cell, one-repeat v4 calibration pilot across the real
simple and orchestrated task strata. Inspect task-level quality, fresh-review
repairs, paired time/cost effects, and trace completeness before applying the
confirmatory continue gate. The v4 operational token ceilings are 20 million
for pilot and 175 million for confirmatory. Do not pool any excluded smoke root
with pilot or confirmatory product estimates; run the optional clean no-TDD
diagnostic only if implementation-policy cost still matters.
