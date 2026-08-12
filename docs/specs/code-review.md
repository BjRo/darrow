# Capability: Code Review

Darrow should provide an independent, model-invoked capability that reviews a
pinned change along two isolated axes: repository standards and fulfillment of
the originating specification.

Plugin: `darrow-review`  
Skills: `code-review`

## Why

A change can be cleanly written but implement the wrong thing, or satisfy the
request while violating the repository's design and maintenance expectations.
Reviewing those questions independently reduces anchoring and keeps findings
traceable to their actual source.

This capability is independently installable and selected from review intent.
It does not depend on a goal loop, ticket pipeline, issue tracker, or another
Darrow plugin.

## Intent

Use code review when the user asks to review a branch, pull request,
work-in-progress diff, uncommitted changes, or changes since a named fixed
point, or when an explicit larger goal contract requires independent review of
its final change.

The skill reviews and reports. It does not edit, repair, commit, publish, or
merge the change unless the user separately requests a capability authorized to
do so.

## Contract

Input:

- a pinned base and target, where the target may include declared staged,
  unstaged, and untracked working-tree changes;
- the originating objective, acceptance criteria, or spec when one exists;
- the applicable repository instruction and coding-standard sources;
- applicable deterministic checks already known to the repository.

Output:

- the exact review scope;
- Standards and Spec findings reported separately;
- each finding's severity, changed location, violated source, and evidence;
- deterministic check results or an explicit evidence gap;
- one aggregate `pass`, `fail`, or `blocked` verdict.

If several reasonable fixed points would produce materially different review
scopes, ask for the base rather than guessing. A request such as “review my
uncommitted changes” is already a sufficient scope when the working tree can be
identified unambiguously.

## Composition in a larger goal

A larger goal composes review through the host-visible intent **independently
review this pinned code change**, not through a plugin name or path. It supplies
the final change scope, originating objective or specification, applicable
repository standards, and current deterministic-check evidence. The current
goal owner reads the capability's normal response semantically; it does not
require a particular serialization or machine-readable envelope.

Selection belongs to the consumer's goal contract. This capability neither
decides that every implementation needs review nor makes itself a mandatory
phase. When a goal contract does select independent review:

- it confirms that a matching capability is available before repository
  mutation; unavailability stops the goal rather than silently substituting
  author self-review;
- it invokes review only after the candidate change and applicable final-tree
  checks are complete;
- a response with no blocking findings returns control to the goal owner
  without granting repair, publication, or other authority;
- blocking findings leave the selected review gate unsatisfied. The goal owner
  may repair them only under authority it already has, must rerun invalidated
  checks, and must review the changed target again. Otherwise it stops and
  reports the findings;
- an unavailable or inconclusive review stops the goal and reports the evidence
  gap; and
- completion or publication requires review of the exact current content. Any
  content-changing repair or later edit requires another independent review.

The review coordinator remains read-only in every mode. A composed invocation
returns its normal report to the enclosing goal instead of treating that report
as the enclosing goal's completion. The enclosing goal owns any later repair,
stop, or already-authorized publication action and may summarize the review in
its own completion response.

## Review axes

### Standards

Determine whether the change follows relevant repository instructions,
documented coding standards, and established local design. Tool-enforced style,
formatting, types, and tests are settled by those tools rather than repeated as
model preferences.

When repository guidance is silent, a small bundled design-smell baseline may
surface high-signal concerns such as duplication, speculative generality,
shotgun surgery, muddled naming, primitive obsession, or misplaced behavior.
The repository always overrides the baseline, and each smell is a judgment
call rather than a hard violation by itself.

### Spec

Determine whether the change completely and correctly implements the
originating request. Look for missing or partial requirements, behavior outside
scope, and requirements that appear implemented but behave incorrectly. Each
finding must cite the relevant acceptance criterion or spec source.

When no spec or objective exists after reasonable local discovery, skip this
axis and report `not_available`. Do not invent requirements.

## Invariants

1. **CR-C1 — Intent mapping only.** The skill is model-invoked from explicit
   review intent. It MUST NOT require a router skill, external orchestrator, or
   another Darrow plugin.
2. **CR-C2 — Fixed point first.** Resolve and validate the base and target
   before starting reviewer agents. An invalid base or empty declared diff is
   reported before spending review-model budget.
3. **CR-C3 — Complete diff.** The review scope includes every declared staged,
   unstaged, and untracked target file. Reviewers inspect the diff itself, not a
   summary written by the change author.
4. **CR-C4 — Isolated axes.** Standards and Spec run as fresh, read-only
   subagents with separate bounded prompts so one axis does not anchor the
   other. When no spec exists, the Spec subagent is not spawned.
5. **CR-C5 — Parallel readers.** When both axes apply, invoke them in parallel.
   The aggregator may deduplicate and order findings but MUST NOT invent a
   finding neither reviewer reported.
6. **CR-C6 — Repository standards win.** The Standards reviewer reads the
   relevant repository guidance. Documented local decisions override any
   bundled smell heuristic.
7. **CR-C7 — Tools before taste.** Run or validate applicable deterministic
   gates. Suppress model findings that merely restate tool-enforced formatting,
   lint, type, or test results.
8. **CR-C8 — Traceable Spec findings.** Every blocking Spec finding cites the
   source requirement it violates. Unsupported assumptions and personal
   product preferences are excluded.
