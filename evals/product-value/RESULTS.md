# Product-value evaluation journal

This file is the durable, reviewable record of product-value evaluation runs.
Raw observations, patches, and harness transcripts remain under `results/` and
are intentionally ignored by Git because they may contain source material or
sensitive output. Numbers in this journal are copied from those immutable local
observations.

This journal covers the product-value evaluation only. Colocated skill-eval
outputs under `evals/results/` are a separate test corpus.

## Current status — 2026-07-19

The current admissible protocol is v3: all three core treatments receive the
same minimal Red/Green TDD policy. The qualifying smoke is incomplete. Its
three Codex cells are complete; its three Claude cells have not been run. Smoke
results qualify the evaluator and resource assumptions only and are not product
evidence.

Local evidence root: `results/shared-tdd-smoke-v1/`

- Runner revision: `3acfcf5ee9e630aa09e8830d4e9aac884b79be15`
- Harness: Codex CLI 0.144.6
- Model: `gpt-5.6-sol`, medium effort
- Task: `mynab-flags-now`, one repeat

| Treatment | Status    | Deterministic quality | Wall time | Input tokens | Output tokens | Commands |
| --------- | --------- | --------------------: | --------: | -----------: | ------------: | -------: |
| Native    | completed |                  1.00 |   163.5 s |      422,015 |         4,641 |       13 |
| Plugins   | completed |                  1.00 |   111.7 s |      283,847 |         3,070 |       12 |
| CLI       | completed |                  1.00 |   159.7 s |      430,937 |         4,577 |       17 |

Provider cost was unavailable, so tokens are the economic fallback. Relative
to direct plugins, the CLI used 1.43× wall time, 1.52× input tokens, and 1.49×
output tokens. Relative to native, it used 0.98× wall time, 1.02× input tokens,
and 0.99× output tokens.

The CLI cell spent 0.46 s in treatment setup and 2.95 s in the runtime wrapper;
150.59 s was model invocation. Direct CLI machinery therefore accounted for
about 2.1% of its wall time. The CLI executed 17 commands versus 12 for direct
plugins, while both executed seven test commands.

### Interpretation

- All three Codex treatments passed the deterministic smoke check.
- Direct plugins were fastest on this single simple task.
- The CLI was approximately level with native. Its direct setup/runtime
  overhead was trivial compared with model execution.
- The observed CLI-versus-plugins difference occurs primarily during model
  execution, not measured host-side setup or runtime work. This smoke does not
  isolate structured-result prompting from other instruction effects within
  that model time.
- One simple smoke task cannot reveal orchestration value. The product case
  depends on pilot tasks where runtime orchestration can unlock behavior that
  native or direct-plugin treatments cannot reliably provide.
- No product-value conclusion is admissible until the Claude smoke cells pass,
  the pilot is accepted, and the confirmatory procedure is completed.

## Excluded diagnostic history

As of 2026-07-19, 56 local observation files exist across the roots below. They
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
| `results/shared-tdd-smoke-v1/`               |            3 | Current policy-matched Codex evidence summarized above.                                                                     | Not excluded, but incomplete until the three Claude cells run.                |

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

Run the three Claude cells into `results/shared-tdd-smoke-v1/`. Because existing
observations are durable checkpoints, the completed Codex cells will not rerun.
Then update this journal with the six-cell table and the smoke go/no-go decision
before starting the 36-run pilot.
