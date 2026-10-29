# Evaluation attempt retention

- **ER-C1 — Explicit whole-attempt cleanup.** `bun run eval:prune
[--results-root <root>] [--older-than <duration>] [--apply]` previews cleanup
  of Darrow selection attempts. The default root is `evals/results` under the
  current directory. No age filter means all eligible attempts. Apply prints
  the same roots, attempt paths, and dependent aliases before deletion.
- **ER-C2 — Retention age.** For attempts with retention metadata, age is measured
  from the latest completed publication, never attempt creation or Sevro's nested
  run timestamp. For legacy attempts without retention metadata, use the newest
  modification time of every file and directory in the attempt. The
  cutoff is exclusive. Durations are positive finite decimal quantities with
  `s`, `m`, `h`, `d`, `w`, or `y` (365 days); malformed or overflowing values
  fail before changes.
- **ER-C3 — Ownership and consistency.** Attempts with supported terminal
  Darrow retention metadata or legacy attempts without that metadata are eligible
  only with valid ownership and internally contained evidence.
  Preserve active, crashed, malformed, symlinked, externally referenced,
  or otherwise ambiguous storage. Retention records must confirm terminal
  publication even for failed/interrupted attempts. Remove the root selection alias
  only when it names a removed attempt. Recorded exported output copies pin
  attempts. Legacy attempts do not record final publication or exports; before
  cleanup, operators must stop publishers for the selected root and check that
  no exported manifests or other external consumers need the selected evidence.
- **ER-C4 — Concurrent publication.** Attempt creation, publication and cleanup
  share an OS-released transaction lock. Legacy publishers do not participate in
  this lock; modification age is not a liveness test. Active attempts with
  retention metadata remain protected during evaluation and final output
  publication. A crashed active attempt stays
  protected until an operator investigates it; cleanup never guesses liveness.
  Cleanup does not follow symlinks or recursively discover arbitrary campaign
  roots. Exact-case suite and guide Sevro storage is outside this entrypoint;
  retained suite/guide manifests and their evidence remain untouched.
