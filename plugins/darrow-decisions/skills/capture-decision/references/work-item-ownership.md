# Work-item ownership

Use this branch only when the decision belongs to a ticket or pull request.

1. Establish the exact owner target: owning system, canonical `owner/repo`, item
   kind, and issue or pull-request number. Resolve it from the request, item URL,
   repository remote, or owner integration. Ask for the missing identity rather
   than guessing.
2. Use the named backend's owner interface for that exact target. The `decision
inspect` inventory and host connector list do not inventory command-line
   owner interfaces.
3. For GitHub, always make `gh issue view <id> --repo <owner/repo>` (or the
   corresponding pull-request read) the first owner action, even when no GitHub
   connector is exposed. Its target-specific result establishes availability;
   a version check, bare item number, generic probe, or missing connector does
   not. Use a separately authorized write operation only after this read.
4. Apply only the work-item mutation authorized by the request, then refetch the
   exact item and compare the persisted decision.
5. If the target identity or operation is unavailable, report the item,
   integration, intended operation, and exact gap. Leave repository
   architecture unchanged and mark persistence unconfirmed.

This branch is complete only after the exact owner call has run and either the
refetched owner state confirms the decision or the report names the precise
owner operation and unresolved persistence gap.
