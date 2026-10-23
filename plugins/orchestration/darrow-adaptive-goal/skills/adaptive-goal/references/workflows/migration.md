# Migration

Execute the selected sequenced transition through this sequence.

## Sequence

1. Find the current public entrypoints and their callers. Map each acceptance
   criterion to that existing entrypoint, including persisted-record conversion,
   readers and writers. Preserve existing import paths unless the authorized
   transition explicitly changes them.
2. Define the transition sequence and rollback or coexistence boundary.
3. Check each transition boundary through its existing public entrypoint, then
   apply the change in dependency order and rerun that check after each slice.
   A new parallel implementation and tests importing only that new location do
   not update the existing callers. If implementation moves, retain a compatible
   forwarding entrypoint and test that original import too.
4. Update consumers, examples, and documentation.
5. Run compatibility checks and broader final-tree gates.
