# Adaptive Goal routing clarification on Luna/medium

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

**Follow-up:** the [0.23.10 prerequisite rerun](darrow-adaptive-delivery-python-prerequisite-2026-09-30.md)
completed all three cases at n:5: **12/15 task**, **15/15 required owner routes**,
and no premature Python refusals. One capability-handoff failure and two parent
agent-list violations remain. The 0.23.9 results and failures below are retained
as historical evidence.

## Change and scope

The user selected a clarification of the existing routing decision. Adaptive
Delivery **0.23.9** separates consequence risk, the owner's reasoning demand,
and assurance. A `routine-plus` choice needs a concrete implementation tradeoff
or an explicit user or repository priority for first-pass boundary correctness.
Contrasting examples preserve high-risk review for a fully specified routine
change and stronger owner routes for explicit correctness priorities or
unresolved diagnoses.

The invariant was updated before the skill. The skill, README, and both plugin
manifests changed. The route catalog, deterministic helpers, eval cases, and
shared runner implementation are unchanged. This is focused coverage of three
routing cases, not the full plugin sweep.

## Measurement correction

The first 15-trial batch used a frozen directory named `candidate`. The runner
derived `$candidate:adaptive-delivery` from that path, while the installed
manifest declared `darrow-adaptive-delivery`. Those requests did not use the
intended explicit invocation. Preserve the
original results (`evals/results/adaptive-routing-option1-2026-09-29/summary.json`)
as setup diagnostics and exclude them from valid explicit-invocation coverage.
In particular, the two observed skill/owner bypasses in the difficult-diagnosis
case cannot establish a plugin activation defect under the intended request.

The corrected copy is named `darrow-adaptive-delivery` and contains the identical
frozen plugin bytes. Before rerunning, the shared prompt renderer verified the
exact installed namespace for all three cases; see the
invocation proof (`evals/results/adaptive-routing-option1-corrected-2026-09-29/invocation-proof.json`).
The runner implementation was not changed. Snapshot naming guidance was added
to `docs/eval-development.md` to prevent this setup mistake.

The same read-only audit found seven affected cases in the selected review
sweep, totaling 35 trials. Their recorded task outcomes remain historical
observations; their explicit-invocation claims are superseded by corrected measurements. The
[review report correction](darrow-review-luna-medium-stabilization-2026-09-29.md#evidence-correction-snapshot-invocation-namespace)
lists the scope and keeps the other 24 review cases separate.

The [2026-09-30 review rerun](darrow-review-explicit-rerun-2026-09-30.md) has
completed all seven corrected cases: **31/35 task and 35/35 activation**. The
four raw failures remain open: a handoff coordination failure, an unconfirmed
capacity block, and two suspected eval/grader failures. They remain separate
from these Adaptive Goal results.

## Corrected results

All corrected runs use Codex CLI 0.156.1, a `gpt-6-luna` / medium parent,
five trials per case, three jobs within each case, threshold 100%, and passive
owner evaluation. Cases run sequentially and every trial is retained. The
semantic-output grader remains the runner default, `gpt-5.6-luna` / low.

| Case                             | Required owner | Task | Accepted required route | Activation contract |
| -------------------------------- | -------------- | ---- | ----------------------- | ------------------- |
| High-risk routine                | Luna/medium    | 2/5  | 4/5                     | 4/5                 |
| Explicit correctness priority    | Luna/high      | 4/5  | 4/5                     | Not configured      |
| Difficult routine-risk diagnosis | Astra/high     | 4/5  | 4/5                     | Not configured      |

Total: **10/15 task passes** and **12/15 accepted required routes**. All three
cases remain below the 5/5 task threshold.

The four accepted owners in each case used the required route: **12/12 among
launched owners**, with no observed incorrect profile choice.
Each case's missing owner stopped at the Python prerequisite. A route-check
failure caused by no owner is distinct from choosing an incorrect profile.
The high-risk activation contract includes parent reads of verification and
review; it does not by itself prove those providers executed successfully.

Raw corrected evidence and the frozen-source comparison are in the
run summary (`evals/results/adaptive-routing-option1-corrected-2026-09-29/summary.json`).

## Remaining failures

| Case and trials                                                                         | Observed failure                                                                                                                                                                                                                                   | Assessment                                                                                                                                                                                                           | Recommended next step                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-risk routine, trial 4; correctness priority, trial 2; difficult diagnosis, trial 1 | Stopped before an owner because the ambient Python was reported as 3.9.6. The correctness-priority response also reported that `uv python find 3.10` failed.                                                                                       | Prerequisite handling needs repair or clarification. Checking one interpreter/minor does not establish that the UV-managed runtime lacks every supported version. Other trials used the bundled helper successfully. | Exercise the bundled frozen launcher and use its actual compatibility result. Preserve the supported Python range; investigate the exact refusal before changing runtime code.          |
| High-risk routine, trial 1                                                              | The correct owner implemented and tested the change, then reported verification and review unavailable. Both supporting skill bodies had been read by the parent. No review result or completion marker followed.                                  | Capability handoff/execution failure. Parent availability and reads do not prove what the fresh owner received or attempted; the precise cause remains unresolved.                                                   | Inspect the capability bindings carried into the fresh owner and their usable entrypoints. Reproduce the missing-provider claim without broadening authority or bypassing verification. |
| High-risk routine, trial 3                                                              | The owner implemented and tested the change. The response reported that the provider blocked review by comparing the Luna/medium owner with the Sol/xhigh reviewer policy. No Standards/Spec reader launch or canonical clear result was observed. | Review-provider execution failure. Owner and reviewer routes have different roles; the reported mismatch is not evidence that the correct owner profile is wrong. The exact failed helper input was not retained.    | Inspect reviewer selection and route evidence at the reader boundary. Keep the owner's route and the provider's required reviewer route distinct.                                       |

No parent-control violation was recorded in the corrected high-risk batch.
The earlier mismatched-invocation batch recorded agent-list calls and one
opaque `exec` call after handoff; those remain diagnostic observations under
the wrong invocation condition. They are not mixed into corrected scores.

## Checks and limits

- The skill inspector validated the entrypoint and all nine local references.
- One bounded fresh-context audit found no actionable issue in the routing
  clarification or its relationship to the three unchanged cases.
- Documentation, formatting, and whitespace checks passed before live runs.
- The frozen candidate matches the source plugin; no edits were made to it
  between trials.
- Native acceptance establishes the concrete owner model and effort. Encrypted
  task contents remain unverified; route acceptance alone does not prove the
  entire handoff contract.
- These samples do not establish full-plugin, Claude, or Windows reliability.
  There is no matched five-trial baseline for the previous plugin version, and
  the mismatched-invocation batch is not a control for a performance claim.

Keep the routing clarification while investigating prerequisite handling and
capability handoffs. The completed cases do not meet the 5/5 task threshold;
further changes should address their owning failure layer.
