# Ticket pipeline controller protocol

Use this protocol for one `deliver-ticket` run. It owns the fragile mechanics;
do not restate or vary them in child packets.

## 1. Ticket and user-work boundary

Use an installed backend-neutral ticket-management capability to fetch exactly
the named ticket and explicitly replace its description. Detect both operations
before launching a child. Do not locate another plugin on disk or use raw
tracker-specific commands. A missing or failing operation is `blocked`.

Explicit invocation authorizes reads and description replacements on that
ticket only. Preserve every byte outside headings beginning `## Ticket
Pipeline` by transforming exported bodies with the bundled mechanic. After
each replacement, re-fetch into a new snapshot, compare all pipeline-owned
bytes with the candidate, then validate it with `summary`. Never continue from
the unconfirmed candidate.

Require UV and Python 3.10–3.13 on macOS, Linux, or native Windows. Resolve
the contained package without assuming the current directory:

```sh
skill_dir=<absolute directory containing deliver-ticket/SKILL.md>
backend="$skill_dir/../../backend"
```

Invoke every operation as `uv run --quiet --frozen --no-dev --project <absolute-backend> darrow-ticket-pipeline <operation> ...`.
The examples below use POSIX shell continuation syntax; on PowerShell pass the
same argument vector on one line. Always use the frozen package invocation;
there is no shell launcher or global installation requirement.

Keep exported ticket bodies, candidate replacements, artifacts, baseline data,
and reason files in private temporary storage outside the repository. Pass only
absolute paths to model-facing packets and mechanics.

### User-work baseline

Before initialization, record `git rev-parse HEAD` and the exact bytes from
`git status --porcelain=v1 -z --untracked-files=all`. Convert every
NUL-delimited status record and filename to a printable, reversible single-line
encoding before placing it in the baseline file. For every reported path,
record:

- its encoded status and path;
- worktree existence, content hash, and mode;
- the complete index entry or an explicit absent marker.

Handle rename/copy source paths and destinations separately. Refuse unreadable
paths or a lossy encoding. Writers receive the persisted baseline and must not
touch any listed path. Before a verified finish, recapture the same evidence
and require every recorded content, mode, and index fingerprint to match; do
not clean, reset, restore, stage, unstage, or hide user work to make it match.

### Initialize or reconcile

Fetch the ticket description into a private snapshot. If it has no reserved
pipeline heading, initialize it with:

```sh
uv run --quiet --frozen --no-dev --project "$backend" darrow-ticket-pipeline init --body-file <snapshot> --run-id <safe-stable-id> \
  --repo <absolute-repository> --base-revision <HEAD> \
  --baseline-file <baseline> --output <candidate>
```

Replace, re-fetch, compare, and validate as described above. For an existing
run, call `summary` on the re-fetched body. A repository byte mismatch, base
revision mismatch, malformed state, orphaned artifact, or contradictory ledger
is `blocked`. A completed run is reported without replay. A surviving
`in_progress` attempt is `needs_human`, because its effects are uncertain.

## 2. Child packet and lifecycle

Create a fresh child with no parent transcript. Include only:

- absolute repository, current ticket snapshot, and artifact-output paths;
- run ID, ticket ID, phase, iteration, and stable child ID;
- exact required phase skill;
- rework mode (`review` or `qa_fix`) only for rework;
- write boundary (`read_only` or `local_worktree`);
- base revision and persisted pre-existing-work baseline;
- relevant prior artifact names already present in the ticket;
- time/invocation stopping budget.

Render these four identities as exact single-line bullets; additional bounded
packet bullets may follow:

```text
- phase: <phase>
- iteration: <positive integer>
- stable_child_id: <stable child id>
- required skill: $<phase-skill-name>
```

Do not copy phase instructions, the parent transcript, broad repository
content, hidden reasoning, credentials, or environment values into the packet.
Tell the child to read its named skill and the shared phase-artifact contract.

### Launch before effect

Before spawning the child:

1. Choose and pin its stable ID and actual harness/model/effort route.
2. Transform the current re-fetched body with `darrow-ticket-pipeline launch`.
3. Replace the description, re-fetch it, compare pipeline-owned bytes, and run
   `summary`.
4. Require the exact phase and iteration to be `in_progress`; only then spawn.

Wait for the child without an invented timeout. At most one write-capable child
may be active. Close every child after consuming its result and before any
dependent launch.

### Consume one artifact

After the child exits:

1. Require exactly one artifact at its absolute packet output path.
2. Re-fetch the ticket description to incorporate concurrent human edits.
3. Run `darrow-ticket-pipeline record` with that body and artifact.
4. Replace the description through the ticket capability.
5. Re-fetch, compare pipeline-owned bytes, and run `summary` on the persisted
   result.

The mechanic validates run, phase, iteration, child ID, status, and artifact
shape. Do not repair semantic findings in the controller. Do not pass a lost,
missing, or malformed artifact to `record`; retain the already-persisted launch
row, finish `needs_human` with the uncertain phase, and never repeat or execute
it inline.

## 3. Bounded state transitions

Use `uv run --quiet --frozen --no-dev --project "$backend" darrow-ticket-pipeline summary --body-file <re-fetched-snapshot>` after every
persisted artifact and follow `next_phase` mechanically.

- `challenge:needs_revision` launches the next refine iteration, up to three
  challenge attempts. The third unresolved challenge needs a human decision.
- `review:changes_requested` launches one rework and a second fresh review. A
  second changes-requested verdict needs a human decision.
- `qa:failed` launches one `qa_fix` rework and a second fresh QA. A second
  failure ends `failed` unless the QA artifact identifies a product decision,
  in which case it ends `needs_human`.
- Any `needs_human`, `blocked`, or non-recoverable `failed` result stops the
  pipeline before downstream phases.

Never exceed the mechanic's limit by inventing another phase, child, inline
retry, or reinterpretation of a phase status.

## 4. Finish and result record

Use `darrow-ticket-pipeline finish` with the honest terminal status. For
`needs_human`, supply a reason file containing only the exact decision,
evidence, and smallest next action. Persist, re-fetch, compare pipeline-owned
bytes, and validate the final body. The final status must match the persisted
ticket state; only a pre-initialization failure lacks such state.

End with a concise human summary followed by this TSV record, using one line
per observed item and absolute paths:

```text
format	darrow-ticket-pipeline-result-v1
run_id	<RUN_ID OR none before initialization>
ticket	<TICKET_ID>
status	<verified|needs_human|blocked|failed|budget_exhausted>
phase	<PHASE>	<ITERATION>	<STATUS>  # repeat when launched
route	<PHASE>	<ITERATION>	<HARNESS>	<MODEL>	<EFFORT>	<CHILD_ID>  # repeat when launched
changed_file	<ABSOLUTE PATH>            # repeat when changed
gate	<NAME>	<COMMAND>	<STATUS>	<EVIDENCE>  # repeat when applicable
review	<STATUS OR not_run>	<EVIDENCE>
qa	<STATUS OR not_run>	<EVIDENCE>
challenge_iterations	<N>
review_iterations	<N>
qa_iterations	<N>
evaluation_child_invocations	<N>
evaluation_human_interruptions	<0 OR 1>
risk	<TEXT OR none observed>
next_action	<TEXT OR none>
```

Count actual child launches, including lost and malformed attempts. Count a
human interruption only when the run requires a new user decision. Do not
invent costs, tokens, checks, routes, files, or phase outcomes. For a failure
before initialization, use `run_id	none`, omit phase/route/file/gate records,
use `not_run` for review and QA, and set every count to zero.
