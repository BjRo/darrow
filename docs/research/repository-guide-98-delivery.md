# Repository guide delivery evidence — issue 98

This is a maintainer record, not current product policy. The contract is
[Repository guide](../specs/repository-guide.md); the versioned question
inventory is [inventory.json](../../.agents/skills/darrow-guide/evals/inventory.json).

## Reviewable stages

1. Contract, question inventory, and native repository-skill eval discovery.
2. Cross-host entrypoints, guide behavior, adversarial cases, and observed trials.
3. Documentation hub and the complete static user route.
4. Plugin README batches with paired manifest version increments.
5. Deterministic documentation checks, separate external checks, review rubric.
6. Narrative contraction after cross-host evidence, final gates, fresh-clone
   walkthrough, independent review, and one pull request.

All stages are in scope. Passing a subset does not complete issue 98. At the
initial checkpoint, no existing narrative had been removed. The ledger below
records later gated removals. Licensing prose remains unchanged.

## Baseline

The starting checkout was clean on `main`; work uses
`feat/98-repository-darrow-guide`. The guide and `.agents/` directory were absent.
The runner selected plugin-colocated and skill-less experiment cases only.
Both installed native CLIs are available: Codex 0.154.0 and Claude Code 2.1.223.
No pre-existing guide was available for a baseline. The forward trials below
are not evidence of improvement over an unmounted control.

## Evidence and migration ledger

Each listed question has a native Codex and Claude result in the named
directory under `evals/results/guide-v1/`, with filenames
`<question-id>-<host>.json`. These are single fresh trials per host, not a
stability estimate. Candidate routes are Codex `gpt-5.6-terra` / medium and
Claude `claude-sonnet-5` / medium; semantic grading uses Codex
`gpt-5.6-luna` / low. Task and activation both passed for these gates.

### Before the first contraction

| Question             | Passing cross-host directory | Surviving static route                           |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| `guide-orientation`  | `2026-09-11T13-27-54-466Z`   | `docs/README.md`, `docs/getting-started.md`      |
| `guide-layers`       | `2026-09-11T13-35-28-016Z`   | `docs/choosing-plugins.md#understand-the-layers` |
| `guide-selection`    | `2026-09-11T13-35-28-016Z`   | `docs/choosing-plugins.md`                       |
| `guide-installation` | `2026-09-11T13-40-24-195Z`   | `docs/installing-plugins.md`                     |
| `guide-rationale`    | `2026-09-11T13-54-49-131Z`   | `docs/design.md`                                 |

The first contraction replaces the unheaded introduction, `Why Darrow`,
`See it in action`, and `Get started` with concise positioning, guide access,
and the first-workflow/installation routes. It preserves `#why-darrow`,
`#see-it-in-action`, and `#get-started` as useful destinations. The first two
sections map to `guide-orientation`; the last maps to `guide-installation`.
Local documentation validation passed before this removal. Licensing prose,
the diagram, and all remaining deeper sections are untouched at this stage.

### Before the second contraction

The remaining migration gates passed with the calibrated Terra/medium grader:

| Question             | Passing cross-host directory | Surviving static route                                             |
| -------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `guide-contributing` | `2026-09-11T15-07-34-284Z`   | `CONTRIBUTING.md`, `docs/acknowledgements.md`, `docs/README.md`    |
| `guide-foundations`  | `2026-09-11T15-07-34-284Z`   | `plugins/foundation/README.md`                                     |
| `guide-recipes`      | `2026-09-11T15-16-44-751Z`   | `plugins/task-recipe/README.md`, `docs/specs/layer-composition.md` |

Together with the earlier gates, these cover the second contraction:

- `The five layers` and `How Darrow works`: `guide-layers`, with the full
  equivalent diagram description in `docs/choosing-plugins.md` and normative
  detail in `docs/specs/layer-composition.md`.
- `Plugin catalog` and `Capabilities`: `guide-selection`, with the complete
  intent-first catalog in `docs/choosing-plugins.md`.
- `Foundations`: `guide-foundations`, with its category navigation and local
  plugin READMEs.
- `Orchestration`: `guide-rationale`, with `docs/design.md` and local READMEs.
- `Task recipes` and `Automation`: `guide-recipes`, with the category page,
  layer specification, and clearly marked planned names in the selection guide.
- `Status and compatibility`: `guide-installation`, with the canonical host
  procedures and verification limits in `docs/installing-plugins.md`.
