# Capability: Code Review

Darrow should provide an independent, model-invoked capability that first
reviews a pinned change comprehensively along two isolated axes, then can
verify authorized repairs against that review's closed finding set without
opening an unrelated review scope.

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

Use comprehensive code review when the user asks to review a branch, pull request,
work-in-progress diff, uncommitted changes, or changes since a named fixed
point, or when an explicit larger goal contract requires independent review of
its final change.

Use fix verification when a caller explicitly asks to verify attempted repairs
and supplies the original findings, original target fingerprint, prior repair
target, and current deterministic-check evidence. Fix verification is not a
second comprehensive review: it examines only the attempted findings and
direct regressions caused by those repairs.

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

Fix-verification input additionally includes the original comprehensive
review's target and canonical finding order, the immediately prior repair
target, all attempted findings, and earlier repair target history. Missing or
inconsistent binding evidence blocks verification rather than widening scope.

Output:

- one human-readable Markdown report by default, leading with the aggregate
  `pass`, `fail`, or `blocked` verdict and finding counts;
- the exact review scope, Standards and Spec sources and statuses, each
  finding's axis, severity, disposition, changed location, violated source,
  and evidence, deterministic checks or an explicit evidence gap, risks, and
  next action;
- the validated `darrow-review-result-v1` TSV only when the requester
  explicitly asks for the machine format. The TSV remains the canonical
  mechanical artifact beneath the review scope artifact directory.

Fix verification returns a human-readable Markdown report by default, or the
validated additive `darrow-review-verification-v1` TSV only when explicitly
requested as machine output. Initial `darrow-review-result-v1` validation and
rendering remain compatible.

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
- the comprehensive review establishes a closed finding set. The goal owner may
  repair eligible findings only under authority it already has and must rerun
  invalidated checks;
- after repair, the goal owner invokes fix verification with the original
  findings, prior and current fingerprints, attempted-finding evidence, target
  history, and current checks. Verification may add only a regression directly
  caused by one attempted repair, tied to that finding's stable key;
- unresolved blocking findings and repair-caused regressions leave the gate
  unsatisfied. Advisories remain visible but never keep the gate open;
- an unavailable or inconclusive review stops the goal and reports the evidence
  gap; and
- completion or publication requires a comprehensive review plus a `clear`
  verification chain bound to the exact current content. Any later
  content-changing edit invalidates that chain.

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
   in the requester-bound repository before starting reviewer agents. An
   explicit repository path overrides ambient Git repository-selection state
   starting at the first repository-discovery command, before helper invocation;
   skill or plugin directories MUST NOT become the review repository. Every
   emitted manifest identifies that bound repository. Explicit review intent
   remains in this capability when a requested base or target is missing or
   invalid. An invalid base or empty declared diff is reported before spending
   review-model budget.
   For a resolved scope, copy base, target, and the complete changed-file set
   from its pinned manifest through bundled mechanics. Before returning a
   result, validate those records against that manifest, including agreement
   between its declared changed-file count and complete file records. A
   schema-valid result with a different identity or missing/extra file is not
   valid review evidence.
   Terminal scope failures without a resolved manifest retain their existing
   blocked-result representation.
3. **CR-C3 — Complete diff.** The review scope includes every declared staged,
   unstaged, and untracked target file. Reviewers inspect the diff itself, not a
   summary written by the change author. Generated authoritative show and repair
   commands shell-quote every argument and remain executable from another
   directory when tool or manifest paths contain spaces or shell metacharacters.
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
   gates through bundled check-evidence capture. Preserve each literal command,
   actual exit status, and bounded output in a canonical record, and copy its
   check row without reinterpretation. Suppress model findings that merely
   restate tool-enforced formatting, lint, type, or test results.
8. **CR-C8 — Traceable Spec findings.** Every blocking Spec finding cites the
   source requirement it violates. Unsupported assumptions and personal
   product preferences are excluded.
9. **CR-C9 — Structured findings.** Every finding identifies axis, severity,
   changed location or command, violated source, and concrete evidence.
   Evidence explains the failure and its cause against that source. Each new
   finding includes reviewer-authored repair guidance: a bounded suggested
   approach, its rationale and important constraints, plus observable behavior
   or a regression test demonstrating resolution. Suggested implementation is
   explicitly advisory and separate from the required outcome. When evidence
   is insufficient to recommend an approach, the reader states that limitation
   and why, without inventing a solution or suppressing a supported finding.
   The coordinator preserves this reasoning rather than authoring it. These
   rules also apply to newly discovered repair-caused regressions.
