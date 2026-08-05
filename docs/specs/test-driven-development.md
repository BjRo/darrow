# Capability: Test-Driven Development

Darrow should provide a compact, model-invoked test-driven-development
capability for implementing behavior changes and bug fixes through a tight
red-to-green loop. It is an engineering discipline, not a workflow orchestrator
or an autonomous delivery system.

Plugin: `darrow-tdd`  
Skills: `tdd`

## Why

Models already understand the mechanics of test-driven development. The useful
skill surface is the smaller set of decisions that determines whether the tests
are worth keeping: where to observe behavior, what constitutes an independent
oracle, how to prove the red result, and how to avoid horizontal test batches.

Keeping this as an independently installable, model-invoked capability lets any
compatible agent apply it when the user's intent calls for TDD. No factory,
planner, or sibling plugin must know whether it is installed.

## Intent

Use TDD when the user asks for test-first implementation, red/green development,
integration-style tests, or a behavior change or bug fix that should be driven
through a durable test seam.

Do not trigger merely because a task happens to contain tests. Reviewing tests,
repairing test infrastructure, adding fixture data, and running an existing
suite are different intents unless the user also asks for test-driven
implementation.

## Contract

Input:

- an observable behavior or reproducible bug;
- an independent expected result from the request, spec, example, or fixture;
- a pre-agreed public seam;
- the smallest scoped test command and applicable final repository checks.

Output:

- the implemented behavior in vertical slices;
- red evidence showing that each new test first failed for the intended missing
  behavior;
- green evidence showing that the minimal implementation passed the test;
- final lint, typecheck, and test results when applicable;
- any missing seam, oracle, or test infrastructure that prevented honest TDD.

The skill edits only within the user's requested implementation scope. It does
not commit, push, publish, or broaden the task merely to make TDD possible.

## Shared model

### Seam

A seam is a public boundary where behavior can be observed without reaching
inside the implementation. It can be an API, command, UI interaction, event,
file format, or other stable interface.

A seam is pre-agreed when it is named by the user or accepted spec, already
documented as the component's public interface, or accepted in a user-approved
plan. When the task would create or materially redefine the seam, the agent
must obtain that decision before writing tests or product code.

### Slice

A slice is one behavior exercised through one seam by one focused test and the
smallest implementation that makes it pass. Several slices may build one
feature, but each cycle incorporates what the preceding cycle revealed.

## Invariants

1. **TDD-C1 — Intent mapping only.** The skill is model-invoked from the task's
   TDD intent. It MUST NOT require a router skill, external orchestrator, or
   another Darrow plugin.
2. **TDD-C2 — Public behavior.** Tests exercise behavior through the pre-agreed
   seam. They MUST NOT bind to private methods, internal call sequences, or
   unrelated side channels merely because those are easier to assert.
3. **TDD-C3 — Independent oracle.** Expected values come from the request,
   spec, a worked example, a known-good fixture, or another independent source.
   A test whose assertion recomputes the implementation's algorithm is not
   valid evidence.
4. **TDD-C4 — Red before green.** Each slice begins with a focused test that
   fails for the intended missing behavior. Syntax errors, broken fixtures,
   unavailable dependencies, and unrelated existing failures do not count as
   a red result.
5. **TDD-C5 — Minimal green.** Write only enough implementation to satisfy the
   current slice. Avoid speculative behavior and abstractions for imagined
   future tests.
6. **TDD-C6 — Vertical slices.** Work one slice at a time. The skill MUST NOT
   write a horizontal batch of imagined tests followed by a separate batch of
   implementation.
7. **TDD-C7 — Durable tests.** A behavioral refactor that preserves the public
   contract SHOULD leave the test unchanged. A test that breaks only because
   private structure moved is evidence of implementation coupling.
8. **TDD-C8 — Boundary doubles.** Prefer real code paths and
   integration-style tests. Use mocks or fakes only for external, slow,
   nondeterministic, or destructive boundaries, and never to replace the
   behavior under test.
9. **TDD-C9 — Tight feedback.** During the loop, run the smallest command that
   proves the current slice. Once implementation is complete, run every
   applicable final lint, typecheck, and test gate for the changed scope.
10. **TDD-C10 — Honest applicability.** When no durable seam, independent
    oracle, or viable test harness exists, report that limitation. The skill
    MUST NOT invent a low-value internal test or bootstrap broad infrastructure
    outside the accepted scope to simulate TDD compliance.
11. **TDD-C11 — Refactoring boundary.** Refactoring is not a mandatory third
    action in each red/green cycle. Perform cleanup after green only when
    supported by concrete design evidence, then rerun the affected tests and
    final gates.
12. **TDD-C12 — Evidence over narration.** Report the test command and the
    relevant red and green outcomes. Do not replace observable results with a
    claim that the loop was followed.

## Packaging and portability

1. **TDD-P1 — Independent plugin.** `darrow-tdd` is independently installable
   and MUST NOT reference files from sibling plugins or assume they are
   installed.
2. **TDD-P2 — Marketplace format.** The plugin includes both
   `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`; the Codex
   manifest points at `./skills/`.
3. **TDD-P3 — Model invocation.** The `tdd` description carries all triggering
   intent needed for Claude Code and Codex to select it without another skill.
4. **TDD-P4 — Reference-sized instructions.** `SKILL.md` contains only the
   durable red/green, seam, slice, and oracle discipline. Detailed examples and
   mocking guidance MAY live in directly linked references loaded on demand.
5. **TDD-P5 — No unnecessary mechanics.** The plugin SHOULD contain no runtime
   script unless evals demonstrate a repeated deterministic check that models
   perform unreliably.

## Evaluation requirements

1. **TDD-E1 — Correct triggering.** Fresh-context cases trigger for explicit
   test-first, red/green, integration-test, behavior-change, and bug-fix intent,
   while avoiding review-only and test-maintenance-only requests.
2. **TDD-E2 — Meaningful red.** Seeded cases distinguish a failure caused by
   missing behavior from syntax, fixture, environment, and unrelated failures.
3. **TDD-E3 — Test quality.** Cases reject implementation-coupled,
   tautological, over-mocked, and side-channel tests while accepting behavior
   observed through a stable public seam.
4. **TDD-E4 — Vertical progress.** Multi-behavior tasks proceed as successive
   red/green slices instead of all tests followed by all implementation.
5. **TDD-E5 — Scope restraint.** Missing test infrastructure or an ambiguous
   new seam produces an honest decision or limitation rather than unauthorized
   framework work.
6. **TDD-E6 — Cross-harness behavior.** The same intent and evidence contract
   is evaluated in fresh Claude Code and Codex contexts.
7. **TDD-E7 — Value measurement.** Comparative evals record escaped defects,
   test mutation sensitivity or equivalent defect detection, total tokens, and
   wall-clock time against direct implementation without the skill.

## Non-goals

- Orchestrating planning, review, repair, commits, pull requests, or delivery.
- Requiring TDD for prose, formatting, generated output, infrastructure-only,
  or purely mechanical changes.
- Testing every internal function or maximizing line coverage as an end in
  itself.
- Replacing repository-specific test conventions or established public seams.
- Depending on a software factory, review plugin, issue tracker, or sibling
  capability.
