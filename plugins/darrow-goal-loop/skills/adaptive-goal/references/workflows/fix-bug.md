# Fix bug

Execute the selected bug-fix contract through this sequence.

## Sequence

1. Reproduce the failure at the narrowest stable public seam.
2. Establish the cause before changing production behavior.
3. Add regression evidence and run its focused check to confirm it fails for
   the diagnosed reason.
4. Make the smallest complete fix while preserving adjacent behavior, rerunning
   the focused check after each coherent slice.
5. Run the reproducer, affected tests, and repository scoped gate against the
   final tree.
