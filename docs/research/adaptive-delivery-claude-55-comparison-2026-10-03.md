# Adaptive Goal: Claude 5 versus 5.5 checkpoint

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

## Status and recommendation

Claude 5.5 is a promising next evaluation baseline. Complete the frozen repair
comparison before deciding whether to adopt it or change more Claude-specific
skill instructions. The completed case shows more accurate evidence claims and
lower observed cost and time, but no improvement in the common task pass rate.
These Claude results do not establish improvements on Codex or invalidate prior
Luna failures.

Fourteen executions ended: ten high-risk comparison trials, two original repair
diagnostics, and two trials with a shared helper correction. The last trial was
interrupted by Claude's session quota during repair reassessment. The host
returned HTTP 429 and reported a reset at **2026-10-03 19:30 Europe/Berlin**
(17:30 UTC). This was a usage quota, not context-window exhaustion.

Eight planned trials remain unstarted. No background eval jobs or automatic
restart remain. Production and installed plugins were not changed by this
experiment. This checkpoint records research; it does not adopt new models or
release the helper correction.

## Frozen comparison

Baseline: `465a9e98`, Adaptive Goal 0.24.3, Verification 0.3.1 and Review
0.11.0. Both conditions use Claude Code 2.1.284, passive owner evaluation, the
native goal entrypoint and the same fixture, checks and observation.

| Role                     | Control           | Candidate           |
| ------------------------ | ----------------- | ------------------- |
| Main coordinator         | Sonnet 5 / medium | Sonnet 5.5 / medium |
| Bounded implementation   | Sonnet 5 / low    | Sonnet 5.5 / low    |
| Verification coordinator | Opus 5 / high     | Opus 5.5 / high     |
| Review coordinator       | Sonnet 5 / medium | Sonnet 5.5 / medium |
| Real independent readers | Opus 5 / xhigh    | Opus 5.5 / xhigh    |

The conditions change both model families together. They cannot isolate the
effect of any one role. Model identifiers, accepted route literals, agent names
and experiment manifest versions change; workflow instructions stay frozen.
No operator subagents were used. Native participant delegation is the behavior
under evaluation.

Selected cases, originally n:5 per condition per case:

- `goal-review-high-selected-claude`: high-risk implementation and coordination,
  using a deterministic review fixture rather than real independent readers.
- `goal-verification-existing-review`: real initial review, bounded repair and
  fresh verification against the closed original finding set.

Before any live repair trial, both repair prompts received the same required
`/goal ` prefix in new copies. Claude's headless entrypoint requires native goal
activation; it does not offer the interactive `ProposeGoal` mechanism. Rendered
prompts match, contain one `/adaptive-delivery`, and produce a 666-character
goal. High-risk goals are 601 characters. Original snapshots and dry runs remain
preserved.

## Completed high-risk case

| Measure                                         | Control, n:5 | Candidate, n:5 |
| ----------------------------------------------- | -----------: | -------------: |
| Common task checks                              |          4/5 |            4/5 |
| Intended role routes                            |          4/5 |            5/5 |
| Sampled capability contract                     |          4/5 |            4/5 |
| Evidence correctness                            |          2/5 |            5/5 |
| Evidence preservation                           |          5/5 |            5/5 |
| Median candidate wall time                      |        340 s |          136 s |
| Median whole-tree tokens, including cache input |    1,250,262 |        633,970 |
| Total whole-tree tokens                         |    6,572,869 |      3,177,777 |
| Harness-reported dollars, five trials           |      $6.5632 |        $3.3597 |

Capability scoring covers sampled ownership, routes, read-only boundaries and
handoffs; it is not an exhaustive audit. This case does not establish production
reviewer performance. Initial trials overlapped local quality validation, so
timings are observational. Control trial 2 used an unintended model route;
the control aggregate is not a pure Claude 5 comparison. Small samples do not
establish broad reliability or a causal performance improvement.

### Retained failures and qualifications

