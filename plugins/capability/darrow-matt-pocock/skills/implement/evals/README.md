# Implement recipe evidence

These cases exercise the approved package and host-request seams. The owning
recipe is a material Darrow adaptation; unchanged Matt workflows retain the
bundle's narrower upstream-maintenance assurance policy.

`missing-owner.yaml` installs only Matt and checks that missing Adaptive Goal
leaves the requested file and history unchanged. `approved-local.yaml` installs
Matt, Adaptive Goal, Git and pstack, with the existing fresh-reader Review
fixture contract. It checks the shell CLI result, a scoped local commit,
candidate-bound reader results and absence of publication. `missing-commit.yaml`
uses the same repository and Review fixture but omits Git. These cases do not
publish remotely; their remote is a disposable bare fixture repository.

The Review fixture is a public compatible provider, not the real Darrow Review
implementation. Its command validates the public behavior and current scope;
its declared workflow launches fresh Standards and Acceptance readers. Real
Review composition remains owned by the Adaptive Goal/Review suites. The tests
in `evals/domain/implement-recipe-fixture.test.ts` exercise canonical fixture
oracles through the existing installed Sevro CLI, including incorrect effects;
they do not simulate the recipe or establish native model behavior.

## Test-first observations — 2026-11-20

1. Red — `bun test ./evals/domain/matt-pocock-bundle.test.ts`: the independent
   package copy lacked the selected implement directory.
2. Green — `bun test ./evals/domain/matt-pocock-bundle.test.ts`: importing the
   complete pinned upstream directory and updating inventories passed.
3. Red — `bun eval --plugin darrow-matt-pocock --case implement-missing-owner --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-red -- --retain-host-diagnostics`:
   raw upstream implement changed and committed NOTES.md with no Adaptive Goal
   provider. Task failed; explicit activation passed. Retained attempt
   `70fb4f79-07ea-40a1-8bdf-0cf1b202cad6`, run
   `8ed71187-be76-4b04-a161-b5a47c51137a`.
4. Green — `bun eval --plugin darrow-matt-pocock --case implement-missing-owner --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-red -- --retain-host-diagnostics`:
   the owner-handoff adaptation refused the missing provider and left content
   and history unchanged. Task and activation passed. Retained attempt
   `27f6a670-6eff-4800-8f76-5720417a21ff`, run
   `e2e5378a-7c5c-48b5-b61b-e9b1da8c9c00`.

The local-composition characterization then passed on Codex, attempt
`4a1ba2ae-0e5e-44b3-9bca-d90bbaa83eb1`, run
`e7fcdf13-45d4-41a7-a43f-67a05d79c623`, under
`/tmp/darrow-implement-333-local`. Native evidence recorded one main-thread
active-to-complete goal and two fresh `gpt-6.1-sol/xhigh` review readers with no
nested spawns. The transcript recorded selected Matt TDD and pstack instructions
and the real Git commit helper. All public result, review-target, local-commit,
no-publication, native-goal and activation checks passed. This was a passing
characterization, not an additional red/green claim.

An incorrect pstack fixture path initially failed before host execution; it was
classified and corrected as a fixture ENOENT. An earlier temporary fixture
construction syntax error started no trial. Neither is red evidence.

All native observations use installed `@bjoernrochel/sevro@1.1.2`, passive mode,
one trial, one job and threshold one. Candidate and semantic routes remain
independent. Evidence roots contain `selection-run.json` and immutable attempt
manifests pointing to raw run and trial files. Private native transcripts and
workspace data remain outside Git. One passing trial is no reliability estimate.

5. Red — `bun eval --plugin darrow-matt-pocock --case implement-missing-commit --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-missing-commit -- --retain-host-diagnostics`:
   the owner-handoff-only recipe implemented and committed through ordinary Git
   with no installed commit provider. Task failed; activation passed. Attempt
   `cd991cd3-1475-490e-b6af-949856c0a065`, run
   `4070fef9-3a80-450c-93ed-90d1f6db7adc`.
6. Green — `bun eval --plugin darrow-matt-pocock --case implement-missing-commit --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-missing-commit -- --retain-host-diagnostics`:
   required public bindings stopped implementation and reported the unavailable
   Git capability without changing content or history. Task and activation
   passed. Attempt `b2a33b86-20f0-4fb8-afe9-379610e3cb30`, run
   `0dcd8ef1-4095-48f7-9d70-317229bf499d`. The response also reported Review
   unavailable; this refusal case does not establish successful Review discovery.

## Final-candidate checks and fixture limits

The completed recipe also passed the full Codex local outcome at
`/tmp/darrow-implement-333-final-codex`, attempt
`ba6695ce-0389-4cc2-bcd9-41f647facc9b`, run
`7b843bd8-1c56-4633-b3f6-f39ed5429ab4`. Its native record contains one main-thread
active-to-complete goal and two fresh `gpt-6.1-sol/xhigh` review readers. That
prompt still mentioned the default commit. The current prompt omits a commit
request so the recipe must supply that default. It retains the standard leading
native invocation for the explicit-only skill.

The first Claude preparation stopped with `fixture repository skill host mirror
is missing`, before model execution (attempt
`93a06686-ec05-4851-b0d9-2e9827e23edb`). Adding the `.claude/skills` mirror fixed
preparation. A temporary YAML anchor typo during that edit started no host turn.
The public prepare protocol now has a focused both-host regression check.

