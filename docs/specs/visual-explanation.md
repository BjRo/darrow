# Capability: Visual Explanation

Darrow should provide a focused, read-only capability that turns an existing
technical subject into the smallest accurate visual representation needed to
understand it. The capability reduces cognitive load without replacing
evidence with a polished but invented diagram.

Plugin: `darrow-explanation`  
Skill: `explain-visually`

## Why

Coding agents often answer structural questions with prose even when the user
needs to see ownership, order, state, or change. A compact file tree, call tree,
structural diff, signature sketch, pseudocode block, table, or Mermaid diagram
can expose those relationships more directly.

Visual form does not make an explanation true. The capability therefore owns
both representation choice and grounding: every concrete name and relationship
must come from the supplied conversation, inspected repository evidence, or an
explicitly identified source. Proposed or conceptual structure remains useful
only when it is visibly distinguished from observed structure.

## Public contract

### Intent

Use `explain-visually` when the user asks to visualize, diagram, draw, map, show
the structure or flow, restate a dense explanation visually, or explicitly
invokes the skill for a current technical subject.

Do not select it merely because a technical answer has several parts. Do not
use it for polished graphic design, UI mockup production, image generation,
implementation, repository documentation, or an ordinary request that concise
prose answers more directly.

### Inputs

The user supplies a subject directly or identifies it through the current
conversation, a named repository area, a change, a specification, or another
authoritative source. The user may request a particular representation, but
the capability may use a smaller accessible equivalent when the host cannot
render that format.

If neither the request nor current context identifies the subject, ask one
compact question for it. Do not infer a subject from unrelated repository
state.

### Output

Return an inline explanation in the conversation:

- one primary compact visual by default;
- a second view only when it answers a distinct necessary question;
- brief prose needed to frame the view, identify evidence status, or preserve
  a critical caveat; and
- source anchors for repository-derived structure when they materially help
  the user verify the view.

The capability does not create or open HTML, image, slide, or documentation
files. Artifact creation requires separate user intent and a matching
capability.

### Evidence status

Every visual represents one of these states:

- **Observed** — concrete names and relationships are established by supplied
  or inspected authoritative evidence.
- **Proposed** — the visual is a target shape based on choices the user or an
  authoritative plan has made.
- **Conceptual** — the visual teaches a general model rather than claiming the
  repository currently has that structure.

When the status could be mistaken, label it next to the visual. Unknown facts
remain `?`, an explicit evidence gap, or a question to the user; plausible
names, files, calls, states, and ownership must not fill the gap.

## Representation selection

Choose the smallest form that exposes the relationship the user is trying to
understand:

| Question                                    | Preferred representation                 |
| ------------------------------------------- | ---------------------------------------- |
| Where does this live or who owns it?        | Shallow responsibility or component tree |
| What calls what at runtime?                 | Call tree or compact sequence diagram    |
| How does state evolve?                      | State diagram or transition table        |
| What changes from the current shape?        | Structural diff                          |
| How does the algorithm work?                | Pseudocode                               |
| What shape should the code expose?          | Types and signatures                     |
| How do several exact fields or choices map? | Table                                    |

Use Mermaid only when it materially clarifies relationships and the response
remains understandable as source text if it is not rendered. Prefer a fenced
text form when rendering support is unknown or an ASCII tree is equally clear.

Prune incidental helpers, files, props, states, and branches. Preserve error
paths, exceptional states, ordering, or boundaries when omitting them would
change the answer. Do not use visual decoration as a substitute for content.

## Workflow

1. Bind the subject and the precise relationship the user needs to understand.
   Ask for the subject only when current context cannot establish it.
2. Gather enough authoritative evidence for every concrete claim. Inspect
   named repository sources directly when the request concerns current code.
3. Classify the view as observed, proposed, or conceptual and select the
   smallest fitting representation.
4. Render the primary view next to only the prose it needs. Add another view
   only when the first cannot answer a distinct necessary question.
5. Verify that every concrete node and edge is grounded, unknowns remain
   visible, critical caveats survive compression, and the visual directly
   answers the request.

The capability completes only when the subject is unambiguous, the chosen view
answers the user's question, concrete structure is traceable or visibly not
claimed as observed, and no required qualification has been hidden by
compression.

## Invariants

