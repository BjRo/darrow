# Adaptive Goal implementation placement (#255)

Status: implemented in `darrow-adaptive-goal` 0.26.0. After two review repairs,
every placement case passed a fresh trial on the final placement rules on its native
host: six on Codex and six on Claude. The three affected existing Codex route
cases passed before the repairs. A matched N=1 comparison with the previous
policy shows a placement difference only for same-route sequential work. It
does not establish cost or speed gains.

## Change under test

Adaptive Goal previously delegated every implementation to a route-selected
child. Version 0.26.0 compares the selected route with the main thread's own
route and places work:

- `same`: implement directly in the main thread;
- `higher` or `unknown`: delegate on the selected route;
- `lower`: delegate only when the work is large enough to repay the handoff;
- independent, substantial parts: concurrent assignments on the selected route.

The new `adaptive-goal-preflight placement` helper reads the main route from the
active session: Codex's latest `turn_context` for `CODEX_THREAD_ID`, or Claude's
latest assistant model plus `CLAUDE_EFFORT`. Missing evidence reports `unknown`.

## Codex results (app-server, passive, 1 trial each)

| Case                                                 | Main route  | Result | Placement observed                  |
| ---------------------------------------------------- | ----------- | ------ | ----------------------------------- |
| `goal-placement-direct-same-route`                   | Luna/medium | pass   | no implementation agent             |
| `goal-placement-coupled-sequential`                  | Luna/medium | pass   | no implementation agent             |
| `goal-placement-cheaper-delegation`                  | Sol/medium  | pass   | one Luna/medium child               |
| `goal-placement-concurrent-parts`                    | Sol/medium  | pass   | two concurrent Luna/medium children |
| `goal-placement-repair-accounting`                   | Luna/medium | pass   | advice only                         |
| `goal-preflight-high-risk-routine`                   | Luna/medium | pass   | direct; required review clear       |
| `goal-preflight-routing-difficult-routine-diagnosis` | Luna/medium | pass   | Astra/high child (`higher`)         |
| `goal-preflight-quality-sensitive-localized`         | Luna/medium | pass   | Luna/high child (`higher`)          |

Failures before the final trials were classified and fixed:

- Fixture defects: an authoritative `SPEC.md` correctly selected readiness that
  the case did not install; "maps each category" allowed a `Map`.
- Invalid expectations: Luna/medium main with a Luna/low route judged a small
  task not worth a handoff, which the policy permits. The cheaper case now runs
  on a Sol/medium main. Luna/medium main finished two small independent parts
  directly in about a minute; the concurrency case now uses larger parts and a
  Sol/medium main.
- Product wording: Luna applied the `same → direct` table row and skipped the
  concurrency exception. The skill now decides concurrency first and then places
  sequential work by relation. An advice probe and later trials confirmed the
  reordered rule.
- Over-specific semantic propositions were reduced to the smallest decision.
  Repair-budget advice no longer requires restated arithmetic.

## Claude smoke

Headless Claude has no model-side `ProposeGoal`, so plain cases stop with
`launch_required`, as documented. Smoke copies entered through native
`/goal {{skill_invocation}} …` and were not committed.

| Case               | Main route     | Trials | Placement observed                                                 |
| ------------------ | -------------- | ------ | ------------------------------------------------------------------ |
| direct same-route  | Sonnet 5.5/low | 1/1    | no Agent call                                                      |
| cheaper delegation | Opus 5.5/high  | 1/2    | trial 1: one `adaptive-goal-sonnet-5-5-low` Agent; trial 2: direct |
| concurrent parts   | Opus 5.5/high  | 2/2    | two `adaptive-goal-sonnet-5-5-low` Agents each                     |

The first cheaper and concurrent smokes delegated correctly but failed a
Codex-only transcript marker. The check now also accepts Claude's `"name":"Agent"`
record; regrading kept the direct trial as a counterexample. Fresh trials then
ran with the updated check.

In the second cheaper trial, Opus judged the task (about 60 lines plus tests)
too small to repay a handoff and implemented directly, stating that basis. The
policy permits that choice for a `lower` relation, and the task passed. The case
is borderline in size; Codex Sol delegated it. The first attempt
of each Claude smoke failed on a revoked OAuth token before any work; the user
refreshed authentication.

## Matched comparison with the previous policy

Same fixtures, prompts, harness, main route and effort; the baseline mounts the
`main` snapshot (0.25.2). N=1 per cell.

