# Prepare a reader input

The coordinator selects authoritative material; the helper binds its complete
contents, scope, checks, schema and axis instructions. Readers own judgment.

Prefer the main skill's intent-level `--source`, `--objective`, `--check` and
`--no-checks-reason` inputs. They use the same validation without a context file.
Do not combine those inputs with `--context`. For a repair handoff,
`--attempted-from-input` copies its explicit attempted original keys for this
axis and refuses unknown or duplicate keys. It never treats a regression key
as an original finding or assumes that every original finding was attempted.
A regression-only follow-up with no attempted originals keeps that list empty.

When a context file is useful, write one JSON per applicable axis beneath the current private run:

```json
{ "sources": ["/absolute/repository/AGENTS.md"] }
```

```json
{
  "sources": [],
  "objective": "The originating request and acceptance criteria"
}
```

Paths must be absolute, readable and nonempty. Never include the other axis's
analysis. In fix verification, add `"attempted": ["supplied stable key"]` and
pass the authoritative `original_input`; the helper copies original findings
and carried regressions rather than asking you to transcribe them. Include
needed source material separately from finding citations.

Pass every relevant captured check through `--check`. When none applies,
include an explicit context check instead:

```json
{
  "sources": [],
  "checks": [
    {
      "command": "none",
      "applicability": "not_applicable",
      "status": "not_applicable",
      "evidence": "Why no configured check applies"
    }
  ]
}
```

Authored applicable check entries are refused. Prepare each input:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result prepare-reader \
  --manifest "$manifest" --axis <standards|spec> --context "$axis_context" \
  [--check "$check_record" ...] [--original "$original_input"] \
  [--route-record '<run>/reviewer-route.json']
```

On Codex, supply the selected `--route-record` to receive the complete `launch`
argument object. Pass all its fields unchanged to `collaboration.spawn_agent`;
it includes explicit model/effort, fresh context, an axis task name unique to
this run, and the complete message. This object describes a request, not native
acceptance. The response also supplies `reader_record` and a shell-quoted
`confirm_command`; replace only its accepted-child-ID placeholder after actual
native acceptance. Claude uses the returned `message` and its route reference.
The message contains the exact `read-reader` command, which revalidates
bound sources, scope, checks and instructions before supplying them directly to
the reader. The helper resolves the Standards baseline. Do not reconstruct
resource paths, fill an axis template, or append conversation history.
Changed, unavailable or mismatched input blocks before judgment; preserve the
actual path/command and diagnostic. Availability errors are evidence gaps,
never product findings.

Save the returned reader JSON unchanged beneath this run. Finalization validates
it and its current bound inputs. A genuine product finding needs no correction.

## One diagnostic correction

For an input-read error or invalid returned record, keep the failed record and
its exact diagnostic. After confirming the accepted child's route, request:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result reader-feedback \
  --input "$reader_input" --agent-id '<same accepted child ID>' \
  --error '<exact read or validation diagnostic>'
```

The helper revalidates input/route, permits one correction and returns the same
child ID plus a diagnostic-only message. Send it unchanged through Codex
`followup_task(target=returned ID)` or Claude `SendMessage(to=returned ID)`.
Wait for that exact child and save the corrected record separately. Never add
a desired finding/verdict, new scope or other-axis reasoning.

Keep initial acceptance evidence and validate the corrected record through the
same gates. On Claude reverify the continued child's transcript route using new
observed/application filenames as described in [claude-readers.md](claude-readers.md).
Unavailable continuation, changed route/input, or another invalid record blocks
that axis; no replacement reader or second correction is permitted.