10. **CR-C10 — Honest verdict.** `pass` requires every available axis and every
    applicable deterministic check to pass. Missing required evidence or a
    check that cannot run produces `blocked`, not `pass`. Each fresh reader's
    bounded prompt includes the axis-status rule: an otherwise complete review
    with only advisory findings passes; `fail` requires a blocking finding.
    Advisory findings remain reported without being promoted to blockers merely
    to match a status. The coordinator does not repair inconsistent judgment.
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
15. **CR-C15 — Deliberate presentation.** Standalone and composed review use
    one human-readable Markdown report by default. An explicit request for
    `darrow-review-result-v1`, raw TSV, or machine format returns only the
    validated TSV. A response never contains both presentations.
16. **CR-C16 — Complete rendering.** Markdown preserves every semantic field
    from the validated TSV, prioritizes verdict and findings, renders checks
    compactly, and presents detailed scope and sources later. Renderer
    mechanics render field values as ordinary Markdown text without HTML code
    wrappers, Markdown code spans, generated links, or terminal hyperlink
    sequences. Conventional `path:line` values remain bare, while hostile field
    content is escaped only as needed to preserve the report structure and its
    visible, copyable value. These presentation rules do not change the
    canonical TSV.
    Human presentation is first materialized as a nonempty canonical Markdown
    artifact beside the TSV, then emitted by one dedicated final renderer
    invocation whose complete stdout is returned without coordinator rewriting.
17. **CR-C17 — Explicit review modes.** Comprehensive initial review retains
    the complete-diff, isolated-axis behavior above. Fix verification requires
    the original finding set and target binding and MUST NOT silently fall back
    to comprehensive review when that evidence is missing or inconsistent.
18. **CR-C18 — Closed fix scope and repair evidence.** Fix verification
    inspects only attempted original findings, carried repair-caused
    regressions, the mechanically pinned prior-to-current repair delta between
    manifests with the same effective base, current checks, and their direct
    consequences. Caller prose alone cannot establish
    repair causality. A new unrelated observation MUST NOT enter its finding
    set. Every direct regression identifies the attempted original finding
    whose repair caused it. Resolution is judged against the original violated
    requirement and current behavior, never adoption of the suggested repair.
    Another valid implementation resolves the finding; matching the suggestion
    while retaining the defect does not.
19. **CR-C19 — Stable lifecycle and progress.** Original finding keys derive
    from the original target, axis, and canonical cross-axis finding order.
    When the original comprehensive result is retained, bundled mechanics copy
    every original finding without rewriting source, evidence, repair guidance,
    resolution evidence, severity or
    disposition, and compare that complete ordered set before accepting
    follow-up output. Complete external handoffs remain supported and must
    preserve their supplied immutable records and canonical order exactly.
    Every attempted
    finding is `resolved`, `unresolved`, or `blocked`; unresolved blocking
    evidence is `progressing` or `unchanged`. Duplicate or unknown keys are
    invalid. A newly detected direct regression is progressing for its first
    verification so the enclosing owner can attempt it; unchanged evidence on a
    later verification is no progress. Every later verification binds the
    checksum and path of the prior verification artifact, preserves each prior
    regression's stable key and immutable causal fields, and records the
    current state of every carried regression, preserving its original repair
    guidance and resolution evidence. Legacy v1 records without the two added
    fields remain valid; preserve that absence without inventing prior advice.
    Regression order is an
    independent sequence beginning at one, not the causing original finding's
    order. The first verification has no target history and binds its prior
    target to the original review target; each later artifact preserves exactly
    the prior history plus the prior artifact's prior target. Advisories never
    determine the gate outcome.
20. **CR-C20 — Mechanical verification outcome.** Verification derives
    `clear`, `continue`, `no_progress`, or `blocked` from exact target history,
    blocking finding and regression states, deterministic checks, and evidence
    gaps. Repeated targets, unchanged blocking evidence, and oscillation produce
    `no_progress`; unavailable evidence produces `blocked`. Fix-axis reader
    records and final verification artifacts are independently validated before
    aggregation or rendering. A failed applicable check requires a scoped
    unresolved or blocked repair-caused regression rather than an original
    blocker alone.
