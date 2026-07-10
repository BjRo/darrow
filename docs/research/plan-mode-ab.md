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

## Follow-up (out of scope here)

Tier 2: feed frozen plans to a fresh executor agent ("implement exactly this,
decide nothing"), measure executor success on deterministic checks — the
operational test of "decision complete". Run only if tier 1 is inconclusive or
surprising.
