# Darrow Ticket to PR

`ticket-to-pr` is an explicitly invoked shortcut for the request users would
otherwise give adaptive-delivery: read and implement one exact ticket in the
current repository on a new branch, then open one verified pull request when
the change is ready.

The recipe owns only that bounded authority envelope and one adaptive-delivery
delegation. `adaptive-delivery` owns readiness, capability binding, route selection,
the separate engineering owner, verification, review, publication, blockage,
and same-owner human feedback through the main thread. Ticket-to-PR performs no
ticket read, repository preflight, Git or forge work, lifecycle bookkeeping, or
post-goal inspection of its own.

Explicit caller repair and review limits pass through unchanged. Without an
override, adaptive-delivery supplies its default repair budget; the recipe
does not define a separate retry policy.

Completion includes the owner's evidence that the remote branch and open PR
both point at the intended verified commit. Reusing an existing URL therefore
requires publishing any additional intended local commits without force;
the recipe still chooses no publication command or capability.
