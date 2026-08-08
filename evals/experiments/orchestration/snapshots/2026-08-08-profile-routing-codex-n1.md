# Adaptive profile routing calibration

Status: exploratory evidence, not an accepted value claim  
Run date: 2026-08-08  
Scope: one accepted Codex trial per task on four pinned, human-authored OSS repositories

## Outcome

The profile route is now genuinely applied. A `gpt-5.6-terra`/low preflight
compiled each task, and the enclosing Codex app server started the native-goal
turn with the selected Sol model and effort. The raw event audit reconciled the
selected route, accepted host boundary, terminal goal state, final answer, and
token totals for every accepted trial.

This proves route application; it does not yet prove product value.

- All four deterministic task and protocol contracts passed.
- The condition-blind judge accepted Ajv, Express, and go-git, but rejected
  Click for a plausible unflushed text-stream ordering defect. Qualitative
  success is therefore 3/4, not 4/4.
- Ajv, Click, and go-git selected `deep` and ran on Sol/high. Express selected
  `standard` and ran on Sol/medium.
- Mean candidate wall time was 240.3 seconds and mean candidate usage was
  627,552 tokens. There were zero Darrow child sessions and zero human stops.
- An initially “passing” go-git trial named `deep` but selected Sol/medium. It
  was excluded. The handoff now distinguishes policy routes from explicit user
  routes and rejects a policy/profile mismatch before activation; the accepted
  replacement ran on Sol/high.

Ajv, Click, and Express ran before `routeSource` became a required handoff
field; their exact routes were accepted after a post-hoc mapping audit. The
go-git replacement exercised the final schema and live policy validator.

## Accepted task evidence

| Case              | Repository / task shape                  | Profile  | Effective route | Deterministic |    Judge |   Wall | Tokens |
| ----------------- | ---------------------------------------- | -------- | --------------- | ------------: | -------: | -----: | -----: |
| Ajv instance path | Ajv 8.5.0 / TypeScript code generation   | deep     | Sol/high        |          pass | 4/5 pass | 226.9s | 552857 |
| Click streams     | Click 8.0.0 / Python stream lifecycle    | deep     | Sol/high        |          pass | 2/5 fail | 304.7s | 772163 |
| Express links     | Express 4.17.1 / HTTP security hardening | standard | Sol/medium      |          pass | 5/5 pass | 121.2s | 229886 |
| go-git insteadOf  | go-git 5.4.2 / Go public config API      | deep     | Sol/high        |          pass | 4/5 pass | 308.3s | 955303 |

The Click judge demonstrated a gap in the deterministic oracle: independently
buffered `TextIOWrapper` instances can turn unflushed writes `a`, `b`, `c` into
combined output `acb`. The existing hidden check exercised Click echo and
binary writes but not this unflushed text path. The finding is preserved as an
evaluation result, not silently converted into a deterministic pass.

## What the execution logs prove

For each accepted candidate stream, the audit verified:

1. exactly one accepted `darrow.route_applied` event;
2. selected and effective routes equal the runner's route record;
3. the policy-sourced route matches the named profile mapping;
4. the terminal `final_answer` equals the stored result text;
5. exactly one complete native-goal update;
6. final cumulative input/output usage equals the stored token fields;
7. every deterministic and protocol check passes; and
8. the parsed blind-judge score equals its recorded assessment.

The app-server flow stays in one thread and counts zero children. Native goal
continuations are turns, not Darrow child invocations.

## Rejected setup and route runs

The calibration sequence found bugs that earlier result summaries would have
missed:

- feeding the active classifier route back as a user override;
- returning before a nested launcher completed;
- losing a shell-only goal-path variable;
- recursive Codex model discovery timing out;
- an invalid structured-output schema;
- trying to attach a goal to an ephemeral thread;
- waiting for the original turn instead of the native continuation turn;
- parsing a commentary message as the final preflight handoff; and
- accepting a `deep` profile paired with Sol/medium.

The accepted bounded calibration is
`evals/results/orchestration-value/route-application-calibration-v9.json`
(SHA-256 `f22c9c065fd8a2c5220d531a64e39779d9831e9344b73d55dac1cc241c0522e2`).
The structured JSON snapshot records hashes and reasons for the other retained
artifacts.

## Comparison and conclusion

Historical vanilla, raw-native, and pinned-preflight cells used
`gpt-5.5`/medium for all implementation work. This routed cell used Sol/high
for three tasks and Sol/medium for one, plus a Terra/low classifier turn.
Comparing their aggregate quality or speed as if only Darrow changed would be
invalid.

The current result is narrower:

- route application and profile integrity are now verified;
- adaptive routing did not prevent the Click defect;
- the accepted composite costs 240.3 seconds and 627,552 tokens per task at
  N=1; and
- no incremental value over vanilla or raw native goal has been demonstrated.

Keep adaptive routing exploratory. The next decision-bearing evaluation should
run at least three trials of vanilla, raw native goal, and Darrow preflight on
the same per-task effective routes. It should also add an oracle for unflushed
text-stream interleaving before treating Click as a deterministic success.

## Provenance

The accepted evidence is a composite because the first go-git route was
excluded after audit:

- Ajv, Click, Express bundle:
  `evals/results/orchestration-value/goal-route-host-api-codex-n1-20260808/`
  (result SHA-256 `74590d14eeb058866145368fddf5f0f956be6c38657a2d462d493b9140e003e5`).
- policy-enforced go-git replacement:
  `evals/results/orchestration-value/goal-route-host-api-codex-go-git-replacement-n1-20260808/`
  (result SHA-256 `4291c0c5bea884a58206e306cc07a2a8d150bfd999af5087717ef04dcecdd0d8`).

Raw bundles remain gitignored. The tracked
[structured snapshot](2026-08-08-profile-routing-codex-n1.json) preserves task
values, routes, audit checks, rejected-run reasons, hashes, and next-step rules
for future agent runs.
