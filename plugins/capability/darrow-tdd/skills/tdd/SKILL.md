---
name: tdd
description: Implement observable behavior changes and reproducible bug fixes test-first through successive red/green slices at a stable public seam. Use when asked for TDD, test-first or red/green development, implementation through an integration/integration-style test, or a behavior change driven by durable regression coverage. Do not use for test review, fixture maintenance, test-infrastructure repair, or merely running a suite unless product implementation is also requested.
---

# Develop test-first

Implement only the requested behavior through observed vertical red/green
slices. Do not commit, push, publish, or bootstrap unrelated test
infrastructure.

## Working model

- **Seam:** a user/spec/approved-plan or documented public API, command, UI,
  event, or file-format boundary where consumers observe behavior. An
  importable internal export is not automatically public.
- **Oracle:** an expected value from the request, spec, worked example, or
  known-good fixture—not the production algorithm repeated in the assertion.
- **Slice:** one behavior, one focused test through the seam, and the smallest
  product change that makes it pass.
- **Meaningful red:** the new test is present, product behavior is still
  unchanged, and the focused command fails specifically because that behavior
  is missing.
- **Green:** the same literal command passes after the in-scope product change.

## Workflow

### 1. Bind an honest contract

Before editing, identify the observable behavior, independent expected result,
pre-agreed public seam, smallest command for one slice, and applicable final
lint/type/test gates.

A seam is pre-agreed only when the user or accepted spec names it, existing
documentation exposes it to consumers, or an approved plan accepts it. If the
task would create or materially redefine a seam—or offers incompatible
unaccepted seams—present the concrete options and ask the user to choose. Stop
before every test, product, or harness edit.

If no durable seam, independent oracle, or viable existing harness exists,
report the exact limitation. Do not substitute a private-method test,
tautological assertion, side-channel check, or broad new framework merely to
claim TDD.

For a request that only evaluates candidate tests, select and explain the
durable test without editing. For fixture maintenance, test review,
test-infrastructure repair, or suite execution without product implementation,
leave this workflow and follow the literal request.

**Complete when:** seam, oracle, first behavior, focused command, and final
gates are concrete and authorized—or work has stopped before edits with the
smallest missing decision/limitation.

### 2. Choose a durable test

Exercise the real public seam and assert its public effect. The test should
survive an implementation refactor that preserves the contract.

- Do not target private methods, internal call order, source text, incidental
  structure, or logs used only as a side channel.
- Prefer an integration-style real path. Replace only external, slow,
  nondeterministic, or destructive collaborators with a mock/fake; never
  replace the behavior under test.
- Keep the oracle independent. A test that recomputes the proposed algorithm
  can agree with the same defect and is not evidence.

**Complete when:** one focused test expresses one accepted example through the
public seam without coupling to its implementation or mocking the subject.

### 3. Complete one red/green slice

Treat every later behavior as out of scope until the current slice is green:

1. Write only the current focused test.
2. Run the smallest literal command that exercises it while product code is
   unchanged.
3. Confirm the failure names the intended missing behavior. Syntax errors,
   broken fixtures, unavailable tools/dependencies, environment failures, and
   unrelated existing failures are not red evidence. Fix an in-scope mistake
   in the new test or narrow the command; otherwise stop and report the
   blocker without changing product code or unrelated harness state.
4. Record `Red — <literal command>: <relevant missing-behavior failure>`.
5. Write only enough product code for this slice; add neither behavior nor
   abstraction required only by an imagined later test.
6. Rerun the same literal command and require it to pass.
7. Record `Green — <same literal command>: <passing result>`.

Only after step 7 may another behavior's test or implementation begin. Do not
batch future tests before implementation. Refactor after green only when the
now-working code supplies concrete cleanup evidence, then rerun the affected
test before continuing.

An unrelated pre-existing failure does not become the slice's red. Preserve it,
use a focused command when available, and report it separately in final gates.

**Complete when:** the trace proves test-first red with unchanged product code,
minimal implementation, and green from the identical command—or the slice has
stopped honestly before implementation because valid red was impossible.

### 4. Finish with observed evidence

After all authorized slices are green, run every applicable final lint,
typecheck, and test gate for the changed scope. Do not alter unrelated failing
tests to manufacture a clean suite.

Report each slice's literal `Red — ...` and `Green — ...` lines in order, then
the final gates and any pre-existing failure or seam/oracle/harness limitation.
Never claim an unobserved red or green, and never replace the command with
“focused command,” “same command,” or another shorthand.

**Complete when:** requested behavior and durable tests exist, every slice has
literal observed red/green evidence, and all final gate results—including
honest failures—are reported.
