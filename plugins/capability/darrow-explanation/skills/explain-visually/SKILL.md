---
name: explain-visually
description: Explain an existing codebase, change, design, runtime flow, state model, algorithm, or technical topic inline in conversation through a compact call tree, responsibility tree, state or sequence diagram, structural diff, pseudocode, signature sketch, or table. Use when the user asks to visualize, diagram, map, or show technical structure or flow, or says prose is too dense. Do not use to create or edit HTML pages, images, slides, UI mockups, documentation, or other artifact files; for implementation; or for an ordinary question that short prose answers directly.
---

# Explain visually

Turn the identified technical subject into one compact, grounded view. Keep the
result inline and read-only: do not create or open HTML, images, slides,
documentation, or other artifact files, and do not modify the subject being
explained.

## Bind the subject

Use the subject supplied in the request or established by the current
conversation. When the request concerns current code, a change, or repository
ownership, inspect the named repository sources before drawing the view.
Treat phrases such as `this <named subject>` as an identified repository or
conversation subject even when the user omits a file path: search likely
filenames and contents for that name before asking where it is.

If neither the request nor current context identifies a subject, ask one
compact question for it. Do not pick, mention, or summarize an unrelated topic
from repository state merely to explain why it was not selected.

If the request is actually to create a visual artifact, implement a change, or
edit documentation, leave this workflow and follow that literal intent through
the matching capability. Do not replace it with an inline explanation or
refuse it merely because this skill is read-only.

**Complete when:** the subject and the relationship the user needs to
understand are concrete, or one focused question has requested the missing
subject without further action.

## Ground the view

Gather enough authoritative evidence for every concrete node and relationship.
Use supplied context, inspected repository sources, or a named authoritative
input. When the request names current code or an accepted repository plan,
search the working tree and likely documentation for that subject before
declaring it missing; conversation memory is not a substitute for repository
inspection. Never fill an evidence gap with plausible filenames, services,
calls, states, ownership, or infrastructure.

Classify what the view represents:

- **Observed** — established by supplied or inspected evidence.
- **Proposed** — a target shape established by the user or an authoritative
  plan.
- **Conceptual** — a teaching model that makes no current-repository claim.

Label the status next to the view whenever the user could mistake one state for
another. Keep unknowns as `?`, name the evidence gap, or ask the user. Under
pressure for an authoritative diagram without enough evidence, show only what
is known or offer a clearly labeled proposed/conceptual view.

**Complete when:** every concrete claim is traceable to evidence or visibly not
claimed as observed.

## Choose the smallest fitting representation

Match the form to the relationship:

| User needs to see | Prefer |
| --- | --- |
| Ownership, location, or UI composition | Shallow responsibility or component tree |
| Runtime calls or interactions | Call tree or compact sequence diagram |
| State evolution | State diagram or transition table |
| Change from an existing shape | Structural diff |
| Algorithmic decisions and order | Pseudocode |
| A proposed code surface | Types and signatures |
| Repeated exact mappings or choices | Table |

Use these minimal shapes as the vocabulary, replacing every placeholder with
evidence from the current subject:

```text
handleRequest
  authenticate
  loadAccount
    accountRepository.find
  renderResponse
```

```text
app/
|-- input/          # parses incoming values
|-- domain/         # owns business state
`-- adapters/       # talks to external systems
```

```diff
 lib/
-`-- cache.ts
+`-- cache/
+    |-- reader.ts
+    `-- eviction.ts
```

```text
on(fetch)
  if cached value is fresh
    return cached value
  load fresh value
```

Use Mermaid only when it materially clarifies relationships and its source is
still understandable if the host does not render it. Prefer a fenced text form
when rendering support is unknown or a tree is equally clear.

Use one primary view by default. Add a second only when it answers a distinct
necessary question. Do not demonstrate every supported representation.

**Complete when:** the chosen form exposes the requested relationship with no
less elaborate form doing the job as clearly.

## Render without hiding the hard parts

Start with the view or one necessary status sentence; skip process narration
and a prose summary of the repository scan. Use at most one short framing
sentence before the view and one short qualification after it unless an
evidence gap cannot be explained that briefly.

Keep repository source anchors inline with the relevant nodes. Do not repeat
them in a separate source list. Omit unrelated nodes instead of listing
everything inspected; mention one only when its exclusion resolves a material
ambiguity in the request.

Prune incidental helpers, files, props, states, and branches. Preserve an error
path, exceptional state, ordering constraint, ownership boundary, or caveat
when removing it would change the answer. Visual polish and brevity are not
substitutes for accuracy.

For a responsibility view, show the nested directory shape with one concise
ownership label per relevant entry rather than a file-by-file prose inventory.
Stay at the ownership level the user requested: do not descend from files into
exported symbols or implementation details unless that extra level answers the
question. Keep source anchors on the same line as the entry they support.

For a structural diff, prefix the removed entry itself with `-` and each added
entry itself with `+`; never put a change marker only on a blank connector line
or rely on surrounding prose to communicate the change. For state views,
preserve directional qualifiers such as `attempts remain` rather than
shortening them into ambiguous labels such as `attempts`. For pseudocode,
preserve material validation and failure branches without transliterating
source line by line.

Before responding, verify:

- each concrete node and edge is grounded;
- observed, proposed, and conceptual structure cannot be confused;
- unknowns remain visible;
- the view directly answers the user's question;
- material boundaries and caveats survived compression; and
- the repository and external state are unchanged.

**Complete when:** the compact inline view answers the question accurately,
remains usable as plain text, and makes no unsupported structural claim.
