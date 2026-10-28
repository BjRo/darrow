# Review skill against the updated builder guidance

This change applies the skill-authoring writing guidance to `darrow-review`
without changing its review or repair-verification outcomes. The plugin version
is `0.11.29` in both host manifests.

## Changes and acceptance

| Audit issue                          | Repair                                                                                                                                                                            | Acceptance evidence                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Retired response-file assertions     | Move 26 human-format checks to public final-message observations; compare machine JSON with captured canonical-artifact output; remove the redundant negative response-file check | Public extension tests, invalid-output counterexamples, and live presentation cases |
| Conflicting human presentation rules | Keep one presentation rule in `SKILL.md`; normal and exceptional paths allow faithful paraphrases with the same findings, dispositions, constraints, checks and gaps              | Presentation cases and independent skill audit                                      |
| Missing phase completion states      | Give scope binding, evidence preparation, independent judgment and finalization their own checkable end states                                                                    | Normal review, repair verification and terminal-scope cases                         |
| Recovery detail in the common path   | Move known route unavailability and later recovery to a conditional reference; split Codex and Claude launch mechanics into host references                                       | Normal review and route-unavailable cases; contained-resource inspector             |
| Repeated/derivable prose             | Remove the repeated workflow reminder, generated launch-field inventory and Python-version restatement from the main body                                                         | Matched original/revised normal-review cases                                        |

The main body decreased from 1,440 to 1,104 whitespace-delimited words (23.3%),
and from 210 to 172 lines. Those are text measurements, not token, speed or cost
claims. Independent reader prompts still carry their own complete instructions;
they do not share conversation context.

The independent audit found no material issue. It identified two further optional
pruning candidates in the context-file and repair references. They remain because
this comparison does not isolate their removal.

## Evaluation method

Use Sevro `1.0.0`, Codex's app-server entrypoint and passive observation. The
candidate coordinator uses `gpt-6-luna/medium`, the semantic grader uses
`gpt-6-luna/high`, and independent readers use `gpt-6.1-sol/xhigh` with fresh
context. Required plugin-hook execution and reminder delivery in the native
initial context are checked separately from skill activation and task outcome.

The acceptance threshold is three successful trials out of three, with task
checks and activation reported separately. The matched normal-review control
and candidate use the same frozen project, fixtures, checks, runtime profile,
configuration root, models, efforts, host executable and trial concurrency.
Only the evaluated skill prose/references change between those cells. The
frozen control uses the original `0.11.28` prose with the repaired graders and
the same `0.11.29` manifests and backend as the candidate.

Runtime profile:
`/Users/bjro/Sources/darrow/evals/sevro-extension/runtime-review-artifacts.json`.
Frozen project:
`/var/folders/_b/yvzxqsys46l91yf5dtlk7q9w0000gn/T/darrow-review-eval-project-zmso9tav`.
Results root: `/tmp/darrow-review-guidance-evals`.

The original prose scored 2/3 on the matched normal-review control. In the failed
trial the coordinator omitted `AGENTS.md` from the Standards input, leaving only
the smell baseline. The independent Standards record passed and missed the
fixture's explicit prohibition on console logging. The semantic check correctly
failed that result. The revised evidence phase explicitly binds repository
instructions and names them in its completion state. A targeted follow-up audit
found no material regression from that clarification.

The first revised-prose threshold also scored 2/3. Every trial reported both
seeded defects, but one coordinator created a replacement Standards reader
after the first was accepted, then cancelled the original. The native route
oracle correctly rejected that extra launch. The Codex reference now states at
the acceptance point that the accepted child owns the axis through completion
or the permitted same-child diagnostic correction. Cancellation leaves a gap
rather than authorizing a replacement.

## Final threshold results

All final candidate cells use three concurrent trials (`--trials 3 --jobs 3
--threshold 1`). The matched original-prose control uses those same settings.
Task and activation pass counts are separate:

| Cell                                | Task | Activation |
| ----------------------------------- | ---- | ---------- |
| Original prose, both axes           | 2/3  | 3/3        |
| Final candidate, both axes          | 3/3  | 3/3        |
| Human presentation                  | 3/3  | 3/3        |
| Raw machine presentation            | 3/3  | 3/3        |
| Selected reviewer route unavailable | 3/3  | 3/3        |
| Resolved repair verification        | 3/3  | 3/3        |
| Empty scope                         | 3/3  | 3/3        |
| Ordinary edit, review inactive      | 3/3  | 3/3        |

