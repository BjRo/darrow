# Adaptive Delivery: capability handoff on Luna/medium

## Result

Candidate **0.23.11 passed 5/5 task and 5/5 activation** in
`goal-preflight-high-risk-routine`. Every accepted owner read both supporting
skills completely, and every trial passed the canonical, clear, exact-final
review and completion checks. No provider-unavailable refusal or prohibited
parent operation was recorded.

| Metric                                         | Prior 0.23.10 | Candidate 0.23.11 |
| ---------------------------------------------- | ------------- | ----------------- |
| Full task                                      | 3/5           | 5/5               |
| Composed activation                            | 5/5           | 5/5               |
| Owner reads both verification and review       | 4/5           | 5/5               |
| Clear review covering the exact final worktree | 4/5           | 5/5               |
| Accepted fresh Luna/medium owner               | 5/5           | 5/5               |
| Trials with prohibited parent operations       | 1/5           | 0/5               |

This is a historical comparison, not a same-version controlled comparison:
Codex CLI changed between batches. Keep the candidate, while retaining the
original failure and its unresolved cause. The separate parent waiting failures
remain the next issue to address.

## Investigation

The preceding [UV prerequisite campaign](darrow-adaptive-delivery-python-prerequisite-2026-09-30.md)
left one high-risk owner blocked after implementation because it reported no
callable verification or review provider. Bounded native evidence narrows the
failure:

- The parent read both `verify-change` and `code-review` completely.
- The accepted fresh Luna/medium owner read `verify-change` completely, but no
  `code-review` read or nested assessment launch was observed.
- The four owners that completed independent review read both skills.
- The failed owner's command and read diagnostics were available and not
  truncated. Its launch message was encrypted, so the exact capability binding
  delivered to that owner remains unverified.

This is a provider-loading/execution failure, not missing primary activation or
proof that the installed review capability was unavailable. The evidence does
not distinguish an incomplete handoff from an owner misinterpreting the supplied
binding. That causal uncertainty remains open.

## Candidate

Starting from `09bf0fdb`, candidate **0.23.11** makes the existing handoff usable
without relying on the parent's conversation:

- Preserve the exact advertised skill name and its public instruction reference;
  for file-backed Codex skills, carry the installed absolute `SKILL.md` path.
- Preserve those references through bounded assessment delegations.
- Explain that Codex invokes such skills by reading and following their
  instructions with host tools; a dedicated same-named tool is unnecessary.
- Have the fresh owner load already-selected verification and required review
  before mutation, then perform assessment when its prerequisites are satisfied.
- Require a concrete access, prerequisite, or execution failure before declaring
  a bound provider unavailable.

The specification was updated before the skill. The Codex launch reference and
both manifests were aligned. Provider selection, sole ownership, review
requirements, model routing, Python mechanics, fixtures, assertions, and the
runner were unchanged. Public references come from the installed host catalog;
the candidate adds neither a registry nor assumed sibling paths.

One fresh-context `audit-agent-skill` audit found no material defects. It checked
the broader Adaptive Delivery and verification/review contracts, discovery, and
packaging. The contained skill inspector returned `valid`; both manifests are
0.23.11. Documentation validation, scoped formatting, and `git diff --check`
passed before evaluation. Static inspection does not prove behavioral reliability.

## Evaluation conditions

The frozen plugin is stored under the exact directory name
`darrow-adaptive-delivery`. The actual prompt renderer verified the explicit
`$darrow-adaptive-delivery:adaptive-delivery` token against that manifest.
The high-risk case uses Codex **gpt-6-luna/medium**, **n:5**, **jobs:3**, a
**100% threshold**, and **passive owner evaluation**. Previous failures are
retained without replacement or regrading.

The current runner reports Codex CLI **0.159.2**, while the prior 0.23.10 batch
used **0.156.1**. Historical score differences alone cannot establish the effect
of this wording change.

All five retained harness results confirm passive evaluation and one accepted
fresh owner on the required route. Snapshot and input hashes remained unchanged
throughout the run. Comparison against 0.23.10 found exactly four changed plugin
files: the skill, Codex launch reference, and two manifests. Source files still
match the frozen candidate. The batch took **16m 8s**, with **7m 51s** mean trial
duration; token usage was unavailable.

## Remaining scope and limits

- The earlier capability refusal remains a real historical failure. The new
  instructions address the missing provider load; the encrypted handoff prevents
  proving its original cause or the exact contract delivered in these trials.
- Complete owner reads are directly observed. The retained diagnostics do not
  independently establish that each read preceded the first mutation.
- Earlier parent `list_agents` failures remain open. Their absence here does not
  establish a fix; the parent waiting instructions were unchanged.
- The quality-sensitive and difficult-diagnosis cases were not rerun for this
  handoff change. Their previous 4/5 and 5/5 scores remain historical 0.23.10
  evidence, not current-candidate results.
- This is one focused case on Codex. It does not establish full-plugin, Claude,
  or Windows reliability. No runner guard, eval relaxation, or failed-trial
  replacement was used.

Next, clarify the parent's supported wait/status path and retest the affected
parent-control cases. Permitting global agent listing would be a separate
contract decision; this candidate does not make that change.

## Evidence

- [Trial results](../../evals/results/adaptive-capability-handoff-2026-09-30/goal-preflight-high-risk-routine/results.json)
- [Task, route, activation, and check summary](../../evals/results/adaptive-capability-handoff-2026-09-30/summary.json)
- [Historical comparison and owner skill reads](../../evals/results/adaptive-capability-handoff-2026-09-30/comparison.json)
- [Invocation proof](../../evals/results/adaptive-capability-handoff-2026-09-30/invocation-proof.json)
- [Run provenance](../../evals/results/adaptive-capability-handoff-2026-09-30/goal-preflight-high-risk-routine/provenance.json)

Raw evidence remains local and gitignored. Prior campaigns and every recorded
failure remain intact.
