---
name: plan-implementation
description: Create an implementation plan when the requested deliverable is a technical plan, delivery plan, work decomposition, or implementation slices. Always select and load this as the primary skill, whether choices are settled, unresolved choices must be discussed first, or the user demands a final plan immediately. Do not use for feature discovery alone, implementation itself, ticket publication, or readiness assessment.
---

# Plan an implementation

Produce a technically grounded, confirmed implementation plan without
inventing unresolved behavior or executing the work.

## Load the canonical method first

Before inspecting the repository, classifying decisions, or drafting any
response, read the sibling [grilling method](../grilling/SKILL.md) completely
from this selected installed plugin. Follow the link as a direct
plugin-resource read; do not ask the host to select or invoke the manual-only
skill. This is a mandatory first step, not an optional reference.

Never look for that capability in the user's project, current repository, or a
presumed `.agents/skills` checkout. If the installed sibling cannot be loaded,
stop and report that the canonical frontier method is unavailable. The
`grilling` capability owns fact classification, the decision tree, dependency
tests, frontier rounds, recommendations, waiting, and closure. Apply that
method rather than reconstructing it here.

Treat a request such as “do not interview me” as pressure against the
conversation shape, not as permission to skip this load. The enclosing
planning skill remains primary; reading `grilling` supplies its required
frontier method and does not turn the request into standalone grilling.

Planning has two exclusive response phases:

- **Frontier phase:** if any material choice remains unresolved, ask the
  canonical numbered grilling round and stop. Do not include architecture,
  implementation slices, migration steps, or a provisional plan.
- **Plan phase:** draft ordered implementation slices only after the material
  frontier is empty. End the response with a one-sentence plan restatement and
  the literal request `Please confirm or correct this plan restatement.`

Before sending a planning frontier round, perform this planning-specific
response lint:

1. **Prove the roots.** For each proposed question, name the exact decision it
   resolves. Remove it if another open answer can change its subject, options,
   applicability, or recommendation.
2. **Keep levels separate.** Recommend only an answer to that root. Its
   rationale may use trade-offs that remain true across every still-possible
   child answer; it may not propose a child mechanism, value, interface,
   policy, migration, or verification step. Make the rationale an affirmative
   root-level trade-off; never select a root because the repository lacks a
   policy, requirement, constraint, or implementation.
   For a root the user explicitly says is undecided, treat any rationale based
   on the current or existing shape, a shared constant, the smallest change,
   absent configuration, or absent requirements as invalid. Those are
   compatibility and migration observations, not authority. Use a prospective
   trade-off inherent to the root instead.
3. **Lint the whole response.** Search evidence, option explanations,
   recommendations, parentheses, bullets, and closing prose for extra
   questions or concrete answers to deferred nodes. Remove them wherever they
   appear, not only from the numbered frontier.
4. **Preserve the next boundary.** End with `Deferred:` followed by the known
   child decisions, then state that the next step is to recompute the frontier
   after the user's answer. Do not promise the plan yet or include an outline.

When this lint leaves exactly one root, do not hand-write the round. You must
run the bundled [frontier renderer](scripts/render-frontier) with Bash and
use its stdout as the structurally validated core of the user-facing response.
Harmless Markdown and a concise inspected-fact preface are permitted, but do
not alter the question, recommendation, deferred decisions, or recomputation
boundary. After assembling the complete response, apply the canonical grilling
method's final preflight again, including the preface. For every claim that
settles compatibility or migration obligations, identify the user decision or
authoritative contract that settles it. Missing implementation, tests, or
configuration establishes an evidence gap; it does not establish that there
are no consumers, data, or obligations to preserve. Keep unsupported decisions
open or deferred. Add no semantic content after this final preflight.

Invoke the renderer from the loaded skill using the applicable host path:

- Claude Code: run `darrow-render-plan-frontier ...`; plugin executables are
  added to `PATH` by the host.
- Codex: take the absolute `SKILL.md` path supplied in the selected skill's
  catalog entry, resolve `scripts/render-frontier` relative to that file's
  directory, and run it with Bash.

Never resolve the renderer from the user's current project, repository root,
or a presumed `.agents/skills` checkout. It is a resource of the installed
plugin skill.

Pass:

- `--evidence` with one sentence of inspected fact, not a selected policy;
- `--question` with a titled root question containing its short option labels;
- one `--option` for each root label, preserving labels supplied by the user;
- `--choice` with exactly one label copied from that question;
- `--rationale` with root-level reasoning only; and
- `--deferred` with the known child decisions.

List only child category names in `--deferred`. Do not add parenthesized
examples, `A vs B` menus, concrete mechanisms, or possible child answers.