21. **CR-C21 — Explicit reviewer route.** Before invoking any comprehensive or
    fix-verification reader, the coordinator MUST resolve one concrete reviewer
    route for the active host and apply that same provider, model, and effort to
    every available axis. Bundled policy defaults to `gpt-5.6-sol` / `xhigh` on
    Codex and `claude-opus-5` / `xhigh` on Claude. An active-worktree
    `.darrow/config.json` MAY replace either host through its independent
    `reviewers` section, but only with a plugin-supported strong model/effort
    tuple; a repository override cannot lower this floor. Codex routes MUST use
    the OpenAI provider and Claude routes MUST use the Anthropic provider;
    provider identity MUST come from
    the native host boundary rather than copied configuration. On Claude, the
    bundled mechanics MAY identify the direct Anthropic provider from the
    documented default only when they observe no active third-party provider,
    Mantle, Claude-on-AWS, or custom API-endpoint selector in
    the current host environment both before launch and during transcript
    verification. Any such selector makes an Anthropic-only route unavailable.
    Missing,
    unreadable, invalid, unavailable,
    silently-substituted, inherited, or unverifiable route evidence blocks the
    affected reader instead of falling back to another model or same-context
    judgment. Standards and Spec remain fresh and isolated even when they share
    one route policy. Bundled mechanics MUST own reviewer-route record parsing,
    serialization, and file creation; the coordinator supplies absolute artifact
    paths and applies only the returned native launch fields. It MUST NOT
    reconstruct route tuples or use shell redirection to create route evidence.
    Each application record MUST bind its axis and the host-reported child ID.
    A native reader launch is accepted only after the host returns exactly one
    distinct child ID for that axis. A canonical child reference in a
    host-returned field named `task_name` is such an ID and MUST NOT be confused
    with the requested bounded task label. Until then the coordinator MUST NOT
    wait for, consume, or replace reader judgment. A rejected launch or a launch
    without one child ID immediately blocks that axis; the coordinator MUST NOT
    substitute same-context analysis, a generic reader, or an inferred result.
    Codex evidence is valid only when retained native events show a distinct
    accepted fresh-context spawn for that ID, exact model and effort, and a
    host-visible, unambiguous axis marker in its native task name or retained
    prompt; a task name containing both axis tokens binds neither axis. An
    application record alone is insufficient. Claude
    uses a foreground exact-tuple plugin agent with full model and effort in
    frontmatter and no per-call model alias. Its evidence binds the current
    native Agent tool-use ID to its host-reported child ID, then binds that
    exact ID to the parsed `agent-<id>.jsonl` transcript's `agentId`, model, and
    effort on every assistant turn. Two-axis evidence MUST close the native
    launch batch over all retained Agent or spawn events: exactly the bound
    Standards and Spec readers may occur before their first wait or child
    result. An unavailable-route result MUST retain zero native reader-launch
    attempts, including inherited, substituted, background, generic, or
    otherwise unbound attempts.

## Result shape and presentation

The validated TSV is the canonical internal mechanical artifact and includes:

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

The default user-facing result is a complete Markdown rendering of that
artifact. The raw `darrow-review-result-v1` is user-facing only when explicitly
requested as a machine format; the two forms are never concatenated.

The additive fix-verification artifact includes:

```text
original_target
prior_target
current_target
history_target[]
previous_verification   # none, or checksum plus absolute prior artifact path
original_finding[]     # stable key, axis, order, severity, disposition, evidence
attempt[]              # stable key, resolved|unresolved|blocked, progress, evidence
regression[]           # stable key, caused_by finding, status, progress, evidence
check[]
evidence_gap[]
outcome                # clear|continue|no_progress|blocked
next_action
```

Stable original keys use `<axis>:<canonical-order>:<original-target>` and
repair-regression keys use
`regression:<canonical-order>:<causing-original-key>`.

The repair scope also binds a prior scope manifest and current scope manifest
with the same effective base and exposes a fixed renderer for their pinned
packet delta. Fix verification
may allow an empty base-to-current diff when the repair restored the base, but
the prior-to-current repair delta remains nonempty and exact-target-bound.

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
8. **CR-P8 — Self-contained reviewer routing.** Bundled reviewer defaults,
   repository override parsing, host-specific launch mapping, and effective
   route verification live inside `darrow-review`. Narrow bundled commands own
   selection, observed-route, and application record I/O at caller-supplied
   absolute paths. The plugin MAY share the `.darrow/config.json` envelope with
   other independently installed plugins, but MUST NOT call or reference their
   helpers or files.

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
12. **CR-E12 — Presentation contract.** Acceptance evidence covers default
    Markdown for passing, failing, and terminal blocked scope outcomes;
    explicit raw-v1 negotiation; composed returns; semantic preservation;
    hostile field escaping; bare conventional path references; faithful paths
    containing spaces or host-sensitive characters; absence of HTML code
    wrappers, Markdown code spans, generated links, terminal hyperlinks, and
    duplicated TSV in human output; and a superficial summary that omits
    evidence.
