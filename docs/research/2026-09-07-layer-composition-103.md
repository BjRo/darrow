# Layer composition — issue 103 evidence

Scope: readiness return semantics, behavioral capability compatibility,
authorized existing-PR publication and the thin ticket-to-PR outcome envelope.
Both Claude Code and Codex are supported. Automation remains future work.

## Request matrix recorded before skill revision

| Target        | Direct                              | Indirect                       | Incomplete                       | Negative                       | Pressure/counterexample                                                                                                    |
| ------------- | ----------------------------------- | ------------------------------ | -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Readiness     | Assess this request                 | Is this ready to implement?    | Assess the unavailable request   | Implement a settled edit       | A non-ready composed result must allow authorized resolution and same-owner continuation without implementing early        |
| Create PR     | Create a PR                         | Publish this branch for review | Publish with no committed branch | List open PRs                  | Existing URL with an older head cannot satisfy explicit publish-and-reuse authority; creation-only request must still stop |
| Adaptive goal | Explicit adaptive invocation        | Preserved recipe delegation    | Missing material acceptance      | Ordinary implementation        | Intent-compatible but evidence-incompatible publisher must not satisfy completion                                          |
| Ticket to PR  | Explicit shortcut plus exact ticket | Explicit shortcut plus URL     | Missing ticket                   | Ordinary ticket implementation | A differently named compatible capability must preserve the complete outcome and authority                                 |

Baseline inspection: `assess-implementation-readiness` section 5 explicitly
terminates its enclosing goal; `create-pr` reports `exists` before push; the
recipe requires a verified current-content PR but delegates no explicit commit
identity evidence. These are source observations, not invented live failures.

## Requirement audit

| Request                                          | Implementation and evidence                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibilities rather than mandatory stages    | `docs/design.md`, README and `docs/specs/layer-composition.md` define all five responsibilities, direct foundation/capability use and evaluation/observability alongside them.                                                                                                   |
| Durable foundation artifacts                     | The contracts explicitly preserve ordinary repository instructions, policy, decisions and skills after the producing plugin is removed.                                                                                                                                          |
| Complete recipes with one policy owner           | The recipe retains one outcome/permission delegation. Orchestration selects workflow and assurance; capabilities execute focused operations and return evidence. No recipe preflight, branch derivation, model selection or verification commands were added.                    |
| Explicit disposition of all four recommendations | The new layer specification adopts caller-owned continuation, behavioral compatibility and one policy owner, with reasons for preserving ordinary duplicate-PR refusal. It adopts future automation contract requirements while deferring implementation.                        |
| Readiness finding, resolution and continuation   | The readiness skill returns non-ready evidence to its caller. The two-turn case saves both complete assessments, proves configuration stayed unchanged until ready, accepts the human's choice and verifies the edit in the same host conversation without a replacement owner.  |
| Existing PR plus local commits                   | Explicit `publish-existing` pins the intended commit and verifies both remote and forge heads, shape and identity. Ordinary `create` retains duplicate-stop behavior. The composition fixture starts with an existing PR, then adds a local commit before ticket implementation. |
| Compatible replacement                           | The second recipe case mounts an independently implemented, differently named publisher in place of the builtin PR capability. It requires the same committed content, existing PR identity, publication evidence and authority boundaries.                                      |
| Future automation limits                         | Required contracts cover recurring authority, entry, admission/deduplication, capacity, human waiting and reconciliation. No scheduler, claim store, queue, ledger or runtime controller was implemented.                                                                        |

## Deterministic and structural validation

- Both `pr.test.sh` and the new `publication.test.sh` pass under the actual
  `/bin/bash` 3.2.57(1)-release interpreter. The version-aware helper reports
  Bash 5 unavailable and the complete matrix unverified (exit 3); this is not a
  Bash 5 pass.
- Publication tests cover intended-SHA mismatch, stale/malformed/unavailable
  forge evidence, PR count/shape/fork mismatch, remote divergence, push endpoint
  ambiguity, unwanted tags/refspec effects, dirty-work preservation, partial
  push effects and read-only verification. The initial absent command and a
  later stale-default regression were both observed failing before their fixes.
- All four skill inspectors and native Claude plugin validators pass. Marketplace
  validation passes with existing optional metadata warnings. Both manifest
  formats retain matching versions: Git 0.3.0, readiness 0.3.0, goal-loop 0.15.0
  and ticket-to-PR 0.3.1.
