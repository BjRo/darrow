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
A later file reread of an explicitly dispatched owner does not select it again
or change its primary position. Native reconciliation still preserves the
observed order among supporting skills and fails closed on genuine conflicts.
Parent-work flags retain an ordinal and allowlisted operation category so an
unexpected control call can be distinguished from repository work without
retaining private arguments, submitted commands, or output.

Participant prompts that explicitly invoke the colocated skill use the shared
`{{skill_invocation}}` placeholder. The runner resolves it only at trial time
to the host-native public token: the unqualified skill name on Claude Code and
the installed plugin-qualified skill name on Codex. The source case therefore
stays host-portable while each harness receives an invocation it can actually
resolve.

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

### Evidence lifecycle

Shell checks execute candidate-controlled code inside the runner's outer
isolation boundary, including during dry runs. Grading uses a private,
credential-free environment and cannot access source worktrees, peer fixtures,
harness credentials, or modify retained evidence. An unavailable isolation
boundary is an explicit error.

Each finished trial is persisted atomically, with its complete bounded result
evidence and case/run provenance, before fixture cleanup or completion feedback.
A later failure or interruption cannot erase those results. Partial attempts
remain inspectable and explicitly incomplete; they are not complete suite
evidence. Retrying preserves the previous attempt's artifacts.

Trial and case artifacts identify dry versus executed trials. Dry preparation
checks remain inspectable but produce no behavioral success or comparative
scores. Historical execution mode may be recovered from an explicit suite
manifest; absent provenance stays unknown.

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