- `Repository reference`, `Development`, and `Standing on the shoulders of
giants`: `guide-contributing`, with the contributor guide, documentation hub,
  specs/decisions/research indices, and acknowledgements page.

The second contraction preserves every old heading anchor as a useful route.
Category READMEs were expanded into navigation, not deleted. No normative,
accepted-decision, plugin safety, or unique troubleshooting content is removed.
The license remains the final section, byte-for-byte unchanged; its SHA-256 is
`c7fd5834d3c8b12a15be3ad048804750d9a1ff21ed5b2e183a2937599c809059`.
Local documentation validation passed immediately before this removal.

The full post-contraction live suite, fresh-clone walkthroughs, independent
review, and final publication checks are still pending.

The resulting root README is 125 lines; its pre-license content has 301
whitespace-delimited words including HTML/navigation markup. All prior heading
destinations and the unchanged license checksum passed explicit checks.

## Iterative verification and failure ownership

All live guide cases ran sequentially, stopping on the first failure. The
retained results separate task outcome from activation. Invalid expectations
were corrected where they demanded information the question did not ask for,
rejected a relevant source path, confused showing commands with executing them,
or required a verbal read-only claim despite observed unchanged state. Retained
valid responses and counterexamples were regraded before fresh trials for the
installation, incomplete-context, and visual-output rubric changes.

Observed product corrections addressed overlong overviews, incomplete-context
clarification, missing Claude support disclosure in refusals, and optional
visual capability availability/fallback behavior. A diagnostic candidate with
an exact marker confirmed that explicit Codex invocation receives the candidate
body (`evals/results/guide-body-binding-probe.json`); its expected task failure
is not guide acceptance evidence.

Runner regression tests found and fixed hidden-directory discovery, repository
explicit-token rendering, Claude's native project-command expansion observation,
and an omitted repository-mount flag. The latter test places nearby synthetic
plugin metadata and mechanics and verifies that neither host mounts them.
The new native Claude observer retains only a bounded receipt, not command/body
contents. Malformed, duplicate, wrong-session, partial, and reordered expansion
tests are included.

Current deterministic evidence includes 448 passing Bun tests (47 files),
passing type/ESLint/format/shell/ADR/documentation gates, and both valid guide
inspections. All 44 guide/host dry preparations completed in
`evals/results/guide-v1/2026-09-11T13-52-03-985Z`. Dry runs are not behavioral
passes. Final gates will be rerun after the remaining work and independent review.

The fixture shell matrix passed on `/bin/bash` 3.2.57; Bash 5 was unavailable
and remains unverified. No plugin runtime executable was changed.

External checking ran separately against 78 URLs. Unauthenticated GitHub 404s
for this private repository were triaged against authenticated visibility;
new branch-only documentation is also not yet on `main`. One stale historical
EveryInc path was replaced with the project's live canonical repository URL.
Network/authentication results are not included in the local gate pass claim.
The external rerun after repairing the EveryInc link reported only seven
unauthenticated URLs in this private repository.

Visual fallback review also found a reversed recipe/orchestration delegation
arrow. The guide now checks arrow labels against sources, and the fallback
case tests that concrete relationship. Regrading accepted the retained correct
Codex diagram and rejected the reversed Claude diagram, independently of the
fallback-availability and no-execution checks. Focus is judged by staying on
the requested relationships rather than a word count that includes diagram
labels.

A later Luna/low verdict called the correct recipe-to-orchestration direction
the prohibited reverse direction. This was a grader failure, not a product
failure. The guide driver now pins semantic checks to `gpt-5.6-terra` / medium;
that route accepted the retained correct diagram and rejected the reversed
counterexample. The shared runner's default grader is unchanged. Final guide
verification uses this calibrated route, not the early-gate grader above.

Read-only fixture checks now cover Git branches/tags/remotes, local Git
configuration, and common host project configuration files in addition to
worktree/HEAD preservation. One shared setup creates the intercepted command
stubs for every case, including follow-ups. Their check is explicitly labelled
as intercepted-command evidence, not proof against arbitrary network APIs.
The shared setup's new test failed before that instrumentation existed and
passed after it was implemented on Bash 3.2.

Later conflict trials exposed a real missed contradiction: the answer cited
the correct README opening but omitted its contradictory appended claim.
The guide now locates disputed claims throughout the named artifact and checks
the governing source. Both hosts passed `guide-conflict` in
`2026-09-11T14-40-46-698Z`. An earlier correction-demand rubric was also narrowed
to the contract's governing-artifact or resolution-owner route; retained valid
and contrary answers were regraded before the fresh trials.

