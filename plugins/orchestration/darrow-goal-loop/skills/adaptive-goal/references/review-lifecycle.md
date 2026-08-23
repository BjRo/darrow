# Selected independent-review lifecycle

Read this reference completely only when independent review is selected. The
parent skill owns selection and canonical caller-facing outcome sentences; this
reference owns target preparation, rework, verification, and convergence.

## Establish the review target

After implementation and applicable final-tree checks, supply the exact final
change, originating objective or specification, repository standards, and
current check evidence to the matching review capability. A preexisting
candidate described as review-ready is unverified: run every applicable
exact-target risk-gate check before the initial review and supply that evidence.
Its current content is the first target. Do not edit it before the review
returns, even when a check fails or it differs from the approved outcome.

Target preparation begins the review boundary. Finish only that capability
invocation and await its ordinary response before other repository work. Read
the response semantically. A result with no blocking findings satisfies the
gate for that exact content; otherwise the single comprehensive review creates
the closed finding set for rework and verification.

After every review response, record its semantic result against the exact
target fingerprint through the parent skill's `goal-loop step review` command.
Prefer the reviewer's literal fingerprint so the helper derives its SHA-256.
Do not reconstruct hashes with shell variables, assignments, substitutions,
command lists, redirects, or pipelines. The helper validates protocol evidence,
not findings or repair choices.

## Rework the closed finding set

The first rework attempts every eligible blocker and advisory together. A
finding is eligible only when repair authority already exists, scope is clear,
risk is low, and the repair expands neither requested behavior nor verification
materially. An ineligible blocker stops the gate; an ineligible advisory remains
a non-gating residual risk.

Perform at most one authorized repair attempt per finding in one rework. Then
run invalidated checks and request fix verification; never self-iterate on that
finding before the response. A later attempt is allowed only after `continue`
and within existing authority.

Fix verification covers only attempted original findings and direct
repair-caused regressions. Supply the original findings and target, canonical
finding order, prior and current targets, complete target history, prior scope
manifest, attempted set, current checks, and the immediately prior verification
artifact with checksum and carried regressions when present. The capability
pins the prior-to-current delta mechanically against the same effective base;
caller prose does not establish causality. It cannot add an unrelated finding.
Advisories never determine the gate outcome.

Evidence run after the latest edit and supplied to verification remains
final-tree evidence for that content. The response does not invalidate it. Run
the last final-tree check before review. After a terminal response that
authorizes no later edit, do not rerun checks or describe a later check as final
verification.

## Continue or stop

`clear` satisfies the exact-content gate. Continue only while an unresolved
blocker or direct repair-caused regression materially progresses. Later rework
addresses only those blockers and regressions. A newly detected direct
regression progresses for one repair attempt; unchanged evidence afterward is
no progress. When `continue` names an authorized blocker or regression, perform
the next rework, rerun invalidated checks, and request verification again.

Before every verification after the first, compare the prospective target with
the complete target history. Repeated content, unchanged failure evidence, or
oscillation is `no_progress`. Stop before editing, rerunning checks, or invoking
the capability when a requested repair would restore a prior target. Preserve
the latest returned `Fix verification: continue.` and report the separate
no-progress stop; never synthesize a verifier outcome.

`no_progress`, `blocked`, unavailable or inconclusive evidence, exhausted
authority, or an explicit limit leaves the gate unsatisfied and permits no
further repair or publication. An explicit originating limit caps every review
invocation, including the comprehensive review, and never permits completion
without clear exact-target evidence. Any later content edit invalidates the
verification chain.

Settle every terminal unsatisfied gate as `blocked` on hosts with persisted goal
status. Review invocations are not goal turns. Any host-required continuation is
status settlement only: preserve the gate, perform no repository inspection,
edit, check, review, or publication, and mark the goal blocked as soon as the
host permits it.