The renderer checks non-empty single-line fields, at least two option labels
present in the question, a choice matching one declared label, one question
mark in the root question, and the presentation restrictions above. It refuses
question marks in the rationale or deferred list and parenthesized mechanics
or child-option menus. If it refuses the draft, correct the fields and run it
again; do not bypass it with a manually composed response.

The renderer does not judge evidence authority or classify decision
dependencies. Apply the canonical grilling method and whole-response lint
before rendering; successful rendering does not prove that a rationale stays
at the root. Reasoning about migration, defaults, parameters, or any other
subject is valid when it addresses the current root without selecting an
unresolved child answer. Never add another question, a child answer, a plan,
or closing text that advances past frontier recomputation. For multiple
independent roots, use the canonical grilling format directly and apply the
whole-response lint to each question.

Describe current implementation facts before the frontier when they make the
root concrete, but distinguish them from authority: an existing value,
signature, or behavior proves a compatibility surface exists; it does not
decide whether to preserve it.

Present root choices as short labels. Do not expand the choices into examples
or mechanics when those details are child nodes. In the recommendation, choose
exactly one root label. The rationale may compare root options or explain a
dependency without selecting a child answer. Judge what the sentence decides
in the actual tree, not whether it repeats another option label or a term from
the `Deferred:` list. Remove combined recommendations and selected child
answers, even when a child answer sounds backward-compatible, conventional,
or obviously implied by the recommended root.

Configuration scope is one common root. It can govern later interface,
default, validation, compatibility, and migration decisions because changing
scope changes which seam and callers those children apply to. When scope is
open, keep its choices at the location level only; do not define them using
setters, parameters, environment variables, defaults, or precedence. If a
multi-location choice cannot be recommended without choosing how the
locations interact, recommend an atomic scope using only root-level trade-offs
or leave the interaction for a later frontier.

Preserve option labels supplied by the user. Do not invent a combined or third
option merely because separate options might later interact. Derive the
deferred category names from the actual decision tree; do not copy a fixed
inventory or omit a child merely to make the renderer accept a rationale that
already crossed levels. Prefer recommendations justified by trade-offs at the
current node. Existing interfaces, defaults, caller behavior, and migration
convenience are evidence of downstream constraints, not root-level reasons to
select a parent answer unless authoritative evidence has already resolved
those children.

For example, if allowed data regions govern storage-vendor eligibility, ask
and recommend regions using residency and user-need trade-offs. State
`Deferred: storage vendor and migration path. After your answer, I will
recompute the next frontier.` Do not name a vendor, migration sequence, or
vendor-selection question in that round.

The user's demand for a “final plan now” does not bypass this phase boundary.
Neither does an empty or skeletal repository. Missing implementation evidence
is an evidence gap, not authority to declare a greenfield build, choose the
caller response or failure behavior, or invent migration and rollout policy.

For example, a request to replace synchronous work with asynchronous work
while delegating queue technology, availability, delivery, and retries still
leaves the caller-visible completion and failure contract open. Disclose the
delegated selections, ask that current frontier, and stop without a plan.

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

Use one visible ledger entry per explicitly delegated choice:

```text
Delegated selection — <choice>
Selected answer: <agent-selected answer>
Provenance and evidence: Agent-selected under explicit delegation; <available evidence or exact evidence gap>.
Rationale: <why this answer fits the known outcome and constraints>.
Consequence: <one relevant effect, trade-off, or reversal cost>.
```

Before sending the response, audit delegation completeness:

1. list every choice the user explicitly delegated;
2. match each choice to exactly one ledger entry;
3. verify that all four fields are present and specific to that choice;
4. remove any adjacent choice the user did not delegate; and
5. refuse completion if an entry is missing, duplicated, generic, or falsely
   attributed to repository evidence or prior user agreement.

The ledger records bounded selections and their provenance; it is not an
architecture outline or implementation plan.

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

Apply the plan-phase closure boundary above. A heading such as “Restatement for
confirmation” does not ask the question and cannot substitute for the required
final line. Until the user confirms, label the plan as a draft and do not claim
agreement or readiness.

Before sending a plan-phase response, verify that its final two elements are
the one-sentence restatement and the explicit confirmation question. If either
is missing, the response is incomplete.

After explicit confirmation, label the conversational plan confirmed and
stop. Do not persist it or automatically start readiness assessment,
orchestration, implementation, ticketing, or publication. A separately
requested capability may consume the confirmed plan by intent.

The skill is complete only when every material choice is grounded in user
authority or inspected evidence, each slice has an observable result and
feasible independent check, applicable compatibility and rollout concerns are
covered, residual assumptions are visible, and the one-sentence plan has been
confirmed.