| Task                             | Policy | Task outcome              | Implementation children | Wall time  | Reported tokens                |
| -------------------------------- | ------ | ------------------------- | ----------------------- | ---------- | ------------------------------ |
| direct same-route (Luna/medium)  | new    | pass                      | 0                       | 59 s       | 294,558 (complete)             |
| direct same-route (Luna/medium)  | old    | pass                      | 1 Luna/medium           | 74 s       | 294,968 (child tokens missing) |
| coupled sequential (Luna/medium) | new    | pass                      | 0                       | 40 s       | 310,988 (complete)             |
| coupled sequential (Luna/medium) | old ×2 | stopped `launch_required` | 0                       | 43 s, 49 s | 152,622; 140,975               |
| coupled, clarified (Luna/medium) | new    | pass                      | 0                       | 41 s       | 325,265 (complete)             |
| coupled, clarified (Luna/medium) | old    | pass                      | 1 Luna/medium           | 56 s       | 267,525 (child tokens missing) |
| concurrent parts (Sol/medium)    | new    | pass                      | 2 Luna/medium           | 236 s      | 818,408 (child tokens missing) |
| concurrent parts (Sol/medium)    | old    | pass                      | 2 Luna/medium           | 213 s      | 711,544 (child tokens missing) |
| cheaper delegation (Sol/medium)  | new    | pass                      | 1 Luna/medium           | 178 s      | 350,422 (child tokens missing) |
| cheaper delegation (Sol/medium)  | old    | pass                      | 1 Luna/medium           | 108 s      | 277,728 (child tokens missing) |

Observations:

- Same-route sequential work is the only cell where placement differs: the new
  policy removed the child. The direct trial was faster and its token total is
  complete; the old total omits child usage, so token cost cannot be compared.
- The old policy already split the independent parts and delegated the cheaper
  task on a Sol main. The new policy reproduced that behavior; its wall times
  were not better in these single trials.
- The original coupled fixture was ambiguous about risk. Both old-policy trials
  and one later new-policy trial classified the interface change as elevated
  and stopped because the case installs no verification. The fixture now states
  that the modules are private and every caller is tested. On that clarified
  fixture both policies completed the task; only the new one stayed direct.
  The first coupled rows are kept as history.

## Independent review and repair

Verification through `darrow-review:code-review` (fresh Opus 5.5/xhigh
Standards and Spec readers) returned **progress**: Standards failed on one
blocking finding, and Spec passed with advisories. Report:
`~/.darrow/reviews/8215ca3d…/darrow-review.eubko6en/review.md`.

- **F1 (blocking):** the cheaper-delegation case failed policy-permitted direct
  placement for a `lower` relation. Repair: the task now adds a dependent budget
  module, so delegation clearly repays the handoff. The semantic check requires
  delegation to a cheaper or lower route.
- Advisories addressed in the same repair: committed Claude `/goal` variants of
  the four placement cases (F11); the repair case split into allowance and
  self-review cases (F5); `high-risk-routine` no longer claims ADL-R1/ADL-R3
  (F3); Hypothesis tests for `relation()` symmetry and the session parser (F4);
  one ordered effort vocabulary in `routes.py` (F6); a renamed rank test (F7);
  clearer Codex short description (F8), summaries naming the stronger or unknown
  route trigger (F9), shared-interface placement for stronger or unknown routes
  (F12), and doctor topology wording (F13). The concurrent check now requires
  separate parallel agents (F10).
- F2 is recorded as a limitation below rather than enforced by the runner.

Fix verification of that repair resolved F1 and ten advisories and found one
direct regression: this document's status overclaimed fresh Codex trials for
the direct and coupled cases. It also left F2 unchanged and F4 half done, and
noted that the verifier had not seen result artifacts or route-pinning facts.
Report: `~/.darrow/reviews/8215ca3d…/darrow-review.ak4_yvta/verification.md`.

The second repair reran the direct and coupled cases, documented
per-case route pinning with `--case-routes` in every case header (F2), added a
property test for the session-route observers (F4), and corrected two summary
wordings. A fresh Codex coupled trial classified the original fixture as
elevated risk and stopped; the fixture now states its risk facts (see above).

Final fresh trials (one each, retained under `evals/results/`):

