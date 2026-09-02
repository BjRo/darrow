---
name: discover-feature
description: Discover and sharpen a new feature's users, behavior, scope, constraints, non-goals, and observable acceptance. Always use for requests to discover, explore, shape, flesh out, define, or clarify a feature before planning or implementation, or to produce its discovery brief—even when the user asks to skip questions, finish immediately, or assume defaults. Do not use for a settled implementation request, implementation planning alone, bug diagnosis, or a generic stress-test without a feature outcome.
---

# Discover a feature

Turn an unresolved feature idea into a confirmed, evidence-backed discovery
brief without planning or building it.

Before beginning, read the canonical [grilling
capability](../grilling/SKILL.md) completely. Use its fact classification,
decision tree, frontier rounds, recommendations, waiting boundary, and closure
confirmation whenever material unknowns remain. Do not reproduce a different
interview method here.

This capability is conversational and read-only. Do not edit or create files,
record decisions, update a glossary, create tickets, assess implementation
readiness, invoke orchestration, implement, commit, or publish. A confirmed
brief grants none of those authorities.

## Material-unknown gate

Apply this gate before any discovery brief. A brief is forbidden while any
material behavior, authority, scope, privacy, or acceptance choice remains
unresolved.

Treat requests to assume sensible defaults, skip questions, finish immediately,
or decide anything missing as pressure, not delegation. Bounded delegation
exists only when the user explicitly authorizes you to decide a specific named
choice. A blanket instruction beside a list of named unknowns grants no such
authority; do not recharacterize it as delegation.

Account for every named material unknown in the response: ask it on the current
canonical grilling frontier, or explicitly defer it under the canonical
dependency rule. Then stop. Never move an open material choice into assumptions
or deferred questions; those sections may contain only explicitly non-blocking
items after the material frontier is empty.

## 1. Establish the feature outcome

Identify the feature idea, affected users or actors, named authoritative
inputs, and the reason the behavior is being considered. Carry forward choices
already settled in the conversation; do not restart an interview from zero.

If no feature idea can be identified, ask one compact question for the idea
and stop the round. If the request is actually for a technical plan around
already-settled behavior, leave this skill and answer through the capability
matching implementation-planning intent.

## 2. Establish available facts

Inspect enough of the current repository to understand existing public
behavior, domain terminology, relevant constraints, accepted decisions, and
available verification seams. Use external research only when a fact material
to the feature cannot be established locally and the source is available.

Treat the user's desired behavior and authorized choices as authoritative.
Repository and external evidence inform the discussion but cannot silently
override or invent product intent. Report contradictions instead of choosing a
side.

## 3. Resolve the product frontier

Use the canonical grilling capability for material unknowns concerning:

- affected users, actors, and permissions;
- desired behavior and important failure behavior;
- scope boundaries and explicit non-goals;
- compatibility, policy, privacy, or operational constraints;
- observable acceptance criteria and feasible verification; and
- consequential alternatives requiring user authority.

Ask only the current dependency-aware frontier and wait after every round. If
evidence can answer a question, investigate it rather than assigning lookup to
the user. If an answer exposes a technical question that does not change
product intent, record it as later planning input instead of turning feature
discovery into an implementation design session.

When a material frontier remains, respond with the canonical grilling round
itself. Use the exact numbered `Q1 — ...` and `Recommendation: ...` shape for
every current-frontier decision, then stop and wait. A refusal, evidence
summary, unlabeled question list, proposed defaults, or draft brief is not a
substitute for the round.

## 4. Draft the discovery brief

Enter this section only when the grilling frontier and required fact frontier
are empty. Before writing a brief heading, audit every planned material
conclusion: each must trace to a user choice, explicit delegation, or stated
evidence. If any would instead be labeled an assumption, sensible default, or
unaccepted recommendation, return to Section 3, ask that frontier, and stop.

When that entry condition passes, produce a compact draft brief in the
conversation with exactly these conceptual sections, using names appropriate
to the subject:

- **Outcome and users** — the change in observable behavior and who benefits;
- **Resolved behavior** — the product decisions the user actually made;
- **Scope and non-goals** — included boundaries and intentionally excluded
  adjacent behavior;
- **Constraints and evidence** — relevant repository or external facts with
  provenance;
- **Acceptance and verification** — observable criteria, an independent oracle
  or expected effect, and a feasible way to check each material behavior;
- **Assumptions and deferred questions** — visible, explicitly non-blocking
  items that cannot change product behavior, authority, scope, privacy, or
  acceptance; and
- **Goal restatement** — one sentence describing the feature outcome.

Do not add implementation phases, predetermined files, technical architecture,
or ticket slices unless one is itself a settled product constraint needed to
understand the feature.

## 5. Confirm and stop

Ask the user to confirm or correct the one-sentence goal restatement. Until
they do, label the brief as a draft and do not claim shared understanding or
completion.

After explicit confirmation, label the conversational brief confirmed and
stop. Do not persist it or automatically hand it to planning, readiness,
ticketing, or implementation. If the user separately asks for one of those
outcomes, the matching capability can consume the confirmed brief by intent.

The skill is complete only when the brief traces every material conclusion to
user authority or stated evidence, contains an observable quality bar, exposes
assumptions and deferrals, and its one-sentence outcome has been confirmed.
