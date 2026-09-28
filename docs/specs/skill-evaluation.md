# Repository Infrastructure: Skill Evaluation Evidence

Darrow's shared evaluation runner should make specification traceability and
comparative skill value inspectable without confusing the presence of a test
with proof that the tested behavior works.

Surface: `evals/runner/`. Runtime: repository development infrastructure on
TypeScript and Bun; this is not a plugin-shipped dependency or user-invoked
orchestration capability.

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

## Public contract

### Repository-owned fixture sources

The extraction compatibility inventory includes canonical repository-skill,
plugin-skill, and skill-less experiment cases. Unsupported scopes remain named
failures; omitting a scope cannot produce a valid migration gate.

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

A setup-only generated fixture starts with an empty Git history. Its setup may
create the initial snapshot; no placeholder commit may be synthesized before
that setup runs.

### Direct runner roots

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

The existing `evals/repository-guide.ts` command uses the public Sevro CLI when
`SEVRO_PACKAGE_BIN` or `SEVRO_CHECKOUT` selects an explicit migration route.
Until an exact published release is pinned, invocation without either route
continues to use the legacy runner. Preserve repeatable `--only`, `--harness`,
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
Candidate defaults preserve Codex `gpt-5.6-terra/medium` and Claude
`claude-sonnet-5/medium`; the semantic judge remains Codex
`gpt-5.6-terra/medium`. Explicit model and effort overrides enter retained routes.
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
must fail explicitly rather than appear as successful empty coverage.

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
to the host-native public token: the unqualified skill name on Claude Code and
the installed plugin-qualified skill name on Codex. The source case therefore
stays host-portable while each harness receives an invocation it can actually
resolve.

Claude may expand an explicit plugin command before the first assistant turn,
without emitting a Skill tool event. Accept that path only when the native
command matches the mounted plugin's namespace, skill, arguments, and session,
and the complete mounted skill body follows in that session before the first
assistant turn. Missing, partial, duplicate, or foreign-plugin expansion does
not establish activation. Retain only the bounded receipt, not the command or
skill text.

Codex orchestration evidence may repeat the owning installed plugin
qualification in child skill tokens. Reconciliation treats that exact
qualification as host transport syntax and compares the declared phase
capability by its leaf skill name; another plugin namespace is not equivalent.

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

Bounded parent skill-read diagnostics also cover well-formed sessions with no
spawn request, including readiness stops before launch. Retain the same read
recognition, body-presence, and command-shape facts without raw commands or
output. These diagnostics confer no activation or pre-owner read credit; a
pre-owner assertion still requires its accepted launch boundary. Malformed
sessions remain unverified.

For each correlated accepted child, retain bounded session-availability facts
and the same read-recognition/body-presence diagnostics. Distinguish an absent
or ambiguous child rollout from a malformed rollout and from an available
rollout containing no recognized reads. Cap child and per-child diagnostic
counts with explicit truncation flags. These records retain no raw command,
output, or child prompt and never supply activation credit on their own.

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
public contract is a proposition that permits faithful paraphrase. Each check
has a stable name and a plain-language proposition. The runner grades all such
checks against the candidate's final response in a separate, hidden grader
call and requires every proposition to pass.

Semantic output checks are distinct from the advisory quality judge. Disabling
that judge does not disable semantic contract gates. The grader route, parsed
verdict and reason for every proposition, raw grader result, token usage, and
cost remain in the trial evidence. A grader failure, unavailable route,
malformed response, duplicate or missing verdict, or unrecognized check name
fails the affected trial closed.

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

The existing `bun eval` and `evals/runner/run.ts` caller selects Sevro when
`SEVRO_PACKAGE_BIN` or `SEVRO_CHECKOUT` is explicitly set. With neither route,
it retains the legacy backend until the published package pin permits default
cutover. Invalid explicit routes cannot fall back. The caller preserves exact
skill/plugin ownership filters, repeatable case substrings, sorted case order,
candidate and independent grader routes, trials, threshold, jobs, dry runs,
skill overrides, unmounted controls, text conditions, evaluation-record checks,
and effective-owner assertions. Relative project, configuration, result, active
storage, skill, condition, and output paths resolve from the invocation directory.
Result storage defaults to the evaluated project's `evals/results`.