- The affected runner tests pass (92 tests); the complete runner suite also
  passes (331 tests across 30 files, 1,154 assertions). TypeScript, ESLint,
  shell lint, decision validation, primary-source formatting and diff whitespace
  checks pass. Invariant coverage recognizes LC-C1 through LC-C4.
- Repository-wide `bun run lint` encounters unrelated formatting failures in
  `.worktrees/fix/104-eval-runner-integrity/`. The equivalent formatting check
  restricted to this primary checkout's README, docs, plugins and runner passes.
  No other worktree was edited.
- Fixture-only Bash instrumentation observes successful execution of the real
  bundled publication entrypoint. A focused probe confirms direct push/forge
  commands produce no such evidence. Retained valid transcript checks pass;
  counterexamples omitting the publisher, omitting acceptance or adding parent
  work fail. Replacement execution has its own publication marker.

## Independent challenge and evidence limits

A fresh-context reviewer found two material gaps: trusting stale local
`origin/HEAD`, and allowing builtin composition to pass after only reading the
publisher skill. Remote `HEAD` observation plus a failing-then-passing regression
addresses the first. Fixture invocation evidence addresses the second. The
follow-up also caught an unsupported negative-check field; both cases now use
the runner's `not_regex`, with a counterexample proving it rejects parent work.
Final narrow verification confirmed both reviewer findings are addressed.

Current Codex native sessions encrypt the launch message. The runner now retains
one correlated spawn/start/acceptance receipt without inferring the private
agent role. It also observes parent tool work after that acceptance. These facts,
executed capability evidence and final artifacts establish this focused
composition behavior. They do not prove the complete inline goal contract or
selected/effective route equivalence; broader fidelity remains issue #102.

Codex supporting-skill activation can remain unknown when a long skill body is
truncated in the observable command stream. Composition cases report that
observation separately and gate the actual handoff, publication operation and
artifacts. They do not relabel incomplete activation as a pass.

## Live evidence

All live attempts use one trial and one job, run sequentially with failures
diagnosed before another case. A single passing trial is a behavioral example,
not a reliability estimate or comparison against a no-skill control. The runner
threshold is 80%; monetary cost is unavailable for Codex. All pushes target
temporary local bare repositories and all forge calls use isolated fixtures.
Raw model evidence stays under gitignored `evals/results/`.

The native hosts are Codex CLI 0.153.4 and Claude Code 2.1.223. Candidate routes
are `gpt-5.6-terra`/medium and `claude-sonnet-5`/medium respectively. Readiness's
semantic-output check uses the runner's `gpt-5.6-luna`/low grader; publication
criteria are deterministic state and transcript checks.

The first readiness attempt used invalid assertions about intermediate text in
a bounded transcript. The corrected case uses caller-owned audit artifacts and
passed on Codex. Initial recipe trials passed content checks but lacked positive
native acceptance and publisher execution evidence, so they are diagnostic
only. Subsequent acceptance-only failures exposed the encrypted-message evidence
limit. The final cases use role-neutral host receipts and fixture execution
evidence, without adding product runtime machinery.

The first Claude builtin trial passed publication and ownership checks but
failed two over-specific report assertions: its status was bold Markdown and
its commit ID was abbreviated. The final checks accept the observed formatting
and resolve a reported full or unique abbreviated ID to the expected Git
commit. Wrong and forged IDs, blocked status, URL-only output and missing
capability/acceptance evidence remain failing counterexamples.

The first Claude replacement trial exposed a product failure: publication
succeeded, but the final relay replaced the required PR URL with only its
number. The normative contract and recipe now explicitly preserve the full URL
and commit evidence during summarization, or report missing evidence without
claiming completion or reinspecting the forge. The URL-missing report continues
to fail the final assertions.

The corrected Claude replacement trial passes and preserves the complete URL.
Independent review found that repair consistent with the thin recipe and its
authority limits. Each requested composition outcome has a passing trial on
both native hosts. Earlier Codex successes already preserved the URL; the final
wording repair was exercised afresh on the host that omitted it. Passing results
remain bounded examples, with the Bash 5, Codex evidence and unrelated-worktree
formatting limitations above.

