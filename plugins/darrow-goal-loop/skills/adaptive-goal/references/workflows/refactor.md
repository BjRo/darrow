# Refactor

Execute the selected behavior-preserving restructuring through this sequence.

## Sequence

1. Characterize the behavior that must be preserved and run its focused check
   to establish a passing baseline.
2. Restructure in bounded, reviewable slices, rerunning the focused check after
   each slice.
3. Keep behavior changes out of the refactor.
4. Prove unchanged behavior at stable public seams.
5. Run the affected repository gates against the final tree.
