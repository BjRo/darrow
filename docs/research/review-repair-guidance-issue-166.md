# Advisory repair guidance: issue 166 evidence

Observed on 2026-09-16 for [issue #166](https://github.com/BjRo/darrow/issues/166).
The contract is CR-C9, CR-C18, CR-C19, and CR-E15 in
[Code Review](../specs/code-review.md).

## Live behavior

Each invocation used one trial, one worker, and the runner's 80% threshold.
These are bounded observations, not a stability estimate. Codex used CLI
0.154.0 with gpt-5.6-terra at medium effort; Claude Code used 2.1.223 with
claude-sonnet-5 at medium effort. Codex semantic grading used gpt-5.6-luna/low.
The review plugin retained its configured strong reader routes.

| Candidate case                                | Harness        | Task / activation | Observation                                                                                       |
| --------------------------------------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| code-review-repair-guidance                   | Codex          | 1/1, 1/1          | Both readers supply useful guidance, preserved into the canonical report                          |
| code-review-guidance-alternative              | Codex          | 1/1, 1/1          | A different valid implementation resolves the original finding                                    |
| code-review-guidance-uncertain                | Codex          | 1/1, 1/1          | Missing vendor contracts limit concrete advice without suppressing the supported defect           |
| code-review-guidance-unresolved               | Codex          | 1/1, 1/1          | Following the suggested approach does not excuse the remaining whitespace defect                  |
| code-review-goal-contract-repair-verification | Codex          | 1/1, 1/1          | Real review, authorized repair, and fix verification preserve original guidance before completion |
| goal-review-repair-verification               | Codex, passive | 1/1, 1/1          | Delivery and verification accept a valid repair differing from the advisory suggestion            |
| code-review-both-axes                         | Codex          | 1/1, 1/1          | Implicit review activation and guidance from both axes                                            |
| code-review-fix-verification-regression-scope | Codex          | 1/1, 1/1          | New repair regression retains its verifier's guidance and excludes an unrelated observation       |
| code-review-repair-guidance                   | Claude         | 0/1, 1/1          | Dispatch observed, but no canonical artifacts or guidance; no passing Claude claim                |

The explicit Codex control used unchanged darrow-review 0.3.13 with the same
case, model, effort, trial count, and checks as the initial candidate run.
It activated correctly and retained canonical output, but failed both new
guidance checks. The candidate passed both. The provenance check was subsequently
widened to accept arbitrary reader-record filenames; a direct oracle probe
accepts identical reader guidance and rejects coordinator-authored replacement.

Additional failures were retained and investigated:

- An earlier implicit Codex control did not activate the skill. It is not
  evidence of the old skill's review behavior.
- The enforced adaptive-delivery trial was rejected by the harness hook before
  nested assessment, despite an accepted owner and supporting skill reads.
  The documented native passive mode passed; the failed enforced run is not
  silently counted as successful product behavior.
- The Claude candidate returned a short same-context summary after unqualified
  and namespaced dispatches and ReportFindings. An unchanged-skill Claude
  control also failed the final-report contract: it launched the readers and
  retained artifacts, then reported an internal verification gap and substituted
  a direct review. These are different failure stages, not proof of one root
  cause. The earlier [reviewer-routing study](code-review-reviewer-routing-trials.md)
  also documents unsuccessful full Claude runs. Claude guidance remains
  unverified; this change does not repair that broader conformance problem.

Raw results remain gitignored under evals/results. The initial explicit Codex
control/candidate files start with 2026-09-16T13-37-29-792Z and
2026-09-16T13-41-26-333Z. The enforced/passive delivery files start with
2026-09-16T14-01-25-445Z and 2026-09-16T14-04-11-123Z. The Claude
candidate/control files start with 2026-09-16T14-14-47-995Z and
2026-09-16T14-18-06-469Z. Nested Codex token accounting was unavailable;
no token or cost improvement is claimed.

## Deterministic and artifact validation

- The new shell regression initially failed because the old validator rejected
  guidance fields. It now covers paired-field validation, legacy records,
  Markdown escaping, immutable original and regression handoffs, and a
  conflicting bash executable on PATH.
- Guidance, original-finding, review, scope-result, and independent-review
  fixture tests pass on observed /bin/bash 3.2.57. The fixture also passes with
  TMPDIR both with and without a trailing slash. Bash 5 was unavailable:
  the version-aware helper reports unverified, not a complete matrix.
- New completion-gate counterexamples initially accepted forged or omitted
  guidance and forged resolution evidence. Delegating to the provider's
  validate-original fixes that gap; all 25 completion-gate tests pass.
- The relevant review-outcome, capability-composition, and documentation tests
  pass, as do typechecking, scoped TypeScript and shell lint, formatting, the
  skill inspector, both changed native Claude plugin manifests, and repository
  documentation/paired-manifest checks. Scoped eval dry preparation succeeds;
  dry results are not live behavioral evidence.
- One fresh-context skill validation reported no material findings. Natural
  language judgment remains model-dependent, and the live sample is N=1 per
  condition.