| Condition / trial | What happened                                                                                                                                                                                                                                                            | Interpretation                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Control 1         | Verification claimed the deterministic provider created independent readers; no such children exist. Provider also reformatted output while claiming verbatim delivery.                                                                                                  | Evidence correctness failure; meaning retained.                                                 |
| Control 2         | A Skill-event assertion failed although a complete provider-body read and execution are retained. A generic Opus alias selected Opus 5.5/medium instead of Opus 5/high. Verification ran `git stash create`; provider forwarding was inaccurately described as verbatim. | Preserve the raw task failure separately from genuine routing, read-only and evidence failures. |
| Control 3–4       | Common task and sampled dimensions passed.                                                                                                                                                                                                                               | Bounded successes, not general reliability evidence.                                            |
| Control 5         | Verification again invented independent-reader creation by the deterministic fixture.                                                                                                                                                                                    | Evidence correctness failure.                                                                   |
| Candidate 1       | Completion wording failed the semantic check; the host marked the native goal complete after the response.                                                                                                                                                               | Retain the task failure. Timing does not prove a false claim about the earlier goal state.      |
| Candidate 2–4     | Common task and sampled dimensions passed.                                                                                                                                                                                                                               | Bounded successes.                                                                              |
| Candidate 5       | Verification ran `git stash create` during a read-only assignment and disclosed the accidental Git object write.                                                                                                                                                         | Contract failure despite accurate disclosure and task success.                                  |

Control 2 recovered from an implementation assignment that initially excluded
the needed test edit by launching a fresh bounded assignment. Other high-risk
trials did not exercise incomplete-handoff recovery. That absence is not a
recovery success. No failed trial was replaced or silently regraded as passing.

## Original repair diagnostics

The original control passed common task checks and repaired the product, but
main performed review coordination and implementation itself. No observed
Adaptive Goal or Verification body read/dispatch, preflight, separate
verification assignment or bounded implementor appears in the retained trace.
Three independent readers ran on Opus 5/xhigh. Main nevertheless omitted the
mandatory `review-claude-verify` attestation before admitting their judgments.
Functional success did not satisfy the ownership and capability contract.

The original candidate activated the intended capability chain and performed
the required route check. It exposed a shared deterministic defect in
`darrow-review/backend/src/darrow_review/provider.py`: on macOS the helper
preserved `_` in the expected project directory, while this Claude host encoded
it as `-`. The actual repository path included `/var/folders/_b/`. Both model
conditions had the same defective helper; the control bypassed its check.

The candidate correctly discarded unverified reader judgments and reported a
blocker. Its native responses survive, but the harness final-response field is
empty. The retained raw result envelope intentionally omits response text, so
host-versus-adapter attribution remains unresolved. The complete verification
renderer output was preserved after accounting for two preceding command
outputs. Do not classify the model as silent or claim report truncation.

Both original repair trials remain diagnostic evidence. Neither is substituted
into the patched repair comparison.

## Approved helper correction in isolated copies

The user approved the same small correction in two new experiment copies and
fresh repair n:5 per condition. The production helper remains unchanged by this
experiment. The runtime change removes the platform-dependent encoding branch:

```diff
-    slug = str(root).replace("/", "-")
-    if os.name == "nt":
-        slug = re.sub(r"[^A-Za-z0-9]", "-", str(root))
+    slug = re.sub(r"[^A-Za-z0-9]", "-", str(root))
```

A public-command regression uses a real transcript fixture with the literal
host-encoded leaf `repo-with-underscore`, then invokes `review-claude-verify`
for `repo_with_underscore`. Existing mock transcript fixtures were aligned.
Missing and ambiguous transcript evidence still fails. Both copies contain
the same spec invariant and helper correction. Paired Review manifests use
`0.11.1-eval.path` for control and `0.11.1-eval.55.path` for candidate.

For each copy, from its Review backend:

- Red — `uv run --frozen --group dev pytest -q tests/test_transcript_path.py`:
  exit 1, expected missing transcript directory for the underscored repository.
- Green — `uv run --frozen --group dev pytest -q tests/test_transcript_path.py`:
  exit 0, correct transcript path, model and effort.

Both complete `bun run check:python` gates passed on macOS / Python 3.13.14 at
14:15:58 UTC. Review coverage was 98.04% statements and 96.48% branches. Both
patched dry preparations passed with zero frozen-input changes. No Windows
live comparison was performed.

Earlier quality-preparation failures remain retained: an omitted baseline
marketplace file needed by an unrelated packaging test, and formatting of two
longer model-literal tests. Final copies include the unchanged baseline
marketplace and formatting corrections before freezing. The preflight test
formatting is AST-equivalent. No participant workflow wording, common checks,
adapter or passive observer was changed to obtain a better result.

