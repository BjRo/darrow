# Capability: Discovery and Structured Grilling

Darrow provides one intent-matched conversational capability that grills a
decision, discovers product feature behavior, or plans an implementation. Each
mode uses the same evidence-backed decision-frontier method.

Plugin: `darrow-discovery`  
Skill: `work-through-decisions`

## Why

Feature discovery and implementation planning produce different artifacts,
but both fail when an agent silently fills gaps with plausible assumptions.
They need the same underlying discipline: discover facts from available
evidence, expose decisions to the user, and advance only through questions
whose prerequisites are already settled.

One public entry skill avoids competition among three skills for closely
related intent. A user may request a standalone grilling session in ordinary
language or explicitly invoke the skill. Feature discovery and implementation
planning load their own mode instructions only when the requested outcome
matches them.

## Capability boundaries

`work-through-decisions` chooses one mode from the requested outcome:

```text
work-through-decisions
  |-- standalone grilling       -> confirmed shared understanding
  |-- feature discovery         -> confirmed discovery brief
  `-- implementation planning   -> confirmed implementation plan
```

All three modes are read-only. They may inspect the current repository and
available external evidence, but they do not persist artifacts, record
decisions, create or update tickets, implement changes, invoke orchestration,
commit, or publish. Another explicitly requested capability may perform those
actions after the conversation reaches its own completion boundary.
When a request combines discovery with writing, ticketing, or implementation,
the discovery mode still resolves open material choices first and performs no
side effect in that turn. The additional action does not delegate unresolved
product choices or override this plugin's read-only boundary.

The plugin does not require a readiness gate. A discovery brief or plan may be
assessed later through an independently installed capability matching
implementation-readiness intent.

## Structured grilling

### Intent

Select standalone grilling for an explicit invocation or an ordinary request
to grill, interview, or challenge a named idea, design, plan, or decision when
the user does not request a feature-discovery brief or an implementation plan.
Generic stress-testing of an idea may also use standalone grilling when the
user asks for decision rounds. A product feature named as the subject does not
by itself change the requested outcome to feature discovery.

Do not select the skill merely because an ordinary request is incomplete, asks
one clarifying question, requests implementation, or requests ordinary advice
without a structured interview outcome. A negated mention such as “do not
grill me” does not activate standalone grilling; a requested feature or plan
still uses the shared method when material unknowns remain.

### Inputs

The user supplies a subject or an enclosing capability supplies the outcome
whose unknowns must be resolved. Existing conversation decisions, named
authoritative sources, repository evidence, and available external sources may
establish prerequisites.

If no subject can be identified, make the user-facing final answer exactly
`What subject would you like me to grill?` and stop. Do not add an explanation,
topic menu, second question, or numbered frontier to that answer.

### Method

Represent the discussion as a decision tree. A node is settled only by:

- an explicit user decision or confirmation;
- authoritative evidence that already determines the answer; or
- a discoverable fact established from available evidence.

Classify each unknown before asking about it:

- **discoverable fact** — investigate it; never ask the user to perform
  repository or external lookup that the agent can perform;
- **confirmation** — present the established fact and ask only whether the
  user intends to override or constrain it when that authority belongs to
  them; or
- **human decision** — ask the user because evidence cannot choose product
  intent or authorize a material trade-off, unless the user explicitly
  delegates that bounded choice to the agent.

The **frontier** is every unresolved human decision whose prerequisites are
settled. Work in rounds:

1. investigate discoverable facts needed by the current tree;
2. recompute the frontier;
3. ask every material, independent frontier question in one round;
4. immediately before sending, re-audit every numbered question against every
   other unanswered node and remove any question whose relevance, subject,
   options, or recommendation can still change; then scan the whole response
   for hidden questions or selected answers from those removed branches and
   verify that every dependency stated by the user remains explicit in the
   deferred chain;
5. number each remaining question and give one recommended answer with concrete
   rationale; and
6. wait for the user's answers before advancing dependent branches.

Do not ask a downstream question in the same round when its choices or useful
wording depend on an answer still open in that round. Before asking, compare
every candidate question with the other open nodes: if another answer can
change whether the question matters, who or what it applies to, its concrete
options, or the recommendation, make it a child of that prerequisite. When all
other material nodes depend on one open root, ask only that root and describe
deferred branches as statements rather than additional questions. The root's
recommendation may explain those dependencies but must not select answers for
the deferred branches. When known child nodes remain, do not promise the final
artifact immediately after the root answer; the next step is to recompute and
ask the newly unblocked frontier. Do not ask speculative questions merely to
make the interview exhaustive. Recompute the tree after each user response;
answers may add, remove, or reorder branches.

Use this presentation shape unless the host surface makes it inaccessible:

```text
Q1 — <short title>: <question and relevant choices>

