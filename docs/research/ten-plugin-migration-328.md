# Ten-plugin migration acceptance evidence

The source cutover integrates the twelve migration slices under
[#328](https://github.com/BjRo/darrow/issues/328). This record separates source and
package checks from native host observations. Parent-local duplicate removal is
complete. Final independent assessment, publication and exact-head CI remain
pending at this worker handoff. It does not claim migration completion or all-green host
behavior.

## Candidate and assurance scope

The #340 worker starts from `960735ce94c5a4cbc86a220aebfb5d4018c4446b`, after the
prerequisite slices and integration fixes. Paired package versions are Matt
`0.2.3`, pstack `0.1.1`, Git `0.10.2`, Readiness `0.3.11`, Review `0.11.30`,
Adaptive Goal `0.30.2`, Ticket-to-PR `0.8.1`, Artificer `0.5.3`, Explanation `0.1.6` and Information Architecture `0.3.1`. The marketplace oracle reads
both host manifests for every exact selected identity.

The owner approved three seams: packaged plugin contents, actual host requests
and observable results, and repository cutover. Deterministic public package,
prepare, installer, selector and documentation checks cover source changes here.
Native observations below were run by preceding slices and the parent, not rerun
by this worker. Unchanged upstream behavior relies on upstream maintenance;
there is no per-skill behavioral suite or reliability claim from single trials.

Matt's raw source pin is `abeeaf95660ba9e8b7c753eb38f441ca707a8823`; pstack's unslop
pin is `aaeb0ea3a0584995aa8f55ce44c6c5259414b896`. Acquisition uses
`npx --yes skills@1.9.0`. The current Darrow principle source is
`de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`, with no established exact upstream
revision. Two actual fresh acquisitions at `/tmp/darrow-curated-329-live` and
`/tmp/darrow-curated-329-live-repeat` produced identical selected byte inventories;
this is separate from disposable network-substitute tests and native execution.
The [acquisition contract](../specs/curated-upstream.md), package provenance and
raw hash inventories retain these distinctions.

## Parent acceptance accounting

Numbers follow the sixteen acceptance criteria in #328. Source/test presence is
not final acceptance; the parent independently reconciles the evidence and gaps.

| Criterion                                                   | Source and evidence                                                                                                                                         | Limit or remaining action                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Exact ten identities, versions and entrypoints           | Marketplace plus `replaced-workflows-retirement.test.ts`; paired versions and exact names pass                                                              | Publication and installed user state are separate                                             |
| 2. Matt selection and closure                               | Complete 17-skill oracle, raw inventory/local-difference hashes and both-host public prepare copies                                                         | No duplicate code-review, pr or implement-spec; upstream behavioral QA excluded               |
| 3. Pstack selection and routing                             | Complete 27-skill oracle; 26 preserved bodies and default table hashes; catalog/native-discovery/personal-state tests                                       | No benchmark/TypeScript helper; Luna routing violation retained below                         |
| 4. Pinned repeatable acquisition and differences            | Public acquisition tests and repeated real imports; full source/tool/required-file/selection records                                                        | Demand-driven updates; no scheduled promise; adaptation lineage limit explicit                |
| 5. MIT notices and BUSL boundary                            | Both native filtered copies retain full notices/provenance; root LICENSE/CONTRIBUTING and each bundle agree                                                 | Git borrowed-source notices retained; unrelated material not relicensed                       |
| 6. One implement owner, agreed seams, publication authority | [Implement contract](../specs/implement.md), [composition/authority evidence](../../plugins/capability/darrow-matt-pocock/skills/implement/evals/README.md) | Qualified Claude guidance condition differs from failed original prompt                       |
| 7. AG acceptance/gaps and independent Review                | [AG contract](../specs/adaptive-goal.md), criterion-gap/history/publication fixtures, actual AG→Review observations                                         | Code review alone is insufficient; Claude Skill-tool activation FAILED                        |
| 8. Ticket-to-PR publication and green CI                    | [Recipe contract](../specs/ticket-to-pr.md), exact fixture PR-head/green-CI observations on both hosts                                                      | Supplied-provider composition is distinct from real Review and real remote CI                 |
| 9. PR presentation, Explanation and IA                      | [Git contract](../specs/git-workflow.md), template/default PR cases; preserved Explanation/IA entrypoints                                                   | Claude motivation semantic grade FAILED; final Spec reconciliation pending                    |
| 10. Artificer compatibility and host exception              | [Artificer contract](../specs/artificer.md), both-adapter public CLI preflight red→green and 307-test canonical package gate from #335                      | Claude native completion unavailable → needs-attention; no new unattended service/model claim |
| 11. Eight payload retirements after replacement readiness   | Three retirement test files; no maintained payload/public entrypoints; replacement package/composition tests                                                | Ignored caches are user state, not active plugins                                             |
| 12. Live tooling retained, obsolete machinery removed       | Surviving Sevro, Review/AG fixtures, Python inventory/selector/CI; Pipeline cells and Decisions validator removed                                           | 608-test parent gate passed before later fixture/classifier changes; current refresh pending  |
| 13. Current docs, history and ADRs                          | Current catalog/guide/spec indexes, archive mappings and general docs checks                                                                                | Historical report bytes preserved; existing narrow ADR notes only                             |
| 14. Consumer migration                                      | [Replacement map and upgrade procedure](../migrating-to-ten-plugins.md)                                                                                     | Host uninstall/reinstall and fresh sessions are explicit user actions                         |
| 15. Local duplicates and personal/custom preservation       | Parent verified and removed seven duplicate Matt directories, five matching Claude links and seven lock entries                                             | Completed after bundle verification; originals backed up and protected state unchanged        |
| 16. Scoped evidence with honest limits                      | Package/entrypoint and adapted-workflow evidence below; failed/unavailable observations retained                                                            | Final independent acceptance remains pending; no statistical reliability claim                |

## Twelve slice acceptance criteria

The criterion ranges below cover every checklist item in each captured ticket.
They track evidence and temporal sequencing, not independent release authority.

| Ticket and criterion numbers                           | Implemented responsibility and evidence                                                                                                                                                                                                 | Limit or handoff                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [#329](https://github.com/BjRo/darrow/issues/329), 1–4 | Pinned installer reuse; source/tool/selection/required files/difference boundary; full notices and provenance gap; disposable public acquisition tests and repeated imports                                                             | Does not establish native execution                                                                         |
| [#330](https://github.com/BjRo/darrow/issues/330), 1–6 | Selected non-implement closure, host calls/configured tracker/setup/labels/authority, explicit activation and human seams, independent Review intent, package and entrypoint evidence; implement was withheld until #333                | Final bundle now has 17 skills; Matt setup Claude activation unavailable, separate domain entrypoint passed |
| [#331](https://github.com/BjRo/darrow/issues/331), 1–5 | Exact current principle bodies/IDs, omitted helpers, precedence/relative custom files/metadata, authorized routing, package and actual host cases                                                                                       | Luna premature reads violate routing despite task grade; owner-route pass is a distinct trial               |
| [#332](https://github.com/BjRo/darrow/issues/332), 1–5 | Acceptance/gaps/history/repair accounting in native main thread; independent Review public binding; updated lifecycle/route/evidence fixtures; real provider runs without Verification; old provider retained until consumer transition | Claude successful final canonical protocol does not erase its failed Skill-tool measurement                 |
| [#333](https://github.com/BjRo/darrow/issues/333), 1–5 | Approved intent/inherited seams, public bindings/missing-provider stops, local-commit default, recorded implement adaptation, both-host composition/authority controls                                                                  | Original Claude delivery failure and qualified pass remain separate                                         |
| [#334](https://github.com/BjRo/darrow/issues/334), 1–6 | Default headings/template precedence, useful representations/evidence limits, merge risk, full borrowed notices, independent Git authority and native PR fixtures                                                                       | Claude semantic motivation failure retained for independent reconciliation                                  |
| [#335](https://github.com/BjRo/darrow/issues/335), 1–5 | Recipe delegates shared implement/AG work; duplicate implementation and Verification requirements removed; publication/CI preserved; Artificer changes limited to compatibility; both-host adapters and recipe outcomes                 | Artificer Claude completion exception remains; fixture PR/CI is not real service delivery                   |
| [#336](https://github.com/BjRo/darrow/issues/336), 1–5 | Surviving consumer inventory, native tracker/provider effects, ordinary ADR/writing guidance, updated checks before retirement, untouched user configuration                                                                            | Readiness Claude activation unavailable; Codex branch-task failure retained below                           |
| [#337](https://github.com/BjRo/darrow/issues/337), 1–6 | Pipeline payload/exclusive cells removed; original reports/source preserved; narrow authority notes; live benchmark helpers and surviving CI kept; retirement tests; marketplace cutover deferred to #340                               | Historical commands target pinned source, not current runnable Pipeline                                     |
| [#338](https://github.com/BjRo/darrow/issues/338), 1–5 | Discovery/TDD/Principles/Verification payloads removed; replacements tested; useful tests transferred; obsolete suites/CI/backends removed; shared assessment helpers preserved                                                         | Archived Verification README is byte-identical; no cache deletion                                           |
| [#339](https://github.com/BjRo/darrow/issues/339), 1–6 | Tickets/Decisions/Skill Authoring removed; no validator dependency; live Sevro retained; ordinary ADR/catalog maintenance and narrow notes; retirement checks; coordinated marketplace transition                                       | No aliases or hidden backends; unaffected ADR bytes retained                                                |
| [#340](https://github.com/BjRo/darrow/issues/340), 1–7 | Exact marketplace, package/check seams, current guidance/license/installer/selector, explicit migration, archive preservation                                                                                                           | Criterion 5 cleanup complete; criterion 7 publication and final current gates/assessment pending            |

## Native observations and conditions

All listed trials use installed Sevro `1.1.2`, passive execution, one trial/job
and threshold 1. Codex is `0.171.0`; Claude Code is `2.1.328`. Semantic grading,
where present, uses the separate Codex `gpt-6-luna/high` route. A task result,
activation observation, native completion and publication result establish
different claims. Raw transcripts/private artifacts remain outside Git.

### Bundles and routing

The [Matt entrypoint record](../../plugins/capability/darrow-matt-pocock/skills/setup-matt-pocock-skills/evals/README.md)
contains exact commands and run IDs. Codex setup at `gpt-6-luna/medium` passed task
and explicit dispatch. Claude setup at `claude-sonnet-5-5/medium` passed task but
activation was unavailable; separate ordinary domain-modeling passed task and
native Skill activation. #340 adds only seven `text` fence labels, records exact
local hashes and leaves raw upstream inventories unchanged. No behavioral rerun
is inferred from those formatting edits.

| Pstack condition           | Candidate route            | Task / activation                                   | Run ID                                 |
| -------------------------- | -------------------------- | --------------------------------------------------- | -------------------------------------- |
| Codex unslop               | gpt-6-luna / medium        | PASS / PASS                                         | `46a2eed0-a261-4632-bb66-2926e01d0550` |
| Claude unslop              | claude-sonnet-5-5 / medium | PASS / UNAVAILABLE                                  | `132108a3-2e20-4e5a-934a-bb7b1a47295b` |
| Codex personal route       | gpt-6-luna / medium        | Grader PASS / UNAVAILABLE, actual routing violation | `f0987a70-ce16-4420-814c-6131a6acfae2` |
| Claude personal route      | claude-sonnet-5-5 / medium | PASS / PASS                                         | `2a8394b1-c569-401c-8448-599cfc45984a` |
| Codex decline route        | gpt-6-luna / medium        | Original semantic FAILED / UNAVAILABLE              | `5606ad7e-d5a3-48d1-a930-8867727e88f1` |
| Claude decline route       | claude-sonnet-5-5 / medium | PASS / PASS                                         | `bdc9ef6e-0d1e-4a08-844c-203dfb7e72ba` |
| Codex owner personal route | gpt-6.1-sol / high         | PASS / PASS, correct executed reads                 | `3b7518c9-6c06-47b8-b48c-783ca0651c0a` |

The Luna personal trial read an unselected leaf before resolving routing and
returned a lower-precedence repository table. That is a real violation despite
its task grade. The owner-route pass neither repairs nor generalizes that result.
The decline fixture's extra demand to repeat an already established route ID was
corrected; durable state passed, but corrected semantic regrading is unmeasured.
No pstack principle, router, setup body or default-table byte changed.

### Implementation, delivery and actual Review

The [implement evidence record](../../plugins/capability/darrow-matt-pocock/skills/implement/evals/README.md)
retains literal delivery/negative commands, earlier failures and fixture repairs.
Codex unbound Ticket-to-PR→implement→AG at `gpt-6.1-sol/medium` passed task,
activation, two-reader effects, exact fixture PR head and required CI in run
`500d6d66-cf72-4153-83bf-24e92a481200`. The original Claude prompt failed after
skipping repository provider guidance. The distinct condition explicitly asks
reading CLAUDE.md and AGENTS.md before binding providers, without implement
co-invocation or an installed path. At Sonnet 5.5/medium it passed task, native
goal, exact fixture PR head and CI in run `e1c17c80-7814-4034-8856-6af71e89d405`;
activation remains UNAVAILABLE and the outer command exits 1. Four ordinary-
request/unauthorized-parent controls passed task and activation across both hosts.

The earlier direct implement Claude foreground-reader correction separately
passed task/native completion and strict two-reader local-commit effects in run
`ebe9d8d6-bf6e-4fc2-8b21-33049b799c4f`, attempt
`b50ac5fc-d9e6-4a54-9f65-a614f2ff9fc2`; activation remains UNAVAILABLE. It is not a
publication or real-Review trial.

Actual AG→Darrow Review Codex used `gpt-6.1-sol/medium`, run
`5715b3bd-a1ca-4de6-9e60-727e83117164`. Canonical/current-worktree/native-goal/hook
checks passed. Positive body exposure supports bounded activation only; aggregate
collection/order remain qualified or unknown.

Actual AG→Review Claude used `sonnet/medium`, run
`ddebf714-6d35-4884-84f3-f6e3eaefb723`. The corrected private-state fixture passed
all seven shell checks, canonical report, current fingerprint and native-goal
completion. The final exact prepared two foreground namespaced Opus 5.5/xhigh
readers returned JSON saved unchanged; real route-confirmation and finalize
accepted the canonical result. The first handwritten-axes/wrong-artifact scope
was invalid and superseded, never retroactively validated. An earlier fixture
mode-755 failure is separate from the corrected mode-700 setup. Review activation
FAILED under the complete Skill-tool collector because its contract was read
through Bash. Valid provider completion does not turn that measurement into PASS.

### PR presentation and native consumer controls

Current default PR presentation at `gpt-6.1-sol/medium` passed task, activation
and all six checks on Codex, run `8371612b-3fc1-4c79-a893-46f6173c2ddc`.
Claude `sonnet/medium`, run `e6bf62f9-2682-4413-8f2c-1ed537fc43a8`, passed all three
shell checks (including headings), activation and evidence/risk semantic checks.
TASK remains FAILED solely on the motivation semantic grade. Its Summary says
the client rejected the first network failure and now retries with backoff before
exhaustion; Evidence contrasts first-rejection failure with third-attempt success.
The producer considers the motivation grade a false negative; final independent
Spec reconciliation is pending. No assertion weakening or retry relabels it.
The original Codex template case passed; repository templates remain authoritative.
The final parent PR has not yet been published.

Native consumer evidence from #336 includes Codex readiness and branch-discovery
PASS/PASS, Claude readiness task PASS/activation UNAVAILABLE, and Claude branch
creation PASS/PASS. Codex create-branch-native-tracker reports task FAILED with
activation PASS. All four branch state checks passed; the compound semantic
check failed because the response omitted a full commit ID. The distinct Codex
branch-discovery trial passed task/activation and full-ID reporting; it does not
relabel the creation-task failure. No source correction or unchanged retry was run. AG native-tracker
preflight passed on Codex. Claude initially could not prepare the legacy Codex-only
no-agent check; the existing common native-control check was corrected and the
actual Claude preflight then passed, run `c415d655-6c23-4218-82dc-0d7f83e4dfca`.
These are focused provider/authority observations, not full tracker CRUD coverage.

## Source cutover checks

Recorded red/green commands use public accepted seams:

- `bun test ./evals/domain/replaced-workflows-retirement.test.ts`: red showed
  eight old entries and two missing bundles; green exact-ten/paired entrypoints.
- `bash scripts/install-all-plugins.test.sh`: red showed two hidden Pipeline
  exclusions in supplied manifests; green installs every supplied entry while
  preserving dynamic inventory, scopes, remote download and failure handling.
  Final fixtures use generic names; the retired identity-specific fixture rows
  and exemptions are removed.
- `bash scripts/test-python-quality-changes`: red skipped a Matt path; green
  selects complete Matt/pstack paths for the installed-pin gate.
- `bun test ./evals/domain/matt-pocock-bundle-mount.test.ts`: red showed Matt's
  unreachable license link and missing pstack full notices. Green checks complete
  filtered notices/provenance on both hosts. A later Claude case-selector mismatch
  was a fixture error, corrected to its declared host case, not a behavioral red.
- `bun test ./scripts/check-docs.test.ts -t 'accepts only exact frozen'`: red
  rejected the exact frozen historical target; green accepts its immutable map.
  Full checker tests also reject changed hashes, wrong URLs, unknown links and
  current broken links. The former stale-marketplace ENOENT was not this red.

The final scoped package/retirement/acquisition/case-resolution/checker command
passed **119 tests, 943 assertions**. It checks every supported skill/support and contained reference file
in both prepared host copies, with exactly 17 Matt and 27 pstack entrypoints:

```sh
bun test --timeout 120000 ./evals/domain/curated-inputs.test.ts ./evals/domain/matt-pocock-bundle.test.ts ./evals/domain/matt-pocock-bundle-mount.test.ts ./evals/domain/pstack-package.test.ts ./evals/domain/principles-catalog.test.ts ./evals/domain/principles-native-discovery.test.ts ./evals/domain/principles-personal-state.test.ts ./evals/domain/replaced-workflows-retirement.test.ts ./evals/domain/provider-retirement.test.ts ./evals/domain/ticket-pipeline-retirement.test.ts ./evals/domain/case-resolution.test.ts ./scripts/check-docs.test.ts
```

`CURATED_TEST_SHELL=/bin/bash bun test ./evals/domain/curated-inputs.test.ts`
passed 2 tests and 59 assertions. `bun run check:docs` passed with ten plugins;
`bun run typecheck` and scoped ESLint/Prettier passed. Both `bash` and `/bin/bash`
passed the installer, Python selector, Python inventory, guide setup fixture and
changed-script shell checks. These are deterministic results, not native model
trials. The guide fixture excludes this acceptance record while retaining the
public archive source mappings.

`bun run check:python` passed all five surviving backends: Git 196 tests
(98.54% lines / 95.86% branches), Information Architecture 181 (99.70% / 98.38%),
Review 504 passed and one skipped (98.33% / 96.07%), Adaptive Goal 411
(98.22% / 97.03%), and Artificer 307 (98.52% / 95.74%).

The guide now qualifies Claude support by documented workflow evidence and retains
primary Codex development. Both hosts are required targets for curated bundles
and revised shared workflows, with Artificer's exception and unverified-operation
limits. Its existing Darrow-owned disclosure adapter rejects the former blanket
best-effort statement; complete final-response evidence is still required.
`bun test --timeout 120000 evals/integration/extension.test.ts -t 'guide disclosure uses retained response evidence through Sevro'`
failed on the new valid response before the change, then passed (1 test,
16 assertions). The complete `bun test --timeout 120000 evals/integration/extension.test.ts`
run also passed (18 tests, 192 assertions). All maintained guide expectations were inspected: only foundations
and rationale change question-specific acceptance; the other positive cases share
the support qualification without changes to task or no-effects checks.

The parent's first current Codex guide trial, `guide-rationale`, run
`ca4ce9c0-e22c-46a2-a9ae-e91ee8e34bb4`, retains **TASK FAILED** and activation
PASS. All four no-effects shell checks, the dedicated host-aware disclosure check
and nearby-evidence output check passed. The semantic grader incorrectly demanded
a Claude disclosure on Codex and called current main-thread goal ownership with
bounded delegation superseded. It also rejected retirement wording even though
the answer said Pipeline was no longer an executable runtime or benchmark and
that the maintained execution surface was removed while history remained.

The retained response and governing retirement/ownership contracts support a
fixture correction: the rationale proposition now states current facts directly,
accepts equivalent retirement wording, and leaves host disclosure to its existing
dedicated check. No product/guide body, no-effects check or prior verdict changed.
Public regrading of the retained trial is unavailable; no regraded result is
claimed. This is a correction to an ambiguous expectation, not an override of
the failed semantic verdict. The subsequent fresh trial is recorded below.

The second Codex `guide-rationale` trial,
`bfd14d71-9e13-40a4-9b27-fd2935e7ad67`, also retains **TASK FAILED**, with
activation and all shell, disclosure and output checks PASS. Its answer correctly
explained runtime ownership and retirement but reported a missing linked historical
report. Inspection confirmed a fixture defect: the retirement contract was copied,
but its linked `2026-08-07-n1.md` and `.json` snapshots were absent.

The setup fixture now copies and tracks exactly those two historical files from
`evals/experiments/orchestration/snapshots/`, preserving their bytes. It does not
copy the experiments tree, executable Pipeline or current acceptance ledger.
`bash .agents/skills/darrow-guide/evals/fixtures/setup.test.sh` and the same command
through `/bin/bash` first failed with both missing snapshot paths, then passed
with exact source-byte, tracked-file and two-file inventory assertions. Existing
no-effects checks and the rationale proposition remain unchanged by this fix.
At that fixture-fix handoff, no fresh native result was available; foundations
and Claude had not run when the parent stopped the second condition.

After the snapshot fix, the parent ran these single-trial conditions. Prior
failed trials above remain unchanged:

| Host and question | Run                                    | Task   | Activation and deterministic checks |
| ----------------- | -------------------------------------- | ------ | ----------------------------------- |
| Codex rationale   | `f3aaea7b-ffea-40ac-99f2-0e4ba2e564ab` | PASS   | PASS                                |
| Codex foundations | `4ef0a367-2e94-494a-99f3-a388f067a777` | FAILED | PASS                                |
| Claude rationale  | `da7c6dce-9c43-4124-a7a6-41cef40775a8` | FAILED | PASS                                |

The foundations grader correctly found that the response did not explicitly say
repository standards govern skill writing. It did identify Information Architecture,
Matt's domain-modeling and writing-for-agents, ordinary decision documents, and
intent/explicit activation. The question asks which plugins help and how skills
are selected, rather than asking for the skill-maintenance process. A citation to
the replacement documentation does not satisfy the old explicit-prose expectation;
the failed verdict remains valid against that declared expectation.

The Claude rationale grader required bounded-delegation wording after the answer
mentioned main-thread goal ownership. The answer did not discuss delegating work
and accurately described the host runtime, Pipeline retirement and preserved history.
The natural question does not request an ownership-policy recital. Both failures
therefore support correcting question-level expectations, not rewriting product
instructions or declaring the old verdicts passed.

One combined correction narrows the two propositions to the questions actually
asked, following [eval-development guidance](../eval-development.md#case-contracts):
rationale requires the host-runtime explanation and Pipeline retirement/history;
foundations requires the plugin-to-purpose mapping and intent/explicit activation.
It removes mandatory adjacent-policy recitals and exhaustive operation lists.
Retired providers and a second Darrow execution controller remain wrong answers.
Prompts, Guide bodies, runtime adapter, disclosure, output and no-effects checks
are unchanged. The source contracts still require repository standards during
skill maintenance and bounded delegation during orchestration.

These are **ungraded oracle-review examples**, not regraded results or new trials:

- The observed Claude rationale's host-runtime and retirement explanation is a
  valid answer to the question without a separate delegation-policy recital.
  A claim that Pipeline remains an installable executable benchmark, or that
  Darrow runs its own second controller, is a plausible wrong answer.
- The observed Codex foundations mapping and activation explanation answers the
  question without repeating the repository's authoring process. Recommending
  the retired Decisions or Skill Authoring plugins, or saying complexity alone
  authorizes orchestration, is a plausible wrong answer.

Public semantic regrading is unavailable; the old results were not regraded.
The parent ran fresh conditions after integrating the combined correction:

| Host and question            | Run                                    | Task / activation |
| ---------------------------- | -------------------------------------- | ----------------- |
| Codex rationale              | `54b80b4b-88cb-406e-a962-140dda83668a` | PASS / PASS       |
| Claude rationale             | `ecbd8ab0-e7d4-4f63-afdf-edf9e9c28312` | PASS / PASS       |
| Codex foundations            | `0d4a77ed-2bc8-4e41-b0f4-d06d1afda13b` | PASS / PASS       |
| Claude Sonnet foundations    | `f515aefe-9d22-4172-8c1e-4eaaac90ee94` | FAILED / PASS     |
| Claude Opus/high foundations | `11e5e65c-44b6-4530-ab31-c1e2d3c1b8d4` | FAILED / PASS     |

Both Claude foundations failures retain their original grades. No-effects checks
passed. Inspection established a concrete fixture source gap: plugin READMEs and
manifests were copied without public skill folders, and Matt's README does not
name writing-for-agents. Opus accurately reported missing source; the semantic
grader treated that read-only observation as environment diagnosis. This is not
a reason to change the product or tune the semantic proposition again.

The existing setup now copies public skills and contained references/support,
excluding evals, hidden grading and caches. The public setup test failed on the
missing writing-for-agents source, then passed under both `bash` and `/bin/bash`,
comparing source bytes and the complete tracked public-file inventory. Its first
expanded inventory incorrectly included non-public `plugins/fixtures` sources;
that test-only scope error was corrected, not counted as another behavioral red.
Current acceptance ledgers remain excluded; no plugins are installed by copying
these read-only sources.

The disclosure classifier also rejected ordinary qualifiers: Opus said support
covers only what documents show and development is mainly with Codex; Sonnet
combined workflow-evidence-only and scoped Claude support in adjacent sentences.
Two public extension/Sevro red-to-green slices add only those bounded forms.
Regressions reject missing or negated development-host qualification, unrestricted
support, unrelated evidence and separated/non-adjacent sentences. Complete,
unique, host-bound final-response requirements remain unchanged. Prompts, Guide
bodies, semantic propositions and the generic runner are unchanged by these fixes.
No fresh native pass after this source/classifier repair is claimed here.

Before these fixes, at `3cb079aeeef6124085c24fbe91785e265b00de1e`, the parent
observed the frozen `bun run test:evals` gate pass 608 tests / 6,280 assertions
and all 14 current quality checks pass. The canonical `bun run check:python`
passed 1,599 tests with one skip across five backends. It ran at `fa365de0`;
`final-python-current-scope.json` proves all five backend and Python gate inputs
have identical Git objects at `3cb079a`. The retained logs are
`final-evals-fixed.log`, `final-current-quality-results.json`, and
`final-python.log` under the private migration evidence directory. These are
candidate-bound results, not passes for later changed adapter/fixture inputs.

The parent owns the current frozen-suite refresh, affected native reruns,
independent assessment, push/draft PR and exact-head CI. Further failures remain
reported evidence; no additional assertion-tuning loop is authorized.

## Preservation and remaining acceptance

The [archive index](retired-workflows.md) and [exact mapping](retired-links.json)
cover five frozen reports and 25 missing relative targets. All target blobs were
read at immutable `de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89` and hashed; no report
observation was rewritten. The moved Verification report retains SHA-256
`badfc3127d7a9dfb67eb46b6ff886a75d40062f58b706fed9761e3ff3563cc28`.
Compared with the #338 preservation manifest, 103 artifacts remain hash-identical;
only the research and ADR navigation indexes change, and no artifact is missing.
Existing ADR supersession notes from prior slices remain; this cutover edits no ADR. The catalog now links those already-recorded partial
supersessions without changing status or relationships.

The parent preservation snapshot and comparison remain private under
`/tmp/darrow-migration-328.1TiGCl/`. After bundle verification, the parent rechecked
every target against the original snapshot and pinned source, backed up originals
in `local-duplicates-backup/`, and removed only seven duplicate directories
(20 files), five unchanged Claude links and seven matching lock entries. The
lock contained only those entries and its version, so the empty artifact was
removed. The first five directories matched raw imports; to-spec/to-tickets
differed only by the exact full pinned MIT notice. `local-duplicates-cleanup.json`
records the completed cleanup; `verify-preservation.py` passed at `3cb079a`,
verifying all 26 backed-up files/links, nine original scratch files, and protected
history/routing state. No unrelated local content was removed.
The main effective table is the worktree `.darrow/principles.md`, SHA-256
`082e5aa18509ef705c215a86f433e5cb2d2eef470df1d82ff7852891e0676087`;
the personal table is absent. No personal table is created, no unlisted custom
directory is scanned, and `.scratch`, custom state and unrelated installs remain.

No installed-plugin changes, push, publication, ticket mutation or final acceptance
occurs in this worker. Existing external-link network failures (LinkedIn 403 and
historical Sevro 503) remain separate from local checks; no external-check pass
is claimed.

## Literal retained commands

Matt entrypoint/delivery/authority commands are recorded in the linked colocated
evidence READMEs above. These are the executed pstack commands from its producer
handoff, one trial each (including failures and unavailable observations):

```sh
bun eval --harness codex --owner-evaluation passive --plugin darrow-pstack --skill unslop --case pstack-unslop-explicit-entrypoint --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-unslop-codex.json
bun eval --harness claude --owner-evaluation passive --plugin darrow-pstack --skill unslop --case pstack-unslop-explicit-entrypoint --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-unslop-claude.json
bun eval --harness codex --owner-evaluation passive --plugin darrow-pstack --skill principles-first --case pstack-principles-first-matrix-personal-relative --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-personal-codex.json
bun eval --harness claude --owner-evaluation passive --plugin darrow-pstack --skill principles-first --case pstack-principles-first-matrix-personal-relative --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-personal-claude.json
bun eval --harness codex --owner-evaluation passive --plugin darrow-pstack --skill setup-principles --case pstack-setup-principles-matrix-decline-new-default --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-decline-codex.json -- --runtime-config-file "$PWD/plugins/capability/darrow-pstack/skills/setup-principles/evals/fixtures/runtime-principles-personal.json"
bun eval --harness claude --owner-evaluation passive --plugin darrow-pstack --skill setup-principles --case pstack-setup-principles-matrix-decline-new-default --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-decline-claude.json -- --runtime-config-file "$PWD/plugins/capability/darrow-pstack/skills/setup-principles/evals/fixtures/runtime-principles-personal.json"
bun eval --harness codex --model gpt-6.1-sol --effort high --owner-evaluation passive --plugin darrow-pstack --skill principles-first --case pstack-principles-first-matrix-personal-relative --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-pstack-331-results --output /tmp/darrow-pstack-331-personal-owner-codex.json
```

The actual real-Review commands below are taken from the first lines of the
parent logs. Codex ran from the main checkout; the corrected Claude fixture ran
from `fix/333-recipe-delegation`, with the same integrated AG/Review bodies.

```sh
bun evals/runner/run.ts --plugin darrow-adaptive-goal --skill adaptive-goal --case goal-preflight-high-risk-routine --harness codex --owner-evaluation passive --model "gpt-6.1-sol" --effort medium --trials "1" --jobs "1" --threshold "1" --results-root "/tmp/darrow-migration-328.1TiGCl/real-review-codex" -- --runtime-config-file /Users/bjro/Sources/darrow/evals/sevro-extension/runtime-review-artifacts.json --retain-host-diagnostics
bun evals/runner/run.ts --plugin darrow-adaptive-goal --skill adaptive-goal --case goal-preflight-high-risk-routine-claude --harness claude --owner-evaluation passive --model sonnet --effort medium --trials "1" --jobs "1" --threshold "1" --results-root "/tmp/darrow-migration-328.1TiGCl/real-review-claude-private-state" -- --runtime-config-file "/Users/bjro/Sources/darrow/.worktrees/fix/333-recipe-delegation/evals/sevro-extension/runtime-review-artifacts.json" --retain-host-diagnostics
```

The Git heading producer returned these literal commands. Current runs used
`fix/334-pr-section-headings`, source `45ed7d5f715010ca1d855297748536740b70bbff`
(integrated as `960735ce`). The failed Claude verdict remains unchanged.

```sh
# Retained red (parent main checkout)
bun eval --plugin darrow-git --skill create-pr --case create-pr-body-context-ticket --harness claude --owner-evaluation passive --model sonnet --effort medium --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-migration-328.1TiGCl/pr-evidence-claude -- --retain-host-diagnostics

# Current Claude
bun eval --plugin darrow-git --skill create-pr --case create-pr-body-context-ticket --harness claude --owner-evaluation passive --model sonnet --effort medium --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-334-heading-claude -- --retain-host-diagnostics

# Current Codex
bun eval --plugin darrow-git --skill create-pr --case create-pr-body-context-ticket --harness codex --owner-evaluation passive --model gpt-6.1-sol --effort medium --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-334-heading-codex -- --retain-host-diagnostics
```
