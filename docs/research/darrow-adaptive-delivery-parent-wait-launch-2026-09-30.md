# Adaptive Delivery: parent waiting and Codex launch names

## Result

The parent waiting failure did not recur on unchanged **0.23.11**. The
quality-sensitive case passed **5/5**, matching the preceding high-risk **5/5**.
The diagnosis case exposed two different launch blockers and passed **3/5**.
After clarifying valid Codex task names in **0.23.12**, that same case passed
**5/5** on the same Codex CLI version.

| Case                                                   | Plugin version | Task | Accepted required route | Prohibited parent calls |
| ------------------------------------------------------ | -------------- | ---- | ----------------------- | ----------------------- |
| High-risk routine, preceding campaign                  | 0.23.11        | 5/5  | 5/5 Luna/medium         | None observed           |
| Quality-sensitive localized, unchanged recheck         | 0.23.11        | 5/5  | 5/5 Luna/high           | None observed           |
| Difficult routine diagnosis, before name clarification | 0.23.11        | 3/5  | 3/5 Astra/high          | None observed           |
| Difficult routine diagnosis, after name clarification  | 0.23.12        | 5/5  | 5/5 Astra/high          | None observed           |

These rows preserve separate versions and batches; they are not a full-plugin
pass or a 15-trial run of 0.23.12. The original missing-lock failure remains
unexplained. No prerequisite change is claimed to have fixed it.

## Checkpoint and scope

The tested capability-handoff change was checkpointed in **`9a5393ca`**,
`fix(adaptive-delivery): preserve callable skill handoffs`. It was not pushed.
The next investigation concerned the parent's `list_agents` calls after owner
acceptance.

The earlier high-risk failure inserted five global agent-list calls between
native waits. The quality-sensitive failure inserted one between its two waits.
Both used the wait tool, so this was not evidence that waiting was unavailable.
The current contract permits waiting and communication with the retained owner;
global listing exceeds that boundary. These are metadata calls, not evidence of
repository mutation.

## Unchanged 0.23.11 recheck

The quality-sensitive case passed **5/5 task and 5/5 accepted Luna/high routes**
on unchanged 0.23.11. It recorded no prohibited parent calls. Combined with the
[preceding high-risk 5/5 batch](darrow-adaptive-delivery-capability-handoff-2026-09-30.md),
both cases previously affected by parent waiting passed on this candidate.
Their raw historical failures remain open; no waiting-specific fix was made or
proven.

The remaining diagnosis case then passed **3/5 task and 3/5 accepted Astra/high
routes**. Its two failures happened before owner acceptance:

| Trial | Failure                                                                                                                             | Assessment                                                                                                                                                       | Next action                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | The parent reported that the bundled backend lacked `uv.lock` and stopped without an owner.                                         | Unresolved prerequisite failure. The snapshot contains the lock, but the failed trial's exact lookup was not retained.                                           | Preserve the failure and capture bounded installed-file and prerequisite-error evidence in the same case. Do not infer a prerequisite policy defect from the report alone. |
| 3     | The attempted task name was `segment-trailing-delimiter-fix`; the parent reported that the host rejected its hyphens, then stopped. | Product launch-call defect. Native metadata records an unaccepted Astra/high/none launch, and the attempted name violates the current host parameter constraint. | Supply a valid lowercase/digit/underscore task name before launch. Preserve the accepted canonical reference as owner identity.                                            |

In successful trial 5, a bounded live probe observed an initial relative lookup
that reported missing package files, followed by a successful listing. Both the
marketplace staging copy and installed plugin contained the expected lock hash.
This shows that a mistaken preliminary lookup can occur; it does not establish
what happened in failed trial 1. That trial's fixture had already been removed.

No parent-control failure was observed in this diagnosis batch. Activation
grading is not configured for the quality-sensitive or diagnosis cases; their
verified invocation tokens and native owner routes are separate evidence.

## 0.23.12 candidate

