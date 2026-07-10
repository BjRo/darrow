# Experiment: does a Claude-style planning workflow improve Codex plans?

Pre-registered design. Written before any trial ran; rubric and decision rule
are frozen here so results can't be curve-fit after the fact.

## Question

When Codex plans a change headless, does forcing it through a Claude-plan-mode
style workflow (phased: parallel exploration → design → self-review → plan)
produce better plans than its native single-pass planning — on the same model,
same harness, same tasks?

Source material: `claude-plan-mode-raw.md` and `codex-plan-mode-raw.md` in this
directory. The workflows differ in enforcement (harness-gated vs semantic),
artifact (file vs inline block), and orchestration (prescribed subagent fan-out
vs opt-in). This experiment isolates the *process* variable.

## Conditions

Identical everything except a condition prompt prepended to the task prompt.

- **A (native):** shared output contract only. Codex plans however it wants.
- **B (ported workflow):** shared output contract + phased workflow: explore
  first with up to 3 parallel explorer subagents (inline exploration as
  fallback), each with a scoped focus; then design; then self-review the draft
  plan against repo facts (paths exist, utilities real, trap-check); then emit.

**Shared output contract (both conditions, verbatim in both prompts):** do not
ask questions — pick the recommended default and record every such choice under
`## Assumptions`; do not implement — change no files, the final message is the
complete plan; required sections `## Summary`, `## Key Changes`, `## Test
Plan`, `## Assumptions`; name existing files by repo-relative path; mark files
to be created with `(new)`.

The contract is shared so structure checks measure compliance symmetrically;
B's treatment is the process, not the output format. Consequence: this
experiment cannot attribute wins to Claude's output-format prescriptions, only
to its exploration/review workflow.

## Constants

- Harness: `codex exec` headless, sandbox bypassed (fixtures are disposable
  temp repos), `--output-last-message` captures the plan.
- Model: gpt-5.5, `model_reasoning_effort` pinned to `medium` via `-c`
  (user config leaks `xhigh` otherwise).
- 5 trials per condition per case; paired per-case comparison.
- Runner: `evals/runner` with experiment extensions (see Infrastructure).

## Cases (3, fixtures planted with ground truth)

1. **reuse-seeded** — repo contains an existing utility that a correct plan
   must reuse (e.g. a backoff/retry helper); the task invites reimplementing
   it. Primary check: plan references the planted helper path.
2. **trap-seeded** — two candidate integration points; the README points at a
   module whose source is marked deprecated with a working replacement next to
   it. Only reading the code reveals the trap. Primary check: plan targets the
   replacement (`expect_regex`) and not the deprecated module (`not_regex`).
3. **multi-subsystem** — the change genuinely spans three areas (e.g. schema +
   API handler + CLI). Primary check: plan names key files from all three.

Tasks are modification-only where possible so the grounding check stays sharp.

## Metrics (frozen)

Primary (drive the verdict):
- **P1 grounding** — every repo-relative path in the plan not marked `(new)`
  exists in the fixture.
- **P2 case goal** — the per-case planted check (reuse / trap / coverage).

Secondary (reported, not verdict-driving):
- **S1 structure** — all four required sections present, ≥1 assumption listed.
- **S2 discipline** — `git status --porcelain` empty after the run (prompt
  says don't implement; sandbox is bypassed, so this measures semantic
  obedience — directly mirrors the Codex-plan-mode enforcement model).
- **S3 cost** — tokens and wall-clock per trial.

## Decision rule (frozen)

Per case, a trial "passes" if P1 and P2 both pass. Compare pass counts out of
5 per condition:

- **B better**: B beats A by ≥2 trials on ≥2 of 3 cases, and loses none by ≥2.
- **B weaker**: symmetric opposite.
- **Similar**: everything else.

Secondary metrics and plan texts are reported for qualitative learning either
way. n=5 detects only coarse effects; that matches the three-way question.

## Known limits (accepted upfront)

- Interactivity stripped: both plan modes are conversational; the no-questions
  rule tests only the headless slice. The value of AskUserQuestion-style
  clarification is not measured.
- Condition B's subagent fan-out depends on headless multi_agent support
  (feature reports stable/enabled on codex-cli 0.143.0; smoke run verifies).
  If unavailable, B degrades to inline phased exploration — still a valid
  treatment, recorded in results.
- Single model, single effort tier, 3 cases: findings are directional for
  darrow skill-porting decisions, not general claims about either product.
- Regex checks on prose can misfire; every failed check is eyeballed before
  the verdict (results JSON keeps full plan text per trial).