## Patched repair comparison at the quota boundary

| Measure                             | Control attempt 1                 | Candidate attempt 1               |
| ----------------------------------- | --------------------------------- | --------------------------------- |
| Common task checks                  | Fail                              | Fail, quota interruption          |
| Actual orchestration                | Required roles bypassed           | Intended roles executed           |
| Provider assessment before repair   | Missing                           | Present                           |
| Bounded implementor                 | Missing; main edited              | Sonnet 5.5 / low                  |
| Closed current repair assessment    | Missing                           | Reassessment interrupted          |
| Evidence correctness / preservation | Pass / pass for produced evidence | Pass / pass for produced evidence |
| Whole-tree tokens through exit      | 1,627,496                         | 1,128,244                         |
| Candidate wall time through exit    | 215 s                             | 220 s                             |
| Harness-reported dollars            | $0.9253                           | $1.2515                           |

Control edited before the initial provider assessment, then ran a comprehensive
review. It again skipped Adaptive Goal and Verification coordination and
reviewer-route attestation. Correct final values did not create the missing
closed repair assessment. The native host nevertheless marked its goal complete.

Candidate obtained the initial finding, successfully exercised the patched
route verifier, delegated one bounded repair, preserved original evidence and
started fresh follow-up verification on Opus 5.5/high. Its provider recovered two
shell-word-splitting errors before successful route confirmation. The initial
verification final matched renderer output exactly.

The follow-up verifier then received an explicit HTTP 429 quota error. The
parent's failed Agent result identifies that error and the same child; the
child's public transcript corroborates it. No completion claim was fabricated.
This is an operational interruption, not an established model failure, and
cannot establish completed repair latency or success.

All seven native actors are correlated, including the interrupted verifier via
the exact parent tool-use ID and native sidecar. Postprocessing includes its
usage without marking the assignment complete. The earlier incomplete usage
summary is retained. `<synthetic>` labels on zero-usage quota messages denote
host error output, not model substitution.

## Evidence and resumption

The complete local evidence remains gitignored beneath:

```text
/Users/bjro/Sources/darrow/evals/results/adaptive-claude-55-comparison-2026-10-03
```

Important paths relative to that directory:

- `setup.json`, `validation.json`, `measurement-rules.md`, `aggregate.json`:
  baseline, matching rules, measurements and per-trial assessments.
- `control/`, `candidate/`: original high-risk frozen inputs.
- `repair/`: original repair inputs and entrypoint preparation evidence.
- `repair-fixed/`: corrected frozen inputs, hash manifests and preparation log.
- `trials/`: ten high-risk trials and both original repair diagnostics.
- `trials-repair-fixed/`: patched repair attempts, including the quota evidence.
- `jobs/`: retained command, dry-run, red/green and quality-gate logs.
- `report.md`, `resume.md`: detailed local report and continuation instructions.

Each trial retains raw results, public native evidence, a summary, a manual
assessment and frozen-input checks. Whole-tree tokens include cache input and
deduplicate message IDs within each actor. Dollar figures are harness-reported;
whole-tree billing reconciliation is not claimed. Private reasoning is excluded
from the observation. Previous failures and attribution gaps remain open unless
explicitly resolved by the recorded evidence.

After capacity returns, resume one trial at a time from the evidence directory:

```sh
bun launch-job.ts fixed-control-repair-2 bun run-trial.ts control goal-verification-existing-review 2 --fixed
```

Wait for `execution.json`, then inspect and assess before the next live call:

```sh
bun summarize.ts control goal-verification-existing-review 2 --fixed --brief
bun inspect-fixed.ts control 2 --full
```

Continue with candidate slot 2, then alternate slots 3–5. The wrapper refuses
overwrites and checks input hashes before and after each run. Refresh the
aggregate with `bun aggregate.ts`. Preserve the same models, efforts, inputs,
checks and observer. Resolve unexplained failures before continuing under the
repository's eval-development rules.

Candidate slot 1 remains an interrupted attempt, not a fully observed
behavioral trial. Any additional trial to obtain five completed candidate runs
must be separately recorded, retaining the quota failure. No production model
upgrade, production helper change, push or further live trial is part of this
checkpoint commit.
