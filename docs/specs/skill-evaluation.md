# Repository Infrastructure: Skill Evaluation Evidence

Darrow's shared evaluation runner should make specification traceability and
comparative skill value inspectable without confusing the presence of a test
with proof that the tested behavior works.

Surface: `evals/runner/`. Runtime: repository development infrastructure on
TypeScript and Bun; this is not a plugin-shipped dependency or user-invoked
orchestration capability.

## Native goal entrypoint

Codex evals may select `--codex-entrypoint app-server` to host the original
participant thread through native goal continuation. The adapter observes native
goal state and automatic turns; it does not create goals, synthesize continuation
messages or launch a separate execution owner. Record the requested entrypoint
in case provenance and the actual transport in each harness result, and include
the selection in the evaluation digest. Dry runs establish setup only. Historical
exec trials and their attribution gaps remain unchanged.

Retain bounded public diagnostics for original-thread app-server errors: source,
thread/turn identity, retry intent, public message, error classification and HTTP
status when supplied. A failed turn may carry this evidence without a separate
error notification. Preserve errors received during final-response settlement
too. Bound record count and message length, marking truncation; omit private
additional details, continuation instructions, request bodies and credentials.
Diagnostics do not authorize retries, synthesized user input, model fallback or
accepting an earlier checkpoint as completion. Unrecoverable host failures stay
failed, with incomplete evidence labeled unknown.

Current main-thread cases declare `native_goal: required|forbidden|optional`;
`optional` accepts either a valid observed goal or a valid observed absence
when the contract allows both. Grade actual native activation separately from
child acceptance and task outcomes. A valid Codex app-server readback binds the
original thread, goal lifecycle and a goal of at most 4,000 characters.
Missing, malformed or failed observation cannot pass. Bounded multiple children
and main-thread checks are valid in this architecture; the former single-child
and parent-inactivity assertions do not apply. Other hosts need equivalent
observed native evidence. Claude uses original-session native `goal_status`
attachments, bound to a successful result and the observed session ID. A
sentinel clear is not assessed completion. Headless Claude cases requiring
activation enter through the user-visible native `/goal` command;
the runner never inserts it on the participant's behalf. Absent observation is
a gap, not evidence of activation or nonactivation. Keep capability consumption
and candidate correctness as separate checks.

## Why

A skill can have plausible instructions and passing candidate-only cases while
adding no value over the host model, triggering on adjacent intent, or leaving
declared behavior untested. Darrow needs two distinct forms of evidence:

1. traceability from normative invariant IDs to the eval cases that exercise
   them; and
2. matched comparisons that isolate the presence of a skill from the prompt,
   fixture, harness, model, effort, and trial count.

Neither form replaces live outcome checks. Coverage says a claim is exercised,
not that it passed, and ablation says what changed under the observed sample,
not that the skill is universally better.

Skill selection is a third, separate question. A skill may work after loading
yet fail to activate for intended wording, activate for adjacent intent, or
lose to a neighboring capability. Activation evidence must therefore remain
distinct from task outcomes and skill-value ablation.

Implicit activation uses the unique complete
`sevro.host.skill-activations` observation. Codex's `tool_result_body_match`
reports exposure of prepared skill bodies; Claude's `skill_tool_result` reports
successful Skill calls. Preserve qualified identities while matching the mounted
skill names. Partial, duplicate, malformed, truncated, or ambiguous collection
stays unavailable, including for negative cases. A current common observation
must never fall back to retired read or transcript evidence. Explicit dispatch
remains sufficient for the invoked owner; supporting inclusion, exclusion, and
order require the separate complete activation collection.

A unique complete Codex
`sevro.host.skill-activation-claims` receipt may separately establish primary
selection and positively observed supporting skills while its paired common
collection remains partial. Cite that complete receipt, preserve the collection's
partial status and public diagnostics, and normalize only mounted namespaces.
For this claim, the paired collection must explicitly name exactly the
`pending_tool_calls` gap. Missing or malformed reasons, or any other gap,
contradict established primary selection and make the claim unavailable.
Use it for implicit positive or competition first-selection assertions and
established positive membership only. Explicit dispatch and its supporting
assertions retain their existing evidence requirements. Missing membership remains unknown; this receipt
cannot prove negative activation, exclusions, or a supporting sequence. Missing,
duplicate, foreign, malformed, or contradictory receipts remain unavailable.
Honor an explicitly unknown primary even when the whole collection is complete;
catalog order is not selection order. Older observations without the new claims
retain their original interpretation and are never upgraded from native logs.

## Public contract

### Supported Sevro release

Darrow targets the exact published Sevro `1.0.0` package and its public v1
protocols and schemas. Current cases use observations emitted by that release;
cases whose required evidence exists only in a retired runner are removed from
active suites. Retained research keeps its original provenance and meaning.

Current evals grade final responses through Sevro's public output or semantic
checks. Shell checks inspect repository state and declared artifact grants;
they must not read a retired runner's response file or materialize a compatibility
copy. Verification handoff cases check the final absolute report reference in
the response and validate retained report content separately. Missing references,
relative references and prose after a required final handoff must fail.

Review presentation output checks consume the complete public final-message
observation. Human checks reject embedded canonical review or verification JSON.
Machine checks compare the parsed response with the canonical artifact through
the digest of a named successful shell check's normalized JSON output. Object
key order and whitespace do not affect equality; array order and field values
do. Missing, duplicate, partial, foreign or failed evidence remains unavailable.
The shell check reads only the original artifact grant and never writes a
response compatibility file.
Review route oracles accept the published native transcript view versions 1
and 2. They validate the materialized files against the index hashes and retain
the same completeness, identity, route and completion requirements.

Deterministic Claude fixtures provide a valid synthetic saved OAuth login to
Sevro's parent process. Their trial executable receives only the access token;
the saved login is not copied into the trial's configuration directory.

### Repository-owned model routes

Darrow owns its candidate, semantic-grader, and advisory-grader model and
effort defaults in the evaluation extension. Repository callers use that
policy without importing generic runner types or implementation. Moving the
policy preserves explicit route overrides. Codex candidates default to
`gpt-6-luna/medium`; the gating semantic grader defaults to Codex
`gpt-6-luna/high` across direct, suite, benchmark, and repository-guide callers.

### Repository-owned fixture sources

Synthetic independent-review providers preserve the selected verification
contract's coordinator/reader boundary. Their coordinator launches fresh
Standards and Acceptance readers on the declared routes. Reader observations
must not advance the closed assessment history or overwrite canonical reports.
Only reconciliation records one assessment, bound to the readers' current
candidate; stale, missing or conflicting reader results cannot clear it.
A synthetic provider exposes its configured subject's byte-exact snapshot and
blob identity when needed to ground acceptance beyond its programmed finding.
Reader observations remain read-only; changed subjects cannot receive clearance.
Semantic grading context must not add deliverables absent from the authoritative
participant input.
Reporting all required steps as successfully finished can establish completion;
do not require a separate completion phrase or blocker-free declaration.
Accept reports of completed observable effects without command-by-command narration.
Keep completion reporting separate from executable content and identity assertions.
Supply synthetic fixture facts to semantic graders; a declared mock URL is not
evidence of a failed workflow.
Cases expecting candidate test execution must explicitly authorize that check in
the participant prompt; fixture guidance cannot supply user authority.

The regular case-resolution test includes canonical repository-skill,
plugin-skill, and skill-less experiment cases. Unsupported cases remain named
failures; omitting a scope cannot produce a valid result.

Fixture command providers preserve the read-only behavior of help queries.
A help request must not create publication state or emit a publication success
receipt. Test both help and an actual mutation when repairing this boundary.
Publication-absence checks use unconditional action state, not a file written
only when an optional title or body argument is supplied. A title-free creation
must not pass an absence check.

Implicit repository-skill cases retain their repository scope. On Codex, prepare
the owning skill under `.agents/skills/` without a plugin wrapper, exclude eval
assets, and preserve activation grading. An explicit repository case negotiates
`sevro.codex.repository-invocation`, declares its mounted owning skill, and uses
exactly one runner-rendered `$skill` token. The declaration and repository scope
enter retained configuration and comparison identity. Plugin dispatch declarations
cannot substitute for repository dispatch. Claude uses the required mirror at
`.claude/skills/<name>`, refuses a missing or unsafe mirror, and negotiates
`sevro.claude.repository-invocation` for the native `/skill` command. Both explicit
and implicit Claude repository trials require `--claude-project-settings`; an
unavailable project-skill capability must fail before candidate execution.
Explicit activation requires one complete native command receipt bound to the
mounted body, arguments, and session. Later Skill calls cannot repair a partial or
rejected receipt. Implicit Claude activation uses complete ordered Skill-call
metadata. Task grading and activation remain separate.

Repository cases can compose independently installed `additional_plugins` or
selected `additional_skills`. The owning repository skill keeps its native
scope; supporting providers keep their manifests and mechanics. Validate skill
name uniqueness and activation membership over the combined set. An ordered
activation sequence can use these explicit providers without mounting plugin
siblings. Apply the shared artifact count and byte bounds across all mounts.

Plugin mounts retain an existing package-root `README.md` at that same relative
location so bundled skill links resolve in project-skill and native-plugin
installations. The README must be a regular file, remains Git-excluded, and
counts toward the shared artifact bounds. This does not expose colocated evals
or hidden checks; a missing optional README does not invalidate another package.

A completed candidate trial with one definitive `darrow.evals.activation`
outcome retains that activation measurement when an unrelated task grader is
unavailable. Task grading remains unavailable. Failed or incomplete execution,
grading errors, missing or ambiguous activation outcomes, and incomplete
activation observations remain unmeasured; no unknown trial enters a pass rate.

Inline fixture repository skills under `.agents/skills/<name>/SKILL.md` or
`.claude/skills/<name>/SKILL.md` are supporting mounts, not ordinary product
files. Bind their bytes at resolution, mount only the selected host's entrypoint
as a Git-excluded public artifact, and include it in activation membership.
Reject changed source bytes, duplicate mounted names, and a missing host mirror.
An unmounted control omits these supporting skills as well as the owning skill.

Feedback fixtures distinguish mutable receipts from product state. A visible
workspace fingerprint includes receipts and cannot prove that product files
changed. Bind an immutable Git-state baseline during setup and require the
feedback fixture to compare product state before discovery and acknowledgement.
Grade the actual same-thread continuation separately from that state evidence.

Negative CLI checks inspect command records rather than captured command output.
Reading a skill body that names a diagnostic is not a diagnostic invocation.
Missing, malformed, or incomplete command evidence remains unavailable.
Terminal Review checks use bound native control labels for reviewer absence.
A missing retired harness file cannot establish that no reviewer launched.

Repository guide fixtures exercise implementation-derived explanations against
Darrow-owned evaluation code, such as its Sevro extension. Their snapshots must
not copy generic runner implementation. Keep the question, source inventory,
and acceptance checks aligned with the copied source.

The guide's legacy Claude host-disclosure assertion is graded from the complete
retained final response. On Claude, it requires the declared best-effort and
primary-Codex disclosures. Codex retains the assertion's non-applicable result.
Missing, duplicate, partial, or foreign response evidence stays unavailable;
absence of legacy environment variables or a response file cannot make it pass.

