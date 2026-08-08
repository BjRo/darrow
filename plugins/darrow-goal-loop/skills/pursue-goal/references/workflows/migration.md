# Migration

Use this workflow for a public contract, schema, dependency, format, or
consumer transition that cannot be safely completed as one isolated change.

## Sequence

1. Inventory affected consumers and compatibility constraints.
2. Define the transition sequence and rollback or coexistence boundary.
3. Apply the change in dependency order.
4. Update consumers, examples, and documentation.
5. Run compatibility checks and broader final-tree gates.

A migration is deep work unless the user explicitly pins another supported
route with sufficient authority.
