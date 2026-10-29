# Clean up Darrow evaluation attempts

Run from the Darrow checkout:

Before cleanup, stop all evaluation publishers for the selected root and check
that exported manifests or other external consumers no longer need the evidence
you plan to remove. This is required because legacy attempts record neither
publisher liveness nor exported output paths. Modification age cannot prove
that a runner has stopped.

```sh
bun run eval:prune
bun run eval:prune --results-root "$HOME/.darrow/my-campaign"
bun run eval:prune --results-root "$HOME/.darrow/my-campaign" --older-than 20m
bun run eval:prune --results-root "$HOME/.darrow/my-campaign" --older-than 1d --apply
```

The default root is `evals/results` under the current directory. Explicit roots
are resolved to absolute paths. Select one root per invocation; cleanup never
discovers other campaigns. Preview is the default. `--apply` prints its current
plan before deleting. The JSON plan shows `resultsRoot`, `cutoff`, every whole
attempt and matching root alias in `remove`, and paths and reasons in `preserve`.
Apply recomputes eligibility under the publication lock; an earlier preview is
not a frozen deletion plan. No age filter means **all eligible attempts**.

`--older-than` accepts positive finite decimal durations with `s`, `m`, `h`, `d`,
`w`, or `y`: for example `20m`, `1d`, `2d`, `1y`, or `0.5h`. One year is exactly
365 days. Values must fit JavaScript's safe integer range in milliseconds.
An attempt must be strictly older than the cutoff. An attempt exactly at the
cutoff remains. For attempts with `retention.json`, publication time is recorded
after the final manifest, optional output copy, and stdout publication. A long-running attempt
that just finished is recent regardless of its start time or nested Sevro age.
For legacy attempts without `retention.json`, age uses the newest modification
time across all files and directories in the attempt, including nested captures
and evidence. A recent nested write or directory change keeps the whole attempt.

Cleanup removes a selected `attempts/<id>/` directory as a unit, including all
case evidence, `cli-result.json` captures and the selection manifest. It never
prunes individual Sevro runs inside a retained attempt. The root
`selection-run.json` alias is removed only when it matches a removed attempt;
an alias for a retained attempt remains unchanged. Cross-attempt references pin
their targets. An exported `--output` recorded in retention metadata pins its
attempt, because its external consumers cannot be enumerated safely. There is no
automatic rewriting or deletion of exported files.

New selection attempts carry `retention.json`. Active attempts remain protected
through final publication. Terminal completed, failed, and interrupted attempts
are eligible. A crash before terminal publication leaves an active record that
cleanup preserves; cleanup does not infer that a PID has exited. Investigate
and archive those attempts separately. Legacy attempts are eligible by default
under the offline-cleanup prerequisite above. They must still have a valid
owned selection manifest and internally contained evidence. Cleanup does not
create terminal metadata or claim that legacy modification time proves final
publication.

Malformed or unsupported metadata, inconsistent root aliases, symlinks,
unreadable storage, and evidence references outside the owning attempt cause
preservation or refusal. Fix the named ambiguity before retrying. No external
evidence is deleted. Short SQLite transactions serialize attempt creation,
publication, planning and deletion. Preview may create `.retention.sqlite` for
coordination; it does not delete evidence. The OS releases transaction locks
when a process exits. Do not manually remove the coordination database while
callers or cleanup commands are running.

This command supports Darrow selection attempts. Suite and repository-guide
callers use exact-case Sevro invocations, whose storage and reports are outside
this retention scope. A root containing `suite-run.json` is preserved in full,
including any selection attempts mixed into it. These manifests therefore do
not acquire dangling references from cleanup. Sevro's own prune command remains
separate; its nested-root defect and archived evidence portability are outside
this command's contract. See the [retention invariants](../../docs/specs/evaluation-retention.md).