1. **VE-C1 — Intent-matched explanation.** Direct and indirect requests for a
   visual explanation select the capability; ordinary implementation,
   artifact creation, and sufficiently answered short-prose requests do not.
2. **VE-C2 — Smallest fitting view.** Representation follows the relationship
   being explained, with one primary view by default and no catalogue of every
   supported form.
3. **VE-C3 — Grounded structure.** Every concrete name and relationship is
   supported by supplied or inspected evidence. Missing evidence remains
   visible rather than becoming plausible architecture.
4. **VE-C4 — Status is explicit.** Observed, proposed, and conceptual views are
   distinguished whenever a user could mistake one for another.
5. **VE-C5 — Loss-aware compression.** The visual removes incidental detail
   while preserving boundaries, ordering, error paths, states, and caveats
   that materially affect the answer.
6. **VE-C6 — Accessible rendering.** The explanation remains usable when
   Mermaid is not rendered; unsupported rich rendering does not block a
   smaller text representation.
7. **VE-C7 — Read-only conversation output.** The capability changes neither
   repository nor external state and creates no visual artifact files.

## Request matrix

The public behavior must cover these representative requests before skill
prose is implemented:

| Class          | Representative request                                                       | Expected behavior                                                                                  |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Direct         | “Use `explain-visually` to show what happens when a job is submitted.”       | Inspect the named code and return a compact observed call-flow view.                               |
| Indirect       | “This state-machine explanation is too much prose. Show me the transitions.” | Choose a state-oriented view without requiring the user to name a format.                          |
| Incomplete     | “Use `explain-visually`. Show me.”                                           | Ask what subject to explain and do not invent one.                                                 |
| Negative       | “Implement the documented retry behavior and keep the response concise.”     | Leave visual explanation unselected and perform only the requested implementation workflow.        |
| Counterexample | “Draw the exact production architecture from this one-line product ticket.”  | Expose the evidence gap or label a conceptual/proposed view; do not invent current files or calls. |

## Packaging and portability

1. **VE-P1 — Independent plugin.** `darrow-explanation` contains every
   required skill and resource and assumes no sibling Darrow plugin.
2. **VE-P2 — Cross-host discovery.** Trigger and exclusion metadata works for
   Claude Code and Codex.
3. **VE-P3 — Conversation-native core.** The skill requires no renderer,
   script, MCP server, or non-baseline runtime dependency.
4. **VE-P4 — Contextual judgment.** Subject binding, evidence classification,
   representation choice, and loss-aware compression remain model judgment;
   no keyword router substitutes for them.

## Evaluation requirements

1. **VE-E1 — Intent boundaries.** Direct and indirect visual-explanation
   requests select the behavior; implementation and visual-artifact requests
   do not mis-trigger it.
2. **VE-E2 — Representation fit.** Call flow, state transition, ownership,
   change, and algorithm cases choose a fitting compact form rather than a
   generic prose list or an unrelated diagram type.
3. **VE-E3 — Evidence fidelity.** Repository fixtures contain tempting but
   unsupported relationships and verify that the output includes established
   nodes and edges without inventing the rest.
4. **VE-E4 — Incomplete input.** A subjectless request asks for the missing
   subject without choosing one from unrelated repository content.
5. **VE-E5 — Pressure.** A request for exact architecture from insufficient
   evidence preserves the evidence gap and status instead of presenting a
   polished hallucination.
6. **VE-E6 — Compact completeness.** Comparative cases assess line or token
   economy together with retention of material boundaries and caveats; shorter
   output alone is not success.
7. **VE-E7 — Read-only behavior.** Every positive and pressure case preserves
   repository refs and tracked content; at least one representative case also
   seeds and preserves untracked content.
8. **VE-E8 — Cross-harness comparison.** Representative direct, indirect,
   negative, and pressure cases compare the skill with an uncontaminated
   no-skill condition on Claude Code and Codex using matched prompts, fixtures,
   model class, effort, and trial count.

## Non-goals

- Creating HTML explainers, diagrams, screenshots, images, slides, or UI
  mockups as files.
- Editing implementation or documentation while explaining it.
- Replacing code review, architecture review, feature discovery, planning, or
  implementation with a diagram.
- Enforcing a global response style on requests without visual-explanation
  intent.
- Claiming that a compact visual is complete merely because it is attractive
  or short.
