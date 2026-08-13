# ADR-0007: Separate skill evaluation evidence dimensions

Status: Accepted
Date: 2026-08-13

## Context

A plausible skill can pass hand-picked candidate-only cases while adding no
value over the host model. It can also work after being loaded but fail to
activate for intended wording, activate on adjacent intent, or leave declared
invariants without any exercising case. No single pass rate distinguishes all
of those failures.

Conflating traceability, runtime behavior, comparative value, and skill
selection would let one kind of evidence conceal a gap in another. Transcript
resemblance and hidden reasoning are especially weak substitutes for observable
repository outcomes or harness-visible activation.

ADR-0001 selected a custom TypeScript/Bun runner with declarative cases and real
harness adapters. It did not establish how later evidence dimensions relate or
which claims each dimension may support.

## Decision

Represent and report skill evaluation as separate evidence dimensions.

- **Invariant coverage** traces normative specification identifiers to eval
  cases. Coverage proves that a claim is exercised, not that behavior passed.
- **Task outcomes** use observable checks in the real supported harness. A
  successful outcome does not by itself prove that the skill activated or added
  value over the host model.
- **Matched skill ablation** compares a no-skill baseline with a candidate while
  holding prompts, fixtures, checks, harness versions, models, effort, trial
  count, thresholds, and optional condition text constant. Only the mounted
  skill surface may differ.
- **Skill activation** is graded independently from a normalized,
  harness-visible invocation event or a controlled host-protocol probe.
  Final-answer resemblance, hidden reasoning, and unbounded transcript capture
  are not activation evidence.
- Reports preserve task-level results, declared trial counts, relevant metrics,
  limitations, and unknown measurements. Aggregates cannot silently hide a
  regression or coerce unavailable evidence to zero.
- Behavior-changing development claims use the evidence dimensions applicable
  to the claim and matched controls before calling a variant better.

The schemas, validation rules, metrics, and gates remain normative in
[Repository Infrastructure: Skill Evaluation Evidence](../specs/skill-evaluation.md).
This ADR complements ADR-0001 without changing its runner technology decision.

## Consequences

- A green candidate run is insufficient evidence that a skill is valuable or
  correctly discoverable.
- Evaluation suites and reports carry more structure, and some measurements may
  remain honestly unknown.
- Triggering regressions can be detected even when task outputs still pass, and
  uncovered invariants remain visible without being mislabeled runtime failures.
- Comparative claims cost additional harness trials because the baseline and
  candidate must use matched conditions.
- Future runner changes must preserve the semantic separation of evidence even
  if their storage or presentation changes.