The guide's no-owner and no-goal-control assertion uses the common
`sevro.host.native-controls` observation on either host. Darrow interprets its
ordered native labels and explicit counts; Sevro does not grade the assertion.
Agent-launch or goal-mutation attempts fail it even when no agent was accepted.
Missing, duplicate, partial, malformed, foreign, or contradictory records remain
unavailable. Submitted Codex code that has not been inspected cannot establish
control absence. Claude's unknown acceptance count cannot establish acceptance.
All native control absence assertions, including inactive-skill and doctor
checks, require inspected submitted-code evidence. Direct session capture alone
cannot prove absence. Direct acceptance and routing receipts remain distinct.
Complete Code Mode receipts must match every direct exec ordinal and submission
count. Inspect their ordered submitted labels for prohibited attempts independently
of direct agent acceptance; malformed or incomplete receipts remain unavailable.
For after-continuation absence checks, validate all receipt bindings and inspect
every submission after the native boundary. A partial earlier submission does
not by itself invalidate complete evidence for the later interval. Submitted
labels cannot substitute for correlated owner acceptance.

Explicit Codex owner dispatch can establish owner activation independently of
supporting reads. Composition order, supporting-skill inclusion, and exclusions
also require unique complete skill-read evidence consistent with the dispatch.
Partial supporting reads cannot establish those assertions.

Host-state cases explicitly opt into Sevro's `codexState` runtime interface.
Grade user-skill absence across all four original candidate-bound skill roots,
excluding only the native CODEX_HOME/skills/.system directory. Missing bindings
remain unavailable. Diagnose the actual isolated config, not fixture config.
Local HTTP corpus cases explicitly select `network.localHttp`; keep their
original socket tests and assertions.

A setup-only generated fixture starts with an empty Git history. Its setup may
create the initial snapshot; no placeholder commit may be synthesized before
that setup runs.

The Darrow extension prepares `.fixture-state/` and excludes it from Git before
running a case's fixture setup or tools. Candidate-run fixture tools write their
receipts, mutable mock state, and test traces there. They do not require writes
inside `.git`. Sevro permits legitimate writes to the isolated trial's Git
metadata while protecting hidden grading assets. Git metadata, immutable setup inputs, and
hidden grading assets remain separate; hidden oracles stay in `.git/eval-checks/`.
Cases that assert an unchanged whole-workspace fingerprint at a feedback boundary
keep mutable fixture receipts in a declared private runtime home subtree instead.
Their explicit runtime profile grants graders read-only access to those original
files. Source-preservation and exact acknowledgement checks remain required;
receipts must not be reconstructed or copied into substitute grading artifacts.
This repository-owned state convention belongs in extension preparation, not
the generic engine.
Fixture setup receives `DARROW_EVAL_MOUNT_EXCLUDES`, a JSON array of the exact
relative paths declared with `gitExclude` in that case's prepared artifacts.
Ignore-configuration baselines must account for those later mount additions
while preserving the original user configuration and rejecting undeclared,
missing, or repeated rules. Bind the expected paths from preparation metadata,
not from candidate-written files or a broad mount-directory exemption.
Dependencies required after setup must survive destruction of the temporary
setup home. Go corpus cases place module, build, and workspace caches in this
excluded state and use the same declared Go launcher during setup, candidate
execution, and grading. They must not depend on a cache in the discarded setup
home or require candidate writes to Git metadata.
Canonical Darrow fixture setup resolves ambient tools before declared fixture
wrappers. A setup command that records system Git must not bind its own Git
wrapper and recurse. Declared fixture tools remain first on `PATH` for candidate
execution and shell grading. The extension preserves this phase distinction
without changing generic Sevro setup policy.

### Direct runner roots

Public result and run-evidence schemas come from Darrow's exact installed Sevro
dependency. Darrow does not maintain copies of engine schemas. Development
overrides remain subject to that pinned public contract. Darrow callers reject
malformed or contradictory results before applying repository policy.

The direct runner accepts `--project-root <directory>` for case discovery,
supporting plugin and skill paths, repository skill mirrors, and the default
corpus and result locations. It accepts `--config-root <directory>` for the
evaluated project's Codex configuration. Relative root arguments resolve from
the caller's working directory. The configuration root defaults to the project
root; without either option, both default to the runner's source checkout for
existing in-repository commands.

The evaluated candidate and shell checks cannot read or write the runner's
source checkout, the evaluated project root, or a separate configuration root.
Git worktrees belonging to those roots receive the same protection. A
packaged runner source without Git metadata remains usable.

On the public Sevro CLI, `--project-root` and `--results-root` are explicit
absolute paths. Optional `--config-root` is also absolute and defaults to the
project root. Import only `agents.max_concurrent_threads_per_session` from
`<config-root>/.codex/config.toml` for every configured Codex role. A missing
file or missing setting retains the host default; malformed, unreadable, or
invalid declared configuration fails before candidate execution. The setting
must be a positive TOML integer within JavaScript's safe integer range.
Unrelated model, permission, hook, credential, and environment settings are
never imported. Capture the value once per invocation and include each role's
effective setting in retained configuration and comparison identity. Changing
that setting must change evaluation identity. Protect the selected configuration
root and its linked worktrees from candidates and isolated checks.

The direct runner accepts `--results-root <directory>` for its default result
bundles and `--run-state-root <directory>` for active ownership records,
checkpoints, and retained attempts. The results root defaults to
`<project-root>/evals/results`; the run-state root defaults to the results root.
`--output <file>` still selects one explicit result bundle independently of
those roots. Relative paths resolve from the caller's working directory.
Candidate execution and shell grading cannot read or write either storage root
or the selected result and diagnostic files.

### Direct case selection

The direct runner accepts `--skill <skill-name>` to select discovered cases
by the exact name of their colocated owning skill directory. Selection does
not depend on case IDs and excludes skill-less experiments. When combined
with repeatable `--case <substring>` filters, a case must belong to the named
skill and match at least one case substring.

The direct runner also accepts `--plugin <plugin-name>` to select all discovered
cases under `plugins/<kind>/<plugin-name>/skills/*/evals/`, matching the plugin
directory exactly regardless of case IDs or plugin kind. Skill-less experiments
are excluded. `--plugin` and `--skill` intersect when both are supplied, and
repeatable `--case` filters narrow the result to IDs matching any substring.
Without either ownership filter, existing case selection is unchanged. An empty
selection fails with `No cases matched.`

A case may declare `harnesses`, a nonempty list of unique supported host names.
Filtered and ownership selection omits a case whose declaration excludes the
requested candidate host; an empty result after that omission still fails with
`No cases matched.` Exact `--case-id` keeps refusing an excluded host before
execution.

A case may declare `candidate_routes`, mapping supported host names to a
complete `{model, effort}` parent candidate route. Filtered and ownership
selection applies it as that case's default route on the matching host, so a
default skill or plugin run executes the case on its required route. An explicit
`--case-routes` entry for the case takes precedence; hosts absent from the
declaration keep the CLI or default route. Exact `--case-id` runs and suite
cells keep their explicit routes. Malformed declarations fail case resolution.
Grader routes stay independent, and retained evidence binds the effective route
exactly as for `--case-routes`.

Selection happens before fixture resolution and mounted-skill overrides.
`--skill-dir` still overrides the skill mounted for the selected cases; it
does not select cases or change their ownership. `--without-skill` likewise
changes mounting without changing the selected case set.

The Sevro run entrypoint accepts these same ownership and substring selectors
before `--`, as an alternative to exact `--case-id`. Exact and filtered selection
cannot be combined. Resolve the complete selected set, reject duplicate IDs,
and sort exact IDs before starting any public Sevro commands. Empty or blank
selectors fail before execution. Each selected case keeps its public Sevro JSON,
exit category, and evidence path in a `darrow-sevro-selection-v1` manifest under
the requested results root. The manifest does not flatten task, execution,
grading, or activation states into one verdict. Exact `--case-id` retains its
existing public result format. Filtering precedes skill overrides and unmounted
controls, and neither can change ownership selection.
Selected cases run sequentially in this migration entrypoint. Interrupting it
forwards cancellation to the active public command, retains that command's
interrupted result in the selection manifest, stops before any later case starts,
and exits `130` for SIGINT or `143` for SIGTERM. Ordinary nonzero case exits remain recorded while later selected
cases run; the aggregate exits `1` if any recorded case command failed.
Forward `--jobs <positive integer>` after `--` to bound simultaneous trials
within each case. Sevro defaults to three jobs; `--jobs 1` runs trials serially.
The engine retains the effective limit in configuration and evaluation identity.
Trial results and checkpoints remain ordered by trial number, and active trials
retain their evidence before cancellation or a persistence failure finalizes.
Missing, malformed, or unsupported public CLI JSON cannot produce an aggregate
success even when the process exits zero. Retain its raw output and exit code,
name the result error, and keep the case's structured result unavailable.

Each selection attempt has a unique retained manifest and raw-result directory
under the requested results root. Its manifest names the absolute `manifestPath`
and `attemptId`. Repeating the selection preserves earlier attempt artifacts.
`selection-run.json` at the results root is an atomically updated current-result
alias; the attempt manifest is also updated atomically as case results arrive.

The Sevro run entrypoint preserves `--skill-dir` and `--mount-plugin-skills`
as Darrow extension configuration. Suite mode `skill_dir` resolves relative
to the suite file; `mount_plugin_skills: true` adds the candidate plugin's
sibling skills to any sibling selection already required by the case. An
override must name a readable plugin or repository skill inside the evaluated
project. Missing inputs and paths escaping that project fail before execution.
The selected case source and its owning activation target remain unchanged;
skill-less experiments do not acquire an activation grade through an override.
Unmounted controls retain the declared override in configuration but mount no
skills. Retained redacted configuration and fixture artifact digests bind the
selected mount. Suite evidence must agree with the requested mount settings.

### Repository-guide caller migration

The existing `evals/repository-guide.ts` command uses the public Sevro CLI from
Darrow's exact installed development dependency. `SEVRO_PACKAGE_BIN` or
`SEVRO_CHECKOUT` selects an explicit candidate or development override.
Preserve repeatable `--only`, `--harness`,
`--dry`, and `--without-skill`. Selected inventory questions run in inventory
order, with Codex then Claude by default, one trial and one job per invocation,
and a threshold of one. Stop before another cell starts after any failed task,
activation gate, command, or evidence validation.

Retain the raw public CLI JSON for each question and host. Validate its schema,
exact case, exit category, and agreement with retained run evidence. A live cell
requires completed execution and grading and a passed task. Mounted cases also
require their declared activation outcome to pass; an unmounted control does not
claim activation success. Dry cells retain not-run, unassessed results and do
not provide behavior evidence. Forward SIGINT and SIGTERM to the active command,
retain its interrupted result, stop selection, and preserve exits 130 and 143.
If public output is missing, invalid, or disagrees with retained evidence, keep
the raw bytes and a companion diagnostic with the process exit code, validation
error, and unavailable structured result. Preserve any nonzero command exit or
recorded interruption; invalid output from a zero-exit command exits one.