| Case                           | Host   | Main route        | Result | Result file                                                     |
| ------------------------------ | ------ | ----------------- | ------ | --------------------------------------------------------------- |
| direct same-route              | Codex  | Luna/medium       | pass   | `2026-10-07T17-49-19-484Z-codex-gpt-6-luna-medium.json`         |
| coupled sequential             | Codex  | Luna/medium       | pass   | `2026-10-07T17-52-33-354Z-codex-gpt-6-luna-medium.json`         |
| cheaper delegation             | Codex  | Astra/high        | pass   | `2026-10-07T17-26-36-223Z-codex-gpt-6-astra-high.json`          |
| concurrent parts               | Codex  | Sol/medium        | pass   | `2026-10-07T17-05-22-772Z-codex-gpt-6.1-sol-medium.json`        |
| repair allowance               | Codex  | Luna/medium       | pass   | `2026-10-07T17-11-09-869Z-codex-gpt-6-luna-medium.json`         |
| repair self-review             | Codex  | Luna/medium       | pass   | `2026-10-07T17-11-21-811Z-codex-gpt-6-luna-medium.json`         |
| direct same-route (`-claude`)  | Claude | Sonnet 5.5/low    | pass   | `2026-10-07T16-56-44-356Z-claude-claude-sonnet-5-5-low.json`    |
| coupled sequential (`-claude`) | Claude | Sonnet 5.5/low    | pass   | `2026-10-07T17-54-28-555Z-claude-claude-sonnet-5-5-low.json`    |
| cheaper delegation (`-claude`) | Claude | Opus 5.5/high     | pass   | `2026-10-07T17-01-06-530Z-claude-claude-opus-5-5-high.json`     |
| concurrent parts (`-claude`)   | Claude | Opus 5.5/high     | pass   | `2026-10-07T17-02-55-512Z-claude-claude-opus-5-5-high.json`     |
| repair allowance               | Claude | Sonnet 5.5/medium | pass   | `2026-10-07T17-04-35-152Z-claude-claude-sonnet-5-5-medium.json` |
| repair self-review             | Claude | Sonnet 5.5/medium | pass   | `2026-10-07T17-04-51-888Z-claude-claude-sonnet-5-5-medium.json` |

The second repair changed only introduction wording in `SKILL.md`, not the
section 7 placement rules. Of the final rows, only the Codex and Claude coupled
reruns started after that edit; the Codex direct rerun started 36 seconds before
it, and every other row ran earlier on identical placement rules. Result files
record no skill-content digest, so this binding comes from timestamps.

The enlarged cheaper task first ran on a Sol/medium main. Both trials classified
its two modules as `scaled`, whose route is also Sol/medium, so the relation was
`same` and the main thread correctly implemented directly. The Codex case now
needs an Astra/high main so that the selected route is `lower`. One earlier
Astra trial passed but lost its checkpoint after I archived its live run record;
the reported pass is the later persisted trial.

## Sevro integration follow-up

After the branch merged `main` with the Sevro evaluation integration (#245), CI
showed that every transcript check must use a registered Sevro evidence pattern.
The four delegation and concurrency cases dropped their unregistered "an
implementation agent was accepted" marker; their semantic checks still require
the reported placement. The Sevro route-grading tests used
`goal-preflight-high-risk-routine` as their delegated-route fixture. That case
now implements directly at the default route, so those tests now use
`goal-preflight-quality-sensitive-localized`, which still delegates on
Luna/high. No live trial was rerun for this assertion-only change.

## Advisory follow-up

The remaining review advisories were addressed after the Sevro merge:

- F2: cases now declare `harnesses` and `candidate_routes` (spec SE-C34).
  A default `--skill adaptive-goal` run selects only the variants for the
  requested host and runs each on its declared main route.
- Claude variants: Sevro grades generic transcript checks only from Codex
  native evidence, so the `-claude` variants carry placement in semantic checks
  instead. The two repair-advice cases keep their no-agent transcript check and
  are Codex-only, like the existing budgeted-repair cases; their earlier Claude
  passes came from the retired runner.
- F4: the observed-route property test now generates valid routes often enough
  to exercise the observed branch, not only the unknown one.
- regression:2: corrected the trial-to-skill-text wording (above).

## Limitations

- One trial per cell. No efficiency or reliability claim is made.
- Codex harness token totals omit native child usage when children run.
- The cheaper and concurrency cases need a main thread stronger than the
  selected route: Codex Astra/high for cheaper and Sol/medium for concurrency,
  Claude Opus/high for both. Their `candidate_routes` declarations apply these
  routes in filtered and ownership runs; exact `--case-id` runs and suites must
  pass them explicitly.
- `bun test ./evals/runner/` passes except `main Bun test discovery ignores
external eval corpus caches`. That test runs only in a temporary directory,
  and this change touches no TypeScript.
