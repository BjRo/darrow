# Ticketed delivery controller protocol

## Ticket boundary

Use an installed backend-neutral ticket-management capability to fetch the
exact ticket and explicitly replace its description. Detect both operations
before launching a child. Do not locate another plugin on disk and do not use
raw tracker-specific commands. A missing or failing operation is `blocked`.

The user's explicit invocation with one ticket identifier authorizes reads and
description replacements on that ticket only. Preserve every non-Factory byte
by transforming exported bodies with the bundled `delivery` command. Re-fetch
after each replacement and confirm the persisted Factory section matches the
candidate body before continuing.

## Child packet

Create a fresh child with no parent transcript. Give it only:

- absolute repository and current ticket-body snapshot paths;
- run ID, ticket ID, phase, iteration, stable child ID, and artifact output;
- rework mode (`review` or `qa_fix`) when the phase is `rework`;
- the exact phase skill name to invoke;
- write boundary (`read_only` or `local_worktree`);
- pre-existing working-tree status and base revision;
- time/invocation stopping budget;
- relevant prior artifact names already present in the ticket.

For harness-observable reconciliation, render these four packet identities as
exact single-line bullets (additional packet bullets may follow):

```text
- phase: <phase>
- iteration: <positive integer>
- stable_child_id: <stable child id>
- required skill: $<phase-skill-name>
```

Before spawning, transform and persist the current ticket with `delivery
launch`, including the stable child ID and harness/model/effort route. Re-fetch
and validate that in-flight record. Only then tell the child to read the phase skill and
`<phase-skill-dir>/../../config/phase-artifact.md`. Do not copy phase
instructions into the packet. Wait for the child, consume its artifact, and
close it before launching a dependent child. Treat a lost child, missing
artifact, or malformed artifact as an uncertain phase attempt: retain the
in-flight launch row, finish `needs_human` with that exact phase, and do not
execute or repeat the phase inline. A replacement controller treats any
persisted `in_progress` phase the same way.

## Loop decisions

Use `bash <skill-dir>/../../bin/delivery summary --body-file <snapshot>` after
every persisted artifact. Follow `next_phase` mechanically.

- `challenge:needs_revision`: launch the next refine iteration, up to three
  challenge attempts. The third unresolved challenge needs a human decision.
- `review:changes_requested`: launch one rework and a second fresh review. A
  second changes-requested verdict needs a human decision.
- `qa:failed`: launch one QA-focused rework and a second fresh QA. A second
  failure ends `failed` unless the artifact identifies a product decision, in
  which case it is `needs_human`.
- Any `needs_human`, `blocked`, or non-recoverable `failed`: stop. Do not launch
  downstream phases.

Never exceed the script's iteration limit by inventing another phase, child,
or inline retry.

## Result record

End with a concise human summary followed by one TSV record:

```text
format\tdarrow-delivery-result-v1
run_id\t<RUN_ID>
ticket\t<TICKET_ID>
status\t<OUTCOME>
phase\t<PHASE>\t<ITERATION>\t<STATUS>  # repeat
route\t<PHASE>\t<ITERATION>\t<HARNESS>\t<MODEL>\t<EFFORT>\t<CHILD_ID>  # repeat
changed_file\t<ABSOLUTE PATH>            # repeat
gate\t<NAME>\t<COMMAND>\t<STATUS>\t<EVIDENCE>  # repeat
review\t<STATUS>\t<EVIDENCE>
qa\t<STATUS>\t<EVIDENCE>
challenge_iterations\t<N>
review_iterations\t<N>
qa_iterations\t<N>
evaluation_child_invocations\t<N>
evaluation_human_interruptions\t<0 OR 1>
risk\t<TEXT>
next_action\t<TEXT OR none>
```

Use one record per observed item and absolute paths. Count actual child
launches, including failed or malformed attempts. Do not invent token or cost
figures. The final status must match the persisted ticket state.