The migration route accepts explicit absolute project and results roots and
forwards supported public Sevro options after `--`. Candidate and semantic
adapter modules are refused because this caller assesses native hosts with the
Codex semantic judge. Caller-owned case, storage, host,
condition, trial, job, threshold, and dry options cannot be overridden there.
Candidate defaults use Codex `gpt-6-luna/medium` and Claude
`claude-sonnet-5-5/medium`; the semantic grader uses Codex
`gpt-6-luna/high`. Explicit model and effort overrides enter retained routes.
Claude repository trials enable project skill settings. The default auth and
binary paths use the local host configuration, with explicit public overrides
available for deterministic tests and coordinated development.

### Invariant coverage

The coverage command scans one or more normative Markdown specifications and
colocated eval YAML files. A normative invariant is a Markdown list item whose
bold identifier is followed by an em dash. An eval case names one or more
comma-separated invariant IDs in its existing `invariant` field.

The report identifies:

- every normative invariant and the eval cases that reference it;
- normative invariants with no eval case;
- eval references absent from the scanned normative specifications; and
- invariant IDs defined more than once in the scanned specifications.

Uncovered invariants are reported evidence gaps, not proof of runner failure.
Unknown references and duplicate normative definitions are integrity failures.
An optional strict coverage gate may also fail when any invariant is uncovered.
Unreadable inputs, invalid YAML, missing required case fields, or an empty scan
must fail explicitly rather than appear as successful empty coverage. Coverage
inspection is read-only: it does not modify specifications, eval cases, result
bundles, repository refs, tracked files, or untracked files.

### Matched skill ablation

The Sevro suite entrypoint accepts a nonempty, unique list of `codex` and
`claude` harnesses. A suite with multiple harnesses supplies an absolute
`--host-options-file` containing one Sevro argument list per selected harness.
Shared forwarded options cannot override those routes. The manifest binds the
options file by digest and verifies each retained candidate route against its
cell's declared harness. Missing, foreign, or contradictory route evidence
makes that cell unsuccessful. Ablations match baseline and candidate cells
within each harness and retain the harness in every comparison row.

An evaluation suite may declare a named ablation with exactly one baseline mode
and one candidate mode. The baseline mode mounts no skill. The candidate mode
mounts the skill selected by each case or an explicit candidate skill path.

The runner may call the pair an ablation only when both modes use the same:

- case set and participant-visible prompt;
- fixture and hidden checks;
- harness and harness version;
- model and effort;
- trial count and pass threshold; and
- optional condition text.

Only the mounted skill surface may differ. A condition, route, or judge change
is a general experiment rather than skill ablation and must not receive an
ablation label.

The generated report preserves task-level baseline and candidate results for
each harness. It shows at least pass-rate, wall-time, token, and cost values and
deltas when both sides report them. Missing measurements remain `unknown` and
never become zero. Missing cases, duplicate cells, or mismatched comparison
dimensions make the ablation report invalid instead of being omitted or
aggregated away.

### Skill activation

Composition may require supporting skills without imposing an order on their
preflight reads. `activation_includes` requires every named skill in the complete
observed skill set; it does not replace the owning-skill expectation or prove
provider execution. Sequence assertions remain available where order is part of
the contract. Required membership is validated against the mounted skill set,
retained in results and evaluation identity, and remains unknown when observation
is incomplete.

Ticket-to-PR publisher-read checks use the main thread's complete supporting
skill observations. Adaptive Goal owns publication in that thread; an overall
owner child is not required. A missing publisher read fails; partial, missing,
duplicate, or foreign-host observations remain unavailable. Separate effect
checks must still prove actual publication and the intended commit.

Whole-run supporting-read and skill-absence transcript checks consume the
complete common `sevro.host.skill-activations` collection, with mounted namespace
normalization and its actual receipt cited. A partial positive claim cannot
prove these complete-collection assertions. Live grading does not accept retired
skill-read receipts or require retired per-turn or parent-read diagnostics.
Remove assertions whose only evidence was retired; do not mark them passed or
reinterpret whole-run observations as counts, ordering, or per-turn absence.
Use fixture invocation and outcome checks where they independently establish the
required behavior. Historical research preserves the original evidence meaning.
Required native control and
event evidence remains independently complete; a valid skill collection does
not establish absence of delegation through an incompletely inspected `exec`.

Ticket-to-PR task verdicts use the case's observable output, repository state,
fixture effects and semantic acceptance checks. Its native-goal, ownership and
transcript assertions are separate workflow domain outcomes. Missing workflow
observations stay unavailable and observed violations stay failed in that
dimension; neither changes the task verdict or becomes required task evidence.
Activation remains separate.
Adaptive Goal outcome cases likewise retain auxiliary transcript assertions as
workflow diagnostics. Native-goal outcomes, explicitly tested implementation
routes, and an observed no-mutation-before-user-feedback safeguard remain task
requirements. A successful final result does not excuse mutation before the
user supplies required authority. The unchanged-worktree safeguard uses the
complete, unique continuation observation; missing or incomplete evidence stays
unavailable. A selection-only case without output,
state or semantic acceptance keeps its selection assertion as the task under
test. Missing diagnostic evidence cannot withhold an otherwise established task
outcome; observed diagnostic violations are never relabeled as passes.
Other plugins retain their declared task gates.
When regrading retained trials, preserve the original records and identify the
new task assessment as a regrade, not fresh candidate execution.

Positive implementation-route checks consume the owning host's validated
accepted-child facts. They must not require a complete common-control receipt
that they do not inspect. A missing or incomplete host-specific route remains
unavailable, and an observed wrong route fails. This does not relax absence
checks, which still require complete control inspection.

A colocated eval case may declare one activation class:

- `positive` — the owning skill should be the primary selected capability;
- `negative` — the owning skill must not be the primary selected capability;
  or
- `competition` — with every sibling skill in the plugin mounted, the owning
  skill should win as the primary selected capability.

The owning skill is derived from the case's colocated skill directory rather
than repeated as user-maintained metadata. A competition case without the
plugin skill set mounted is invalid. Skill-less experiment cases and no-skill
suite modes do not receive an activation grade because their target capability
is absent.
Composition cases may declare additional repository plugins or selected skills
from one. On Codex, the runner installs each provider as an independent local
plugin, retains its source bytes in the fixture identity, and validates
activation membership against the combined mounted skill set. A selected-skill
provider packages only those skills with its own manifests and mechanics. A
provider's files must not be folded into the owning plugin.

Activation is graded only from a normalized, harness-visible observation. A
direct host skill-invocation event is preferred. Codex cases that contain the
shared explicit-invocation placeholder use the runner-rendered host-native
invocation token as a controlled dispatch probe: the exact token must occur
once in a successfully completed turn. Codex cases without that placeholder
remain implicit-discovery probes and require the first completed read of a
mounted `SKILL.md`. Missing, duplicated, malformed, or failed probe evidence is
unavailable rather than a pass. The retained trial identifies the evidence
source, primary skill, and ordered observed skills. Final-answer resemblance,
hidden reasoning, and unbounded transcript capture are not activation evidence.
During Sevro migration, the Darrow extension grades a complete, normalized
host observation as a domain outcome separate from task checks. Explicit Codex
cases require the runner's exact-token dispatch receipt; implicit cases require
the mounted-skill read receipt. Each receipt is accepted only with its expected
host source and probe method. Missing, partial, or malformed observations yield
unavailable activation; they never change the task verdict. Other activation
forms remain unsupported until their mounts and host probes are represented
faithfully. Synthetic receipts remain available for implicit protocol parity
tests.
A later file reread of an explicitly dispatched owner does not select it again
or change its primary position. Native reconciliation still preserves the
observed order among supporting skills and fails closed on genuine conflicts.
Parent-work flags retain an ordinal and allowlisted operation category so an
unexpected control call can be distinguished from repository work without
retaining private arguments, submitted commands, or output.
For Claude selected-owner cases, the Darrow extension binds the foreground
Agent call, its first-line marker, nested skill calls, and the route resolver's
completed result to complete host evidence. The resolver must confirm the
selected agent before launch. Missing or malformed evidence is unavailable;
observed violations fail. Parent tool calls after the owner's result fail the
handoff boundary. A completed native Agent graph may prove a deeper nested
Skill call when the outer stream omits it. The full event artifact is
digest-checked and stays local.

Participant prompts that explicitly invoke the colocated skill use the shared
`{{skill_invocation}}` placeholder. The runner resolves it only at trial time
to the host-native public token. Plugin cases use the installed plugin namespace:
`$plugin:skill` on Codex and `/plugin:skill` on Claude Code. Repository cases use
`$skill` on Codex and `/skill` on Claude Code. The source case therefore stays
host-portable while each harness receives an invocation it can actually resolve.
An explicit Claude repository case must start its prompt with the shared
placeholder, followed by its arguments. An inline mention does not constitute a
native project command and is rejected before execution. Codex repository cases
may use the placeholder inline.

Claude may expand an explicit plugin command before the first assistant turn,
without emitting a Skill tool event. Accept that path only when the native
command matches the mounted plugin's namespace, skill, arguments, and session,
and the complete mounted skill body follows in that session before the first
assistant turn. Missing, partial, duplicate, or foreign-plugin expansion does
not establish activation. Retain only the bounded receipt, not the command or
skill text.

Legacy ticket-pipeline Codex evidence may repeat the owning installed plugin
qualification in child skill tokens. Reconciliation treats that exact
qualification as host transport syntax and compares the declared phase
capability by its leaf skill name; another plugin namespace is not equivalent.
This describes the historical phase checker, which retires with the legacy
runner. Current native observations do not establish those phase bindings.

Retained Codex collaboration evidence distinguishes a current host task label
from the stable child-agent reference returned by the launch. A valid bounded
task label must not cause an otherwise accepted launch event to disappear.
For review-route verification, the retained launch also preserves the
non-sensitive requested model, reasoning effort, and fresh-context setting
alongside its bounded axis marker and stable child reference.
Started and successfully returned launches remain distinct evidence; a start
event alone never becomes accepted-launch proof. Raw collaboration identifiers
outside the bounded public identifier grammar are omitted.
When `codex exec --json` omits collaboration calls, the runner keeps the
session only inside the trial's isolated configuration long enough to locate
the one rollout bound to the reported parent thread. It reduces native spawn,
start, acceptance, and wait records into the same bounded result evidence; the
full rollout and child prompt are never copied into the result. When the native
host encrypts that prompt, one unambiguous bounded axis token in the task name
supplies the retained review-axis marker; a task name containing both axes
supplies neither. A missing, ambiguous, or malformed parent rollout establishes
no accepted launch.

For configured feedback continuations, distinguish an agent accepted before
the actual feedback boundary from one first accepted in the resumed turn.
Compare native ordinals, not the serialization order of recovered records.
Missing or ambiguous boundary evidence remains unknown and cannot satisfy a
pre-feedback-owner requirement. Acceptance alone proves neither that ordering
nor successful feedback delivery.

Native goal controls are separate from adaptive-owner launch evidence. Retain
only their allowlisted names and source ordinals, never goal arguments or tool
outputs. A direct native function call establishes an invocation attempt; a
goal-control call expression in submitted code establishes only a code
reference, not that the expression ran. Neither establishes goal persistence,
adaptive delegation, or owner acceptance. Missing references cannot establish
non-use because dynamic calls and unavailable source remain unobserved.