## Infrastructure

- Cases: `evals/experiments/plan-mode-ab/cases/*.yaml` (same schema as skill
  evals; no skill is mounted).
- Conditions: `evals/experiments/plan-mode-ab/conditions/{native,ported}.md`,
  injected via a new `--condition <file>` runner flag (prefix + blank line +
  case prompt); condition label recorded in results.
- Plan artifact: adapters write the final agent message to
  `.git/last-message.md` in the fixture (codex via `-o`; claude via the parsed
  `result` field) so checks can grep it. Lives under `.git/` for the same
  reason as `fixture-bin`: invisible to the model's worktree.
- Runner case discovery gains a second glob for `evals/experiments/*/cases/`.

## Execution

```
cd evals
bun runner/run.ts --harness codex --case plan-ab --condition experiments/plan-mode-ab/conditions/native.md
bun runner/run.ts --harness codex --case plan-ab --condition experiments/plan-mode-ab/conditions/ported.md
```

Smoke first (`--trials 1`), then the full 5-trial pair. ~30 codex runs total
on the user's ChatGPT quota.

## Amendments (from the smoke run, before the full run)

The condition-A smoke (1 trial × 3 cases) exposed three check-harness false
fails; no genuine model misses. Fixed before any full-run trial, metrics and
decision rule untouched:

1. Grounding now two-pass: paths mentioned on any `(new)` line are exempt
   everywhere (models re-reference new files unmarked), and `*.test.*` /
   `*.spec.*` paths are exempt (proposed test files are implicitly new).
   Contract wording tightened to "at every mention, including new test files".
2. The trap `not_regex` was blunt: a plan that correctly said "use client.ts,
   not legacy.ts" *inside Key Changes* failed it. Narrowed to bullets that
   start with the legacy path, i.e. legacy as a change target.
3. No change to P2/S1/S2 semantics.

## Results (2026-07-09, codex-cli 0.143.0, gpt-5.5@medium, 5 trials/case)

**Verdict: similar** on all primary metrics — with a large cost asymmetry.

| Case | native | ported (raw) | ported (eyeballed) |
|---|---|---|---|
| reuse-seeded | 5/5 | 5/5 | 5/5 |
| trap-seeded | 5/5 | 3/5 | 5/5 |
| multi-subsystem | 5/5 | 5/5 | 5/5 |

- The two ported trap "failures" were check false-fails of a new flavor: the
  ported plans were *more explicit*, adding dedicated "do not add callers to
  src/mailer/legacy.ts" bullets whose sub-bullets start with the legacy path —
  tripping the change-target regex. Both trials integrate via client.ts and
  passed the positive check. Counted per the pre-registered eyeball rule;
  check patched afterwards with a negation-line filter (amendment 4, affects
  future runs only).
- Cost: ported ≈ 2.5× tokens (means 267k vs 108k per trial) and ≈ 2.3×
  wall-clock (117s vs 50s). The workflow's whole observable effect at this
  task size was more thoroughness per plan, paid in tokens.
- Treatment fidelity confirmed: every ported trial spawned 3 explorer
  subagents (9 collab_tool_call events each); every native trial spawned none.
- Discipline (S2): 30/30 trials left the repo untouched — semantic-only
  "don't implement" held, including for subagents inheriting a bypassed
  sandbox.
- Structure/assumptions (S1): 30/30 — the shared output contract was followed
  by both conditions every time.

Interpretation for skill porting: gpt-5.5 at medium effort already explores
before planning — the forced Claude-style phases added no measurable grounding,
reuse, trap-avoidance, or coverage gain on repos this size, at 2.5× cost.
Porting Claude skills to Codex should therefore not bother transplanting
orchestration mechanics; the leverage is in output contracts + script-checked
invariants (consistent with the plan-mode contrast doc). Caveats: small
fixtures (7 files), one model/effort, headless slice only, and checks measure
floor quality, not depth — a tier-2 executor test could still separate the
conditions on plan *depth* (ported plans consistently listed more edge cases
and test scenarios).

## Round 2 — real codebase (pre-registered before any trial)

Round 1's ceiling (native 100% everywhere on 7-file fixtures) leaves the
interesting question open: does the delta appear when search is actually hard?
Round 2 reruns the same A/B on a real repo: a ~71k-LOC Go backend + TS
frontend monorepo (credfolio2 — GraphQL/gqlgen, Bun ORM, River job queue,
LLM pipelines, 28+ migrations), where exploration means navigating distractors,
indirection, and partially stale docs.

