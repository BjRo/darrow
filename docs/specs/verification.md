# Capability: Verification

Verification coordinates one bounded assessment of an implementation candidate.
It is directly intent-matched and independently installable. This is the
semantic boundary introduced by issue #154 under #153; it does not integrate
adaptive-delivery, execute QA, or create reviewer-facing evidence packages.

## Contract

- **VF-C1 — Bounded selection.** Verification MUST select for a request to
  coordinate implementation assurance against originating acceptance, including
  targeted follow-up. Ordinary implementation, running tests, readiness, direct
  code review, and evidence presentation alone MUST NOT select it. It returns
  one assessment operation without implementation, repair, publication, goal
  control, continuation, or repair-budget ownership.
- **VF-C2 — Replaceable required review.** An invoked verification operation
  MUST bind compatible independent code review through host-advertised intent.
  Compatibility includes prerequisites, authorized effects, result evidence and
  stop conditions for the selected initial or follow-up mode. No sibling files,
  provider identity, private serialization, or second capability registry may
  be required. Review remains responsible for standards/spec assessment,
  deterministic checks, fresh-context readers and repair judgments. Missing or
  incompatible review MUST block; verification MUST NOT substitute self-review.
  The provider invocation MUST have a bounded response boundary that returns
  its complete normal result to verification. A provider's final response MUST
  NOT replace verification's reconciliation or end the enclosing owner.
- **VF-C3 — Complete target-bound evidence.** Inputs and results MUST identify
  the repository, candidate content and scope/base, originating objective,
  every material acceptance criterion, applicable constraints and current
  required checks, selected assessments and their provenance. Every criterion
  MUST have current supporting evidence, a supported failure, or an explicit
  unsupported/unavailable status. A provider's pass alone cannot establish
  unassessed criteria. Stale, missing, contradictory or inconclusive required
  evidence cannot clear verification. Content binding MUST preserve the meaning
  and scope of content identities: different checksum or
  scope-fingerprint schemes are not by themselves a mismatch. Relate them through
  observed common content; an unavailable relationship is a gap, not an invented
  mismatch. Findings, checks and repair evidence MUST
  remain accessible in their complete provider result, with absolute local
  references when available; evidence packaging is not required.
  When a provider retains a local report artifact, a narrow handoff renderer MUST
  preserve the authored assessment and append a validated, directly usable
  absolute report reference. It MUST refuse missing, unreadable or empty inputs
  without interpreting provider formats, deciding findings or writing product
  files. This mechanical report handoff is not a reviewer-facing evidence package
  or a storage/retention policy.
- **VF-C4 — Optional is selected explicitly.** QA and reviewer-facing evidence
  are independently adoptable future extensions. Installation alone MUST NOT
  select them; absent unselected capabilities MUST permit review-only operation.
  If the caller selects an additional required assessment whose compatible
  operation is unavailable or unsupported, verification MUST report that gap
  and cannot clear. It MUST NOT execute QA or produce a rich evidence package
  in this slice, nor silently drop a selected requirement.
- **VF-C5 — Closed follow-up.** Follow-up MUST preserve original finding
  identities, provider/axis provenance, evidence, severity and blocking/advisory
  disposition; original/prior/current targets and target history; attempted
  repairs and their evidence; prior follow-up results; and carried direct
  regressions with their causing-original-finding identities. Fresh provider
  assessment is limited to that closed set, attempted repairs and direct
  repair-caused regressions. Missing history blocks instead of starting a new
  comprehensive review. Advisories remain visible and nonblocking.
- **VF-C6 — Honest conclusion.** Return clear, progress, no-progress or blocked
  with the provider's original outcome and its meaning preserved. Clear requires
  current successful required checks, sufficient evidence for every material
  criterion, and no unresolved eligible blocker or direct regression. In an
  initial result, actionable evidenced blockers are progress (assessment is
  available, not proof of a repair). Follow-up progress requires material
  provider-observed improvement or a newly evidenced direct regression eligible
  for owner repair. Unchanged, repeated or oscillating failure is no-progress;
  missing/unavailable/inconclusive evidence is blocked. Mixed required results
  cannot clear; blocked evidence takes precedence, then no-progress, then
  progress. A clear provider follow-up may clear an advisory-only remainder.
- **VF-C7 — One owner.** Verification MUST collect the complete result of each
  selected supported assessment before returning combined eligible blockers.
  It may identify targeted evidence needed next, but MUST NOT initiate owner
  repair, retry assessment in a loop, reset budgets, or claim overall completion.
  The active owner retains assurance selection and continuation under the
  strictest authority/time/token/invocation limits. The shared default maximum
  two owner repair attempts and finite explicit overrides belong to that owner;
  verification consumes history without maintaining a second ledger.
  A no-progress result MUST return the unchanged evidence and stop reason, not
  recommend another repair as the next executable step. The owner may investigate
  or seek new authority/evidence under its own continuation contract.
  A generic request for a smallest next action MUST NOT override this stop:
  any next-action field in a no-progress result carries the stop reason or
  needed investigation, never an implementation instruction or another repair
  followed by reassessment.

## Consumer handoff

This is a semantic contract, not a mandatory object schema. Preserve the
provider's normal public report and references rather than requesting its
private record format. A caller supplies a bounded initial request or a closed
follow-up, and receives candidate identity, selected/absent/unavailable
assessments, complete provider results, criterion-level evidence, combined
findings with dispositions, limitations, conclusion and the smallest needed
next action. Provider-specific artifacts can travel opaquely with provenance;
only the provider interprets its own mechanical records.

Issue #155 will bind this capability in adaptive-delivery preflight and the
existing owner contract, preserving routine omission and high-risk review
selection. The owner supplies successful current checks before assessment,
waits for every selected result, addresses eligible combined blockers under
one budget, then requests fresh closed-set follow-up. Clear ends repairs;
another attempt requires material progress and remaining budget. No-progress,
blocked evidence, exhausted budget or absent authority prevents completion.
This slice does not change that orchestration's current direct-review route.

Issue #156 owns optional QA execution, scenario evidence and fresh scenario
follow-up. Issue #68 owns optional presentation and its still-open format,
storage, retention and required-artifact policy. Neither future capability is
necessary for a complete review-only operation here.

## Evaluation

Colocated cases cover direct, indirect, incomplete and negative selection;
actual existing-review composition; an independently mounted differently named
compatible replacement; missing/incompatible/stale required evidence; absent
unselected optional capabilities; criterion gaps; clear/progress/no-progress/
blocked follow-up; advisory disposition and direct-regression lineage; and
pressure to repair or bypass missing evidence. Supported hosts require native
live evidence. Coverage, dry preparation, activation, outcomes and matched
no-skill observations are reported separately.