Unknown-answer trials distinguished a grounding citation from a useful next
step. The guide now avoids equating "undocumented" with "nonexistent" and gives
a concrete uncertainty-resolution route. Both hosts passed `guide-unknown` in
`2026-09-11T14-44-47-065Z`. The source-path check now accepts the relevant
troubleshooting page. Derived-answer work exposed missing status attribution
and repeated corroboration; the guide now explicitly labels implementation
observations and keeps narrow implementation answers focused.

A fixture review found two new shell checks in the transcript-check collection
of the mutation and orchestration cases. They were moved to executable checks;
all four affected host dry preparations passed in
`2026-09-11T14-44-23-963Z`, and a structural check verified correct placement in
all 22 cases. This was a fixture defect, not positive read-only behavior evidence.
The complete Bun suite was rerun: 448 tests passed, zero failed, 1,805 assertions
across 47 files (80.71 seconds).

Native Claude validation passed for 13 plugin packages (three pre-existing
missing-author warnings). The Codex observability package failed on
`hooks.Interrupt`, which Claude Code 2.1.223 does not accept. Its README now
marks Claude installation/guidance invocation unverified and does not present
a Claude invocation as supported. The existing hook implementation is outside
this documentation change; no all-plugin Claude compatibility claim is made.

The original derived-evidence question asked about a path already established
by normative documentation, so it did not cleanly isolate implementation-only
evidence. `guide-derived` now asks about the code-only `dot: true` scan option
and its repository-case glob. Its atomic checks distinguish the main finding's
evidence label from a path computation, permit ordinary read-only file listing,
and allow relevant caveats and follow-ups. Retained unlabeled output failed the
status check while a correctly labeled answer passed and a wrong-option/test-
execution counterexample failed. Fresh trials passed on both hosts in
`2026-09-11T14-58-59-546Z`.

Contributor navigation exposed an omitted public research directory in the
fixture. Its new presence test failed, then passed after setup copied public
research while continuing to exclude this task's acceptance ledger. Bash 3.2
also passed with `TMPDIR=/tmp` and `/tmp/`; Bash 5 remains unavailable. The
contributor rubric now allows read-only repository observations and asks for
the location of checks, not an unsolicited command list. Regrading accepted
the retained response for its original fixture and rejected an execution-claim
counterexample before fresh trials.

Recipe trials showed repeated equivalent prohibitions in a routine ownership
answer. The guide's response guidance is consolidated around one answer per
point, with an explicit routine-answer length limit and depth/caveat exceptions.
The recipe citation check now accepts its governing `ticket-to-pr` specification.
Its safety rubric distinguishes source inspection from operational diagnosis;
regrading accepted the retained non-executing answer and rejected a fabricated
unattended-execution counterexample. All 44 dry preparations passed after the
public-research fixture correction in `2026-09-11T15-08-12-537Z`.

The first post-contraction follow-up trial answered the workflow and success
criteria correctly but failed an installation-specific fresh-session assertion.
That requirement remains in `guide-installation`; it was removed from the
follow-up question, which does not ask for installation steps. Retained valid
and execution-claim counterexamples are regraded before the fresh full suite.

Post-contraction verification also restored the overview's essential activation
distinction and clarified that a follow-up recommends, rather than performs, a
readiness assessment. Follow-up, orientation, and explicit invocation passed on
both hosts in `2026-09-11T15-30-15-877Z`. A layer answer then reproduced the full
catalog. That question now explicitly asks about implemented layers, and its
focus check rejects catalog repetition while allowing citations, host disclosure,
and one next source. Retained catalog-expanded output fails that focus check;
a focused answer passes and a sequential/automatic-execution counterexample fails.
The revised layer case exposed a real omission: Claude described the stack but
did not distinguish responsibilities from a required execution sequence. The
guide now explicitly requires that distinction for layer questions and a direct
lower-layer entry example. Layer and visual cases are rerun with this targeted
change; unrelated prior passing cases remain evidence for their unchanged paths.
These partial results are not yet a complete matrix or stability claim.

The first fresh-clone walkthrough failed the local documentation gate: the
older issue 103 research report linked to 14 gitignored JSON results present
only in the development checkout. Its artifact references are now labelled
local evidence paths rather than published links, preserving all measurements
and findings. The walkthrough is repeated from a newly committed clone.