The candidate defaults remain Codex `gpt-5.6-terra/medium` and Claude
`claude-sonnet-5/medium`; the semantic default is Codex `gpt-5.6-luna/low`.
An advisory judge is requested only by `--judge-harness`, with Codex
`gpt-5.6-sol/low` defaults. Requested Claude graders fail explicitly. Per-case
candidate routes override only the parent model and effort. The historical
default owner condition remains enforced and cannot become passive silently.
Native host options follow `--` and cannot override caller-owned routes,
conditions, roots, limits, or graders. Bundled-host enforcement and private goal
assertions remain explicitly unsupported.

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
flags remain accepted for the plain JSON output. Custom corpus-manifest paths
and manually supplied human-review minutes remain explicit migration gaps;
they cannot be silently ignored.

The existing `bun run eval:orchestration` and `evals/runner/suite.ts` caller
selects Sevro when `SEVRO_PACKAGE_BIN` or `SEVRO_CHECKOUT` is explicitly set.
With neither route, it retains the legacy backend until the published package
pin permits default cutover. An invalid explicit route cannot fall back.
The caller preserves suite, harness, mode, case, trials, threshold, seed, dry,
and candidate and grader route options. Relative suite and output paths resolve
from the invocation directory; default output remains under the evaluated
project's `evals/results/<experiment>/<timestamp>`. An optional absolute
`--project-root` selects another evaluated checkout. Native host options follow
`--`; caller-owned selection, routing, condition, storage, and grading options
cannot be overridden there. Active-run storage remains a native forwarded
option; result storage is owned by the caller.

Candidate defaults remain Codex `gpt-5.6-terra/medium` and Claude
`claude-sonnet-5/medium`. The separate semantic route remains Codex
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
With a curated Claude UV cache, candidate and check homes remain under the
trial's Git metadata, outside assessed worktree contents. The homes and Darrow
caches are separate; the curated UV cache remains shared within the trial.
Caller cache overrides and credentials are not inherited. This deliberately
replaces the legacy shared Darrow cache environment contract without changing
the plugin launcher's public default or introducing Darrow policy into Sevro.

Shell checks execute candidate-controlled code inside the runner's outer
isolation boundary, including during dry runs. Grading uses a private,
credential-free environment and cannot access source worktrees, peer fixtures,
harness credentials, or modify retained evidence. An unavailable isolation
boundary is an explicit error.

Packaged Python eval oracles remain hidden from participants. Plugin mounting
excludes every nested `evals/` directory, including `backend/tests/evals/`.
Fixture setup may copy grading helpers to `.git/eval-checks/`; the outer agent
sandbox denies reading and writing that subtree, while isolated grading may
execute it. Declared external isolation must preserve this boundary too.

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

### Historical legacy interpretation

Recorded trial success that contradicts a failed harness or named check is
invalid evidence. Preserve its recorded facts and diagnostic, but publish no
measured rate for that row.
Retained semantic assessment names and verdicts must agree with their named
checks. Contradictory semantic evidence stays visible with diagnostics and no
measured rates; malformed assessment entries also fail interpretation.
Semantic facts that lack corresponding check outcomes remain unavailable.
Duplicate named checks or trial numbers, trial numbers beyond the declared
planned count, and malformed cell exit codes are invalid archive structure and
must produce diagnostics and an unsuccessful interpreter exit.

Darrow owns a read-only interpreter for retained legacy result arrays, suite
manifests, and `darrow-eval-trial-v1` checkpoints. The documented legacy report
command accepts `--json` for its `darrow-legacy-report-v1` view. The independently
usable migration entrypoint is `evals/sevro-extension/legacy-report.ts`; it
reads the same archival inputs and writes JSON or Markdown to standard output.
Neither path executes a host, requires Sevro or Git metadata, rewrites input
artifacts, or imports the generic runner to interpret them.

The view identifies every input by absolute path and content digest. It retains
recorded summary values, named trial checks, exact candidate and grader routes,
activation, advisory and semantic outcomes, and requested versus observed policy
assistance separately. Runner revision, dirty state and patch identity are
legacy facts; absent evaluator metadata stays unknown. The view never supplies
a current Sevro package, protocol or evaluator identity and does not establish
comparison eligibility.

Execution comes only from consistent case/trial declarations and an explicitly
linked suite manifest's `dry` boolean. Empty responses, zero timing and successful
checks do not establish execution. Missing or conflicting declarations stay
unknown. Case completeness requires a manifest's planned trial count, all unique
trial numbers, and a finished cell exit of zero or one. Standalone arrays with no
planned count remain unknown; checkpoints remain partial even when their retained
single trial matches `plannedTrials`. A partial attempt is not a completed
threshold run.

