# Recover review evidence

Read the applicable branch when route selection, input preparation, reader
launch or returned evidence fails. Preserve the actual command/path and diagnostic.
An availability problem is an evidence gap, not a product finding.

## Selected route already unavailable

When the host or requester reports the selected route unavailable before reader
preparation, keep zero launch attempts, including probes. Save the blocked report:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result block-route \
  --manifest "$manifest" --route-record '<run>/reviewer-route.json' \
  --reason '<exact reported unavailability>' --spec-source '<originating source or not_available>' \
  [--check '<captured check record>' ...] [--no-checks-reason '<why none applies>'] --present
```

Pass every captured check or explain why none applies. For repair verification,
replace `--spec-source` with `--original "$original_input"`. Present the retained
report and exit. This shortcut refuses prepared inputs; preserve partial reader
evidence through the later-failure branch instead.

## Preparation error

For a mistyped argument, correct it from the retained authoritative path and
revalidate the same evidence before launch. Keep scope, route and required
evidence fixed; a guessed replacement path cannot resolve genuinely missing input.
For a persistent gap, use [result-protocol.md](result-protocol.md) to retain the
blocked assessment.

## Launch or capture failure

Bind a delegation refusal to the actual higher-priority prohibition, absent
native tool or returned error. The main skill's explicit delegation request
satisfies a host rule permitting skill-requested readers.
When launch first reveals unavailability, stop further launches and keep any
completed axis evidence. A child without an accepted ID cannot be waited on.
Keep selected/observed route records and bind the affected comprehensive axis
as `blocked`, or the fix-axis gap under `evidence_gaps`.

Use exceptional finalization in [result-protocol.md](result-protocol.md) for
unavailable readers or capture failures, preserving every supported finding and
actual evidence gap. A failed capture records the capture error, without claiming
that the requested check ran. Coordinator judgment and substitute routes cannot
replace independent evidence.

## Invalid reader input or result

For an input-read error or invalid returned record, follow the one diagnostic-only
correction in [reader-inputs.md](reader-inputs.md). It continues the same bound
reader, with the same route, scope and evidence. Persistent invalidity or
unavailable continuation stays blocked; a product finding never triggers correction.
