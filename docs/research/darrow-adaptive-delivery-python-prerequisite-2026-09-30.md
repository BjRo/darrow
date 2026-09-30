# Adaptive Delivery: UV prerequisite clarification on Luna/medium

Follow-up: the [0.23.11 capability-handoff candidate](darrow-adaptive-delivery-capability-handoff-2026-09-30.md)
passed the high-risk case at 5/5 task and activation. Codex CLI changed between
batches; the historical results and unresolved causes below remain retained.

## Result

All three requested cases completed at n:5 on **0.23.10**. The corrected
prerequisite wording had **zero premature Python refusals in 15 trials**.
All **15 owners were accepted on the required route**, with fresh context.
The complete task result is **12/15 (80%)**. The remaining three failures are
downstream of preflight.

| Case                                                 | Required owner | 0.23.9 task | 0.23.10 task | Accepted required route, before → after |
| ---------------------------------------------------- | -------------- | ----------: | -----------: | --------------------------------------: |
| `goal-preflight-high-risk-routine`                   | Luna/medium    |         2/5 |          3/5 |                               4/5 → 5/5 |
| `goal-preflight-quality-sensitive-localized`         | Luna/high      |         4/5 |          4/5 |                               4/5 → 5/5 |
| `goal-preflight-routing-difficult-routine-diagnosis` | Astra/high     |         4/5 |          5/5 |                               4/5 → 5/5 |
| **Total**                                            |                |   **10/15** |    **12/15** |                       **12/15 → 15/15** |

The high-risk case's composed activation contract passed **5/5**, including
complete parent reads of `verify-change` and `code-review`; the prior corrected
batch was 4/5. The other two cases do not configure an activation score. Their
explicit invocation tokens were checked before execution, and their accepted
owner routes were observed separately. Parent reads do not prove successful
provider execution.

## Candidate and run conditions

The starting checkpoint is `214af00bd81bdf4fabf6352e6f66b11a288ce488`.
The user's uncommitted four-file change shortens the skill prerequisites to UV,
Git, and the readable package/lock files; states that UV selects compatible
Python; aligns the specification; and bumps both manifests to 0.23.10.
System Python is no longer described as a separate prerequisite. Python runtime
code was unchanged.

The frozen plugin lives under a directory named exactly
`darrow-adaptive-delivery`. Before each case, the actual shared prompt renderer
verified one `$darrow-adaptive-delivery:adaptive-delivery` token in each of the
three selected prompts, matching the installed manifest name and version.

All runs used:

- Codex CLI **0.156.1**, parent **gpt-6-luna/medium**;
- **five trials**, **three concurrent jobs** per case, threshold **100%**;
- **passive owner evaluation**, confirmed in every retained harness result;
- sequential cases, finishing all five trials before inspecting each batch;
- unchanged fixtures, assertions, supporting plugins, and shared runner inputs.

Snapshot comparison with the prior corrected candidate found only the skill
text and two manifests changed inside the plugin. Snapshot and input hashes
remained unchanged during every run. The earlier results were preserved, and
no failed trial was replaced by a passing repeat or regrade.

## Remaining failures

| Case and trial                       | What failed                                                                                                                                                                                 | Assessment                                                                                                                                                                                                           | Recommendation                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-risk routine, trial 1           | The owner implemented the strict cookie value and passed focused checks, then reported no callable verification or review provider. It produced no clear review proof or completion marker. | Capability handoff or execution failure, recurring from the earlier corrected campaign. Both supporting skills were available and read by the parent; the exact child exposure/binding error remains unverified.     | Inspect the capability bindings and usable entrypoints supplied to the fresh owner. Keep verification mandatory and diagnose the missing-provider claim before changing the workflow. |
| High-risk routine, trial 3           | All implementation, review, canonical proof, completion, and activation checks passed. The parent called `collaboration.list_agents` five times after accepting the owner.                  | Product orchestration contract failure. The current contract permits waiting, requesting status from the same owner, relaying feedback, or explicitly stopping that owner. Global agent listing fails that boundary. | Address the parent's waiting behavior as a shared issue. Keep the raw failure; any decision to permit agent-list inspection would require an explicit contract discussion.            |
| Quality-sensitive localized, trial 1 | Implementation, durable tests, route selection, and completion checks passed. The parent called `collaboration.list_agents` once after owner acceptance.                                    | Same parent-control failure as high-risk trial 3. The native event identifies the call at ordinal 58.                                                                                                                | Handle both cases together. Prefer the supported wait/status path; do not weaken the eval merely to obtain 5/5.                                                                       |

The high-risk trial 3 calls are retained at native ordinals 118, 140, 160, 182,
and 202. These are metadata calls; their presence does not establish repository
mutation. No parent-control violation was recorded in the diagnosis batch.

For high-risk trial 1, native evidence binds a single fresh Luna/medium owner,
and complete pre-owner reads of both supporting skills. No nested provider or
reviewer launch was observed. The encrypted owner message does not establish
the exact capability information delivered to that child. The result is a
handoff/execution failure with a bounded causal uncertainty, not a new Python
failure or evidence that the requested owner route was wrong.

## Recommendation and limits

Keep the UV prerequisite clarification. These samples support its intended
effect: the three previous preflight refusals did not recur, and every trial
reached the required owner route. This is focused evidence from five trials per
case, not a guarantee of reliability across the plugin or hosts.

The next work should address **capability execution after handoff**, then the
shared **parent waiting behavior**. Both are separate from prerequisite and
profile selection. The earlier owner/reviewer route-confusion failure remains
retained even though it did not recur in this batch. All historical failures,
including the invalid snapshot-name diagnostics, remain in their original
campaigns.

## Evidence

- [Current summary](../../evals/results/adaptive-python-prerequisite-2026-09-30/summary.json)
- [Comparison and input verification](../../evals/results/adaptive-python-prerequisite-2026-09-30/comparison.json)
- [Invocation proof](../../evals/results/adaptive-python-prerequisite-2026-09-30/invocation-proof.json)
- [Failure classifications](../../evals/results/adaptive-python-prerequisite-2026-09-30/failure-classifications.json)
- [High-risk results](../../evals/results/adaptive-python-prerequisite-2026-09-30/goal-preflight-high-risk-routine/results.json)
- [Quality-sensitive results](../../evals/results/adaptive-python-prerequisite-2026-09-30/goal-preflight-quality-sensitive-localized/results.json)
- [Diagnosis results](../../evals/results/adaptive-python-prerequisite-2026-09-30/goal-preflight-routing-difficult-routine-diagnosis/results.json)
- [Previous corrected campaign](darrow-adaptive-delivery-routing-luna-medium-2026-09-29.md)

Raw evidence is local and gitignored. The report preserves the comparison and
ownership limits without retaining private reasoning or encrypted handoff
contents. These runs do not measure Claude, Windows, or full-plugin coverage.