Parent and child skill-read diagnostics from the retired collector are historical
evidence only. Current skill assertions use the common hook collection. Native
child-session availability and route facts remain separate and do not establish
skill exposure, read counts, or pre-owner ordering.

Before resuming a configured Codex follow-up turn, retain the first turn's
public final response at the feedback boundary, capped at 8,000 characters
with an explicit truncation flag. An absent response remains empty. This is
diagnostic output, not proof of an owner launch, message delivery, or skill
activation. Resumption must not overwrite the only evidence explaining why
the first turn ended; private reasoning and tool payloads remain excluded.

### Claude continuation through Sevro

A case's `follow_up_prompt` resumes the same native Claude session after a
successful initial turn. Both terminal results must identify the requested
session. A failed, malformed, missing, or foreign initial result prevents
resumption; a failed or unbound follow-up cannot produce a successful task
assessment. Both calls use the same isolated workspace, credentials, settings,
model, and effort. Explicit repository-command activation remains bound to
the initial turn.

Retained evidence includes the combined bounded event stream and separate
initial and follow-up streams when resumption occurs. A sourced
`sevro.claude.continuation` observation records the session and whether visible
worktree contents stayed unchanged before feedback, without retaining file
names or contents. Missing fingerprints remain partial with an unknown value.
The final response comes from the last turn; usage and cost are summed only
when all included host results supply valid measurements. These facts establish
session continuity and bounded state observations, without proving an owner
handoff or private message delivery.

### Semantic output checks

An eval case may declare one or more gating semantic output checks when the
public contract is a proposition that permits faithful paraphrase. Assertions
must accept the representations allowed by that contract. A compact mapping
table can satisfy a visual explanation; grading still requires its material
relationships and authority boundaries, without requiring exact policy words.
When a contract permits either a documented route or a separate request,
either satisfies that alternative. A prohibition on configuration changes
states a repair limit without requiring the literal word "repair".
Assess each finding's own disposition. An unresolved blocker does not make a
separate advisory blocking, and describing that advisory's resolution condition
does not make it a completion gate.
Reporting the changed state and a passing acceptance check conveys successful
verification. A prohibition on claiming permanent termination does not require
repeating an earlier non-ready finding in the final response.
The actual-state Codex Doctor case grades its required verbatim source records
deterministically: checked and used records name the same absolute isolated
configuration, and `checkout_config_used` is `no`. Keep the concurrency
and nesting control names in deterministic checks too. The exact names and
nesting applicability may appear in prose or helper records; the public skill
does not require `concurrency_control` or `nesting_control` field labels.
Preserve the exact control values, including the V1-only nesting qualifier,
and keep the three source-record checks unchanged.
Keep the configured concurrency and unknown live free-capacity distinction in
a separate, small semantic check without requiring a backend conclusion there.
A valid configured limit does not prove current free slots or resolve an unknown
backend. A recommendation alone does not report the diagnosed current setting.
Reporting configured capacity and comparing it with the topology is valid without
an extra live-capacity disclaimer. Reject an explicit claim that configuration
proves currently free slots or guarantees immediate spawning; do not infer that
claim from "adequate" within a configuration assessment.
For effective Codex configuration, concurrent threads and spawned-agent slots
describe the same concurrency limit. Accept either term when the completed
diagnosis reports the correct effective value. Keep that value distinct from the
topology's required minimum; supplied values or recommendations alone do not
establish a completed diagnosis.
Each check
has a stable name and a plain-language proposition. The runner grades all such
checks against the candidate's final response in a separate, hidden grader
call and requires every proposition to pass.

Semantic output checks are distinct from the advisory quality judge. Disabling
that judge does not disable semantic contract gates. The grader route, parsed
verdict and reason for every proposition, raw grader result, token usage, and
cost remain in the trial evidence. A grader failure, unavailable route,
malformed response, duplicate or missing verdict, or unrecognized check name
fails the affected trial closed.

When the public contract belongs to a saved free-form document, an eval may
declare a `semantic_artifact` with one repository-relative filename pattern and
gating propositions. The runner resolves exactly one regular file inside the
fixture, grades its contents independently of the final response, and retains
the path, route, verdicts, and grader evidence. Missing, ambiguous, unsafe, or
unreadable artifacts fail closed. Deterministic checks still establish the
document's existence, required metadata, and structural validity.

The grader receives the candidate response as untrusted quoted data and must
not follow instructions embedded in it. The rubric and propositions are
evaluator-owned inputs that are not exposed to the candidate. Cases use this
channel only for meaning: observable repository or external effects belong in
deterministic hidden checks, while exact commands, paths, identifiers,
protocol tokens, and specification-required canonical text remain rigid output
checks.

An unavailable, malformed, or incomplete observation is `unknown`, never a
pass or failure. Activation grades do not change task checks or task pass rate.
The runner gates a declared activation case independently at the suite
threshold and the report presents per-class results plus activation recall and
precision separately from execution outcomes. Recall is the share of measured
positive and competition trials where the owning skill was primary. Precision
is true selections divided by true plus false selections. A false selection is
a different non-null primary on a positive or competition trial, or the owning
skill becoming primary on a measured negative trial; correctly choosing an
adjacent capability on a negative trial is not a false positive. An incomplete
observation set or a zero precision denominator is reported as `unknown` rather
than averaged over the available subset.

The Sevro suite route retains an independent activation gate on each mounted
case that declares activation. It reports the declared class, target skill,
threshold, measured pass rate, and `passed`, `failed`, `unavailable`, or
`not_run` status. Cases without activation and unmounted controls are
`not_requested`. A missing trial or missing, duplicate, malformed, or
unavailable activation outcome leaves the gate unavailable and its pass rate
null. A failed or unavailable live activation gate makes the suite exit
unsuccessfully without changing Sevro's task verdict, checks, or exit code.
Dry preparation retains `not_run` and does not establish activation success.

The suite writes a separate `darrow-sevro-activation-v1` report with cell
gates and summaries grouped by mode and harness. Each group presents all three
activation classes, recall, and precision. Unknown trials leave the affected
class pass rate and group selection metrics null. Dry cells and unmounted
controls do not supply activation measurements. Grouping keeps distinct
conditions and host routes from being averaged together.

Sevro suite modes preserve `model_by_harness` and `effort` as candidate route
overrides. They replace the corresponding candidate CLI options for each cell
without changing semantic or advisory grader routes. The manifest retains the
requested overrides separately from actual Sevro route evidence. Missing or
contradictory candidate model or effort evidence makes the cell unsuccessful.
Comparisons across different candidate routes remain ineligible for matched
ablation deltas.

Suite `case_routes` maps supported harness names to exact case IDs and complete
model/effort routes. A mode enables these parent candidate overrides with
`apply_case_routes: true`. A selected case's route takes precedence over that
mode's candidate overrides; cases absent from the map keep the mode or CLI
route. An omitted or false flag leaves the map inactive. Grader routes and
owner-route expectations stay independent. Malformed maps and an enabled mode
without a map for a selected harness fail before any cell starts. The manifest
retains the declared maps, selected request, and independently observed route;
dry results remain unassessed and contradictory retained routes fail closed.

The Sevro suite route defaults an omitted `harnesses` declaration to Claude
and Codex, in that order. Repeatable `--harness` and `--mode` options select
supported hosts and named modes before any cell starts. Repeatable `--case`
filters replace the suite's filters, preserving the existing focused-run
contract. Invalid, duplicate, or unsupported host and mode selections fail
before execution. The manifest records the effective selections while the
source suite digest still identifies the complete input. Selecting only part
of an ablation does not permit a comparison with its missing counterpart.
When narrowing the harness selection, a host-options file may retain routes
for other harnesses supported by the complete suite. Every entry is validated,
every selected harness needs a route, and unknown harnesses are rejected. The
complete file digest remains in the manifest; only selected routes execute.

The existing `bun eval` and `evals/runner/run.ts` caller uses Darrow's exact
installed Sevro dependency by default. `SEVRO_PACKAGE_BIN` or `SEVRO_CHECKOUT`
selects an explicit override. Invalid explicit routes cannot fall back.
The caller preserves exact
skill/plugin ownership filters, repeatable case substrings, sorted case order,
candidate and independent grader routes, trials, threshold, jobs, dry runs,
skill overrides, unmounted controls, text conditions, evaluation-record checks,
and effective-owner assertions. Relative project, configuration, result, active
storage, skill, condition, and output paths resolve from the invocation directory.
Result storage defaults to the evaluated project's `evals/results`.

Repository evaluation runs use Sevro's runtime policy in the root `sevro.json`:
inherited `PATH` and uv-managed Python, a prepared public UV cache shared by
explicitly selected candidate and shell-check roles, native goals, and read-only access to the trial's
own native transcripts, which Adaptive Goal uses to observe its session route.
Sevro owns each role's private temporary storage and its temporary-directory
environment variables; repository policy cannot override them. A fixture recorder must reject empty input
before consuming a receipt slot; a failed upstream command cannot establish a
returned assessment. Callers launch Sevro with `PATH`
free of repository and Bun-injected entries, set `UV_PYTHON_INSTALL_DIR` when
unset, and warm the shared cache in place only when a registered lock changes.
Warming preserves existing cache entries and directory identity; it must not
delete or replace a cache that another evaluation may be using. Runtime profiles
select `runtime.sharedCacheDirectories` rather than copying the UV cache into
per-role seeds, and set `UV_PYTHON_DOWNLOADS=never`. Hooks and semantic/advisory
graders receive no cache grant unless their declared work actually needs UV.
Repository-skill guide trials select a hook-free runtime file because Claude
project settings conflict with native-goal hooks. It retains native transcripts
for complete control observations and skill-read recovery. With the repository's
default goal-enabled policy, Darrow compiles Codex runs with the `app-server`
entrypoint when no entrypoint was supplied. Explicit entrypoints and replacement
runtime files remain authoritative. An explicit
`--runtime-config-file` replaces either default.

The candidate defaults remain Codex `gpt-6-luna/medium` and Claude
`claude-sonnet-5-5/medium`; the semantic default is Codex `gpt-5.6-luna/low`.
An advisory judge is requested only by `--judge-harness`, with Codex
`gpt-5.6-sol/low` defaults. Requested Claude graders fail explicitly. Per-case
candidate routes override only the parent model and effort. The historical
default owner condition remains enforced and cannot become passive silently.
Native host options follow `--` and cannot override caller-owned routes,
conditions, roots, limits, or graders. Bundled-host enforcement and private goal
assertions remain explicitly unsupported.
The public Sevro `--codex-timeout-ms` option passes through unchanged, including
for native app-server trials. Sevro owns its value validation and execution bound.
The opt-in `--retain-host-diagnostics` flag also passes through unchanged to
selected native roles. Retention changes configuration identity, preserves
failure outcomes, and does not authorize publishing private diagnostic contents.

