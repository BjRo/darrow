# PR #257 Codex validation with Sevro rc.11

The full Codex verdict remains **blocked**. All 77 distinct cases selected for
this release retest have outcomes. Known Darrow fixture repairs are verified;
remaining failures and unavailable observations are retained below.

## Candidate and limits

Validation ran in `.worktrees/fix/pr257-validation` on `fix/pr257-validation`,
with checkpoint `1e6759c4349567f897a167a588b3714095889e86` and subsequent
uncommitted fixture repairs. No push or merge followed the checkpoint.

The [pull request](https://github.com/BjRo/darrow/pull/257) still points at
`feat/255-conditional-implementation-placement`, head
`34606ad9e1952b7f4e9c56befa446c18e1a2eb5d`, on 2026-10-13. Its non-skipped CI
checks succeed on that head. They do not validate the separate repair branch.

Every native retest uses installed, published `@bjoernrochel/sevro@0.1.0-rc.11`,
with both development overrides cleared, candidate `gpt-6.1-sol/medium`, semantic
grader `gpt-6-luna/medium`, passive owner evaluation, one trial, one job,
threshold one, and a 1,200,000 ms Codex timeout. Fixture-selected reviewer routes
remain unchanged. These are functional observations across changing case
variants, not matched reliability trials or a fleet run on one final snapshot.

Retained local evidence lives under `evals/results/pr257-eval-migration/`.
`rc11-complete-retest-status.json` selects the latest declared result for every
case and retains selection hashes. The original attempts, bounded capacity
retry, semantic controls, and preparation/resource errors remain separate.
Classifications never turn failed or unavailable outcomes into passes.

## Results

| Outcome                                                   | Distinct cases |
| --------------------------------------------------------- | -------------: |
| Task passed                                               |             57 |
| Task failed                                               |             12 |
| Task not assessed                                         |              8 |
| Activation passed                                         |             49 |
| Activation unavailable                                    |             18 |
| Activation not requested                                  |             10 |
| Task passed with required activation and public exit zero |             45 |

The retest set comprises the original 58 release cases and 19 additional
previously blocked cases. The earlier migration attempted 192 of 194 affected
cases; two Claude-only cases were excluded on Codex. The 403-case inventory was
not rerun in full on rc.11. Nine Review-artifact prompt rechecks overlay earlier
results for those same cases. Ajv was attempted but rejected before execution;
it contributes an unassessed outcome, not a completed candidate trial.

## Verified Darrow repairs

- Guide diagnosis and installation assertions now grade their original meaning
  without requiring incidental wording. Retained responses and valid controls
  pass; repair/installation claims and missing-contract counterexamples fail.
  Fresh native runs pass 7/7 checks and activation for each case.
- All 34 canonical Review-artifact cases state the prerequisite to preserve the
  configured Review and dependency-cache paths. The state remains outside the
  repository and graders read the original records through the public read-only
  grant. The fixed-point case passes 6/6 checks and activation. All nine shared
  prompt rechecks completed; empty-diff control absence and high-risk composed
  activation remain unmeasured.
- Review progress/advisory grading keeps advisory findings distinct from
  completion gates. Four retained/valid/contradictory controls behave as
  expected; the fresh case passes 7/7 and activation.
- Readiness continuation grading recognizes a named passing acceptance check as
  verification and does not require repeating a prior non-ready result in the
  final response. Positive controls pass; unverified completion and permanent
  termination counterexamples fail. The fresh case passes 8/8 and activation.
- Three feedback-boundary fixtures keep authentic bookkeeping outside the
  repository through the explicit
  [feedback receipt runtime profile](../../evals/sevro-extension/runtime-feedback-receipts.json).
  Sevro fingerprints Git-ignored workspace files, so mandatory `.fixture-state`
  receipts previously invalidated the unchanged-workspace assertion. Original
  receipts are now read-only granted to graders. Exact acknowledgement,
  source-preservation, ordering, and boundary checks remain. Cross-turn feedback
  passes 8/8 plus activation; steering passes 10/10 plus activation; the direct
  diagnostic control passes 8/8 with activation not requested. The final steering
  oracle retains exact-byte comparison, including the trailing newline.
- Capability-routing and real-commit mock review fixtures compute the same
  SHA-256 identities with Python's standard library. macOS `shasum` previously
  aborted because the sandbox blocked Perl's library. Fresh native review now
  clears in both cases; genuine Git writes remain blocked afterward.
- The deterministic 15-fixture discovery control has a 120-second aggregate
  timeout instead of 40 seconds. All its acceptance checks remain intact.

Commander passes both hidden-contract and focused-Jest checks on rc.11. TDD's
public red/green case passes all eight checks and activation, including the cause
of its red result. Their older failures did not recur; no product fix or
reliability claim follows from those single observations.

## Remaining compatibility and observation gaps

| Required evidence or operation              | Affected examples                                                                                                                    | Current evidence                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legitimate Git index/ref writes             | Ticket-to-PR compositions and feedback relay; capability routing; real commit; authorized publication; PR evidence; Artificer revoke | Actual `.git/index.lock`, ref locks/directories, or Artificer admission lock denied. No simulated effects or relocated Git metadata.                                                                            |
| Native control absence                      | Guide mutation/orchestration; Review empty diff and unavailable route                                                                | Submitted opaque `functions.exec` calls leave control absence unavailable despite other checks passing.                                                                                                         |
| Complete activation and turn-specific reads | Guide unknown/visual cases; composed Review, Verification, Goal and Ticket cases; readiness prior assessment                         | Unsupported prefixed/multiple-skill read forms or partial whole-read summaries; initial/follow-up read receipts absent. Retained complete bodies or aggregate receipts do not replace the required observation. |
| Actual isolated host configuration          | Direct Codex Adaptive Goal doctor                                                                                                    | Top-level `.codex` fixture rejected before host execution. A nested represented configuration would test a different input.                                                                                     |
| Actual candidate user-skill absence         | Undefined skill refusal                                                                                                              | Retired `.git/darrow-eval/state` assertion cannot inspect the private candidate skill root. Grader-home absence is not a substitute.                                                                            |
| Repository submodules                       | Ajv instance-path task                                                                                                               | Public CLI rejects the pinned source with `repository submodules are not supported`.                                                                                                                            |
| Local socket tests                          | Express links; Requests proxy sessions                                                                                               | Hidden behavior checks pass, but focused upstream tests cannot bind sockets. Express shows `listen EPERM`; Requests shows `PermissionError` at `socket.bind`. Full acceptance remains unverified.               |

[Sevro #67](https://github.com/BjRo/sevro/pull/67) adds bounded sequential literal
skill-read recognition, not arbitrary shell parsing or every composed read form.
[Sevro #68](https://github.com/BjRo/sevro/pull/68) moves plugin preparation into
private request state; legitimate Git operations above still need repository
metadata writes. [Sevro #69](https://github.com/BjRo/sevro/pull/69) publishes
rc.11. The private artifact grants are working for the explicitly configured
Review and feedback state; they do not expose every private host directory.

## Behavior failures reported separately

Product skill bodies were not changed under the infrastructure-only scope.

- `create-ticket-no-attribution`: activation passes, but the candidate sends the
  forbidden AI note to the backend, receives an input refusal, and stops without
  creating the requested ticket. One of four checks passes.
- `code-review-invalid-base`: the candidate reports an invalid Git ref manually
  without preparing the canonical terminal blocked Review record. The missing
  declared state causes a grading error with zero checks; activation is also
  unavailable. Honest blocked prose does not replace the required record.

## Final checks and merge work

All **536 deterministic checks pass across 55 files**, run one file per fresh
process, sequentially, with both Sevro development overrides cleared. This
covers the installed integration, Darrow domain, and historical-reader tests.
The initial monolithic attempt did not pass: it had one 40-second test timeout
followed by `ENFILE` errors. Two concurrent targeted attempts also could not load
their test modules during that resource failure. Those attempts remain retained.
The split launcher separately refused a duplicate output basename before running
an integration file; directory-qualified output names fixed that preparation
error without overwriting evidence. The monolithic command was not rerun after
these successful per-file checks.

Type checking, lint for the changed TypeScript test, documentation checks,
formatting for all 56 changed or new paths, and `git diff --check` pass. The checkpoint's full Python quality gate passed all 12 packages; no
packaged Python source, tests, metadata, or locks changed afterward.

Before an unqualified merge verdict, bring the validation changes onto the
pull request's actual branch, run CI for that candidate, and obtain a fresh
independent review covering the final repairs. Required Codex coverage still
needs the supported operations and observations above, followed by affected
case retests. A narrower merge decision would need an explicit acceptance of
remaining coverage limits. Unrelated existing plugin behavior failures remain
separate follow-up work rather than silently changing this PR's acceptance.