The next Claude trial activated implement but correctly refused to mutate when
the fixture Review provider was absent from its native catalog (attempt
`6375ddc7-5b78-4469-8a0c-58e7cb11b675`, run
`5ff4b07b-5cbf-4ad8-b415-7d4a73fd7eca`). Its full-task checks failed because no
implementation, review or commit occurred; the no-publication check passed.
The fixture now explicitly supplies the provider's per-host public instruction
path in AGENTS.md, reachable through CLAUDE.md, following the existing file-backed
capability fixture pattern. This is supplied-provider composition, not proof of
automatic catalog discovery or real Darrow Review behavior. No recipe, runner or
runtime profile was changed to bypass the refusal. Parent migration assurance
owns actual Darrow Review provider runs and full-spec acceptance.

An embedded-in-sentence invocation experiment on Claude did not enter implement
(attempt `d94d64f1-7032-424f-a727-90b2a3c732a3`, run
`ad520e9b-1cb2-474f-8c86-c31102d7f888`). It used constituent skills, changed the
files and reported review, but left them uncommitted and created no native goal;
activation was unavailable and the full outcome failed. The fixture restored the
standard leading native invocation. This is invalid-invocation evidence, not a
successful recipe trial or permission to relax explicit-only metadata.

The standard leading Claude invocation reached read-only preparation and bound
TDD, principles-first, Git and the supplied Review contract, but stopped because
its session exposed neither `ProposeGoal`/`ToolSearch` nor an existing matching
native goal. Attempt `0101e086-0cb6-4b00-8be4-97b8f6f8d7b3`, run
`f929c30b-5b7c-4f5f-ab96-74674ea37e2e`, remains a failed full-outcome trial with
activation unavailable and no edits. The actual response requested the native
`/goal` launch required by Adaptive Goal's Claude guide. This is a concrete host
capability gap, not evidence of successful Claude implementation. Do not replace
it with a custom goal controller, simulated activation or raw-tool delivery.
That one-turn condition supplied no successful Claude delivery coverage. The
declared native-kickoff condition below tests the documented client route. The
source recipe was not changed to bypass this stop.

## Final supported-entry observations

The final one-turn Codex case is scoped to Codex. Its prompt does not request a
commit; the recipe supplies that default. The final Claude case declares the
existing `follow_up_prompt` facility: first the leading implement invocation,
then the fixed user `/goal` command carrying the already-approved objective in
the same session. It preserves the same repository fixture, readiness, seam,
provider bindings and no-publication boundary. This is an actual user kickoff,
not synthetic runner continuation or a new execution controller.

| Condition                         | Task / activation          | Retained attempt and run                                                        |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| Final Codex default-local outcome | Passed / passed            | `0ff7ab8b-f082-401d-a9ee-6fc586ff3f32` / `5fa23edd-c391-4774-9f10-ac4f9123836c` |
| Claude declared native kickoff    | Not assessed / unavailable | `c8a4c90c-9a46-408c-956a-73a921f18b2b` / `10e6bc84-7295-443e-b6b3-c2b3a476698c` |

Commands, run sequentially from the worktree root:

```sh
bun eval --plugin darrow-matt-pocock --case implement-approved-local --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-final-default-codex -- --retain-host-diagnostics
bun eval --plugin darrow-matt-pocock --case implement-approved-local-claude --harness claude --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-implement-333-claude-native-follow-up -- --retain-host-diagnostics
```

Codex used 0.171.0, app-server and `gpt-6-luna/medium`; Claude used 2.1.328 and
`claude-sonnet-5-5/medium`. The independently selected semantic route was Codex
`gpt-6-luna/high`; no advisory grader was selected. Candidate durations were
224.5 seconds and 322.2 seconds respectively. These are retained single-trial
observations, not performance or reliability comparisons.

Codex passed public behavior, exact commit scope, both review-target receipts,
no publication, native-goal and activation checks. The source recipe in the
final runs has SHA-256
`193c2c92622fe5bcc2095d0bc4f9663340878fe42d1dbb371169302aa2789ee1`.

Claude's native goal observation establishes one main-thread goal in session
`23fcd7a4-b3cc-4c0d-a925-07011fc3ae54`, active at 17:55:38 UTC and complete at
17:59:53 UTC. The response reported local commit `ac09e51`, passing tests and
fresh Opus/high readers. Native controls recorded two Agent calls. However,
Sevro returned `sevro.host.failed` with `Claude host execution did not complete`,
set execution to failed, skipped grading and left task not assessed. Both native
subprocesses exited zero; retained diagnostics truncate their stdout and provide
no more specific failure cause. Native completion does not turn this into a
passed task. The response also admitted running the fixture review protocol as
coordinator, contrary to the supplied provider contract. That deviation remains
visible; the case's review/effect checks were not graded. No further host variant
was attempted. Successful task grading and actual Darrow Review assurance remain
parent-owned work.

## Local gates and remaining coverage

The final focused command passed 16 tests and 195 assertions:

```sh
bun test ./evals/domain/implement-recipe-fixture.test.ts ./evals/domain/matt-pocock-bundle.test.ts ./evals/domain/matt-pocock-bundle-mount.test.ts ./evals/domain/case-resolution.test.ts
```

TypeScript checking, scoped ESLint and Prettier passed. Fourteen local Markdown
link targets exist. Both `bun run check:docs` and `bun run check:docs:external`
stop at the known missing retired Ticket Pipeline marketplace directory, pending
#340; neither gate was bypassed. No Python or standalone shell source changed.

The fixture checks do not establish real Review's complete behavior, publication,
CI, every possible new-seam question, an inherited no-commit request, or reuse of
an already-active outer delivery goal. Those are separate claims. The native
Claude follow-up does establish same-session user kickoff of the prepared recipe,
while its task outcome remains unassessed. Historical one-turn Claude diagnostics
predate the final host scoping; their immutable attempt manifests retain the exact
conditions. The package, mount, activation, task and native-goal observations must
remain separate.
