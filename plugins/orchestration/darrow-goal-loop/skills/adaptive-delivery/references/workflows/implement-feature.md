# Implement feature

Execute the selected new-feature contract through this sequence.

## Sequence

1. Establish the public contract and observable acceptance criteria.
2. Add acceptance evidence at a stable seam and run its focused check to
   confirm that the missing behavior fails for the intended reason.
3. Implement the smallest coherent vertical slice, rerunning the focused check
   after each slice until it passes.
4. Update affected callers, examples, and documentation.
5. Run the applicable final-tree checks for the new behavior and relevant
   existing behavior.
