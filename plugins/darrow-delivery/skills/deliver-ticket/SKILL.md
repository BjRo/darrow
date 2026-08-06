---
name: deliver-ticket
description: Run one existing engineering ticket through a durable, ticket-backed multi-agent delivery pipeline with refine/challenge, implementation, review/rework, QA/fix, and codify phases. Invoke only when the user explicitly names or selects deliver-ticket and supplies one ticket identifier; never trigger it implicitly because it launches several agents, edits the working tree, and rewrites Factory-owned sections of the ticket description.
---

# Deliver ticket

Act only as the non-implementing controller. Read
`references/controller-protocol.md` completely before starting. Delegate every
phase to a fresh child that explicitly invokes the matching skill; never do a
phase inline.

## Preflight

1. Require exactly one ticket identifier and an absolute Git repository path.
2. Detect a backend-neutral ticket capability that can fetch that exact ticket
   and explicitly replace its description. Do not assume another plugin is
   installed, inspect another plugin's files, or use raw tracker commands.
   Stop `blocked` before product writes when either operation is unavailable.
3. Fetch the open ticket. Require a concrete outcome and observable done
   criteria. Materially ambiguous behavior is `needs_human` before children.
4. Record `git rev-parse HEAD` and export
   `git status --porcelain=v1 -z --untracked-files=all` plus content hashes,
   modes, and index entries for every reported path to the baseline file.
   Encode each NUL-delimited record into a printable single-line form before
   persistence; if the filename-safe baseline cannot be captured, stop before
   a writer. Treat all existing changes as user-owned, prohibit writers from
   touching those paths, and pass the persisted baseline to every writer.
5. Locate the bundled mechanic relative to this file:

   ```sh
   skill_dir=<absolute directory containing this SKILL.md>
   delivery="$skill_dir/../../bin/delivery"
   ```

6. Export the fetched description to a private temp file outside the repo.
   If it has no `## Factory Run`, initialize it with `bash "$delivery" init
   --baseline-file <baseline>`, persist the candidate description through the
   ticket capability, then re-fetch and verify it. If it has an active run,
   use `summary`, which reconciles the phase table, launch ledger, and artifact
   headers before returning a route. A completed run is reported, not
   repeated; contradictory state is blocked. An `in_progress` phase means a
   prior controller may have lost contact after launching a child. Finish
   `needs_human` without repeating that phase, especially a writer.
   For an active run, require its persisted `repository` to byte-match the
   requested absolute path and its `base_revision` to equal the current HEAD.
   A mismatch is `blocked`; never route a resumed writer into another tree.

The local working tree plus Factory-owned description updates on the named
ticket are the entire mutation boundary. Do not branch, commit, push, open or
edit a pull request, merge, release, deploy, change ticket status/fields, or
touch another external object without separate user authority.

## Run phases

Use the protocol's child packet. Pin a stable child ID, record harness/model/
effort, wait without inventing an ad hoc timeout, and close the child after
consuming its artifact.

For each `next_phase`, select exactly this skill and boundary:

| Phase | Skill | Boundary |
| --- | --- | --- |
| refine | `$refine-ticket` | read-only product tree |
| challenge | `$challenge-ticket` | read-only product tree |
| implement | `$implement-ticket` | local working tree |
| review | `$review-ticket` | read-only product tree |
| rework | `$rework-ticket` | local working tree |
| qa | `$qa-ticket` | read-only product tree |
| codify | `$codify-ticket` | read-only product tree and guidance |

Before launching every child:

1. Assign its stable ID and exact harness/model/effort route.
2. Run `bash "$delivery" launch` for the phase and iteration.
3. Persist the candidate description, re-fetch it, and require `summary` to
   show the phase as `in_progress` before actually launching the child. This
   durable intent record is mandatory and prevents a replacement controller
   from replaying an uncertain writer.

After every child:

1. Require the artifact at the packet's absolute output path.
2. Re-fetch the current ticket body to prevent overwriting concurrent human
   edits.
3. Run `bash "$delivery" record` with the current body and artifact.
4. Replace the description with the candidate through the ticket capability.
5. Re-fetch, compare Factory-owned bytes, then run `summary` for the next
   phase. A persistence mismatch is `blocked`.

A lost child or missing/malformed artifact is not passed to `record`. Preserve
the already-persisted launch row, finish `needs_human` with the exact uncertain
phase and decision, and do not replay it. The escalation plus launch row is the
durable failed-attempt record.

Apply only the bounded loop decisions in the controller protocol. At most one
write-capable child may exist at once. A child that reports an overlap with
pre-existing user work, a destructive operation, missing authority, or a
security/privacy/product choice causes `needs_human`; do not guess.

## Finish

For `verified`, run `bash "$delivery" finish --status verified`, persist and
re-fetch the description, and require the final ticket to show approved
challenge/review, passed QA, and codify evidence. For `needs_human`, write the
smallest decision to a reason file and finish with `--reason-file`. Finish
other terminal outcomes honestly.

Report the result record from the controller protocol. `verified` means the
latest tree—not an earlier child state—satisfies every criterion and applicable
gate, every baseline path still has its recorded content/mode/index fingerprint,
every launched child has an artifact or escalation, and the ticket persisted
the verified state.
