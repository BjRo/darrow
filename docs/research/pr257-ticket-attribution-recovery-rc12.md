# PR #257: Ticket attribution recovery on Sevro rc.12

Observed on 2026-10-15 in the `fix/pr257-validation` worktree, after checkpoint
`a5ab8f5a`.

The repaired `create-ticket-no-attribution` eval passes all four task checks and
implicit competition activation on native Codex. The retained trace demonstrates
actual recovery from an attribution rejection, rather than only omitting the
note before the first attempt.

## Repair

The create-ticket Skill now explicitly identifies
`error: AI attribution is not allowed in tickets` with exit 6 as local
title/body validation before provider resolution. It directs the candidate to
remove prohibited attribution from the same draft, retry the same item, preserve
the substantive request, and report the omission after creation.

TM-C7 records that distinction. Both plugin manifests advance to `0.7.3`.
The existing backend, diagnostic, exit code, participant prompt and four eval
checks are unchanged. Provider failures and uncertain creation effects retain
their stopping rules.

## Observed result

Published package `@bjoernrochel/sevro@0.1.0-rc.12`, with source overrides
cleared. Native Codex app-server, observed candidate `gpt-6.1-sol/medium`,
passive N=1, jobs=1, threshold=1, timeout 1,200,000 ms and retained diagnostics.
The configured semantic route is `gpt-6-luna/medium`; this case declares no
semantic-output checks.

- Run ID: `b0df83d8-9247-4e91-a1c5-f05a4e0bbc9a`.
- Task: passed, 4/4 checks.
- Activation: passed, with a complete native read of the current Skill body.
- Raw-response SHA-256: `59e1d1aa0553461b8d85f4d85b9c7b3978514df9b0ce095153203a4a4e42a2b1`.

The trace preserves this sequence, using zero-based native record ordinals:

1. Ordinal 35 submits a draft containing the requested attribution note.
2. Ordinal 39 returns exit 6 and the exact attribution diagnostic.
3. Ordinal 45 removes the attribution section from that same draft and retries
   the same title and body-file path.
4. Ordinal 50 returns exit 0 and fixture ticket `#99`, labelled `enhancement`.
5. The final response reports creation and explains that policy required
   omitting the attribution note.

The four unchanged checks verify ticket creation, no attribution in title/body,
no invented export requirements, and no attribution added through comments or
edits. GitHub operations use the isolated fixture provider.

The previous rc.12 failure remains retained at
`evals/results/pr257-eval-migration/rc12-create-ticket-no-attribution-selection.json`.
It passed only 1/4 checks after the candidate stopped at exit 6. This repair used
one fresh trial after a diagnosed Skill change; there was no unchanged-case
resampling. N=1 does not establish reliability, and native Claude was not tested.
Other cohort cases were not rerun.

## Evidence and checks

Private evidence remains under `evals/results/pr257-eval-migration/`:

- `rc12-create-ticket-attribution-recovery-v1-selection.json` points to the
  original trial and native transcript bundle.
- `rc12-create-ticket-attribution-recovery-summary.json` binds the response and
  bundle hashes, observed route, complete current Skill read, exact creation
  receipts, and case/Skill hashes.

Documentation, formatting and whitespace checks pass. No Python source,
tests, package metadata or locks changed.

The [eval development guidance](../eval-development.md) calls for a bounded
fresh-context review after stabilization. That review remains pending in the
main conversation because this side conversation prohibits subagent use.

## Reproduce

From the validation checkout, select fresh absolute output paths:

```bash
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN \
  bun evals/runner/run.ts --case create-ticket-no-attribution \
  --harness codex --codex-entrypoint app-server \
  --model gpt-6.1-sol --effort medium --owner-evaluation passive \
  --trials 1 --jobs 1 --threshold 1 \
  --semantic-check-model gpt-6-luna --semantic-check-effort medium \
  --results-root <new-absolute-result-directory> \
  --output <new-absolute-selection-json> \
  -- --codex-timeout-ms 1200000 --retain-host-diagnostics
```
