# Localized Terra versus Luna routing — 2026-08-19

Status: **matched N=3 evidence accepted for the localized Codex defaults**

This experiment compares Terra and Luna at the same effort on two dissimilar,
fully specified localized JavaScript tasks. Every cell used the same prompts,
fixtures, hidden checks, native-goal condition, runner revision, Codex CLI, and
three trials per case. The model is the isolated routing intervention.

## Outcome

All 24 trials passed every repository check. There were no escaped defects,
human interruptions, or child invocations.

| Effort | Route | Passed | Total wall | Mean per trial | Host-reported tokens |
| ------ | ----- | -----: | ---------: | -------------: | -------------------: |
| medium | Terra |    6/6 |     452.2s |          75.4s |            1,997,968 |
| medium | Luna  |    6/6 |     386.3s |          64.4s |              927,725 |
| high   | Terra |    6/6 |     524.6s |          87.4s |            1,858,586 |
| high   | Luna  |    6/6 |     524.3s |          87.4s |              983,788 |

At medium effort, Luna reduced aggregate wall time by **14.6%** and reported
tokens by **53.6%**. At high effort, aggregate wall time was effectively equal
at **-0.05%**, while reported tokens were **47.1%** lower.

The per-case high-effort latency result was mixed: Luna was 9.9% faster on the
Retry-After parser and 19.7% slower on stable-version validation. The aggregate
therefore supports cost-oriented promotion, not a claim that Luna/high is
consistently faster.

## Pricing interpretation

The runner did not report provider cost or cached-input tokens, so this snapshot
does not reconstruct a dollar total. As of 2026-08-19, OpenAI lists Luna at
$0.20 input, $0.02 cached input, and $1.20 output per million tokens, versus
Terra at $2.00, $0.20, and $12.00 respectively. Luna's unit rates are therefore
10 times lower in every reported category.

Sources: [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and
[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Some cumulative session input totals exceed the published long-context pricing
threshold, but the runner does not expose per-request prompt lengths, cache
reads, or cache writes. Exact metered cost would therefore be misleading.

## Decision

Promote the two localized Codex defaults:

- `routine`: Terra/medium to Luna/medium;
- `routine-plus`: Terra/high to Luna/high.

Keep `scaled` on Terra/medium, `repo-wide` on Terra/high, and `judgment` on
Sol/high. This experiment did not test those profiles, so it provides no basis
for changing them.

## Post-promotion policy validation

A separate N=1 suite then ran the installed adaptive preflight through the
Codex app-server host API. An unambiguous mechanical task selected
`routine` / Luna/medium, and an unambiguous localized quality-sensitive feature
selected `routine-plus` / Luna/high. Both implementations passed every hidden
check and emitted matching selected and effective routes with `route_verified`
`true`, zero child invocations, zero interruptions, and no escaped defects.

This validates policy selection and application after promotion; it is not part
of the matched Terra-versus-Luna quality comparison.

## Provenance

- Cases: `orchestration-routing-localized-retry-after` and
  `orchestration-routing-localized-version`.
- Harness: Codex native goal, `codex-cli 0.148.0`.
- Runner revision: `3df838e8f79b85727e54229940fd0ef285050d65` with the
  two experiment cases present as uncommitted additions.
- Trial order: Terra/medium, Luna/medium, Terra/high, Luna/high; cases ran in
  Retry-After then version order within each cell.
- No failed live trial was replaced or rerun.
- Post-promotion host-API validation result:
  `evals/results/localized-routing-policy-live/codex-adaptive-policy.json`
  (SHA-256 `c6d0dae92b3f011a8c2c3d8c194a7c9c15961deda1c2eeafdc659323072b04c0`).
- The raw result files remain gitignored. Their paths and SHA-256 digests are in
  the machine-readable companion snapshot.

## Limitations

- N=3 per case is evidence for a routing default, not a stable population
  estimate.
- Both tasks are synthetic localized JavaScript changes; no held-out OSS task
  was included.
- Cells ran sequentially rather than in randomized or alternating order.
- Quality was assessed by deterministic hidden behavior checks, not a blind
  model judge or human review.
- Host token totals are cumulative and do not separate cached input, cache
  writes, or per-request long-context pricing.
- The high-effort latency result varies by case and should be recalibrated on a
  broader localized corpus.