13. **CR-E13 — Fix verification convergence.** Evals cover several blockers
    resolved together, a first-rework advisory, an unresolved non-gating
    advisory, progressing and unchanged blockers, repeated and oscillating
    targets, a repair-caused regression, an unrelated observation excluded from
    scope, unavailable evidence, and exact-target read-only operation.
    Acceptance checks compare finding states by TSV field, rather than matching
    state words inside free-form evidence. Verification presentation checks
    independently render the validated TSV and compare both the retained report
    and final response with that rendering; matching two coordinator-authored
    summaries is insufficient. Unavailable-check evidence is compared with the
    captured canonical check row rather than a separately prescribed diagnostic
    sentence.
14. **CR-E14 — Reviewer route application.** Deterministic and cross-harness
    evidence covers bundled Sol/xhigh and Opus/xhigh defaults, repository
    overrides in a config that may also contain adaptive-delivery routes, direct
    Anthropic-provider detection and rejection of every supported third-party
    or custom-endpoint selector, parallel
    two-axis application, one-axis omission, fix-verifier application,
    conflicting environment overrides, unavailable models, and detected
    Claude substitution. No passing case may rely on an inherited or
    self-reported effective route. Tests also prove that file-bound helper
    commands create each route artifact without coordinator-authored tuples or
    redirects. Matched control/candidate trials use the same fixture,
    participant prompt, checks, harness, model, and effort within each pair and
    report native-evidence failures without converting them into acceptance.
    Eval gates join each axis's native launch to the child ID from that axis's
    own application record; valid distinct reviewers MUST pass this identity
    check, while reused or mismatched child IDs MUST fail.
    Separately, at least one live passing route-mechanism case preserves and
    cross-binds distinct native accepted-launch evidence for every applicable
    axis. Codex evidence binds a native axis marker and places both accepted
    starts before the first wait; Claude evidence places both
    Agent calls in one parallel tool-use turn and joins each tool-use ID to its
    host-reported child ID. Two-axis evidence rejects every additional native
    launch in the retained batch, including unmarked or ineligible launches;
    one-axis evidence rejects any native launch for the unavailable axis; and
    unavailable-route evidence rejects every native reader-launch attempt.

15. **CR-E15 — Advisory repair reasoning.** Evidence covers useful guidance
    from each originating reader, explicit uncertainty without loss of a
    supported finding, faithful human and machine presentation, immutable
    guidance through original and regression handoffs, acceptance of an
    alternative valid repair, and rejection of a suggested repair that leaves
    the original defect. Include the enclosing repair/verification chain.

Representative issue-32 control/candidate evidence and its N=1 limitations are
recorded in
[`review-convergence-issue-32.md`](../research/review-convergence-issue-32.md).
Reviewer-route control/candidate results, native passing evidence, and their
surface-specific limitations are recorded in
[`code-review-reviewer-routing-trials.md`](../research/code-review-reviewer-routing-trials.md).
The Codex variance investigation and follow-up matrix for issue 108 are recorded
in [`code-review-stabilization-issue-108.md`](../research/code-review-stabilization-issue-108.md).
Advisory repair-guidance evidence and its host-specific limitations are recorded
in [`review-repair-guidance-issue-166.md`](../research/review-repair-guidance-issue-166.md).

## Non-goals

- Implementing, repairing, refactoring, or formatting the reviewed change.
- Choosing whether another goal or workflow requires review.
- Requiring an issue tracker or a particular spec-storage convention.
- Treating a bundled smell baseline as repository law.
- Reviewing the entire repository when the user requested a bounded diff.
- Publishing comments, approvals, or review status to a remote forge.
- Depending on a TDD plugin, orchestration plugin, Git workflow, or sibling
  capability.
- Discovering defects in fix verification that were neither reported by the
  original comprehensive review nor directly caused by an attempted repair.