Recommendation: <recommended answer and why>
```

The recommendation is advisory. It must not be phrased as an accepted choice,
and facts or repository conventions cannot silently decide product intent.
When the user explicitly delegates a bounded choice, record that delegation as
its authority and distinguish the resulting agent selection from a
user-selected answer.

### Completion

The interview reaches closure only when:

- no material decision remains on the frontier;
- no unresolved discoverable fact blocks the stated subject;
- material assumptions and intentionally deferred questions are visible; and
- the user confirms a one-sentence restatement of the resulting shared
  understanding.

An empty current round is not enough when a known dependent branch remains.
Do not act on the result, call it agreed, or hand control back to an enclosing
consumer as resolved before confirmation.

## Discover a feature

### Intent

Use feature-discovery mode when the user wants to discover, explore, shape, or
clarify a new feature or product behavior before planning or implementation.
Do not use it for an already-resolved implementation request, implementation
planning alone, bug diagnosis, or a generic request to be grilled without a
feature outcome.

### Workflow

1. Establish the feature idea, affected users, and named authoritative inputs.
2. Inspect enough existing behavior, terminology, constraints, and related
   decisions to avoid asking for repository facts.
3. Apply the canonical `grilling` method to unresolved product behavior,
   scope, non-goals, constraints, and acceptance evidence.
4. When the material frontier is empty, produce a concise draft discovery
   brief in the conversation.
5. End with a one-sentence goal restatement and ask the user to confirm it.

The brief contains:

- desired outcome and affected users;
- resolved behavior and decisions;
- scope and explicit non-goals;
- constraints and relevant evidence with provenance;
- observable acceptance criteria and feasible verification;
- assumptions and intentionally deferred questions; and
- the one-sentence goal restatement.

If the frontier is not empty, ask the current grilling round instead of
fabricating or prematurely completing the brief. The brief is
non-authoritative until confirmed and remains conversational even afterward;
confirmation does not authorize persistence or implementation.

## Plan an implementation

### Intent

Use implementation-planning mode when the user asks for a technical implementation
plan, migration or rollout plan, delivery decomposition, or executable work slices for an understood
outcome. The skill may begin from a request, confirmed discovery brief,
specification, ticket, or accepted decision.

Do not use it for feature discovery alone, implementation itself, ticket
publication, or a request that merely asks whether existing work is ready.

### Workflow

1. Establish the desired outcome and authoritative product constraints.
2. Inspect the current architecture, public seams, tests, repository rules,
   and relevant accepted decisions.
3. Apply the canonical `grilling` method to material implementation unknowns.
   Investigate technical facts directly; ask the user only for product intent,
   authority, or consequential choices that evidence cannot settle and the
   user has not explicitly delegated.
   Apply delegation literally: resolving named technical choices does not
   resolve adjacent caller behavior, compatibility, migration, rollout, or
   operational choices. A synchronous-to-asynchronous change cannot be planned
   while its caller-visible completion and failure contract remains open.
   Missing implementation evidence does not authorize the planner to label a
   change greenfield or select those adjacent contracts; it leaves an evidence
   gap and decision frontier. Existing defaults and signatures identify the
   compatibility surface but do not authorize preserving or changing a
   specific value or call shape when that policy depends on an open parent
   decision.
4. If a newly exposed product ambiguity changes the desired behavior, resolve
   it through grilling before selecting implementation structure.
5. When the material frontier is empty, produce a concise draft implementation
   plan in the conversation.
6. End with a one-sentence plan restatement followed by an explicit request
   asking the user to confirm or correct it. A heading or label that merely
   mentions confirmation is not a confirmation request.

The plan contains:

- objective and authoritative constraints;
- current-state evidence and affected public seams;
- selected approach with material alternatives rejected and why;
- ordered, independently verifiable vertical slices and their dependencies;
- verification for behavior, compatibility, migration, and rollout where
  applicable;
- risks, assumptions, and intentionally deferred work; and
- the one-sentence plan restatement.

Do not require predetermined files or tactical detail that repository
inspection can establish during implementation. Do not force a wide mechanical
migration into artificial vertical slices; name an expand-migrate-contract
sequence when that better preserves compatibility.

If material unknowns remain, ask the current grilling round rather than hiding
them inside assumptions or producing a final-looking plan. The plan remains
non-authoritative until confirmed and is never published as tickets by this
skill.

## Invariants

1. **DG-C1 — Intent-matched invocation.** The one public skill selects
   standalone grilling from explicit invocation or matching natural-language
   intent without a feature or implementation-plan outcome. Feature and
   planning intent select their respective mode instead. Ordinary advice,
   implementation, and a single clarification do not select the skill. A
   negated mention such as “do not grill me” does not cancel a feature or plan
   mode's required shared method. When a standalone grilling request has no
   identifiable subject, its user-facing final answer is exactly `What