Setup deltas from round 1 (everything else identical — conditions, contract,
metrics, decision rule, 5 trials, gpt-5.5@medium):

- Fixture: `fixture.repo` clones the repo's HEAD into the temp dir
  (`--local --no-hardlinks`), strips remotes so the eval clone has no route
  back to the source repo.
- The repo's Codex lifecycle hooks (`.codex/hooks*`) are removed in setup and
  the removal committed neutrally — eval infra must not fire project hooks.
  Docs (`AGENTS.md`, `CLAUDE.md` file map, `.agent-shared/`) stay: both
  conditions benefit equally, and a repo that documents itself is the
  realistic porting target.
- Grounding path regex gains go/sql/graphql(s) extensions.

Cases (`evals/experiments/plan-mode-ab-real/cases/`), ground truth verified by
a read-only exploration pass before authoring:

1. **plan-ab2-reuse-llm-feature** — async LLM skill-gap analysis. Correct
   plans route through `internal/job/` (River) + `internal/infrastructure/llm/`
   and echo a sibling pipeline (positioning review / extraction, resilience
   wrappers). The sibling-pattern check is the discriminator; the CLAUDE.md
   file map documents the areas but not the resilience/chain internals.
2. **plan-ab2-trap-fork-pipeline** — per-step progress for fork generation.
   Trap: a decision record prescribes the saga coordinator pattern "for all
   pipelines" and two coordinators exist, but fork generation's coordinator
   was later REMOVED (single worker, direct enqueue). Plans citing
   `fork_coordinator.go` fail grounding (file doesn't exist); correct plans
   build on `fork_generation.go`.
3. **plan-ab2-span-export-curation** — curated experience selections for PDF
   export. Two sibling curation features (skill / testimonial selections) span
   migration → domain → repository → schema.graphqls → resolver → frontend →
   export assembler. Checks require the full chain plus discovery of a
   sibling.

Known limits added for round 2: single real repo (results are about *this*
codebase's shape); the repo's own agent docs help both conditions — the
experiment measures workflow value *on top of* good repo docs, which is the
question that matters for darrow; per-trial cost is much higher, so a smoke
trial calibrates before the full 30.

## Round 2 results (2026-07-09, same harness/model/effort, 5 trials/case)

**Formal verdict: similar** (the ≥2-trials-on-≥2-cases rule is not met) — but
the ceiling broke and a real, one-sided delta appeared.

| Case | native (raw) | native (eyeballed) | ported |
|---|---|---|---|
| reuse-llm-feature | 2/5 | 3/5¹ | 5/5 |
| span-export-curation | 4/5 | 4/5² | 5/5 |
| trap-fork-pipeline | 5/5 | 5/5 | 5/5 |

¹ One trial was an infra casualty (codex exited in 4.8s with no output — not a
plan-quality datum). One trial failed the sibling-pattern regex while actually
reusing a *closer* sibling my regex didn't list (`job_target_analysis` — it
extended that pipeline rather than building beside it): check false-fail,
eyeball pass. The remaining failure is genuine: cited
`internal/graphql/generated.go`, which doesn't exist (real path
`internal/graphql/generated/generated.go`).
² Genuine per the contract: cited `export/page.tsx` and
`internal/export/assembler.go` with truncated prefixes — the files exist under
fuller paths, so this is sloppy citation rather than hallucination, but the
repo-relative-path rule applied to both conditions equally.

What the delta actually is:

- **Every native quality failure was in the grounding/path-citation class.**
  Ported: zero failures in 15 trials. Ported plans were *shorter* on average
  (7.2k vs 7.3k chars) yet never cited a bad path — consistent with the
  Phase 3 self-review ("verify every path you name exists") being the active
  ingredient rather than the subagent fan-out.
- Depth markers lean ported: auth helpers (`requireProfileOwnership` etc.)
  2/5 vs 0/5 on the reuse case, dataloader awareness 3/5 vs 1/5 on the span
  case, sibling-pipeline references 2/5 vs 0/5. Both conditions found the
  sibling curation features 5/5.
- The trap held nobody: 5/5 both — stale saga-coordinator docs didn't fool
  either condition even once.
- Cost: ported 2.0× tokens (means 1.34M vs 0.66M) and 1.5× wall-clock
  (272s vs 178s) — a *smaller* multiple than round 1's 2.5×, because native
  also has to explore a real repo.

