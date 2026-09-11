# Selected independent-review lifecycle

Read this reference only when independent review is selected. The parent binds
the exact advertised review skill before launch; the owner invokes it.

## Review the final candidate

After implementation and every applicable current final-tree check succeeds,
invoke the bound review skill with:

- the exact current change;
- the originating request or authoritative specification;
- repository instructions and relevant standards; and
- current focused and final-tree check evidence.

A pre-existing candidate described as review-ready still needs current checks
before review. When the caller requires review before changing that candidate,
check and review it unchanged first; do not preemptively repair issues before
the requested initial review. Merely running a required check is insufficient: a failure must
be repaired within existing authority and the invalidated checks rerun, or the
owner stops before review, commit, and publication. Once the review invocation
starts, await its complete ordinary response before editing or running
unrelated repository work.

Read the result semantically. A result with no blocking findings clears that
exact content for the review gate, but cannot waive a failed required check.
Preserve its complete result and report the clear outcome.

## Repair within an explicit budget

A blocking comprehensive review establishes one closed finding set. Attempt a
finding only when the originating authority already covers the repair, scope is
clear, and the repair does not expand product behavior or authority. Stronger
checks of the same behavior are permitted.
Unresolved ineligible blockers stop the goal; advisories remain non-gating
residual risks.

Default to at most two repair attempts, each followed by one fix verification.
Stop as soon as verification clears; the second attempt requires material
progress in the first verification. Before launch,
include that limit or an explicit user/repository nonnegative integer maximum
number of repair attempts in the contract, together with any review-invocation,
time, or token limit. Apply the strictest applicable limit. An unbounded
"keep trying" request does not enlarge the default.

When all blockers are eligible and budget remains, repair them together, rerun
invalidated checks, and invoke the same bound skill for fix verification. Supply
the original findings and target, the repaired target, the attempted repairs,
and current check evidence. Verification covers those findings and direct
repair-caused regressions; it is not a new comprehensive review.

Only a clear verification satisfies the gate. A further attempt is allowed
only within the configured budget and when the preceding verification shows
material progress: resolved original blockers or changed evidence narrowing a
remaining cause. Different wording or another speculative edit is not progress.
Keep the original finding set plus direct repair-caused regressions closed;
do not start another comprehensive review to reset the budget. The same owner
applies these rules without a parent-side repair controller.

Without an explicit override, an uncleared second verification exhausts the
budget even if it shows progress. An explicit finite user/repository maximum
replaces the default; it may raise or lower it, including to zero.

Unchanged evidence, unavailable or inconclusive verification, no material
progress, exhausted budget, or missing authority stops affected work,
completion, and remaining publication. Report the findings and consumed budget;
ask for a concrete decision only if one can enable an authorized next action.

An explicit user-supplied review invocation limit may reduce this sequence but
never permits completion without clear exact-target evidence. Any later content
edit invalidates the clear result.