The final candidate passes all 21 task trials and all 21 activation trials.
The unavailable-route and empty-scope cases pass by retaining honest blocked
reports; the ordinary-edit case passes with zero false skill selections.
Every final candidate check passed with completed execution and grading.

The final audit compared the evaluated plugin, case files, hidden Python
oracles and TypeScript grading extension with the current worktree. They match.
The candidate prose identifier, computed from `SKILL.md` and sorted Markdown
references using their relative filenames and bytes, is SHA-256
`5ef4398f31d76747d7d9681181ca35e662f90af301eea5c3dc6d5291301ff48c`.
Both host manifests identify `darrow-review` version `0.11.29`.

Retained selection manifests:

- Control: `/tmp/darrow-review-guidance-cli-165-control-3.json`.
- Final both-axes candidate:
  `/tmp/darrow-review-guidance-cli-165-candidate-both-axes-final-3.json`.
- Human presentation:
  `/tmp/darrow-review-guidance-cli-165-code-review-presentation-default-3.json`.
- Machine presentation:
  `/tmp/darrow-review-guidance-cli-165-code-review-presentation-machine-v1-3.json`.
- Unavailable route:
  `/tmp/darrow-review-guidance-cli-165-code-review-reviewer-route-unavailable-3.json`.
- Repair verification:
  `/tmp/darrow-review-guidance-cli-165-code-review-fix-verification-resolved-3.json`.
- Empty scope:
  `/tmp/darrow-review-guidance-cli-165-code-review-empty-diff-3.json`.
- Ordinary edit:
  `/tmp/darrow-review-guidance-cli-165-code-review-no-trigger-after-edit-3.json`.

Each manifest points to its complete Sevro result and per-trial evidence. The
current CLI executable is explicitly bound as
`/opt/homebrew/Caskroom/codex/0.165.0/bin/codex`.

## Measurement repairs and excluded attempts

The first control detected both seeded defects and produced valid read-only
review artifacts, but its route oracle rejected Sevro's complete native
transcript view solely because it declared version 2. The oracle now accepts
published view versions 1 and 2 while preserving materialized-file hashes,
completeness, identity, route, child completion and launch-batch checks. A retained
version-2 capture passes the repaired oracle. Regression tests reject unknown
versions and preserve the existing invalid-evidence counterexamples.

Earlier trials on Codex `0.164.0` include a successful 3/3 original-prose control
and a successful revised-prose diagnostic. During the revised threshold run,
the installed CLI changed to `0.165.0` and the old executable directory vanished.
The candidate reported the missing code-mode executable; the semantic host
reported `ENOENT` during state preparation. That attempt is a host failure and
supplies no successful threshold evidence. The matched comparison is rerun on
the explicit `0.165.0` binary.

An external absolute `--skill-dir` override was refused before execution because
the runner requires a project-contained skill. The frozen-project preparation
also initially retained source symlinks; Sevro refused it before candidate
execution. The usable snapshot omits the unrelated corpus cache and materializes
the repository's instruction mirror as a regular file. Neither refused setup
counts as a live outcome.

The first original-prose threshold command exceeded the MCP shell's observation
timeout while its process continued. Its retained Sevro result and all three
trial records completed successfully. Later long commands use resumable native
process handles. No observation timeout is treated as a terminal process result.

## Deterministic checks and limits

- The shared skill inspector reports `status valid` with contained references.
- TypeScript, ESLint and documentation checks pass.
- `bun run check:python` passes. The Review package has 474 passed tests and one
  platform skip, with 98.21% line and 95.54% branch coverage.
- Focused response/outcome oracle tests pass: 34 tests, including both Bash
  interpreters and canonical, summarized, empty and stale-report counterexamples.
- `bun run test:evals` passes: 501 tests, zero failures, 5,473 assertions.

This bounded sample does not establish long-run reliability. Native Claude and
Windows execution are unverified in this pass; deterministic host-specific
contracts remain covered by the package and repository tests.