The specification was updated before the Codex launch reference. The candidate
requires `task_name` to contain only lowercase letters, digits, and underscores,
with `adaptive_delivery_owner` as an example. The host-returned canonical
reference still identifies the accepted owner. Both manifests are **0.23.12**.

The main skill, prerequisite rules, routing, retry policy, owner authority,
fixtures, assertions, supporting plugins, and shared runner were unchanged.
Inside the plugin, only the Codex launch reference and two manifests differ
from 0.23.11.

One fresh-context `audit-agent-skill` audit found a second spec passage still
calling the name optional. It was aligned with the new requirement; scoped
search found no remaining optional-name wording. The audit reported no other
material finding, and the contained skill inspector returned `valid`. No second
audit-hardening round was run.

## Run conditions

All new runs use Codex CLI **0.159.2**, parent **gpt-6-luna/medium**, **n:5**,
**jobs:3**, a **100% threshold**, and **passive owner evaluation**. Cases run
sequentially; each full batch finishes before classification. Every frozen
plugin preserves the `darrow-adaptive-delivery` directory name, and the actual
prompt renderer verifies the matching explicit invocation token before launch.

The task-name candidate adds passive external observation of installed lock
presence and hashes plus bounded prerequisite error/listing lines. It does not
change participant instructions, inputs, runner guards, or grading. No private
reasoning, complete native sessions, or encrypted handoff bodies are retained.

The five 0.23.12 trials used valid names: four `adaptive_delivery_owner` and one
`segment_bug_owner`. Every owner was accepted with fresh context on Astra/high;
every task check passed. The observer confirmed the bundled lock in all five
fixtures. The batch took **4m 22s**, averaging **2m 7s** per trial. Token usage
was unavailable. Activation scoring is not configured for this case.

Frozen snapshot and source-input hashes remained unchanged during every run.
The matched diagnosis comparison changed only the Codex launch reference and
two manifests inside the plugin; supporting plugins, cases, and runner hashes
match. An external observer collects evidence but supplies no participant
assistance. No trial was replaced, regraded, or removed.

## Remaining decision

Keep the valid-name clarification and leave the parent's waiting instructions
unchanged for now. The observed name rejection has a concrete correction and a
passing focused rerun. Neither the old parent-listing failures nor the missing
lock claim is erased by later passes.

The missing-lock trial's unretained lookup prevents resolving its cause. Under
the stop rule in [`docs/eval-development.md`](../eval-development.md), the user
was asked whether broader coverage could continue with that failure open. The
user explicitly approved this exception on 2026-09-30. Continue coverage with
the bounded prerequisite capture and preserve the failure as unresolved. No
prerequisite policy change or clean full-plugin claim is justified by this
evidence. The exception does not turn subsequent unexplained failures into passes.

## Evidence

- [Unchanged quality-sensitive results](../../evals/results/adaptive-parent-wait-control-2026-09-30/goal-preflight-quality-sensitive-localized/results.json)
- [Unchanged diagnosis results, including both failures](../../evals/results/adaptive-parent-wait-control-2026-09-30/goal-preflight-routing-difficult-routine-diagnosis/results.json)
- [Successful trial 5 prerequisite probe](../../evals/results/adaptive-parent-wait-control-2026-09-30/goal-preflight-routing-difficult-routine-diagnosis/prerequisite-probe.json)
- [0.23.12 diagnosis results](../../evals/results/adaptive-launch-name-2026-09-30/goal-preflight-routing-difficult-routine-diagnosis/results.json)
- [Comparison, native owner routes, names, and provenance](../../evals/results/adaptive-launch-name-2026-09-30/comparison.json)
- [0.23.12 check summary](../../evals/results/adaptive-launch-name-2026-09-30/summary.json)
- [Invocation proof](../../evals/results/adaptive-launch-name-2026-09-30/invocation-proof.json)

Raw evidence is local and gitignored. All earlier failures and campaigns remain
intact. These runs do not establish Claude, Windows, or full-plugin reliability.
