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
It does not depend on a delivery workflow, issue tracker, software factory, or
another Darrow plugin.

## Intent

Use code review when the user asks to review a branch, pull request,
work-in-progress diff, uncommitted changes, or changes since a named fixed
point.

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

## Non-goals

- Implementing, repairing, refactoring, or formatting the reviewed change.
- Acting as a required stage of another plugin's workflow.
- Requiring an issue tracker or a particular spec-storage convention.
- Treating a bundled smell baseline as repository law.
- Reviewing the entire repository when the user requested a bounded diff.
- Publishing comments, approvals, or review status to a remote forge.
- Depending on a TDD plugin, software factory, Git workflow, or sibling
  capability.