The direct caller uses the existing public selection command and its
`darrow-sevro-selection-v1` manifest. Stdout and optional `--output` contain that
manifest, rather than legacy arrays or terminal tables. The output file's
containing directory and the complete requested results root are created and
protected from isolated evaluated tools and shell checks. Protection includes
prior attempts, sibling cases, and selection manifests, even without
`--output`. Each selected case retains its original
public CLI result and exit category. The selection exits `1` for a case failure,
`64` for invalid invocation, and preserves cancellation's `130` or `143`.
The direct aggregate also exits `1` when requested live activation is failed
or unavailable at the requested threshold. Its manifest records that Darrow
gate separately; the public task verdict and exit code remain unchanged.
Dry preparation and unmounted controls do not fail this activation gate.
Dry and unknown evidence cannot become measured success. Terminal presentation
flags remain accepted for the plain JSON output. `--corpus-manifest` preserves
the selected corpus manifest: the direct caller resolves it from the invocation
directory, and the Sevro run entrypoint accepts an absolute path before `--`.
Unreadable or invalid explicit manifests fail before case execution. Repository
fixtures resolve their cache beside that manifest, verify the pinned revision,
license file and clean source, and retain the selected manifest's path and digest
with source provenance in `darrow-corpus-source-v1` evidence. The manifest and
its directory, source repositories and their worktrees remain protected from
evaluated tools and checks. The manifest contributes to evaluator identity;
a metadata change cannot silently reuse the same identity. Per-attempt corpus
evidence paths must not make otherwise identical corpus inputs appear different.
Reusing a results root with changed corpus metadata preserves prior source
provenance files rather than overwriting them.
The default manifest remains under the evaluated project's corpus directory.
The direct command accepts `--human-review-minutes` as a finite, non-negative
number of manually supplied minutes per trial. Zero is explicit; empty or
invalid values fail with exit `64` before creating selection storage or running
cases. The Darrow selection manifest retains `humanReviewMinutes` and
`humanReviewMinutesSource: "user_supplied"`; an omitted value retains both as
`null`. This annotation applies to the selected cases and remains in per-attempt,
latest, optional output, failed, and interrupted manifests. It does not assert
that a review occurred, establish a task assessment, enter Sevro grading or
evaluator identity, or become an automated duration, token, or cost measurement.
Dry and unassessed runs remain unassessed when the annotation is supplied.

The existing `bun run eval:orchestration` and `evals/runner/suite.ts` caller
uses Darrow's exact installed Sevro dependency by default. `SEVRO_PACKAGE_BIN`
or `SEVRO_CHECKOUT` selects an explicit override. An invalid explicit route
cannot fall back.
The caller preserves suite, harness, mode, case, trials, threshold, seed, dry,
and candidate and grader route options. Relative suite and output paths resolve
from the invocation directory; default output remains under the evaluated
project's `evals/results/<experiment>/<timestamp>`. An optional absolute
`--project-root` selects another evaluated checkout. Native host options follow
`--`; caller-owned selection, routing, condition, storage, and grading options
cannot be overridden there. Active-run storage remains a native forwarded
option; result storage is owned by the caller.

Candidate defaults remain Codex `gpt-6-luna/medium` and Claude
`claude-sonnet-5-5/medium`. The separate semantic route remains Codex
`gpt-5.6-luna/low`, and the optional advisory judge remains Codex
`gpt-5.6-sol/low`. `--no-judge` disables only advisory grading; dry execution
requests no advisory judge. Requested Claude grader routes remain explicitly
unsupported until Sevro supplies their native route. Mode and case candidate
overrides do not change either grader. The caller writes a retained host-route
argument file and uses the existing Sevro suite command for execution and
reports. Its stdout becomes that command's JSON summary, with the absolute
evidence directory on stderr. Public result categories, unknown measurements,
condition identity, and cancellation exits remain those of the suite route.
This is a deliberate output migration from legacy result arrays and console
tables. Unsupported private goal policy or bundled-host enforcement remains an
explicit failure; the caller never rewrites an enforced mode to passive.

The Sevro suite preserves benchmark `--seed` before `--`. A supplied seed,
including an empty string, deterministically shuffles the selected host/mode
blocks with the legacy suite's ordering rule. An omitted seed uses a generated
timestamp retained as `orderSeed`. The initial block list follows selected
harness order, then selected mode order. Within each block, cases keep their
sorted exact-ID order. Harness and mode selection lists describe the selected
set; they do not describe execution order.

Before the first public case command starts, retain the complete `cellPlan`
with consecutive one-based `index`, `harness`, `mode`, and `caseId` values in
execution order. Completed or cancelled `cells` are its executed prefix, with
the same indices and identities. Reusing a seed and the same ordered selections
reproduces the plan without changing any case, route, condition, grader, or
comparison-eligibility dimension. Ordinary cell failures do not skip later
planned cells; cancellation stops before the next one. This preserves legacy
block ordering while making the new per-case CLI calls explicit. The seed
does not establish measured task success or make unlike conditions comparable.

### Benchmark record checks

The Sevro run entrypoint accepts `--require-evaluation-records`; suite modes
preserve `require_evaluation_records`. The request enters Darrow's extension
configuration and retained redacted evidence. Applicable trials require exactly
one `evaluation_child_invocations` and one `evaluation_human_interruptions`
record in the complete final response. Each uses a nonnegative integer after
a tab or `: ` separator. These are self-reported counts, without an assertion
that native observations confirm their accuracy. Missing, malformed, or duplicate
records fail their named checks. Missing, partial, duplicate, or foreign final
response evidence remains unavailable. The checks add to existing task checks;
they do not replace task, activation, semantic, or advisory outcomes.

Preserve the legacy applicability exception for an adaptive-delivery mount. The
record request remains in configuration, while no standalone record checks
are declared for that mount. Ownership assertions remain in the selected case's
policy or an explicitly requested benchmark route check; suppressing record
checks does not establish ownership. Other mounted skills and unmounted
experiments retain the record check when requested.

### Task quality and bookkeeping reports

The Sevro suite writes a Darrow-owned `darrow-sevro-quality-v1` report beside
the generic Sevro report. Its JSON and Markdown distinguish task quality,
bookkeeping completeness, and the public task pass rate. Quality excludes only
the two named benchmark record checks from Darrow's benchmark grader. Other
task checks, including semantic and owner-route checks, remain required. The
report preserves public execution, grading, task, and exit states and names
each input result and retained evidence path. It preserves task verdicts and
the existing task and activation gate semantics.

Persisted suite cell result paths use canonical absolute file identities,
matching Sevro's public report input and row paths. A symlink alias to that
same result must not create a missing-report or unmatched-ablation outcome.
Retain exact input count, order, case and provenance checks; canonicalization
does not permit a missing, additional, duplicate or foreign result.

A quality rate requires completed execution and grading, an executed trial,
and assessed non-record checks under the default task policy. A selected custom
task policy remains explicit and leaves this default quality metric unavailable.
Bookkeeping uses both declared record checks; an omitted record policy or the
adaptive-delivery exception is not requested. The suite retains whether Darrow's
resolved case declared bookkeeping checks, so an empty dry outcome list does
not imply that the policy was omitted. Missing trials, unavailable checks,
execution or grading errors, and dry or unknown execution cannot become
successful measurements. Their rates stay null with an explicit reason. An
otherwise correct answer with a failed record check may have quality rate one
and bookkeeping rate zero while the public task still fails.

Rows retain per-trial assessments. Groups keep mode, harness, requested and
actual condition, and candidate route separate and do not average over
unavailable trials. Invalid
or inconsistent public result/evidence inputs remain unavailable and make the
report unsuccessful. The suite retains the diagnostic and fails without
rewriting those input artifacts. Advisory assessments and activation stay in
their existing separate evidence; they do not enter the quality-check rate.

### Benchmark owner-route checks

The Sevro run entrypoint preserves `--assert-effective-owner-routes` as a JSON
map of exact case IDs to model and effort expectations. Suite modes preserve
`effective_owner_routes`. A selected case's expectation enters extension
configuration and retained evidence separately from the parent candidate route.
It adds the named native effective-route check without changing other checks
or launch inputs. Unselected map entries do not change focused case selection.

This check requires one complete, sourced Codex native acceptance receipt with
correlated launch, host-start, and acceptance ordinals. Exactly one accepted
child must use `forkTurns: none` and the expected model and reasoning effort.
An observed mismatch or a complete observation with no unique accepted child
fails. Missing, partial, duplicate, foreign, malformed, or route-incomplete
evidence remains unavailable. The receipt establishes the applied route;
contract selection and private launch intent are not inferred.
Expectations require a bounded nonempty model identifier and one of `low`,
`medium`, `high`, `xhigh`, `max`, or `ultra`. Invalid maps fail before execution.
The legacy effective-route check is Codex-specific. A Sevro suite requesting it
for Claude fails preflight explicitly; standalone preparation rejects that
unsupported host route. Dry preparation remains unassessed. Suite retained
configuration must agree with the selected case's requested expectation.

The canonical `profile-impact-suite.yaml`, `localized-routing-policy-suite.yaml`,
and `promoted-routing-suite.yaml` compare task outcomes and independently
observed native owner model/effort routes. They declare Codex scope explicitly,
preserve their case selections and benchmark conditions, and bind each owner
expectation through mode `effective_owner_routes`. Parent `case_routes` remain
separate. Dry results stay unassessed.

These suites retire the legacy `goal_expectations` and
`apply_expected_goal_routes` fields and private goal profile, workflow, risk,
and selected-versus-effective contract assertions. Existing experiment and
mode names and condition instructions remain historical labels and task
inputs; they do not establish those private dimensions. Historical snapshots
retain their original interpretation and cannot be relabeled as matched native
route comparisons. The suites preserve their enforced condition default.
An unsupported bundled-host enforced request must still fail explicitly;
this migration neither converts it to passive execution nor restores removed
preflight machinery.

Each canonical suite also provides explicitly named `-passive` variants of its
existing modes. A passive variant preserves the case set, condition instructions,
mounts, task and record checks, parent routes, and native owner-route expectations
of its corresponding mode, and declares `owner_evaluation: passive`. Its retained
cell condition and evaluation identity remain passive. The original mode keeps
its enforced condition, and unsupported enforced execution still fails explicitly.
Callers select the passive mode names when requesting native observational
comparisons; selecting all modes also selects the original enforced variants.
This adds no policy enforcement, launch rewriting, or benchmark correction.

### Deprecated ticket-pipeline baseline

The deprecated ticket-pipeline baseline keeps task outcomes and explicitly
requested self-reported evaluation counts through shared benchmark checks.
It gains no dedicated grader, phase instrumentation, or active benchmark
correction. The legacy phase, iteration, stable child ID, and phase-to-skill
assertions are deliberately retired. Native agent acceptance alone cannot
establish those facts. Recorded historical results keep their original
interpretation and cannot become current phase-check passes.

The existing record checks validate declared counts rather than independently
observed child totals. Generic host usage retains its own completeness and
provenance; retired route rows cannot establish child token totals or repair
incomplete usage. Named task-check metrics remain independent from these counts.
No legacy goal-loop machinery or private completion format is restored.

### Benchmark conditions

The Darrow Sevro run entrypoint accepts an absolute benchmark condition file
separately from Sevro's passive or enforced execution condition. It prefixes
the initial case prompt with the trimmed instruction text and preserves the
follow-up turn without adding the prefix again. In both prompts,
`{{harness}}`, `{{model}}`, and `{{effort}}` use the selected
candidate adapter's negotiated route context. The condition label and original
UTF-8 content digest enter retained configuration and evaluation identity.
Condition files are bounded, protected source inputs; malformed, unreadable,
or unsupported templates fail before candidate execution. Unmounted controls
preserve the same condition text. Native invocation placeholders retain their
existing declaration and host dispatch requirements.