9. **CR-C9 — Structured findings.** Every finding identifies axis, severity,
   changed location or command, violated source, and concrete evidence.
   Findings remain concise and actionable.
10. **CR-C10 — Honest verdict.** `pass` requires every available axis and every
    applicable deterministic check to pass. Missing required evidence or a
    check that cannot run produces `blocked`, not `pass`.
11. **CR-C11 — Read-only operation.** The coordinator and reviewers MUST NOT
    edit product files or apply their own recommendations. Normal ignored test
    and build artifacts produced by checks are permitted.
12. **CR-C12 — Permission preservation.** Review does not authorize repair,
    commit, push, pull-request mutation, approval, merge, release, or deploy.
13. **CR-C13 — Composable return.** A standalone invocation returns the
    review report to its requester. A composed invocation returns the same
    findings and outcome to the current goal owner, which interprets them and
    applies its own pass, repair, stop, and publication contract without
    transferring those actions into the review capability.
14. **CR-C14 — Target-bound gate.** A passing result satisfies a selected
    review gate only for the exact reviewed target content. A later
    content-changing edit invalidates it; author self-review, a stale result,
    or a result for another fingerprint cannot substitute for a fresh
    independent review.

## Result shape

The exact serialization is an implementation detail, but output MUST be
machine-readable and include:

```text
base
target
changed_files
standards             # pass, fail, blocked; sources; findings
spec                  # pass, fail, blocked, not_available; source; findings
checks[]              # command, applicability, status, evidence
verdict
risks
next_action
```

## Packaging and portability

1. **CR-P1 — Independent plugin.** `darrow-review` is independently installable
   and MUST NOT reference files from sibling plugins or assume they are
   installed.
2. **CR-P2 — Marketplace format.** The plugin includes both
   `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`; the Codex
   manifest points at `./skills/`.
3. **CR-P3 — Model invocation.** The `code-review` description carries all
   triggering intent needed for Claude Code and Codex to select it without
   another skill.
4. **CR-P4 — Bounded context.** Each axis prompt contains the fixed diff
   command or manifest, its own source material, a strict finding schema, and a
   concise output budget. It MUST NOT receive the other reviewer's analysis or
   an unrelated conversation transcript.
5. **CR-P5 — Mechanics in scripts.** Fixed-point validation, diff-scope
   construction, and structured-result validation belong in bundled portable
   scripts. Review judgment remains in `SKILL.md` and small references.
6. **CR-P6 — Portable scripts.** Bundled shell mechanics follow Darrow's Bash
   3.2 and Bash 5 requirements, preserve pre-existing changes, and emit
   absolute model-facing paths where paths are needed.
7. **CR-P7 — Portable composition.** Consumers request independent code review
   by intent and interpret its reported findings and outcome; neither side needs
   a sibling plugin path, implementation name, output schema, tracker, or
   orchestrator-specific API.

## Evaluation requirements

1. **CR-E1 — Correct triggering.** Fresh-context cases trigger for explicit
   branch, PR, fixed-point, work-in-progress, and uncommitted-change review
   intent, but not merely because an agent has edited code.
2. **CR-E2 — Axis isolation.** Seeded changes independently fail Standards,
   Spec, both, and neither; findings remain on their assigned axes.
3. **CR-E3 — Scope coverage.** Evals cover committed, staged, unstaged, and
   untracked files, invalid bases, empty diffs, and merge-base branch review.
4. **CR-E4 — Traceability.** Blocking Spec findings cite the request, and
   Standards findings cite repository guidance or label a bundled smell as a
   heuristic.
5. **CR-E5 — Low-noise review.** Tool-enforced style is not duplicated, repo
   decisions override the smell baseline, and unsupported preferences do not
   fail a review.
6. **CR-E6 — Read-only safety.** Adversarial prompts cannot induce product
   edits, repair, commits, publication, or approval actions.
7. **CR-E7 — Cross-harness behavior.** The same review scope, axis, and result
   contracts are evaluated in fresh Claude Code and Codex contexts.
8. **CR-E8 — Value measurement.** Comparative evals record seeded-defect
   detection, false-positive rate, tokens, wall-clock time, and human review
   minutes against a single unstructured review agent.
9. **CR-E9 — Goal composition.** Evals prove that `pass` returns control to an
   enclosing goal, while `fail` and `blocked` stop completion and publication
   unless the enclosing goal has repair authority and reruns review.
10. **CR-E10 — Repair invalidation.** A composed goal that repairs a failed
    target reruns invalidated checks and independent review against a different
    target fingerprint before completion.
11. **CR-E11 — Same canonical capability.** Direct manual review and review
    requested from a larger goal exercise the same skill and finding semantics
    on Claude Code and Codex, without requiring the enclosing goal to reproduce
    the review's serialization.

## Non-goals

- Implementing, repairing, refactoring, or formatting the reviewed change.
- Choosing whether another goal or workflow requires review.
- Requiring an issue tracker or a particular spec-storage convention.
- Treating a bundled smell baseline as repository law.
- Reviewing the entire repository when the user requested a bounded diff.
- Publishing comments, approvals, or review status to a remote forge.
- Depending on a TDD plugin, orchestration plugin, Git workflow, or sibling
  capability.
