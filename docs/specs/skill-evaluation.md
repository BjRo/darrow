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

## Public contract

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

### Evidence lifecycle

Raw result bundles remain gitignored. A reviewed tracked snapshot may preserve
the suite definition, pinned harnesses and models, effort, trial count,
quantitative results, observed failures, limitations, and the exact raw result
location or digest. Promotion or behavior-value claims require enough fresh
trials for their risk and must not rely on one convenient green run.

## Invariants

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

## Non-goals

- Treating invariant coverage as semantic proof or a skill quality score.
- Grading hidden reasoning or requiring one exact tool sequence when outcomes
  permit several safe implementations.
- Retaining secrets, hidden chain-of-thought, or unbounded transcripts for
  replay.
- Replacing the custom runner with another evaluation framework.
- Making the runner, its TypeScript code, or Bun a plugin runtime dependency.
- Turning ablation into a mandatory phase of user work or Darrow orchestration.