Sevro suites preserve mode `condition` and `condition_by_harness` declarations
as benchmark instruction inputs. A host-specific file takes precedence over
the shared file; absent host overrides use the shared file or no prefix. Paths
resolve relative to the suite file. Selected inputs are validated before cells
start. The manifest records each cell's absolute source path, mode label, and
original content digest separately from its passive or enforced condition.
Each cell checks its condition bytes against the preflight digest before
candidate execution. A changed input makes the cell unsuccessful; it cannot
start under the previously recorded input.
Suite preflight validates each mode's combined case and condition templates
without inventing a candidate route. It checks activation and unmounted-control
eligibility for that mode and host. Actual route rendering remains in Sevro's
case-resolution lifecycle.
The suite verifies its condition label and digest against Sevro's retained
redacted extension configuration. Missing or contradictory configuration makes
the cell unsuccessful without changing Sevro's raw task verdict or exit code.

### Evidence lifecycle

Sevro does not supply `DARROW_CACHE_DIR` to candidates or shell checks. Darrow's
locked launchers select their documented cache beneath the isolated `HOME`.
With a selected Sevro runtime policy, each execution role receives a private
home and writable runtime outside the Git fixture. Candidate and checker homes
and Darrow caches are separate. Only the explicitly
declared public UV dependency cache is shared across selected roles and runs;
project environments, homes, temporary files, and Review state remain private.
Shared-cache identity binds its source, target and roles, not mutable contents;
equal identities cannot establish identical dependency-cache bytes. Isolated
fingerprinted seeds remain appropriate when dependency independence is required.
Disposable checker state, including copied seeds, is removed after grading even
on failed or retained fixtures, while shared sources and result evidence survive.
Caller cache overrides and credentials are not inherited. This deliberately
replaces the legacy shared Darrow cache environment contract without changing
the plugin launcher's public default or introducing Darrow policy into Sevro.

The `.fixture-state/` receipt convention does not relocate a plugin's public
state when its contract requires state outside the repository. A grader must
use retained evidence bound to the candidate's actual state, not the checker's
private home or a retired candidate-home path. Missing or inaccessible state
cannot establish either artifact presence or artifact absence.

Review artifact evals explicitly select Sevro's bounded
`runtime.artifactDirectories` grant for `.darrow/reviews` beneath the candidate
home. Graders use its candidate-bound `SEVRO_CANDIDATE_ARTIFACT_REVIEWS` path and
read the original files without relocating them. Access stays read-only through
grading; candidate runtime cleanup follows grading and evidence persistence.
The grant does not archive those files. Missing or unsafe declared directories
are grading errors; fixture setup prepares an actual empty directory before
checking absence. The selected Review profile may explicitly configure Darrow
state and cache paths without inheriting the caller's overrides. Cases that
depend on a declared state-directory grant state that configured state and
cache paths must be preserved. A different valid private state root remains
outside that grant; do not claim artifact presence or absence from it.

Fixture setup and candidate commands share the same private
trial home. Setup initializes required artifact directories and may seed prior
Review evidence there; its temporary directory remains disposable. Graders
retain their own homes and access only declared candidate artifact grants.
Fixture input receipts may use `.fixture-state/`, while canonical scopes and
reports remain in the private Review state root.

Trusted fixture preparation records the selected bundled host as `codex` or
`claude` in `.git/fixture-host`. Other adapters record `unavailable`. Shell
oracles use this prepared fact rather than an undeclared ambient host variable;
it identifies preparation and does not prove a native child route.

Shell checks execute candidate-controlled code inside the runner's outer
isolation boundary, including during dry runs. Grading uses a private,
credential-free environment and cannot access source worktrees, peer fixtures,
harness credentials, or modify retained evidence. An unavailable isolation
boundary is an explicit error.

Plugin-local skills prepared for project discovery retain the owning plugin's
contained backend under `.agents/backend`, alongside `.agents/skills/`. Plugin
configuration and shared references retain their plugin-relative paths below
`.agents/` so an implicit mount has the same mechanics inputs as its package. This
includes implicit Codex preparation and adapters that use the project skill
surface. Retain both owning plugin manifests at `.agents/.claude-plugin/plugin.json`
and `.agents/.codex-plugin/plugin.json` with their original names and versions,
so the locked backend launcher can establish its plugin identity. Copy only
those manifest files, not plugin hooks or agent registrations.
The backend, configuration, references, and manifest source bytes participate in fixture identity and their
artifacts remain Git-excluded and subject to the shared artifact limits. Native
plugin preparation retains the backend inside its independent plugin package.
Project discovery does not copy plugin hooks or agents into project settings.

Plugin cases may declare `required_plugin_hook: <plugin-name>` to evaluate an
installed plugin hook. Preserve implicit prompts: this declaration installs the
native plugin package without adding a skill invocation. It requires the public
`sevro.host.hooks` observation and a matching runtime `hooks.plugins` allowlist.
One complete receipt must identify the declared plugin as the sole allowed
plugin and retain at least one completed successful hook execution. A disabled
hook, no execution, or a failed execution fails the check. Missing, duplicate,
partial or malformed receipts remain unavailable. Do not infer hook execution
from packaged files, hook configuration, native-goal hooks or skill activation.
The current receipt does not attribute executions among multiple allowed
plugins; such evidence remains unavailable. Hook output delivery is a separate
native check and does not establish skill activation. Hook-free controls retain
their original runtime profile and evidence rather than being relabeled.

Packaged Python eval oracles remain hidden from participants. Plugin mounting
excludes every nested `evals/` directory, including `backend/tests/evals/`.
Fixture setup may copy grading helpers to `.git/eval-checks/`; the outer agent
sandbox denies reading and writing that subtree, while isolated grading may
execute it. Declared external isolation must preserve this boundary too.

Review route checks select the declared aggregate kind: `result.json` for
comprehensive review or `verification.json` for fix verification. Exactly one
finalized scope of that kind must exist. The original comprehensive scope may
coexist with a follow-up verification scope; it neither makes the follow-up
ambiguous nor supplies its reader identities. Missing or multiple selected
scopes remain unavailable, and selecting an artifact does not replace native
launch evidence or canonical result validation.

Codex Review route graders read the trial-bound public native transcript view
from `SEVRO_CANDIDATE_TRANSCRIPTS`. They require a complete candidate capture,
verify each indexed file digest, and correlate the requested spawn, native
start, accepted result, child session and completed reader turn. Both selected
axes must belong to one coordinator turn and be accepted before its first wait.
Retired `retained-harness.jsonl` labels cannot establish current native routes.
Missing, partial, mismatched or uncorrelated evidence fails closed.

Adaptive Goal's real-Review completion fixture resolves its validation provider
from the prepared `.sevro-marketplace/.claude-plugin/marketplace.json` catalog.
It requires exactly one declared `darrow-review` package with matching Codex
and Claude plugin identities. Undeclared copies in Git metadata are not
providers. Missing, duplicate, malformed, or escaping catalog sources refuse
completion; the fixture must not search unrelated packages or private caches.
Its completion launcher uses the owning mounted package's frozen bootstrap and
the provider's documented private state root. After successful validation it
records that absolute root alongside the selected artifact receipt. Grading
must read that same artifact; a separate grader home or a receipt by itself
cannot prove a review. State inside the repository cannot clear completion.

Codex trials may import the repository's explicit agent-concurrency limit into
their isolated configuration. They must not inherit unrelated repository or
user settings. Capture the limit once per runner process, include it in the
evaluation identity for each Codex role, and retain the configured candidate
limit in case and trial evidence. A missing limit uses the host default;
malformed or unreadable configuration is an error.

Each finished trial is persisted atomically, with its complete bounded result
evidence and case/run provenance, before fixture cleanup or completion feedback.
A later failure or interruption cannot erase those results. Partial attempts
remain inspectable and explicitly incomplete; they are not complete suite
evidence. Retrying preserves the previous attempt's artifacts.

Trial and case artifacts identify dry versus executed trials. Dry preparation
checks remain inspectable but produce no behavioral success or comparative
scores. Historical execution mode may be recovered from an explicit suite
manifest; absent provenance stays unknown.

### Retained research

Darrow no longer ships interpreters or comparison commands for pre-Sevro result
arrays, suite manifests, trial checkpoints, or reviewer-routing proof formats.
Their tests and compatibility entrypoints are removed. Historical snapshots and
research remain in their recorded formats with their original provenance; they
do not establish current evaluator equivalence or live behavioral stability.
Current reporting uses Sevro's public report command and Darrow's suite reports.