<!-- issue103-retained-results -->

### Retained executed trials

All rows have one executed trial at medium effort. Counts and timings are host-reported; these are not matched performance comparisons. Diagnostic passes do not satisfy the final composition criteria.

| Evidence use                                           | Case / host                                                       | Task | Time    | Tokens | Artifact                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ---- | ------- | ------ | --------------------------------------------------------------------------------------- |
| diagnostic: invalid readiness assertions               | readiness-caller-resolution-continuation / codex gpt-5.6-terra    | fail | 47.6 s  | 86389  | [JSON](../../evals/results/2026-09-07T15-44-30-194Z-codex-gpt-5.6-terra-medium.json)    |
| readiness behavior                                     | readiness-caller-resolution-continuation / codex gpt-5.6-terra    | pass | 84.6 s  | 140973 | [JSON](../../evals/results/2026-09-07T15-47-14-717Z-codex-gpt-5.6-terra-medium.json)    |
| diagnostic: weak composition checks                    | ticket-to-pr-composition-existing-pr / codex gpt-5.6-terra        | pass | 188.1 s | 298709 | [JSON](../../evals/results/2026-09-07T15-49-46-746Z-codex-gpt-5.6-terra-medium.json)    |
| diagnostic: weak composition checks                    | ticket-to-pr-composition-replacement / codex gpt-5.6-terra        | pass | 180.6 s | 300515 | [JSON](../../evals/results/2026-09-07T15-54-18-078Z-codex-gpt-5.6-terra-medium.json)    |
| diagnostic: missing accepted-owner evidence            | ticket-to-pr-composition-existing-pr / codex gpt-5.6-terra        | fail | 171.8 s | 333554 | [JSON](../../evals/results/2026-09-07T16-02-05-836Z-codex-gpt-5.6-terra-medium.json)    |
| diagnostic: encrypted contract unavailable             | ticket-to-pr-composition-existing-pr / codex gpt-5.6-terra        | fail | 163.0 s | 246564 | [JSON](../../evals/results/2026-09-07T16-10-18-452Z-codex-gpt-5.6-terra-medium.json)    |
| diagnostic: activation unknown; execution probe absent | ticket-to-pr-composition-existing-pr / codex gpt-5.6-terra        | pass | 158.0 s | 277822 | [JSON](../../evals/results/2026-09-07T16-17-46-705Z-codex-gpt-5.6-terra-medium.json)    |
| builtin composition                                    | ticket-to-pr-composition-existing-pr / codex gpt-5.6-terra        | pass | 217.5 s | 304657 | [JSON](../../evals/results/2026-09-07T16-21-29-234Z-codex-gpt-5.6-terra-medium.json)    |
| replacement composition                                | ticket-to-pr-composition-replacement / codex gpt-5.6-terra        | pass | 175.9 s | 270502 | [JSON](../../evals/results/2026-09-07T16-25-21-006Z-codex-gpt-5.6-terra-medium.json)    |
| readiness behavior                                     | readiness-caller-resolution-continuation / claude claude-sonnet-5 | pass | 85.1 s  | 709961 | [JSON](../../evals/results/2026-09-07T16-28-28-148Z-claude-claude-sonnet-5-medium.json) |
| diagnostic: report formatting and abbreviated ID       | ticket-to-pr-composition-existing-pr / claude claude-sonnet-5     | fail | 127.3 s | 790606 | [JSON](../../evals/results/2026-09-07T16-30-31-375Z-claude-claude-sonnet-5-medium.json) |
| product failure: relay omitted PR URL                  | ticket-to-pr-composition-replacement / claude claude-sonnet-5     | fail | 106.6 s | 601469 | [JSON](../../evals/results/2026-09-07T16-37-50-420Z-claude-claude-sonnet-5-medium.json) |
| supported-host validation                              | ticket-to-pr-composition-existing-pr / claude claude-sonnet-5     | pass | 100.4 s | 737579 | [JSON](../../evals/results/2026-09-07T16-35-17-482Z-claude-claude-sonnet-5-medium.json) |
| supported-host validation                              | ticket-to-pr-composition-replacement / claude claude-sonnet-5     | pass | 176.8 s | 827949 | [JSON](../../evals/results/2026-09-07T16-41-27-867Z-claude-claude-sonnet-5-medium.json) |
