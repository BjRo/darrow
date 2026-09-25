# Implementation planning mode

Establish the requested change and authoritative product constraints. If the
change cannot be identified from the message or conversation, ask for it and
stop. Inspect current public seams, tests, architecture, accepted decisions,
compatibility, migration, and rollout constraints that bear on the plan.
Investigate technical facts directly. Repository conventions do not settle
product intent or authorize a consequential trade-off.

When the user explicitly says a choice is undecided, keep it undecided even if
nearby wording sounds suggestive. Do not treat the noun used for a behavior,
the current implementation, a default value, or missing requirements as
authority for either option. Recommend from a prospective trade-off inherent
to the open choice, and label the recommendation as advisory. Do not call one
option settled or describe the requested behavior as if it already specifies
that option.

If any material product, caller-contract, architecture, compatibility,
migration, rollout, or operational choice remains unresolved, read the complete
[decision frontier method](decision-frontier.md). Ask the current frontier and
wait. Do not include an implementation plan or ordered slices in that round.
An agent may select a choice only when the user explicitly delegates that
bounded choice. Record its provenance and consequences; do not extend the
delegation to adjacent choices.

Once material decision and fact frontiers are empty, produce a compact draft
plan in the conversation. Include the objective and constraints, relevant
current-state evidence, selected approach and consequential alternatives,
ordered independently verifiable slices, verification, applicable migration
and rollout, risks and assumptions, and a one-sentence plan restatement. Lead
with the implementation outcome. End with the restatement followed by
`Please confirm or correct this plan restatement.` After confirmation, call the
plan confirmed and stop without implementing or publishing it.

Complete when every material choice is grounded in user authority or inspected
evidence, each slice has an observable result and check, and the user confirms
the plan restatement.
