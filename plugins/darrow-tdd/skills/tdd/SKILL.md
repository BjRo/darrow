---
name: tdd
description: Implement observable behavior changes and reproducible bug fixes test-first through a tight red/green loop at a stable public seam. Use when the user asks for TDD, test-first or red/green development, asks to implement through an integration or integration-style test, or asks that a behavior change or bug fix be driven through a durable test seam. Do not use for test review, fixture maintenance, test-infrastructure repair, or merely running an existing suite unless implementation is also requested.
---

# tdd

Implement the requested behavior as successive vertical red/green slices. Stay
inside the requested scope; do not commit, push, publish, or add unrelated test
infrastructure.

## Establish the contract

Before editing, identify:

- the observable behavior and an expected result independent of the code;
- the public seam that exposes it;
- the smallest test command for one slice;
- the final lint, typecheck, and test gates that apply to the changed scope.

A seam is pre-agreed only when the user or accepted spec names it, existing
documentation exposes it, or an approved plan accepts it. If the change would
create or materially redefine the public seam, ask the user to choose before
writing a test or product code.

A language-level export is not public merely because other code can import it;
repository contracts or documentation must expose it to consumers. When
multiple incompatible seams are only proposed and none is accepted, stop before
all edits—even if an internal function could temporarily host the behavior.

Expected values must come from the request, a specification, a worked example,
or a known-good fixture. Do not derive an assertion by repeating the production
algorithm. If no durable seam, independent oracle, or viable harness exists,
state the limitation instead of inventing an internal test or bootstrapping a
broad framework.

## Run one slice

Repeat this loop for one behavior at a time:

Treat every later behavior as out of scope until the current slice is green.
Before that green result, do not write a later test or implement behavior that
only a later test requires.

1. Write one focused test through the public seam. Prefer a real code path.
2. Run the smallest command that exercises that test.
3. Confirm that it fails because the requested behavior is missing. A syntax
   error, broken fixture, unavailable dependency, or unrelated existing failure
   is not red evidence. Repair an in-scope test mistake or isolate the focused
   test; otherwise report the blocker.
4. Write only enough product code to pass this slice. Do not add speculative
   behavior or abstractions for imagined later tests.
5. Rerun the same command and confirm green before starting another test.

Do not write a batch of future tests and then a batch of implementation. Let
each completed slice inform the next. Refactor after green only when the code
provides concrete design evidence for cleanup, then rerun the affected test.

## Keep tests durable

- Assert public effects, not private methods, internal call order, source text,
  logs used only as side channels, or incidental structure.
- Prefer integration-style tests and real collaborators. Replace only external,
  slow, nondeterministic, or destructive boundaries with a mock or fake; never
  mock the behavior under test.
- Keep a test unchanged when an implementation refactor preserves the public
  contract. If moving private code breaks it, the test is coupled too tightly.

## Finish with evidence

Run every applicable final lint, typecheck, and test gate for the changed scope.
Report:

- each slice as `Red — <command>: <relevant failure>` followed by
  `Green — <same command>: <passing result>`;
- final gate results, including unrelated or pre-existing failures;
- any seam, oracle, or harness limitation that prevented honest TDD.

Do not claim a red/green result that was not observed.
Copy the literal command into both evidence lines; do not replace it with
“focused command,” “same command,” or another shorthand.
The final response is incomplete without these literal Red and Green lines,
even when the user did not explicitly ask for test evidence.