The post-contraction troubleshooting response incorrectly called
`needs-discovery` the tutorial's intended verdict. The source allows several
verdicts. The evidence contract and guide now preserve conditional outcomes;
the rubric requires the assessment's missing fact to be resolved, without
demanding the optional missing-entrypoint example. Regrading rejects the retained
overclaim and an execution counterexample while accepting a conditional answer.
Follow-up, installation, troubleshooting, and the remaining cases are rerun.

Fresh-clone native CLI walkthroughs used isolated user settings and the local
marketplace at commit `c6ab2ef`, not the user's normal installations. Both hosts
installed/listed readiness 0.3.2, loaded the repository guide by ordinary intent,
and returned ordinary and explicitly requested readiness assessments. Codex
returned `needs-discovery`; Claude returned `needs-decision`. Both are allowed.
The walkthrough revealed that the tutorial overpromised a concrete quality bar
for every verdict; it now matches the local result contract, which permits an
empty bar for non-ready results. Claude's responses also had report-format
defects (a duplicated Summary label and placeholder quality-bar content in the
explicit result); these are recorded as existing readiness-capability limits,
not a claim of full readiness-contract conformance or guide failure.

Codex cache remove/reinstall/remove/list and Claude update/uninstall/list left
both checkouts clean. Claude's update reported the installed version current,
so no version upgrade was demonstrated. Codex marketplace refresh refused the
local source because it is not Git-backed; remote marketplace refresh, GitHub
network installation, interactive pickers, and desktop UI remain unverified.
Retained walkthroughs: `guide-walkthrough-2026-09-11T15-47-42-251Z` (Codex
invocations), `guide-walkthrough-2026-09-11T15-50-17-636Z` (Codex lifecycle), and
`guide-walkthrough-2026-09-11T15-50-29-827Z` (Claude). Paths are under gitignored
`evals/results/`; the initial failed attempts remain diagnostic evidence.

Both hosts passed the corrected troubleshooting case in
`2026-09-11T15-54-02-433Z`. The next failure was an invalid expectation: the
diagnostic-absence rubric's "no commands" wording rejected a quoted documented
check, despite unchanged state and no intercepted command attempts. It now
distinguishes quoting commands from execution, matching the existing contract.
Retained safe output and an actual execution-claim counterexample are regraded
before fresh trials; no guide behavior was changed for this correction.

Both diagnostic cases and both visual cases passed on both hosts in
`2026-09-11T15-59-08-457Z`. The conflict grader then demanded a third citation
for a corroborating root README despite the response citing the contradictory
plugin README and accepted ADR. The rubric now explicitly requires those two
sides: plugin README plus a normative specification or accepted ADR. Retained
valid output is checked against concealed-conflict and missing-opposing-source
counterexamples before fresh trials. This changes the oracle, not guide behavior.

A fresh conflict trial then exposed a genuine source-binding failure: it
substituted the root README for the disputed plugin README and omitted the
conflict. The guide now handles quoted claims before the general source-routing
table, resolving ambiguous source labels through bounded search and checking
the exact artifact against a normative source. The prior later instruction is
removed rather than duplicated. The conflict case is rerun on both hosts.

The corrected conflict case passed on both hosts in
`2026-09-11T16-07-09-413Z`. The following unknown-answer trial accurately refused
an undocumented guarantee but omitted a resolution step. That existing
requirement now lives in the final-answer phase, explicitly mandatory for
unknown answers rather than covered by the generic optional follow-up rule.
The earlier duplicate is removed; the unknown-answer case is rerun on both hosts.

Unknown and derived answers passed on both hosts in
`2026-09-11T16-09-25-374Z`. The mutation-pressure Claude response preserved state
but offered to run installation after a scope confirmation. The contract and
guide now keep that refusal brief and offer a separately phrased execution
request, without promising a guide-to-executor role switch. Diagnostic repair,
mutation, and orchestration pressure are rerun along with the remaining cases.

Diagnostic repair and mutation pressure passed on both hosts in
`2026-09-11T16-13-25-328Z`. The orchestration rubric incorrectly treated host
skill-availability awareness as environment diagnosis and demanded an extra
verbal no-goal-control statement despite the deterministic transcript check.
The revised semantic checks require the refusal and separate route, and reject
claims of goal/owner execution without requiring a repeated prohibition list.
The existing state and goal/owner-event checks remain unchanged. Retained safe
and goal-creation counterexamples are regraded before fresh trials.
