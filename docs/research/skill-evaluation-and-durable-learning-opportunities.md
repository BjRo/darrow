# Skill Evaluation and Durable Learning Opportunities

Status: exploratory research, not an accepted decision or implementation plan  
Reviewed: 2026-08-07  
Sources:
[obra/superpowers](https://github.com/obra/superpowers),
[Microsoft Waza](https://github.com/microsoft/waza),
[EveryInc Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/skills/README.md),
[EveryInc Compound Knowledge](https://github.com/EveryInc/compound-knowledge-plugin)

## Purpose

This note focuses the broader community-project research on two opportunities:

1. make skill triggering, incremental value, invariant coverage, and replayable
   evidence first-class parts of Darrow's evaluation practice; and
2. capture reusable learning after verified work while continuously preventing
   stale, duplicate, or weakly evidenced guidance from accumulating.

These are complementary feedback loops rather than new orchestration systems:

```text
skill idea -> failing evidence -> skill change -> comparative evaluation
     ^                                                |
     +------------ replay, coverage, refinement ------+

verified work -> candidate learning -> authoritative source -> later refresh
                                      ^                      |
                                      +-- reconcile/remove --+
```

The note preserves ideas for later evaluation. It does not authorize a new
plugin, change the accepted eval-runner decision, create a repository memory
store, or change the boundaries of `darrow-goal-loop` and
`darrow-ticket-pipeline`.

## Existing Darrow foundations

Darrow already has substantial foundations for both opportunities.

The [custom eval runner](../decisions/ADR-0001-eval-runner.md) already provides declarative fixtures, deterministic
repository and output checks, pinned harness/model execution, repeated trials,
token and duration measurements, optional blind judgment, invariant IDs,
no-skill baselines, and candidate-versus-baseline comparison. Capability specs
already require positive and negative triggering behavior for several skills.
The opportunity is to make those practices consistent and inspectable across
the marketplace, not to replace the runner.

The ticket pipeline already ends with
[`codify-ticket`](../../plugins/orchestration/darrow-ticket-pipeline/skills/codify-ticket/SKILL.md).
It derives candidate
learnings only from converged delivery evidence, applies a high durability
threshold, chooses one authoritative owner, rejects routine or duplicated
facts, and emits read-only recommendations. The opportunity is to make that
discipline available outside ticket delivery and add a lifecycle for reviewing
knowledge that has already been codified.

| Concern               | Darrow today                                                        | Opportunity                                                                             |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Skill behavior        | Outcome-oriented fixture checks and repeated real-harness trials    | Standardize activation, ablation, coverage, and replay evidence                         |
| Skill value           | No-skill conditions and comparison tooling exist                    | Make comparative value a normal promotion gate                                          |
| Traceability          | Cases name one invariant                                            | Report uncovered invariants and unsupported skill promises                              |
| Reproduction          | Results retain harness output and metadata                          | Regrade saved evidence and reproduce runs from a complete manifest                      |
| Learning discovery    | `codify-ticket` recommends durable learning after ticket delivery   | Support other verified work without weakening the evidence threshold                    |
| Knowledge maintenance | Information-architecture doctor can repair agent-guidance structure | Reconcile meaning, authority, duplication, and staleness across named canonical sources |

## Opportunity 1: skill evaluation as test-driven behavior

### What the external projects add

Superpowers' [`writing-skills`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md)
guidance treats a procedural skill like behavior developed through red, green,
and refactor:

1. run a representative scenario without the skill;
2. preserve the observable failure or evasion;
3. add the smallest instruction that corrects it;
4. rerun the same scenario with the skill; and
5. add pressure and variation cases that expose remaining loopholes.

Its
[`testing-skills-with-subagents`](https://github.com/obra/superpowers/blob/main/skills/writing-skills/testing-skills-with-subagents.md)
reference also separates evaluation shapes. A discipline skill needs pressure
and rationalization cases; a technique skill needs application and variation;
a pattern skill needs recognition and counterexamples; a reference skill needs
retrieval, application, and gap detection.

Waza contributes runner mechanics such as trigger tests, action-sequence and
skill-invocation graders, multi-trial stability, snapshots, replay, token
budgets, and coverage between declared skill promises and eval cases. Darrow
should adapt the missing mechanics while retaining its stronger preference for
observable repository outcomes over transcript-shaped success.

### A. Evaluate activation separately from execution

A skill can be well written after loading and still fail in normal use because
it does not load when appropriate, loads when inappropriate, or loses a routing
competition to another installed capability.

Each model-invoked skill should therefore have three activation classes:

- **positive trigger:** ordinary user wording that should select the skill;
- **negative trigger:** adjacent intent that must not select it; and
- **competition:** a fresh context with relevant neighboring skills installed,
  where the correct capability must win without a root-level hint.

Explicitly invoked controller skills need a different contract. Their evals
should prove that an explicit invocation is honored and that ordinary requests
do not silently start consequential orchestration.

When a harness exposes trustworthy skill-invocation events, retain them as
activation evidence. When it does not, use controlled outcome probes and state
the limitation. Do not infer exact routing merely because the final answer
looks plausible.

### B. Make ablation a normal value test

Run the same prompt, fixture, harness, model, effort, and checks under at least
these conditions:

1. the candidate skill is absent;
2. the candidate skill is present; and
3. when changing an existing skill, the accepted version is present.

The comparison should answer more than whether the candidate passes:

- Which failures occur without the capability?
- Which failures does the capability actually remove?
- What new false positives, extra writes, interruptions, tokens, or latency
  does it introduce?
- Is the direct strong-agent baseline already as good?
- Does the candidate remain better across repeated trials and both harnesses?

Preserve observable omissions, refusals, unsupported claims, unauthorized
actions, or user-facing rationalizations as failure evidence. Do not request,
store, or grade hidden chain-of-thought.

A skill that merely restates behavior the underlying agent already performs
reliably should not be promoted. Neutral or harmful ablation results are useful
product findings, not eval failures to explain away.

### C. Report promise-to-eval coverage

Darrow cases already carry an invariant ID. A deterministic coverage command
could compare the capability specification, skill activation claims, and eval
suite and report:

- invariants with no eval case;
- trigger claims with no positive case;
- exclusions with no negative case;
- safety or mutation boundaries with no adversarial case;
- supported harnesses without a fresh-context run; and
- cases that point to unknown or retired invariants.

Coverage means that a claim is exercised, not that it is true. Semantic claims
still need appropriate outcome checks and repeated real-harness results.

The stable traceability source should remain the capability invariant ID. A
future parser may recognize structured `USE FOR` and `DO NOT USE FOR` metadata,
but Darrow should not make brittle inference from arbitrary prose the sole
source of coverage truth.

### D. Separate regrading from reproduction

“Replay” describes two useful but different operations:

- **Regrade:** run current deterministic checks or judge logic against retained
  outputs and observable action records without paying for another model run.
- **Reproduce:** rebuild the original fixture and rerun the harness from a
  complete execution manifest.

A replayable result should identify, subject to redaction:

- case and invariant IDs;
- fixture and corpus provenance, including the initial revision;
- skill and relevant configuration digests;
- harness name and version, model, effort, and condition;
- sanitized prompt and mounted-capability set;
- normalized final output and observable action/tool results exposed by the
  harness;
- deterministic checks, judge version, tokens, cost, and duration; and
- environment facts required to explain reproducibility limitations.

Raw transcripts must not become the primary success oracle. Secrets, hidden
reasoning, unrelated user data, and unbounded command output must not be
retained merely to make replay convenient.

### E. Adopt an explicit skill red/green/refactor loop

For a new or materially changed skill:

1. Name the capability invariant or skill promise under test.
2. Add a representative eval and observe the skill-absent or accepted-version
   baseline.
3. Record the smallest observable failure taxonomy, not a speculative theory
   about the model.
4. Change the skill, bundled mechanics, or description by the smallest amount
   that should address the failure.
5. Rerun the same case until the result is green across the required trial
   threshold.
6. Add one variation, one adjacent non-trigger, and one plausible pressure or
   adversarial case.
7. Refactor instructions and scripts while keeping those evals green.

This extends Darrow's existing skill-development loop; it does not require all
product implementation to be performed by a nested TDD skill.

### Proposed evaluation dimensions

| Dimension            | Primary question                                                 | Preferred evidence                                    |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Activation recall    | Does the skill load for representative intended requests?        | Harness invocation event or controlled behavior probe |
| Activation precision | Does it stay dormant for adjacent requests?                      | Fresh-context negative and competition cases          |
| Outcome value        | Does it improve the repository or user-visible result?           | Deterministic fixture checks and independent oracles  |
| Safety               | Does it remain inside authority, scope, and mutation boundaries? | Adversarial fixtures and state checks                 |
| Stability            | Does behavior survive stochastic variation?                      | Repeated trials with a declared threshold             |
| Efficiency           | Is the improvement worth its context and execution cost?         | Tokens, duration, cost, and human-review minutes      |
| Traceability         | Is every material promise exercised?                             | Deterministic invariant-to-case coverage report       |
| Reproducibility      | Can a failure be regraded or rerun with known limitations?       | Saved result bundle and execution manifest            |

### Suggested rollout

1. Generate a read-only invariant coverage report from the current corpus.
2. Define first-class positive, negative, and competition case metadata.
3. Normalize the existing no-skill and condition mechanisms into an explicit
   ablation report.
4. Save a versioned, redacted run manifest and support deterministic regrading.
5. Add full fixture reproduction only after the manifest proves sufficient.
6. Apply the red/green/refactor discipline to one new skill before making it a
   marketplace-wide promotion gate.

### Boundaries

- Do not replace the custom eval runner with Waza or another framework merely
  to acquire individual grader types.
- Do not grade hidden reasoning or make verbose transcripts the success oracle.
- Do not require a literal tool sequence when several safe sequences produce
  the same observable result; sequence checks are appropriate only when order
  is part of the contract.
- Do not equate one passing run, raw model confidence, or an LLM-judge score
  with stable capability value.
- Do not add structured metadata unless it drives a check, report, or routing
  decision that cannot be obtained reliably from existing invariants.

## Opportunity 4: reusable learning with an explicit lifecycle

### What the external projects add

Compound Engineering ends meaningful work with a `compound` step that extracts
reusable knowledge for later work. Its more important complement is
`compound-refresh`, which revisits accumulated knowledge and classifies it as
Keep, Update, Consolidate, Replace, or Delete. Compound Knowledge similarly
emphasizes small, searchable learnings and checks for contradictions and stale
material.

Darrow should adapt the capture-and-refresh lifecycle without adopting a
universal `docs/solutions` directory, a global agent-memory database, or a
mandatory integrated workflow.

### A. Preserve the `codify-ticket` threshold

The existing ticket phase already provides a strong default definition. A
candidate learning must:

1. follow from concrete, converged evidence;
2. apply beyond one work item;
3. be non-obvious from current authoritative sources;
4. prevent a credible future correctness, safety, workflow, or verification
   failure;
5. be expressible without incidental filenames or implementation detail; and
6. have exactly one appropriate authoritative owner.

Routine commands, successful implementation details, generic preferences,
speculative abstractions, duplicated facts, and “remember to run the tests” do
not cross the threshold.

This threshold should govern any later standalone capture capability. A broader
entry point must not become a lower-quality path around `codify-ticket`.

### B. Route learning instead of storing it in a new memory surface

The durable target depends on what kind of fact was learned:

| Learning                                               | Likely authoritative owner                          |
| ------------------------------------------------------ | --------------------------------------------------- |
| Observable product behavior                            | Code, public tests, or the product specification    |
| Accepted architectural or policy choice                | The repository's decision surface                   |
| Capability invariant                                   | The relevant capability specification               |
| Repeatable intent-triggered procedure                  | A repository or plugin skill                        |
| Universal or scoped agent constraint                   | The narrowest reachable instruction surface         |
| Tooling fact cheaply derived from configuration        | Configuration itself; usually no prose copy         |
| Explanation useful to people but not behavior-changing | Existing project documentation at its natural scope |

The capture process should first search for an existing owner, then recommend
or apply the smallest change there. It should create a new document only when
the repository has no suitable canonical surface and the user accepts the new
ownership boundary.

Independently installable plugins must not reference sibling files or require a
sibling plugin to be present. A standalone capability may recommend that a
decision be captured or guidance be doctored, but it must remain complete and
safe when those Darrow plugins are absent.

### C. Distinguish recommendation from mutation

There are two useful authority modes:

- **Recommend:** inspect verified evidence, identify durable candidates, and
  name exact canonical additions without changing the repository. This is the
  current `codify-ticket` behavior and should remain the pipeline default so
  codification cannot invalidate the verified tree.
- **Apply:** when explicitly asked to persist confirmed learning, update one
  verified authoritative owner, preserve existing decisions and user changes,
  and validate the affected surface.

A generic request to summarize a session is not authority to create permanent
repository guidance. A request to capture or persist a named insight can
authorize a scoped addition, but it does not settle a new architecture or
policy choice that the user has not made.

### D. Add refresh and reconciliation from the beginning

Captured guidance needs an observable reason to remain. A refresh operation
should inspect a named knowledge surface or subject, not scan the repository or
conversation history indiscriminately. For each candidate it should choose one
action:

- **Keep:** current evidence still supports it, its scope is correct, and it is
  not duplicated.
- **Update:** the underlying invariant remains but wording, paths, versions, or
  scope have drifted.
- **Consolidate:** several records express the same knowledge and one canonical
  owner can replace them without losing distinct constraints.
- **Supersede:** a newer accepted decision or invariant replaces the old one
  while history remains relevant in the repository's established decision
  mechanism.
- **Remove:** the claim is obsolete, contradicted by stronger authority, or
  cheaply derivable and no longer carries non-obvious behavioral value.
- **Needs human:** evidence conflicts, ownership is ambiguous, or the action
  would choose between live policies.

Recency, usage frequency, file age, and pattern prevalence are investigation
signals, not deletion authority. Rare safety constraints and intentionally
stable decisions may be both old and essential.

Refresh must respect the maintenance semantics of the authoritative surface.
For example, an accepted decision is superseded according to the decision
record contract; agent-guidance structure is maintained through its own
information-architecture rules; code and tests are not rewritten as a side
effect of documentation cleanup.

### E. Make learning provenance and reviewability explicit

Every proposed durable addition should state, in normal prose rather than a
new mandatory schema:

- the reusable claim;
- the converged evidence supporting it;
- the future failure it prevents;
- why the current repository does not already express it;
- the one proposed owner and intended scope; and
- a concrete revisit trigger when the claim depends on a version, migration,
  external contract, or temporary repository state.

Revisit triggers prompt review; they do not automatically delete, supersede,
or rewrite knowledge.

### F. Evaluate capture quality and lifecycle behavior

A future capture or refresh capability should be evaluated for:

- accepting a non-obvious, reusable invariant with strong evidence;
- returning `no_change` for routine or already-canonical facts;
- routing different knowledge types to the correct narrow owner;
- refusing to duplicate an accepted decision, specification, test, or rule;
- separating unresolved choices from settled knowledge;
- preserving rare but valid safety guidance despite missing usage evidence;
- finding a genuinely stale or contradicted record;
- consolidating duplicates without dropping distinct constraints;
- honoring read-only versus apply authority; and
- working without any sibling Darrow plugin installed.

Comparative evaluation should measure not only recall of useful learnings but
also false-positive codification, duplicate knowledge created, unsupported
policy written, resident-context growth, and human review time.

### Suggested rollout

1. Evaluate the current `codify-ticket` phase against durable, routine,
   duplicate, conflicting, and no-change cases.
2. Observe several real deliveries to learn whether recommendations are acted
   on and whether the threshold is calibrated.
3. Prototype a standalone, explicitly invoked `capture-learning` skill for
   verified work that did not use the ticket pipeline.
4. Keep its initial mode read-only; add scoped application only after ownership
   and authority evals are reliable.
5. Prototype refresh against a named documentation or guidance surface using
   Keep/Update/Consolidate/Supersede/Remove/Needs-human outcomes.
6. Decide only after those experiments whether capture and refresh belong in
   one plugin, an existing maintenance capability, or separate independently
   adoptable plugins.

### Boundaries

- Do not create a universal Darrow memory directory, learning database, or
  transcript-mining service.
- Do not automatically codify every completed goal, review, conversation, or
  ticket.
- Do not turn implementation summaries, agent preferences, or one-off
  surprises into repository policy.
- Do not duplicate facts across decisions, specifications, instructions,
  skills, tests, and explanatory documentation for convenience.
- Do not let refresh rewrite accepted decisions, product behavior, or policy
  without the authority required by their canonical surfaces.
- Do not use absence from recent sessions or evals as evidence that knowledge
  is obsolete.
- Do not make capture or refresh a third workflow controller.

## Relationship between the opportunities

Skill evaluation and durable learning should inform each other without
silently mutating one another:

```text
eval failure
  -> evidence for a narrowly scoped skill or runner change
  -> passing comparative eval
  -> possible durable capability invariant

verified delivery
  -> candidate repository learning
  -> canonical addition after applicable authority
  -> future skill and delivery contexts
  -> refresh when its stated assumptions change
```

An eval failure is not automatically a repository learning: it may be model
variance, a bad fixture, or a local prompt defect. A captured learning is not
automatically a skill instruction: it may belong in code, a test, a decision,
or a specification. Both paths require evidence, one owner, and an explicit
boundary between recommendation and mutation.

## Open questions before implementation

1. Which harness events are stable enough to serve as direct skill-activation
   evidence across Claude Code and Codex?
2. Should coverage parse only invariant IDs initially, or also adopt a small
   structured form for trigger and exclusion promises?
3. What retained result bundle is sufficient for deterministic regrading
   without storing sensitive or reasoning-like transcript material?
4. Does standalone learning capture have enough demand outside
   `codify-ticket`, or should the initial work focus on evaluating and consuming
   its existing recommendations?
5. Which existing capability, if any, should own cross-surface refresh without
   becoming a general documentation cleaner?
6. What evidence should trigger a periodic refresh: an explicit user request,
   a changed dependency or decision, failed routing, or a bounded scheduled
   audit?

## Suggested priority

Start with the evaluation work. It can directly test both future capability
ideas and establish whether learning capture improves outcomes rather than
merely producing more prose.

Within evaluation, begin with invariant coverage and explicit ablation because
the runner already contains much of the required data. Then add activation
classes and regrading manifests. In parallel, strengthen `codify-ticket` evals
and observe how its recommendations are used. A standalone capture or refresh
capability should follow only when those observations demonstrate a clear gap.
