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

## Follow-up (out of scope here)

Tier 2: feed frozen plans to a fresh executor agent ("implement exactly this,
decide nothing"), measure executor success on deterministic checks — the
operational test of "decision complete". Run only if tier 1 is inconclusive or
surprising.
