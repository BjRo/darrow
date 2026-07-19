# Product-value evaluation journal

This file is the durable, reviewable record of product-value evaluation runs.
Raw observations, patches, and harness transcripts remain under `results/` and
are intentionally ignored by Git because they may contain source material or
sensitive output. Numbers in this journal are copied from those immutable local
observations.

This journal covers the product-value evaluation only. Colocated skill-eval
outputs under `evals/results/` are a separate test corpus.

## Current status — 2026-07-19

The current protocol is v3: all three core treatments receive the same minimal
Red/Green TDD policy. The qualifying six-cell smoke is complete. All three
treatments passed deterministic verification in both Codex and Claude Code.
Smoke results qualify the evaluator and resource assumptions only and are not
product evidence.

Local evidence root: `results/shared-tdd-codex-v2/`

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
untouched. Neither the excluded attempt nor its valid replacement leaked a
process.

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

### Interpretation

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

As of 2026-07-19, 63 local observation files exist across the roots below. They
are retained as infrastructure evidence but must not be pooled with the current
protocol. Counts refer to finalized `observation.json` files, not attempted
shell invocations.

| Local result root                            | Observations | What it established                                                                                                         | Why excluded                                                                  |
| -------------------------------------------- | -----------: | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `results/runs/`                              |            9 | Initial pilot exposed CLI startup and Claude authentication failures.                                                       | Predates protocol v2 and evaluator repairs.                                   |
| `results/repair-smoke/`, `-2`–`-4`           |            7 | Iterative Codex CLI repair ended with a runnable CLI cell.                                                                  | Targeted repair runs, not a balanced treatment block.                         |
| `results/repair-smoke-claude/`               |            2 | Claude CLI cells stopped waiting for input and exposed launcher/authentication problems.                                    | Incomplete targeted repair runs.                                              |
| `results/repair-smoke-claude-2/`             |            0 | No finalized observation was written.                                                                                       | No result to analyze.                                                         |
| `results/protocol-v2/`                       |            6 | Codex ran, but the CLI appeared dramatically slower; all deterministic checks failed and all Claude cells failed at launch. | Confounded delivery policy and broken Claude execution.                       |
| `results/protocol-v2-invalid-high-effort/`   |            2 | Reproduced the large Codex CLI gap under the wrong effort setting.                                                          | Invalid high-effort smoke configuration.                                      |
| `results/workspace-parity-v1/`               |            1 | Showed that allocating a second CLI worktree discarded prepared ignored dependencies and disadvantaged the CLI.             | Targeted evaluator diagnostic; fixed by shared prepared workspaces.           |
| `results/insight-v1/`, `results/insight-v2/` |            2 | Exercised compact timing and tool-trace instrumentation.                                                                    | Trace diagnostics with failed verification.                                   |
| `results/policy-diagnostic-v1/`              |            2 | Attempted to isolate the cost of prescriptive TDD instructions.                                                             | Both cells failed verification, so neither is a valid overhead baseline.      |
| `results/policy-diagnostic-v2/`              |            5 | Added native/plugin controls and made the policy mismatch visible.                                                          | TDD and CLI cells failed; the comparison is not a valid policy-cost estimate. |
| `results/portable-implement-smoke-v1/`       |            6 | All direct Codex/Claude cells passed; Claude CLI timed out after using capabilities unavailable to direct Claude.           | Treatment tool parity was broken.                                             |
| `results/portable-implement-smoke-v2/`       |            6 | All six deterministic checks passed after simplifying the implementation skill.                                             | Predates the shared TDD policy and final Claude trace/launcher repairs.       |
| `results/claude-cli-tools-repair-v1`–`v5`    |            5 | Repaired bounded Claude tools, cleanup, usage recovery, and tracing; v5 completed with quality 1.                           | Targeted sequential repair attempts, not a balanced block.                    |
| `results/shared-tdd-smoke-v1/`               |            3 | First policy-matched Codex checkpoint; all three deterministic checks passed.                                               | Earlier operational checkpoint; not pooled with the current rerun.            |
| `results/shared-tdd-codex-v2/`               |            7 | Complete current six-cell smoke plus one preserved evaluator-infrastructure exclusion; all six valid checks passed.         | Smoke is operational qualification only and excluded from product inference.  |

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

Harden preflight so a missing evaluator dependency fails before treatment
assignment. Then run the optional clean no-TDD diagnostic if Red/Green policy
cost still matters. Before pilot work, raise or redefine the phase token
ceilings using observed resource usage. Run the 36-cell calibration pilot into
a fresh result root; do not mix either smoke checkpoint into product analysis.
