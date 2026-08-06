# Small design-smell baseline

Use this baseline only when applicable repository guidance is silent. These are
review prompts, not repository law, and a documented local decision always
overrides them.

- Duplication: the change repeats knowledge that already has one clear owner.
- Speculative generality: abstraction or configuration exists only for an
  imagined future use.
- Shotgun surgery: one behavior requires coordinated edits across avoidably
  many owners.
- Muddled naming: names conceal the changed behavior or give two meanings to
  one concept.
- Primitive obsession: raw strings, numbers, or flags erase an important
  domain invariant at a boundary.
- Misplaced behavior: logic sits with data or responsibilities it does not own.

Report a smell only with concrete changed-line evidence. Cite it as
`heuristic:<smell-name>`, label it advisory unless it creates a demonstrated
correctness or maintenance failure, and suppress it when local guidance accepts
the design.
