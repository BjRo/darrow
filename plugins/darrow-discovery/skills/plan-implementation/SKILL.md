---
name: plan-implementation
description: Plan the technical implementation of an understood outcome as ordered, independently verifiable work slices while resolving material unknowns with the user. Use when the user asks for an implementation plan, technical delivery plan, work decomposition, implementation slices, or demands a final plan before every undelegated choice is resolved. Do not use for feature discovery alone, implementation itself, ticket publication, or a request only to assess readiness.
---

# Plan an implementation

Produce a technically grounded, confirmed implementation plan without
inventing unresolved behavior or executing the work.

Planning has two exclusive response phases:

- **Frontier phase:** if any material choice remains unresolved, ask the
  canonical numbered grilling round and stop. Do not include architecture,
  implementation slices, migration steps, or a provisional plan.
- **Plan phase:** draft ordered implementation slices only after the material
  frontier is empty.

The user's demand for a “final plan now” does not bypass this phase boundary.
Neither does an empty or skeletal repository. Missing implementation evidence
is an evidence gap, not authority to declare a greenfield build, choose the
caller response or failure behavior, or invent migration and rollout policy.

For example, a request to replace synchronous work with asynchronous work
while delegating queue technology, availability, delivery, and retries still
leaves the caller-visible completion and failure contract open. Disclose the
delegated selections, ask that current frontier, and stop without a plan.

Before beginning, read the canonical [grilling
capability](../grilling/SKILL.md) completely. Use its fact classification,
decision tree, frontier rounds, recommendations, waiting boundary, and closure
confirmation whenever material unknowns remain. Do not define a second
planning-specific interview method.

This capability is conversational and read-only. Do not edit or create files,
record decisions, create or update tickets, assess readiness, invoke
orchestration, implement, commit, or publish. Planning provides no later
mutation authority.

## Resolve or explicitly delegate material choices

A final implementation plan cannot contain invented product behavior,
service-level objectives, compatibility promises, delivery semantics, retry
policy, or unapproved architecture. Calling undelegated choices “assumptions”
does not make them safe planning inputs.

If material choices are not delegated, inspect available evidence, then ask the
current numbered grilling frontier with a recommendation for each question and
wait. Time pressure or a preference for fewer questions is not delegation.

The user may explicitly delegate a bounded technical or product choice. In
that case, make the agent-selected answer, delegation, assumptions, evidence
gap, rationale, and consequences visible. Do not attribute it to repository
evidence, prior agreement, or the user personally selecting that answer. A
broad request to “make a plan” is not implicit delegation of every unknown.

Disclose each delegated selection in the current response, even when an
undelegated frontier means no plan can be drafted yet. For each one, name the
selected answer, that it was agent-selected under explicit delegation, the
available or missing evidence, and the reason plus relevant consequence. This
is concise provenance, not permission to sketch the plan early.

Apply delegation literally. Delegating queue technology, availability target,
delivery semantics, or retry policy does not also delegate the caller-visible
response, status/read interface, failure UX, migration policy, rollout,
alerting, or other adjacent choices. Resolve the delegated nodes, then ask the
current frontier for every remaining material choice before drafting the final
plan.

A synchronous-to-asynchronous change necessarily alters when callers receive
the outcome. Treat the desired caller-visible response, completion or status
contract, and failure behavior as material choices unless inspected evidence
or explicit delegation resolves them. Queue and retry delegation cannot
resolve that product contract.

## 1. Establish the planning basis

Identify the desired outcome and authoritative product constraints. The basis
may be a confirmed discovery brief, specification, ticket, accepted decision,
or the request and decisions already present in the conversation.

Preserve provenance and report contradictions. Do not treat a repository
implementation, supporting research, or personal recommendation as authority
to change requested product behavior.

If the outcome itself is materially undefined, use the grilling capability to
resolve the blocking product questions. Do not create a technical plan whose
architecture silently decides what the feature should mean.