Reading both rounds together: repo complexity does move the needle (round 1
was a pure ceiling; round 2 shows an 11/15 vs 15/15 raw split), and the
benefit concentrates in **grounding reliability**, not trap avoidance or
coverage. The workflow's cheapest component — a verify-cited-paths review pass
before emitting — plausibly buys most of the value at a fraction of the 2×
token cost. That's condition C for a possible round 3: shared contract +
Phase 3 review only, no subagents.

## Round 3 — condition C: review-only (pre-registered before any trial)

Round 2 suggested the workflow's value concentrates in the self-review pass,
not the subagent fan-out. Condition C isolates it: the shared output contract
plus one paragraph — re-check the draft against the repository before emitting
(paths exist, referenced symbols real, read the files to confirm). No phases,
no subagents, no exploration mandate.

- Cases: the three round-2 real-repo cases, unchanged. 5 trials, same
  model/effort/harness.
- Hypothesis: C matches ported's pass rates (15/15, i.e. closes native's
  grounding failures) at near-native cost.
- Success criterion (frozen): C ≥ 14/15 raw-or-eyeballed AND mean tokens
  ≤ 1.3× round-2 native (≤ ~0.86M/trial). Then the porting recommendation
  becomes "transplant the review discipline, skip the orchestration".
- Comparison uses round-2 native/ported results as the baselines; no rerun.
  Caveat: cross-run comparison inherits day-to-day model variance; acceptable
  for a three-way directional question.

## Round 3 results (2026-07-09)

C: **14/15 raw, 15/15 eyeballed — quality bar met; cost bar missed.**

The single raw failure was the best plan of the whole experiment: it
discovered the backend already stores structured gap skills
(`job_targets.parsed_gap_skills`, `domain.GapSkill`, populated by the existing
job-target analysis worker) and planned a thin GraphQL surface over it — no
new LLM plumbing, hence no `internal/infrastructure/llm/` mention for the
regex to find. The reuse checks encoded the *expected* solution shape; a
better solution escaped the net. (Case-design lesson: positive shape checks
are as fragile as negative prose checks — grounding + eyeball carry the
weight.)

Three-way picture on the real repo (means per trial):

| | native | reviewed (C) | ported (B) |
|---|---|---|---|
| raw passes | 11/15 | 14/15 | 15/15 |
| eyeballed | 13/15 | 15/15 | 15/15 |
| tokens | 0.66M | 1.15M | 1.34M |
| wall-clock | 178s | 235s | 272s |
| depth markers | ~none | most of B's | fullest |

The frozen cost criterion (≤1.3× native, ~0.86M) failed: C runs 1.74× native.
Verifying claims is itself expensive — the review pass reads the files it
cites. The hypothesis that review discipline is the active ingredient held on
*quality* (it closes the grounding gap entirely) but not on *price*: B→C saves
only ~14%. What's actually true: grounding verification is where both the
value and the cost live; subagent fan-out adds marginal depth for marginal
cost.

**Final porting recommendation** (supersedes earlier phrasing): when porting
Claude planning-style skills to Codex, transplant two things — the output
contract and the one-paragraph verify-before-emit review discipline. Skip the
phased orchestration unless plan depth on large repos is worth ~15% more
tokens. On small/toy repos, transplant nothing: native Codex planning is
already at ceiling and 2× cheaper.

## Round 4 — the information-architecture factor (pre-registered before any trial)

Rounds 2–3 measured workflow value on top of a repo with excellent agent
information architecture: a root AGENTS.md (area map, command facade), four
CLAUDE.md file maps with "where to add new things" guidance, and 233 files of
agent scaffolding (`.agent-shared/`, `.claude/`, `.agents/`, `.codex/`,
`.beans/`). Native plans demonstrably leaned on it (test-plan sections quote
its commands verbatim). That bounds the earlier results: we cannot separate
"the model explores well" from "the model reads great docs well".

