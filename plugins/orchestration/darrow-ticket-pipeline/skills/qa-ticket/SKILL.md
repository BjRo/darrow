---
name: qa-ticket
description: Independently verify every ticket acceptance criterion and applicable final-tree gate without repairing product or test code. Use only when explicitly invoked by deliver-ticket for the QA phase or when the user supplies a complete QA-phase packet.
---

# Verify ticket acceptance

Produce independent final-tree evidence for the ticket's observable contract.
Review approval and earlier command reports are context, not proof.

## Working model

- **Criterion oracle:** the expected observable result comes from the ticket,
  accepted specification, or approved worked example—not from repeating the
  implementation or trusting its test assertion.
- **Independent evidence:** observe the real public seam with the smallest
  reproducible setup and command that can prove or disprove one criterion.
- **Final-tree gate:** every applicable lint, typecheck, test, build, and
  task-specific command required by repository guidance, manifests, CI, or the
  approved plan, run after the last writer finished.

## Workflow

### 1. Bind the current contract and tree

Read the packet's current ticket-body snapshot, latest approved refine and
challenge artifacts, implementation/rework artifacts, latest approved review,
applicable repository guidance and accepted decisions, and current final diff.
Derive the exact acceptance criteria and discover all final-tree gates from
current sources rather than inheriting an earlier phase's list blindly.

Remain read-only for tracked and untracked product/test files, repository
guidance, the index, and the tracker. Run checks in their normal supported mode;
prefer temporary output outside the repository. Normal ignored cache/build
artifacts created by an applicable gate are permitted, but do not edit inputs,
fixtures, expectations, or configuration to make a check pass.

**Complete when:** every criterion has an independent oracle and public seam,
every gate is accounted for, the tested tree is identified, and required
sources are either readable or explicitly unavailable.

### 2. Verify each criterion independently

For every acceptance criterion, record:

1. the setup and relevant final-tree state;
2. the literal action or command;
3. the exact independent assertion;
4. the observed value, exit status, or other result;
5. `pass`, `fail`, `blocked`, or `needs_human`.

Exercise the real user-facing/public boundary. Do not replace the behavior under
test with a mock, infer a pass from source inspection when execution is
required, reuse review approval as evidence, or accept an incidental log or
side effect in place of the stated outcome. Browser, service, device, or other
external checks run only when the ticket requires them, the environment is
available, and the authorized interaction is non-destructive.

**Complete when:** every criterion has observed evidence from the current tree,
or its exact unavailable environment/manual observation is recorded without a
fabricated result.

### 3. Run all final-tree gates

Run every discovered gate with its literal command and record the exit status
and concise relevant output. Do not weaken a command, narrow away a required
failure, install an unapproved dependency, or label an unrun command passed.

On QA iteration 2, first inspect the prior QA failure and QA-fix rework artifact,
then rerun the exact failed observation to test the repair. Regardless of that
result, rerun the full criterion set and all applicable gates; a repair
invalidates the earlier QA evidence.

**Complete when:** each applicable gate has a current observed result and every
iteration-2 claim is based on the post-fix tree rather than the earlier run.

### 4. Derive and write the verdict

Choose the status in this order:

1. `blocked` when a required tool, configuration, service, or environment is
   unavailable and prevents a complete verdict;
2. `needs_human` when a required non-destructive manual observation remains and
   the ticket does not explicitly accept it as later follow-up;
3. `failed` when current evidence reproducibly disproves any criterion or an
   applicable gate fails;
4. `passed` only when every criterion and applicable gate passes on the latest
   tree.

A known failure is still recorded when another missing proof makes the overall
status `blocked`. Do not repair product code, tests, fixtures, or configuration;
the controller owns any bounded QA-fix route.

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

Include:

- `### Acceptance evidence` — one setup/action/assertion/result/status record
  per criterion;
- `### Gates` — every literal command, status, and concise observed result;
- `### Failure evidence` — reproducible mismatches and unavailable evidence, or
  `None`;
- `### Remaining risks` — residual uncertainty or `None observed`.

**Complete when:** the artifact validates against the shared contract, its
status follows the precedence above, repository and tracker inputs remain
unchanged, and the response reports the absolute artifact path without
claiming repair or publication.
