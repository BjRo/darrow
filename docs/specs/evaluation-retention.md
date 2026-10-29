# Evaluation attempt retention

- **ER-C1 — Explicit whole-attempt cleanup.** `bun run eval:prune
[--results-root <root>] [--older-than <duration>] [--apply]` previews cleanup
  of Darrow selection attempts. The default root is `evals/results` under the
  current directory. No age filter means all eligible attempts. Apply prints
  the same roots, attempt paths, and dependent aliases before deletion.
- **ER-C2 — Publication age.** Age is measured from the latest completed
  publication, never attempt creation or Sevro's nested run timestamp. The
  cutoff is exclusive. Durations are positive finite decimal quantities with
  `s`, `m`, `h`, `d`, `w`, or `y` (365 days); malformed or overflowing values
  fail before changes.
- **ER-C3 — Ownership and consistency.** Only attempts with supported terminal
  Darrow retention metadata and internally contained evidence are eligible.
  Preserve active, legacy, crashed, malformed, symlinked, externally referenced,
  or otherwise ambiguous storage. Preserve failed/interrupted attempts unless
  their publisher reached terminal publication. Remove the root selection alias
  only when it names a removed attempt. Exported output copies pin attempts.
- **ER-C4 — Concurrent publication.** Attempt creation, publication and cleanup
  share an OS-released transaction lock. Active attempts remain protected during
  evaluation and final output publication. A crashed active attempt stays
  protected until an operator investigates it; cleanup never guesses liveness.
  Cleanup does not follow symlinks or recursively discover arbitrary campaign
  roots. Exact-case suite and guide Sevro storage is outside this entrypoint;
  retained suite/guide manifests and their evidence remain untouched.