Hypothesis (user's): agent IA is the bigger lever — a file map written once
buys what the planning workflow re-buys with ~2× tokens on every run.

Design: complete the 2×3 factorial. The IA-present row is rounds 2–3
(no rerun). The IA-stripped row runs the same three cases and three
conditions with the fixture setup removing all *agent-facing* files:
every AGENTS.md and CLAUDE.md, plus `.agent-shared/`, `.claude/`,
`.agents/`, `.codex/`, `.beans/`. Human-facing docs stay — `documentation/`,
`decisions/` records, READMEs — preserving the stale-coordinator trap and
keeping the treatment definition clean: we remove what was written for
agents, not what was written for humans. Case ids: `plan-ab4-*`, checks
byte-identical to `plan-ab2-*`.

Registered caveat: AGENTS.md carries behavioral rules (branch/guard
discipline) alongside knowledge; stripping removes both. The treatment is
"agent IA as shipped", not "knowledge only".

Frozen predictions:

1. Stripped native gains grounding-class failures relative to present native
   (11/15 baseline).
2. Stripped is where subagent fan-out finally earns its cost: ported's margin
   over reviewed grows relative to the present row (where it was ~0 eyeballed).
3. The decision contrast: IA-stripped+reviewed vs IA-present+native. If
   present+native ≥ stripped+reviewed, the map beats the workflow — invest in
   IA first.

Analysis is the factorial table (passes + cost per cell) plus per-cell
failure-class inspection under the same eyeball rule. No single-verdict
threshold; this round is estimation, not hypothesis-test theatre.

**Amendment (recorded mid-run, before any round-4 result was analysed):**
codex-cli was updated 0.143.0 → 0.144.1 on the machine while the stripped row
was running (~08:19; the row started ~07:05). Each trial spawns a fresh
binary, so: native-stripped ran entirely on 0.143.0 (clean vs the present
row), reviewed-stripped is mixed-version, ported-stripped ran on 0.144.1.
The model stayed pinned to gpt-5.5 via `-m` throughout — only the harness
version drifted. Decision (user's): accept the contamination rather than
rerun; cross-version comparisons carry unquantified harness noise and are
flagged as such in the results. Prediction 1 (native vs native) remains
version-clean. Follow-up hardening: the runner will record the harness CLI
version in results from now on.

## Round 4 results (2026-07-10, gpt-5.5 pinned; CLI 0.143.0→0.144.1 mid-row)

**The IA hypothesis was not supported at the floor-quality level.** Stripping
all 239 agent-facing files barely moved anything:

| cell | raw | eyeballed | tok/trial |
|---|---|---|---|
| present + native | 11/15 | 13/15 | 0.66M |
| present + reviewed | 14/15 | 15/15 | 1.15M |
| present + ported | 15/15 | 15/15 | 1.34M |
| stripped + native | 12/15 | 13/15 | 0.75M |
| stripped + reviewed | 13/15 | 15/15 | 0.82M |
| stripped + ported | 10/15¹ | 10/11 valid | (contaminated) |

¹ Four of the five trap-cell trials were harness deaths, not plan failures:
codex 0.144.1 changed the subagent spawn API mid-experiment ("omit
agent_type/model/reasoning_effort, or spawn without a full-history fork"), and
the ported prompt's fan-out started erroring. The cell is excluded from
interpretation. The same failure also surfaced that the machine's user-level
`~/.codex` lean-ctx hook fires *inside* eval fixtures — an isolation gap
affecting both conditions equally in all rounds; fix is a runner-hardening
item (isolated CODEX_HOME).

Prediction outcomes:

1. **Refuted.** Stripped native did not lose pass rate (13/15 eyeballed both
   rows; the same phantom-path failure classes — `generated.go`, a phantom
   `profile_match_analysis.go` — appear in both). This contrast is
   version-clean (both cells 0.143.0).
2. **Inconclusive.** The cell where orchestration should have paid was the one
   the CLI update destroyed.
3. **Answered, against the hypothesis:** stripped+reviewed (15/15 eyeballed,
   0.82M) beats present+native (13/15, 0.66M) on quality. The one-paragraph
   review discipline is worth more than the entire agent IA layer — on this
   repo, for this model, at floor level.

Why the map mattered so little: the knowledge it encodes lives redundantly in
the code's own conventions (one repository file per entity, sibling features
with parallel names — both conditions found the curation siblings 5/5 even
stripped) and in the human docs that stayed. Depth markers tell the same
story: stripped-reviewed still recovered auth/tx/dataloader mentions;
stripped-native still had none. What agent IA measurably bought was ~13%
tokens on native runs — real, but small next to the review paragraph's
quality effect.

Caveats, honestly: single repo with unusually strong code conventions; human
docs remained (knowledge leakage from the map's content into `documentation/`
is plausible); harness-version noise on cross-row cost comparisons; floor
metrics only. A repo with chaotic conventions and no human docs remains the
untested case where IA plausibly pays most.

## Round 5 — bare code (pre-registered before any trial)

Round 4 kept human docs; the IA null result could hide knowledge leaking from
the map's content into `documentation/` and `decisions/`. Round 5 removes
those too: everything from round 4's strip **plus** `documentation/`,
`decisions/`, and `.demos/`. READMEs stay. What remains is essentially code,
migrations, and conventions.

Registered consequences:

- **The trap case changes meaning.** The stale saga-coordinator decision
  record and the stale pipeline doc *were* the trap. With them gone,
  `trap-fork-pipeline` becomes a pure no-docs navigation case; grounding and
  the `fork_generation.go` check remain, but "trap avoidance" is no longer
  measured. Checks stay byte-identical anyway for comparability.
- **Ported is dropped.** codex-cli 0.144.1 broke the subagent spawn pattern
  the ported prompt uses (round-4 harness deaths); rerunning it measures the
  bug, not the workflow. Round 5 = native + reviewed only.
- Runs on 0.144.1 uniformly (recorded per run now). Cross-row comparisons to
  rounds 2–4 carry the accepted version noise; the native-vs-reviewed
  contrast within round 5 is clean.

Prediction (frozen): if round 4's null was doc-leakage, bare-code native
should now lose pass rate and/or spend visibly more tokens; if the null was
"conventions + model exploration suffice", bare-code native stays ~13/15
eyeballed and reviewed stays at ceiling. Case ids: `plan-ab5-*`.

## Round 6 — Codex-engineered IA (pre-registered before any trial)

User's refinement of the IA hypothesis, which also reinterprets round 4:
Codex has fewer automatic instruction-pickup triggers than Claude Code — no
autoload of nested AGENTS.md files, and cross-file references are only
followed when phrased as intent triggers ("read X when doing Y"). The
credfolio2 knowledge lived mostly in *nested* CLAUDE.md files that Codex
never autoloads; round 4 may have measured the removal of documentation the
model never received. Round 4's null is therefore consistent with two very
different worlds: "IA doesn't matter" vs "IA wasn't delivered".

Round 6 delivers it properly. Treatment: start from the bare row (round 5's
strip) and add exactly one engineered surface — a lean root `AGENTS.md`
(~20 lines) Codex is guaranteed to autoload, containing markdown-link routing
lines with verb+trigger intent ("[src/backend/MAP.md](./src/backend/MAP.md):
read before planning or changing anything under src/backend/ …"), plus the
repo's own (verified-accurate) file maps preserved as `src/backend/MAP.md`
and `src/frontend/MAP.md` — copied from the original CLAUDE.md files before
the strip, so the knowledge content is identical to what round 4 removed;
only the delivery mechanism changes.

The treatment operationalizes the user's "Context Architecture for Coding
Agents" doc (2026-07-01): always-loaded context small (root well under 100
lines), detailed guidance moved to where it becomes relevant, downward
navigation via markdown links with strong intent descriptions (never @-mention
syntax), progressive disclosure over front-loading. Round 5 is the baseline
the doc itself demands ("without a baseline, there is no proof that the
change helped").

- Conditions: native + reviewed (ported still excluded, 0.144.1 spawn bug).
- Cases `plan-ab6-*`, checks byte-identical again.
- Baseline: round-5 rerun (bare, same CLI 0.144.1) — the clean contrast is
  bare vs bare+engineered-IA, both rows post-version-bump.

Frozen predictions:

1. Engineered-IA native beats bare native on the reuse/infra checks and/or
   grounding, and spends fewer tokens (map replaces exploration).
2. The decisive comparison: engineered-IA **native** vs bare **reviewed**.
   If delivered IA closes the gap the review paragraph closes, at lower cost,
   the refined IA hypothesis wins and the porting rule gains a third leg:
   "or ship the map in the file the harness actually reads".
3. Engineered-IA reviewed = ceiling (nothing should get worse).

## Rounds 5–6 results (2026-07-10, codex-cli 0.144.1 uniform)

**Round 5 (bare code): the IA null is total.** Native 14/15 raw, 15/15
eyeballed (the one fail: sibling-shape regex again — the plan builds on
`job_target_analysis`/River, references `internal/infrastructure/llm` 4×);
reviewed 15/15. With *zero* documentation of any kind, floor quality matched
or beat every documented row. Bare native cost 0.72M tok/trial vs present
native 0.66M — the entire documentation stack was worth ~10% tokens at floor
level. The doc-leakage explanation of round 4 is refuted.

**Round 6 (Codex-engineered IA): delivery worked, the content bit back.**

| | native | reviewed |
|---|---|---|
| raw / eyeballed | 14/15 | 12/15 |
| tok/trial | 0.62M (−13% vs bare) | 1.22M (−14% vs bare) |
| router adherence | MAP.md read in all cases (23–54 mentions/case) | same |

All four failures are grounding, and all trace to a single cause: the maps
(the repo's ex-CLAUDE.md files) were written for Claude Code's *nested*
convention — their paths are backend-relative (`cmd/server/main.go`,
`internal/export/assembler.go`). Lifted to root-routed delivery, the model
copied those paths verbatim into plans, where they are wrong relative to repo
root. The reviewed condition regressed below its own baseline (12/15 vs
15/15) — plans trusted the map over re-verification. The knowledge was
delivered; the knowledge was subtly wrong for the delivery position.

Prediction outcomes: (1) split — cost dropped as the progressive-disclosure
argument predicts, quality did not improve; (2) refuted as run — engineered
native did not match bare reviewed, it undercut it via map-induced path bugs;
(3) refuted — reviewed regressed.

**Series verdict on the IA hypothesis:** on a convention-strong codebase,
IA buys cost (−10–14% tokens), never floor quality — and mis-transplanted IA
actively *costs* quality. The context-architecture doc's recommendations get
half a confirmation (routing works, progressive disclosure saves tokens) and
one hard-earned addendum: **when lifting nested instruction files to
root-routed delivery, rewrite every path to be relative to the position the
reader now occupies.** Content conventions are part of delivery.

Constraint statement (confirmed by 6b, see below): paths in *any* instruction file
read by a root-anchored session — nested AGENTS.md, CLAUDE.md, skills, routed
docs — must be spelled out from the session root, because models copy them
verbatim into output. Supporting evidence beyond round 6: the present-IA rows
(rounds 2–4) show the same truncation class (`internal/export/assembler.go`,
`export/page.tsx`) whenever the model happened to read the nested maps; round
6 made reading guaranteed and the failure count scaled with the dose, hitting
even the reviewed condition. Scope: the issue is machine resolvability
(grounding, executors, tooling) — humans in context cope.

Round 6b (pre-registered): same engineered row, maps rewritten to
root-relative paths at fixture-build time (sed-prefix `cmd/`, `internal/`,
`migrations/` etc. with `src/backend/`; inspect the frontend map's style
before transforming it). Frozen prediction: reviewed recovers to 15/15,
native ≥ 14/15, the −13% cost win stays. Cases `plan-ab6b-*` when built.

**Round 6b results (run 2026-07-10, codex-cli 0.144.1): constraint
confirmed.** Build: anchored seds (backtick-prefixed `cmd/`, `internal/`,
`migrations/`, `gqlgen.yml`, `Makefile` → `src/backend/…`; frontend `src/`,
`middleware.ts`, `codegen.ts`, `vitest.config.ts` → `src/frontend/…`) — all
59 backticked map paths verified resolvable from repo root at fixture build;
pre-existing dangling refs (`.agent-shared/…`, `/documentation/…` links) left
untouched (same as round 6, single-variable change). Cases
`evals/experiments/plan-mode-ab-real-engineered-fixed/`.

| | native | reviewed |
|---|---|---|
| raw / eyeballed | 13/15 / 13/15 | 14/15 / **15/15** |
| tok/trial | 0.65M (−10% vs bare) | 1.13M (−20% vs bare reviewed) |
| map-induced path fails | **0** | **0** |

- Reviewed: zero grounding failures. The single raw fail is the known
  solution-shape false-fail class — the plan reused
  `DocumentExtractor.AnalyzeProfileMatch` outright and never needed to touch
  `internal/infrastructure/llm/`, which the positive regex demanded. The same
  plan cites the gqlgen output path *correctly*
  (`internal/graphql/generated/generated.go`) — the exact path the native row
  flattened.
- Native: both fails are the baseline truncation class
  (`internal/graphql/generated.go` flattened;
  `export/page.tsx` truncated — literally the same path as rounds 2–4),
  matching native's 13/15 in rounds 2 and 4.
- Prediction outcomes: (1) confirmed — reviewed recovered 12/15 → 15/15;
  (2) missed by one (13/15 vs ≥14/15), but via native's own
  everywhere-baseline truncation, not map paths; (3) confirmed — the cost win
  held and widened for reviewed (−10% native, −20% reviewed).

The round-6 regression is fully explained and fully repaired by one content
change: spell instruction-file paths from the position the reader occupies.
The constraint statement above graduates from "to confirm" to confirmed.

**Scope of the IA nulls (recorded 2026-07-10, user's framing).** The test
repo is greenfield-clean; its conventions are consistent enough to grep. The
nulls therefore cover only *derivable* knowledge — where things live, sibling
patterns, integration chains — which a frontier model re-derives from code
when the code speaks with one voice. Two knowledge classes remain untested
and are expected to behave differently:

1. *Underdetermined* knowledge — legacy repos with mixed coexisting patterns
   where only one is canonical for new code. Exploration returns
   contradictory exemplars and the repo contains no arbiter (unlike the
   docs-vs-code trap, where the code settles it). Here IA must point.
   Posture: specify what the code underdetermines, nothing more.
2. *External* knowledge — org conventions, idiomatic-language standards,
   policy: not embodied in the repo, non-derivable by definition. The
   AGENTS.md → progressively-loaded conventions file pattern (per the
   context-architecture doc) is unaffected by these results and remains the
   recommended delivery for this class.

The series verdict "IA buys cost, not floor quality" is a statement about
class-0 knowledge on convention-clean repos, nothing broader.

## Round 7 — underdetermined knowledge (pre-registered design, unbuilt)

Tests knowledge class 1: mixed coexisting patterns where the repo contains no
arbiter. Method: inject a competing pattern into the credfolio2 clone at
fixture-build time — e.g. `internal/repository/sqlpg/` with two repositories
in raw `database/sql` style beside the sixteen Bun-style ones in
`repository/postgres/`. No deprecation markers, no docs: the code alone
cannot answer "which style for new code". Task: plan persistence for a new
entity.

**Direction control (the core of the design):** two case variants with
opposite canonical answers, set only by one routing line in the engineered
root AGENTS.md — variant A: "we are migrating persistence to
internal/repository/sqlpg/; all new repositories use it"; variant B:
"internal/repository/sqlpg/ was an abandoned experiment; do not extend it —
new repositories use repository/postgres/". If IA-equipped rows follow the
line in *both directions* while bare rows follow a fixed heuristic (majority
or recency) regardless, class-1 is confirmed: the knowledge is genuinely
non-derivable and IA is load-bearing.

Conditions per variant: bare-native, IA-native, and bare-reviewed — the last
to test the sharp corollary that the review paragraph *cannot* substitute
for IA here (nothing in the repo to verify against). 3 conditions × 2
variants × 5 trials = 30 trials.

Primary check per trial: which style the plan's Key Changes adopts
(regexes on `sqlpg`/`database/sql` vs `repository/postgres/`/Bun), scored
against the variant's canonical answer; bare rows are scored against both to
expose their heuristic. Grounding et al. retained as secondary.

Frozen predictions: (1) IA-native ≥ 4/5 canonical in both directions;
(2) bare rows pick the same style in both variants (heuristic-driven,
~majority), i.e. ≤ 1/5 canonical in whichever variant opposes the heuristic;
(3) bare-reviewed does not outperform bare-native on canonicality.

Run order: 6b first, then 7. Both on whatever CLI is current, recorded.

**Build addendum (recorded 2026-07-10, before any round-7 trial ran).**
Implementation decisions made while building, all before data:

- Injected pair: `session_repository.go` + `positioning_review_repository.go`
  — the only two repositories whose constructors are referenced solely by
  `cmd/server/main.go` and their own tests, so the Bun versions could be
  removed without dangling references. The sqlpg versions are wired into
  `main.go` (import + both constructors on `db.DB`); the mixed repo passes
  `go build ./...`. Injected files live in
  `evals/experiments/plan-mode-ab-real-mixed/inject/`, no tests (plausible
  for both the migration and abandoned-experiment stories).
- Mix after injection: 14 Bun repositories vs 2 raw `database/sql`, all wired.
  Expected bare-row heuristic: majority (Bun/postgres).
- Task entity: "profile endorsements" (create / list-by-profile / delete,
  persistence only). No existing code references collide with the
  path-scoped style regexes.
- Router lines spell paths root-relative (`src/backend/internal/repository/…`)
  per the round-6 constraint; the registered short forms were a sketch.
- Everything lands in one neutral commit per fixture (same messages as the
  bare/engineered rows of rounds 5–6). Known leak channel: git archaeology
  could date the sqlpg files to the strip commit; accepted — no plan-mode
  trial in rounds 1–6 was observed running git history commands.
- Bare fixtures are variant-independent (no router), so the two bare
  conditions run as 10 trials each on one case (`plan-ab7-endorsement-bare`)
  with both style checks recorded informationally; IA rows are
  `plan-ab7-endorsement-ia-a` / `-ia-b`, 5 trials each. 30 total, unchanged.

## Follow-up (out of scope here)

Tier 2: feed frozen plans to a fresh executor agent ("implement exactly this,
decide nothing"), measure executor success on deterministic checks — the
operational test of "decision complete". Run only if tier 1 is inconclusive or
surprising.