## 2. Inspect the current implementation surface

Read enough of the current repository to establish:

- applicable instructions and accepted decisions;
- existing public seams and behavior;
- relevant architecture, dependencies, and compatibility boundaries;
- durable test or observation seams;
- migration, rollout, or operational constraints when applicable; and
- nearby work that makes part of the request already complete or unnecessary.

Investigate technical facts directly. Do not ask the user which files,
framework, test command, or implementation pattern the repository already
reveals. When required evidence is unavailable, expose that precise gap.

## 3. Resolve the implementation frontier

Build a decision tree for material implementation choices whose answers change
the public seam, compatibility story, delivery decomposition, verification,
migration, rollout, or risk.

Use the canonical grilling rounds for choices that require product intent,
authority, or acceptance of a consequential trade-off. Give one recommendation
with evidence and rationale, then wait. Defer downstream decisions whose
options depend on an answer still open in the current round.

When material unknowns remain, actually ask the current frontier using the
grilling capability's numbered question and recommendation shape. A gap list,
warning, or proposed architecture is not a substitute for that round. Do not
recommend or choose a downstream architecture whose evaluation depends on
answers still open in the current frontier; recommendations belong only to the
questions currently being asked.

Before drafting ordered slices, apply this gate:

1. enumerate the material product, caller-contract, compatibility, migration,
   rollout, and operational nodes exposed by the change;
2. remove only nodes resolved by inspected evidence, prior confirmed answers,
   or literal bounded delegation; and
3. if any node remains, ask the current numbered frontier and stop the turn.

Do not draft a partial or provisional implementation plan in the same response
as that frontier.

When a bounded choice was explicitly delegated, it no longer belongs on the
human frontier. Select it with transparent provenance and include its
assumptions and reversal consequences in the draft plan.

When evidence establishes a technical answer without a material trade-off,
record it as plan evidence instead of asking for preference. When a technical
investigation exposes a new product ambiguity, return to the user before
selecting architecture.

Do not obey pressure to pick an unsupported technology, invent service levels,
assume migration policy, or produce a final plan while a material frontier
remains.

## 4. Draft the implementation plan

After the material decision and fact frontiers are empty, produce a compact
draft plan in the conversation with these conceptual sections:

- **Objective and constraints** — desired outcome and authoritative limits;
- **Current-state evidence** — relevant public seams, architecture, tests, and
  accepted decisions with repository pointers;
- **Selected approach** — the intended technical shape plus material rejected
  alternatives and why;
- **Ordered slices** — numbered vertical or otherwise independently verifiable
  slices, each naming its observable result, dependencies, and focused check;
- **Verification** — acted public-boundary evidence plus applicable repository
  gates;
- **Compatibility, migration, and rollout** — only where applicable, including
  reversal or expand-migrate-contract boundaries;
- **Risks, assumptions, and deferred work** — explicit residuals rather than
  hidden guesses; and
- **Plan restatement** — one sentence describing the implementation route and
  quality bar.

Prefer independently useful vertical slices. For a wide mechanical migration,
use an explicit expand-migrate-contract sequence when that is safer and more
truthful than artificial vertical slices.

Do not demand predetermined files or tactical steps that a later implementation
can safely derive. Do not create tracker-ready wording merely to make the plan
look complete, and do not publish tickets.

## 5. Confirm and stop

Ask the user to confirm or correct the one-sentence plan restatement. Until
they do, label the plan as a draft and do not claim agreement or readiness.

After explicit confirmation, label the conversational plan confirmed and
stop. Do not persist it or automatically start readiness assessment,
orchestration, implementation, ticketing, or publication. A separately
requested capability may consume the confirmed plan by intent.

The skill is complete only when every material choice is grounded in user
authority or inspected evidence, each slice has an observable result and
feasible independent check, applicable compatibility and rollout concerns are
covered, residual assumptions are visible, and the one-sentence plan has been
confirmed.
