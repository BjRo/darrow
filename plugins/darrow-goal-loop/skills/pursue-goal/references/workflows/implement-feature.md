# Implement feature

Use this workflow when the request introduces observable behavior with no
existing equivalent.

## Sequence

1. Establish the public contract and observable acceptance criteria.
2. Add acceptance evidence at a stable seam.
3. Implement the smallest coherent vertical slice.
4. Update affected callers, examples, and documentation.
5. Verify the new behavior and relevant existing behavior.

Do not infer missing product choices. If a required behavior or authority is
materially unspecified, select `decision-gated`.
