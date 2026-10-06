# Change feature

Execute the selected behavior-change contract through this sequence.

## Sequence

1. Characterize current behavior, compatibility constraints, and consumers,
   and run focused evidence for the current boundary.
2. Update acceptance evidence for the approved new behavior and confirm its
   focused check fails for the intended contract change.
3. Implement the change without silently widening its scope, rerunning the
   focused check after each coherent slice.
4. Update affected callers, examples, and documentation.
5. Run final-tree checks for both the new boundary and any compatibility
   behavior that remains.