Recorded rates remain visible as archival claims. Measured task quality and
protocol rates require known executed and complete evidence; dry, unknown,
partial or unavailable required trial facts leave their rates null. Legacy task
quality excludes only the two exact bookkeeping check names. Bookkeeping
requires both named checks; missing policy or outcomes stay unknown. Activation,
semantic gates and advisory assessments do not become interchangeable rates.
Malformed, unreadable or contradictory inputs retain a diagnostic and make the
interpreter unsuccessful. Other valid inputs remain visible. Original snapshots,
transcripts and comparison inputs remain preserved in their own recorded formats.

Before Darrow switches to a packaged runner, the same command-level
compatibility cases must run against the in-repository runner and the candidate
package through their public commands. Compare case selection, named check
outcomes, requested and observed policy-assistance modes, evidence completeness,
artifact lifecycle, and exit categories. Normalize timestamps, temporary
paths, attempt IDs, and other variable fields. Record deliberate contract
changes separately; a changed result must not be hidden by normalization.

Equivalent runs have one verifiable process owner. A live owner prevents a
duplicate; a confirmed abandoned owner can be reclaimed atomically without
discarding evidence. Process identity includes protection against PID reuse.
Ownerless legacy or unverifiable records require explicit diagnosed recovery,
never automatic expiry based only on age.

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

`adaptive-delivery` trials record requested evaluation mode and actual per-trial
policy assistance separately. Passive observation installs no product-policy
guard, rewrites no launch inputs, and disables no tools for adaptive-delivery
compliance. Fixture isolation remains identical. Enforced trials evaluate the
skill plus eval assistance; missing historical provenance is unknown. Reports
must expose this distinction. Matched framing comparisons hold fixture,
acceptance checks, harness, and model/effort routes constant; comparisons that
change routes measure a separate effect. Missing route or token evidence does
not prove equivalence or savings.

- **SE-C1 — Complete traceability scan.** Coverage reports every invariant,
  case reference, uncovered invariant, unknown reference, and duplicate
  normative definition within the selected scope.
- **SE-C2 — Coverage is not correctness.** The report distinguishes an
  exercised invariant from a passing live result and does not fail merely
  because honest uncovered gaps exist unless strict coverage was requested.
- **SE-C3 — Fail closed on invalid evidence.** Unreadable or empty inputs,
  malformed cases, unknown invariant references, and duplicate normative IDs
  cannot produce a successful integrity result.
- **SE-C4 — Read-only inspection.** Coverage does not modify specifications,
  eval cases, result bundles, repository refs, tracked files, or untracked
  files.
- **SE-C5 — Ablation isolates skill presence.** A named skill ablation requires
  a no-skill baseline and rejects differences in prompts, conditions, cases,
  fixtures, checks, harness versions, models, efforts, trial counts, or
  thresholds.
- **SE-C6 — Task-level comparative evidence.** Ablation output preserves every
  matched case per harness and reports baseline, candidate, and delta values
  without allowing an aggregate to hide a regression.
- **SE-C7 — Unknown stays unknown.** Missing cost, token, judge, or other
  optional measurements are reported as unavailable and never coerced to zero
  or silently dropped from one side.
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
- **SE-C16 — Legible terminal feedback.** The direct runner shows bounded live
  progress, its configured positive worker count, visually distinct task and
  activation outcomes, a repeated-trial case summary, and an absolute result
  artifact link. `--jobs` bounds simultaneous trials and defaults to three.
  Color, symbols, and animation are independently disableable, respect terminal
  conventions, and degrade to stable outcome-bearing text outside an
  interactive terminal.
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
  preserving prior evidence.
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

- **SE-C25 — Select cases by owning skill.** The direct runner's `--skill`
  filter selects every discovered case colocated with the exact named skill,
  independently of case-ID naming and mounted-skill overrides. Case filters
  narrow that set, skill-less cases are excluded, and an empty selection
  fails explicitly.
- **SE-C26 — Select cases by owning plugin.** The direct runner's `--plugin`
  filter selects every discovered case colocated under all skills of the exact
  named plugin, across plugin kinds and independently of case IDs or mounting
  configuration. Skill and case filters narrow that set, skill-less experiments
  are excluded, and an empty selection fails explicitly.

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

## Evaluation requirements

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
9. Codex orchestration reconciliation fixtures include installed
   owning-plugin-qualified child skill tokens, reject a foreign namespace, and
   retain their phase-to-skill checks.
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