subject would you like me to grill?`, and it stops.
2. **DG-C2 — Dependency-aware frontier.** Each round asks all material
   independent questions whose prerequisites are settled and defers dependent
   questions until a later round. A node is dependent when another open answer
   can change its relevance, subject, concrete options, or recommendation;
   deferred nodes are neither phrased as additional questions nor selected
   inside the current root's recommendation. Immediately before sending, the
   agent rechecks every numbered question against every other unanswered node
   and removes newly exposed dependents from both the numbered round and the
   surrounding prose. User-stated dependency edges remain visible even when an
   earlier prerequisite is the current root; the agent may not shorten the
   chain by saying a downstream node follows only that earlier prerequisite.
   A root answer does not authorize the final artifact while known child nodes
   remain.
3. **DG-C3 — Facts are investigated.** The agent discovers available
   repository and external facts instead of delegating lookup to the user;
   evidence does not silently decide product intent.
4. **DG-C4 — Recommendations preserve authority.** Every material question has
   a concrete, non-empty recommendation and rationale, clearly distinguished
   from the user's decision. If the agent cannot recommend an answer, the node
   is not a numbered decision: investigate it, report it as an unnumbered
   evidence gap, or defer it.
5. **DG-C5 — Confirmed closure.** The capability is not complete until the
   material frontier is empty and the user confirms the resulting one-sentence
   shared understanding.
6. **DG-C6 — Conversation-only authority.** Standalone grilling neither acts
   on the result nor persists it and grants no additional authority to a
   consumer.
7. **DF-C1 — Product outcome.** Feature discovery resolves desired behavior,
   users, scope, constraints, non-goals, and observable acceptance without
   turning into implementation planning. It is not selected when the user's
   requested outcome is an implementation plan, even if unresolved choices
   must be discussed before that plan can be produced. Ordinary requests to
   spec out or work through what a product feature should do select feature
   discovery even without naming a discovery brief. Personal decisions and
   generic requests for grilling or stress-testing without a product-feature
   outcome do not select feature discovery.
8. **DF-C2 — Honest brief.** A discovery brief exposes evidence provenance,
   assumptions, and deferred questions. Material product choices cannot be
   moved into assumptions or deferrals, and no discovery brief, including a
   draft, is produced while a material frontier remains. When a named material
   choice is open, the response accounts for it by asking it on the current
   frontier or explicitly deferring it under the canonical dependency rule. A
   blanket request to assume defaults or decide missing details is pressure,
   not bounded delegation over nearby named choices.
9. **PI-C1 — Technical outcome.** Implementation planning resolves public
   seams, approach, delivery slices, dependencies, verification, and relevant
   migration or rollout concerns without implementing or publishing tickets.
   For implementation-planning intent, the planning mode is selected even when
   every material choice is already settled. Its instructions are loaded before
   the shared grilling method. It also remains selected when
   unresolved implementation choices must be discussed before plan slices can
   be produced. Ordinary requests such as "let's plan how to implement this"
   select planning when the referenced change is identifiable; personal advice
   and generic stress-tests without an implementation-plan outcome do not.
10. **PI-C2 — No invented plan.** Planning investigates technical facts and
    returns to the user for unresolved product or consequential choices rather
    than embedding guesses as architecture. An explicitly delegated bounded
    choice is permitted only when the current response gives that choice its
    own visible entry containing the selected answer, agent-selected provenance
    and available or missing evidence, rationale, and a relevant consequence,
    even when another frontier remains. Before sending the response, planning
    checks that every explicitly delegated choice has exactly one complete
    entry. Delegation is literal and does not authorize adjacent choices; any
    remaining material frontier prevents ordered plan slices.
11. **DC-C1 — Read-only composition.** All three modes preserve repository
    and external state; later persistence, decision capture, ticketing,
    readiness assessment, orchestration, and implementation require separate
    intent and authority.
12. **DC-C2 — Clear conversation output.** Questions lead with the requested
    decision. Briefs and plans lead with their outcome; their required
    confirmation request remains the final substantive element. All three modes use
    familiar words, active voice, and short sentences and paragraphs, explain
    necessary Darrow terms, and omit repeated points and process narration.
    They still preserve material choices, provenance, constraints, acceptance
    evidence, and confirmation boundaries.

## Packaging and portability

1. **DC-P1 — Independent plugin.** `darrow-discovery` contains its one public
   skill and every required resource and assumes no sibling Darrow plugin.
2. **DC-P2 — Cross-host discovery.** The public skill carries concrete trigger
   and exclusion metadata usable by Claude Code and Codex. Its entry file
   chooses one mode by requested outcome and reads only that mode's complete
   instructions before acting.
3. **DC-P3 — One canonical method.** All modes read and reuse the installed
   skill's shared grilling reference when material unknowns need a decision
   frontier. They do not reproduce competing interview protocols or invoke a
   second public skill.
4. **DC-P4 — Contextual judgment.** Decision-tree construction, fact
   classification, materiality, and closure remain model judgment; no keyword
   checklist or numeric ambiguity score substitutes for them. The frontier
   renderer checks field and presentation structure, not semantic authority or
   decision dependencies. It must accept valid root reasoning about migration,
   defaults, parameters, or other subjects regardless of vocabulary, including
   comparisons with another root option or words shared with deferred nodes.
   The canonical grilling method remains responsible for preventing selected
   child answers and unsupported authority in the surrounding conversation.
   Apply that contextual audit to the complete user-facing round after
   rendering, including any inspected-fact preface. Missing repository
   implementation does not settle compatibility or migration obligations.
5. **DC-P5 — Portable frontier renderer.** The deterministic frontier renderer
   is a plugin-contained, UV-locked Python package with no runtime dependencies.
   Its public command preserves the accepted arguments, rendered structure,
   validation diagnostics, stdout/stderr separation, and exit statuses on
   Linux, macOS, and native Windows. Claude Code and Codex resolve the backend
   from the installed skill directory and invoke the same locked package
   entrypoint directly. Fresh-artifact checks exercise that installed layout
   without repository-relative references or platform-specific launchers.
   Internal simplification preserves literal flag values, last-wins scalar
   options, ordered repeated option labels, validation order, and removal of
   exactly one terminal period before rendering prose.

## Evaluation requirements

1. **DC-E1 — Intent boundaries.** Explicit invocation, natural-language
   grilling, feature discovery, and implementation-planning requests select
   the one public skill and their matching mode. Ordinary advice,
   implementation, readiness, and single-clarification requests leave it
   unselected. Cases verify entry-skill reads separately from task behavior;
   mode-reference reads require additional evidence when the host does not
   retain ordinary resource reads.
2. **DC-E2 — Frontier sequencing.** Cases contain independent and dependent
   decisions and verify that the first response asks the independent frontier
   with recommendations while deferring downstream questions.
3. **DC-E3 — Fact ownership.** Repository fixtures contain facts tempting to
   ask the user; the skills inspect and use them without making the user look
   them up. Verify relevant fact use at the current frontier without requiring
   an exhaustive inventory of the inspected implementation in the response.
4. **DC-E4 — Incomplete input.** A subjectless grilling request produces the
   user-facing final answer `What subject would you like me to grill?`, with no
   explanation, topic menu, second question, or numbered frontier in that
   answer.
5. **DC-E5 — Pressure and delegation.** Direct grilling retains its canonical
   recommendations and dependency ordering under pressure. Outcome skills do
   not convert time pressure or undelegated gaps into assumptions; when the
   user explicitly delegates a bounded choice, they preserve that provenance
   and uncertainty instead of attributing it to repository evidence or prior
   agreement, and demonstrate that undelegated adjacent choices remain on the
   frontier.
6. **DC-E6 — Outcome distinction.** Feature discovery produces the discovery
   brief shape without an implementation plan; planning produces executable
   slices without publishing tickets or implementing them.
7. **DC-E7 — Read-only behavior.** Every direct and composed case preserves
   repository refs, tracked content, untracked content, and external state.
8. **DC-E8 — Cross-harness behavior.** Representative direct, composed,
   negative, and pressure cases run on Claude Code and Codex with matched
   prompts, fixtures, model class, effort, and trial count.
9. **DC-E9 — Communication quality.** Focused cases assess whether each skill
   is clear and concise while preserving every material decision, evidence
   source, safety boundary, and next action. Semantic assertions grade meaning,
   not one preferred wording.

## Non-goals

- Persisting specifications, plans, evidence, or `.darrow` artifacts.
- Recording accepted decisions or maintaining a glossary.
- Creating, updating, relating, or publishing tickets.
- Assessing implementation readiness.
- Diagnosing a reproducible bug or implementing a repair.
- Starting adaptive-delivery or another orchestration helper.
- Selecting every installed capability through a workflow router.