Equivalent-run recovery follows [SE-C22](#invariants); process identity includes
protection against PID reuse. Recovery never discards retained evidence.

Raw result bundles remain gitignored. A reviewed tracked snapshot may preserve
the suite definition, pinned harnesses and models, effort, trial count,
quantitative results, observed failures, limitations, and the exact raw result
location or digest. Promotion or behavior-value claims require enough fresh
trials for their risk and must not rely on one convenient green run.

### Terminal experience

The direct evaluation command presents long-running work as a bounded run with
an explicit target, total workload, configured worker count, live trial
progress, and a final case-level summary. The positive `--jobs` option bounds
simultaneous trials and defaults to three. Use `--jobs 1` when diagnosis or
rate-limit constraints require serial execution.
Interactive serial runs receive color, status symbols, and an updating progress
bar by default. Concurrent runs use per-trial status lines instead of a
single-trial animation. Passes are green, failures are red, and unknown or
skipped states remain visually distinct; this applies to activation as well as
task outcomes. Users may independently disable color, status symbols, and
animated progress, while `NO_COLOR` and non-interactive output produce stable,
unanimated logs without hiding outcome text.

The completion view summarizes passed and failed cases across repeated trials
and always prints the absolute raw-result path. On capable interactive
terminals that path is also an OSC 8 file hyperlink, while its visible text
remains copyable and useful when hyperlinks are unavailable.

## Invariants

Each identifier remains a normative coverage target. A linked entry incorporates
the named contract section rather than defining a second copy of its rules.
Evaluation requirements below specify evidence obligations, not alternative
behavior. The [consolidation map](../research/repository-guidance-consolidation-277.md)
records the removed repetitions and their retained authority.

For `adaptive-goal` policy-assistance provenance and matched framing comparisons,
follow [ADL-E2](adaptive-goal.md#adaptation-and-evaluation-fidelity-102).
Record requested mode and actual per-trial assistance separately and expose both
in reports. Enforced trials measure the skill plus eval assistance; missing
historical provenance stays unknown. Missing route or token evidence does not
prove equivalence or savings. Matched framing comparisons also hold acceptance
checks and harness constant.

- **SE-C1 — Complete traceability scan.** See the complete report inventory in [Invariant coverage](#invariant-coverage).
- **SE-C2 — Coverage is not correctness.** See the distinction between coverage gaps and integrity failures in
  [Invariant coverage](#invariant-coverage). An exercised invariant does not
  establish a passing live result.
- **SE-C3 — Fail closed on invalid evidence.** See the refusal conditions in [Invariant coverage](#invariant-coverage).
- **SE-C4 — Read-only inspection.** See the read-only boundary in [Invariant coverage](#invariant-coverage).
- **SE-C5 — Ablation isolates skill presence.** See the matched dimensions and no-skill baseline in
  [Matched skill ablation](#matched-skill-ablation).
- **SE-C6 — Task-level comparative evidence.** See the per-case, per-harness results and invalid-comparison rules in
  [Matched skill ablation](#matched-skill-ablation).
- **SE-C7 — Unknown stays unknown.** Missing cost, token, judge, or other optional measurements remain
  unavailable, never coerced to zero or silently dropped from one side; apply the reporting rule in
  [Matched skill ablation](#matched-skill-ablation), including outside ablations.
- **SE-C8 — Reproducible suite evidence.** A suite manifest records the named
  modes and ablations, runner revision and patch state, harnesses, models,
  effort, trial count, threshold, result paths, and cell exit states needed to
  inspect the comparison later.
- **SE-C9 — Explicit activation classes.** Activation cases declare positive,
  negative, or sibling-competition intent; the runner derives the target from
  the owning skill, rejects structurally invalid competition cases, and does
  not grade a target that was not mounted.
- **SE-C10 — Observable activation evidence.** Activation grades retain the
  direct host event or explicitly labeled controlled-probe source, primary and
  ordered observed skills, and preserve unavailable or incomplete observation
  as unknown without changing task outcomes.
  A separately complete primary/positive-presence receipt may prove only its
  declared claims within a partial collection; absence and sequence assertions
  still require complete collection. Retain the cited evidence scope so a
  primary claim is never reported as complete collection coverage.
  Codex per-skill body exposure and collection health remain distinct. Preserve
  RC.21's `skillExposures`, `collectionStatus` and positive exposure receipts in
  retained evidence. Full exposure proves complete prepared-body exposure to a
  tool caller; partial exposure proves fragments. Neither proves primary
  selection, order, compliance or absence. Missing fields in older evidence
  remain unknown; do not backfill them from activation lists.
  An established explicit Codex invocation may combine with a separately
  complete RC.21 positive-exposure receipt to establish supporting-skill
  inclusion. Each required support must have `full` exposure in that receipt.
  The aggregate catalog observation is a separate diagnostic, not an additional
  proof requirement. Partial exposure never satisfies a full read;
  missing positive membership stays unknown. Retain explicit ownership,
  unordered positive members, aggregate completeness and collection health
  separately. This receipt supplies no implicit primary, absence or sequence.
  A passing result cites only the complete receipts that establish its claim;
  an incomplete aggregate remains diagnostic metadata, outside its evidence refs.
  Claude route observations match the shipped scoped agent names, model IDs,
  and effort levels. Static route selection, accepted launch, and candidate
  self-report do not establish the applied model and effort; use correlated
  native evidence. An agent name alone does not establish goal ownership or
  successful route application.
- **SE-C11 — Separate activation reporting.** Reports preserve per-case and
  per-class activation results and compute recall and precision only from a
  complete measured set, so task success cannot hide routing failure and one
  observable trial cannot hide another unknown trial.
- **SE-C12 — Host-native explicit invocation.** A colocated case that uses the
  shared skill-invocation placeholder receives the owning skill's public
  host-native invocation token without changing its participant-visible intent,
  fixture, hidden checks, model, effort, or trial count.
- **SE-C13 — Namespace-tolerant Codex reconciliation.** Codex child-route
  evidence accepts owning-plugin-qualified skill tokens while preserving the
  exact plugin, phase, iteration, stable child ID, thread ID, and leaf-skill
  checks.
- **SE-C14 — Gating semantic contracts.** Prose propositions that permit
  paraphrase use evaluator-owned semantic output checks whose every verdict
  gates task success independently of the advisory quality judge.
- **SE-C15 — Fail-closed semantic evidence.** The runner rejects unavailable,
  malformed, incomplete, duplicate, or unexpected semantic grader results and
  retains the grader route, verdicts, reasons, raw result, tokens, and cost.
- **SE-C16 — Legible terminal feedback.** See [Terminal experience](#terminal-experience).
- **SE-C17 — Role-specific Codex defaults.** Candidate execution, advisory
  quality judging, and gating semantic-output grading resolve independent
  GPT-5.6 model defaults, preserve explicit model and effort overrides, and
  record the exact effective route in manifests, JSON result evidence, and
  generated reports.
- **SE-C18 — Invocation-aware Codex activation.** Explicit Codex activation
  cases use one exact runner-controlled host invocation as dispatch evidence,
  while implicit cases retain the mounted-skill read probe. Installed skill
  roots contained by the fixture repository are recognized in both absolute
  and repository-relative command paths. Indirect shell reads through variables,
  working-directory changes, conditional branches, bounded pathname loops, or
  discovery commands require a successful read-capable command and frontmatter
  matching a skill that actually exists under a mounted root. A pathname loop
  may use literal paths or rooted pathname globs and a file-existence guard;
  its reader must consume the bound loop variable without reassignment. A
  bounded literal separator displaying only that same filename before the read
  does not invalidate it; separator output never supplies skill-body evidence.
  Other intervening commands or dynamic formatting remain unverified. Quoted
  wildcard characters remain literal, and ambiguous expansion stays unknown.
  Missing or ambiguous evidence stays unknown and both
  paths preserve source, primary skill, and ordered observations independently
  from task success.
- **SE-C19 — Isolated grading execution.** Shell checks and their descendants
  retain outer isolation and a credential-free environment in live and dry
  runs, while authorized fixture checks remain functional. Isolation failures
  never fall back to unrestricted host execution. Cleanup handles read-only
  dependency caches in evaluator-owned scratch space. If cleanup cannot finish,
  it reports the retained absolute path without discarding grading outcomes or
  replacing the original execution error.
- **SE-C20 — Durable incremental evidence.** Every completed trial's full
  bounded evidence and provenance survive later errors and interruption.
  Persistence precedes cleanup and completion reporting, concurrent completions
  cannot overwrite one another, and incomplete attempts remain distinct from
  completed result bundles.
- **SE-C21 — Dry is unmeasured.** Artifacts retain execution mode; dry or
  unknown execution provenance cannot produce behavioral or comparative scores.
  Fixture preparation results are independently inspectable.
- **SE-C22 — Recoverable run ownership.** Equivalent-run ownership is acquired
  and reclaimed atomically using verifiable process identity. Live or unknown
  ownership blocks duplicates; confirmed abandonment permits retry while
  preserving prior evidence. Ownerless legacy or unverifiable records require
  explicit diagnosed recovery, never automatic expiry based only on age.
- **SE-C23 — Complete explicit composition evidence.** Explicit Codex
  observations retain the invoked primary first and all verified supporting
  reads in order, without duplicate skills. Every supporting observation
  requires a complete mounted skill body. Sequence and exclusion checks use
  that complete observation; invalid dispatch or stream evidence stays unknown.
  Exact source pages from one actor may overlap or repeat: complete source
  coverage establishes the read without requiring duplicate-free concatenation.
  Missing intervals, altered content and pages split across actors do not.
  Exact source coverage may be embedded in compound command output; unrelated
  returned text neither contributes coverage nor erases verified source bytes.
  A yielded Codex command may expose its early output only in tool-result
  chunks. Recover those chunks only when their process identifier binds to one
  completed native command in the same actor's session, before that completion.
  Keep the existing successful mounted-read and complete-body requirements;
  unmatched, ambiguous, late, or cross-actor chunks establish no read. Retain
  bounded recovery facts, never tool output or skill text. Diagnostic fields
  distinguish the completed command's output from recovered earlier chunks.
  A completed executor result may also carry the complete body while the native
  command output is empty. Recover its plain text only when one unique matching
  executor call encloses exactly one native command completion, with no
  interleaved tool calls, duplicate results, or reused command identity in the
  same actor. The host's completed-executor envelope and the complete mounted
  body remain required. Arbitrary objects and printed nested result JSON cannot
  supply this evidence. Retain this recovery separately from yielded chunks.
  When plain output arrives before its native command completes, bind it only
  through a unique unconditional top-level awaited `tools.exec_command` with a
  literal command and direct `text(result.output)`, plus one matching completed
  native command in the same actor. Reject dynamic or conditional code, changed
  output, mismatched working directories, duplicate commands or results, and
  missing completion. Submitted code alone never proves execution. Retain only
  the recovery fact, not submitted code or output.
  Parent read diagnostics remain available when a review launches multiple
  independent readers; diagnostic retention requires no single-owner claim.
  Native recovery reconciles completeness and shared read-order anchors without
  repairing invalid explicit dispatch. Conflicting source orders remain
  unknown; recovered earlier reads are not appended after known later reads.
  If the stream first exposes an incomplete mounted read and only credits its
  later reread, a native complete read may recover that skill's earlier
  position when the stream's own first-read attempts agree with that position.
  Retain the stream/native orders and recovered skills as bounded diagnostic
  facts. Without that earlier stream anchor, a disagreement remains unknown;
  native ordering must not silently override a contradictory complete stream.
  Child launch-list order is not skill-read order. Multiple children adding
  unanchored supporting reads leave the ordering evidence incomplete.
- **SE-C24 — Current Codex collaboration evidence.** A valid native task label
  is not mistaken for a conflicting child-agent reference. Retained accepted
  launch evidence preserves the stable child reference, bounded task label,
  requested model, reasoning effort, fresh-context setting, and permitted
  review-axis marker needed to verify route application without retaining the
  rest of the child prompt. A start without a correlated successful return is
  retained only as an attempt, never as accepted-launch proof; unbounded raw
  collaboration identifiers are omitted. A unique parent-thread rollout may
  supply this evidence when CLI stdout does not, but its full transcript never
  enters the retained result. Encrypted child prompts bind review axes through
  one unambiguous bounded task-name token rather than prompt inspection.
  Bounded nested-reader observations use the same task/axis binding. An
  available child session alone does not establish a returned assessment:
  retain completion only when its final assistant message matches the same
  turn's later native completion event. Missing, ambiguous, malformed or
  interrupted result evidence remains unavailable. Retain bounded route/axis
  and completion facts without prompt or result bodies; assessment claims must
  also be supported by the case's candidate-bound provider result and checks.
  Darrow's nested-reader check MUST preserve an unavailable reader-result
  observation as unavailable, rather than infer failure to return. Complete
  evidence of missing required readers or inherited context still fails.

- **SE-C25 — Select cases by owning skill.** See exact skill ownership, case filters, mounting independence and
  empty-selection refusal in [Direct case selection](#direct-case-selection).

- **SE-C34 — Case-declared hosts and routes.** Filtered and ownership
  selection omits cases whose `harnesses` exclude the requested host and
  applies a case's `candidate_routes` as its default parent candidate route on
  each declared host, below explicit per-case routes. Grader routes are
  unaffected; malformed declarations fail resolution.

- **SE-C26 — Select cases by owning plugin.** See exact plugin ownership across kinds, intersecting filters and
  empty-selection refusal in [Direct case selection](#direct-case-selection).

- **SE-C27 — Native repository-skill cases.** The runner discovers canonical
  `.agents/skills/<name>/evals/*.yaml` cases alongside plugin and experiment
  cases. These have an owning skill but no owning plugin. On Codex it mounts
  the canonical `.agents/skills/<name>` entrypoint; on Claude it mounts the
  corresponding `.claude/skills/<name>` entrypoint and refuses a missing one.
  Repository cases use project-skill discovery and native explicit invocation,
  never a synthetic guide plugin. Host mirrors are not discovered twice;
  candidate overrides and no-skill controls preserve case ownership. Hidden
  checks stay outside participant mounts, and ordinary fixture isolation
  remains in force. Coverage includes repository cases by default.
  Claude native project-command activation can be established by one exact
  command with matching arguments and a complete host-injected mounted body,
  in the correlated session before its first assistant turn. Missing,
  malformed, partial, stale, duplicate, or mismatched native evidence does not
  prove activation. Retain only the bounded receipt, not command/body text.
  A rejected or unavailable receipt keeps explicit activation unknown, even
  when later ordinary skill events name the same owner. Preserve those observed
  events without treating them as accepted native-command dispatch.

- **SE-C28 — Public runner compatibility.** Before replacing the in-repository
  runner with a packaged release, run the same deterministic command-level
  cases against both public commands. Compare selected cases, check outcomes,
  evidence completeness, passive/enforced conditions, retained artifacts, and
  exit categories. Normalize only variable fields and document intentional
  contract changes separately.
  A manually selected published candidate must bind an exact package version
  and SHA-256 before installation; ranges and distribution tags are invalid.
  The published package is `@bjoernrochel/sevro`; its public command remains
  `sevro`. Package provenance must retain the scoped name.
  Normal Darrow execution must resolve the exact development dependency from
  the Darrow tooling installation, independently of the evaluated project and
  invocation directory. Its installed public manifest must match the declared
  exact version. Missing or mismatched installations fail explicitly. An
  explicit `SEVRO_PACKAGE_BIN` or `SEVRO_CHECKOUT` remains a candidate or
  development override; empty, relative, or conflicting overrides fail without
  fallback. A checkout retains its distinct revision and patch identity.
  The installed integration gate must clear source-checkout overrides, retain
  the verified archive and package identity with its logs even on failure, and
  exercise the public command without package Git metadata. This candidate gate
  does not replace automatic verification of the eventual frozen dependency pin.
  Pull-request and push CI must install the frozen exact pin and exercise the
  public CLI/protocol and Darrow domain gate with both runner overrides cleared.
  Retain the installed package identity, lock digest, Darrow revision, and test
  log even on failure. Any host sandbox or fixture-tool prerequisites belong to
  the declared compatibility matrix; these checks make no live model claim.
  Darrow-owned oracle and repository-tooling tests belong outside the generic
  runner tree. They may execute their owning plugin's public oracle, but must
  not import runner implementation or private runner types. Their input types
  describe only the domain fields that the oracle consumes.

- **SE-C29 — Independent direct runner roots.** An explicit project root
  controls case and supporting-asset resolution and the default result path;
  an explicit configuration root controls imported Codex settings. Candidate
  execution and shell grading protect both roots, their Git worktrees, and the
  runner's own source. Normal execution does not require runner Git metadata.

- **SE-C30 — Independent direct runner storage.** The results and run-state
  roots may be configured separately from the runner installation and project
  checkout. Result bundles, ownership records, and trial checkpoints land in
  their configured locations. Candidate execution and shell grading protect
  both storage roots and any explicit result and diagnostic files.

- **SE-C31 — Bounded no-agent evidence.** A Darrow transcript assertion that
  no agent launched may migrate to a check over the complete Codex native-call
  observation when the assertion has no other condition. Any observed agent
  spawn attempt fails the check. Missing, partial, duplicate, or malformed
  native-call evidence makes the check unavailable; absence from CLI output
  alone cannot prove that no agent launched. A combined repository-guide
  assertion forbidding both owner launch and native goal control uses the same
  complete observation. Spawn, accepted-owner, `create_goal`, or `update_goal`
  evidence fails it; checking spawn absence alone cannot satisfy that assertion.
  Other transcript assertions remain
  unsupported until an equivalent evidence source and grader are defined.

- **SE-C32 — Ledger absence across host evidence.** A migrated assertion that
  forbids specified retired preflight or ledger text and native `create_goal`
  attempts checks the bounded retained Codex event artifact and complete native
  call observation together. Only the terms named by the case are graded. A
  matching event or a goal-control attempt fails the check. Missing, altered,
  incomplete, or contradictory evidence leaves it unavailable. The raw event
  text is never copied into the graded result.

- **SE-C33 — Native goal evaluation entrypoint.** An explicitly selected Codex
  app-server entrypoint hosts the original main thread with the same isolated
  environment, installed plugins and passive observation as the exec adapter.
  It submits the requested user input once and observes native continuation;
  it never creates, replaces, completes or resumes a goal on the participant's
  behalf. An active goal keeps the session open after a completed turn. A terminal
  goal state requires the associated completed turn and its final response before
  shutdown. Failed/interrupted turns, protocol failures and time bounds remain
  failures with retained evidence. No-goal runs may return at completed-turn
  boundaries. Only an explicitly supplied follow-up user prompt starts another
  client-requested turn. Deliver that prompt after a completed response in the
  original thread, regardless of whether its goal remains active. Retain the
  response and actual pre-feedback worktree boundary before delivery. Do not
  require the participant to complete or block its goal to receive user input.
  A later in-flight native turn defers delivery to a settled response boundary;
  it does not authorize interrupting the goal or inventing continuation input.
  Results identify the entrypoint and preserve bounded
  root-thread, turn and goal-state evidence without private reasoning. Existing
  exec results and defaults remain distinct and unchanged.
  A check requiring a specific host observation declares that identifier as
  required evidence. A conditionally consumed observation is validated when
  used. Missing, incomplete or contradictory evidence remains unavailable.
  Native goal history and ledger-only checks do not require a complete control
  receipt merely because the host emits one. Declare control receipts only for
  checks that consume them; unrelated partial inspection must not make otherwise
  complete goal and ledger assessments unavailable. Genuine control-absence and
  implementation-route requirements remain mandatory.
  Dual-host implementation-route checks require the shared native control
  receipt and validate the applicable host's facts when grading. Codex routes
  use correlated accepted spawns. Claude routes bind the normalized Agent call
  to its unique native invocation and successful tool result in verified host
  events. A launch attempt alone is unavailable. Grade readiness and skill
  absence only from valid complete call records, including valid empty records.

## Evaluation requirements

Test ownership follows the runner boundary. Sevro proves scheduling, isolation,
host continuation, built-in graders, cancellation, and evidence persistence in
its own repository. Darrow tests case translation, caller option forwarding and
response handling and repository policy. A small
installed-package integration suite checks the connection. Darrow does not
repeat the engine's implementation matrix or compare against a retired runner.

The requirements below describe needed evidence across both repositories.
Engine and host mechanics belong to Sevro; Darrow retains the corresponding
request translation and domain-policy checks.

1. Coverage fixtures include covered and uncovered IDs, comma-separated case
   references, duplicate spec IDs, unknown or retired references, malformed
   YAML, unreadable or absent inputs, and strict versus report-only behavior.
2. Coverage tests prove that the command leaves its fixture tree unchanged.
3. Ablation fixtures include a valid no-skill/candidate pair and adversarial
   mismatches in case set, harness version, model, effort, trial count,
   threshold, and condition text.
4. Ablation reporting tests cover candidate improvement, candidate regression,
   and unknown measurements at the per-case seam.
5. One real plugin suite runs the same representative positive, negative,
   incomplete, competition, and pressure cases on Claude Code and Codex with
   pinned models, matched effort, and a declared trial count.
6. Activation fixtures cover all three classes, invalid metadata and
   competition mounting, correct and incorrect primary selection, no-skill
   modes, incomplete observations, direct-event evidence, and controlled-probe
   evidence.
7. Activation reports cover recall, precision, per-class results, routing
   failure alongside task success, unknown evidence, and mixed known/unknown
   trials without silently dropping the unknown trial.
8. Prompt-rendering tests cover Claude Code and Codex invocation tokens,
   unchanged prompts without the placeholder, and invalid placeholder use by a
   case without a colocated owning skill.
9. Public benchmark fixtures preserve explicitly requested self-reported counts
   and their malformed, duplicate, missing, and unavailable evidence cases.
   Deprecated ticket-pipeline phase-to-skill assertions retire with the legacy
   runner; no special native phase contract is required.
10. Semantic output-check fixtures cover a valid paraphrase, negation,
    contradiction, malformed output, missing and duplicate verdicts,
    unexpected names, and an unavailable grader route.
11. Runner tests prove semantic checks still gate with the advisory judge
    disabled and retain route, verdict, token, and cost evidence without
    exposing propositions to the candidate.
12. CLI rendering tests cover interactive progress, green pass and red failure
    output (including activation failure), repeated-trial summaries, artifact
    hyperlinks, explicit style opt-outs, `NO_COLOR`, and non-interactive logs.
13. Runner tests cover default and explicitly overridden model and effort
    resolution for the candidate, advisory quality judge, and semantic-output
    grader roles.
14. Activation fixtures cover an explicit Codex invocation without a visible
    skill-file read, implicit discovery with a completed mounted-skill read,
    indirect mounted-skill reads through shell variables, working-directory
    changes, and discovery commands, plus missing or ambiguous evidence for both
    observation paths.
15. Grading tests execute candidate scripts through the real isolation boundary,
    proving denied source/peer/credential access and preserved fixture behavior,
    including read-only cache cleanup and retained outcomes on cleanup failure.
16. Runner subprocess tests inject later-trial errors, concurrent completions,
    persistence errors, and process interruption, then inspect retained evidence.
17. Reports and comparison tests cover dry-only, mixed, historical, unknown,
    and executed provenance without inventing behavioral measurements.
18. Ownership tests cover live duplicates, terminated owners, abrupt death,
    PID reuse, competing retries, and legacy or unverifiable records.
19. Explicit activation fixtures combine supporting reads with required
    sequences and exclusions, plus truncated, unmounted, duplicated, malformed,
    and failed observation counterexamples.
20. Codex collaboration-retention fixtures cover current task labels separately
    from stable child references and preserve bounded review route fields while
    excluding unrelated prompt content. They reject start-only acceptance and
    omit hostile or unbounded sender and receiver identifiers. Session fixtures
    cover exact parent-thread lookup, missing or ambiguous rollouts, accepted
    native launch reduction from encrypted prompts, task-name axis binding,
    rejected-attempt retention, and prompt exclusion.

21. Direct-runner subprocess tests cover skill selection with unrelated and
    misleading case IDs, exact skill-name matching, skill-less experiments,
    combined case filters, mount overrides, and empty matches. They also
    preserve case-only and unfiltered selection.
22. Direct-runner subprocess tests cover plugin selection across multiple skills
    and plugin kinds, unrelated and misleading case IDs, exact plugin-name
    matching, excluded experiments, combined skill and case filters, mount
    overrides, and empty matches.

## Non-goals

- Treating invariant coverage as semantic proof or a skill quality score.
- Grading hidden reasoning or requiring one exact tool sequence when outcomes
  permit several safe implementations.
- Retaining secrets, hidden chain-of-thought, or unbounded transcripts for
  replay.
- Replacing the custom runner with another evaluation framework.
- Making the runner, its TypeScript code, or Bun a plugin runtime dependency.
- Turning ablation into a mandatory phase of user work or Darrow orchestration.
