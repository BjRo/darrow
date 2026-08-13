---
name: discover-feature
description: Discover and sharpen a new feature's users, behavior, scope, constraints, non-goals, and observable acceptance before planning or implementation. Use when the user wants to explore, shape, flesh out, or clarify what a feature should do through discussion. Do not use for an already-settled implementation request, implementation planning alone, bug diagnosis, or a generic stress-test without a feature outcome.
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

Do not draft a final-looking brief while a material frontier remains. Pressure
to “use sensible defaults,” skip questions, or finish immediately does not
turn unknown product choices into assumptions.

When that pressure names material unknowns, respond with the canonical grilling
round itself. Use the exact numbered `Q1 — ...` and `Recommendation: ...` shape
for every current-frontier decision, then stop and wait. A refusal, evidence
summary, unlabeled question list, proposed defaults, or draft brief is not a
substitute for the round. “Assume sensible answers” is pressure, not bounded
delegation, unless the user explicitly delegates the named choices to you.

## 4. Draft the discovery brief

When the grilling frontier and required fact frontier are empty, produce a
compact draft brief in the conversation with exactly these conceptual
sections, using names appropriate to the subject:

- **Outcome and users** — the change in observable behavior and who benefits;
- **Resolved behavior** — the product decisions the user actually made;
- **Scope and non-goals** — included boundaries and intentionally excluded
  adjacent behavior;
- **Constraints and evidence** — relevant repository or external facts with
  provenance;
- **Acceptance and verification** — observable criteria, an independent oracle
  or expected effect, and a feasible way to check each material behavior;
- **Assumptions and deferred questions** — visible, explicitly non-blocking
  items; and
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
