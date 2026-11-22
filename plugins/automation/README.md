# Automation

No automation plugin currently ships. The automation category remains for
admission timing, eligibility and shared capacity under explicit recurring
authority. Task recipes and native sessions retain engineering execution.

Use [Ticket-to-PR](../task-recipe/darrow-ticket-to-pr/README.md) to explicitly
deliver one ticket. Installing a plugin grants no recurring execution or
publication authority.

Before removing an existing Artificer installation, use its installed version
to run `darrow-artificer revoke`, `darrow-artificer unschedule` and
`darrow-artificer status`. Reconcile running deliveries in their original native
sessions, or cancel an identified delivery with `darrow-artificer cancel DELIVERY_UUID`.
Revocation and unscheduling do not stop running deliveries. This repository
removal leaves local schedules, state, worktrees and published effects intact.
