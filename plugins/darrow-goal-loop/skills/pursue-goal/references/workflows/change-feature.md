# Change feature

Use this workflow when approved behavior changes an existing public or
consumer-visible contract.

## Sequence

1. Characterize current behavior, compatibility constraints, and consumers.
2. Update acceptance evidence for the approved new behavior.
3. Implement the change without silently widening its scope.
4. Update affected callers, examples, and documentation.
5. Verify both the new boundary and any compatibility behavior that remains.

Use `migration` instead when consumers, schemas, or dependencies require a
sequenced transition rather than one bounded behavior change.
