# Codex reviewer-effort follow-up — October 30, 2026

Eight benchmark cells, one trial per historical case in both candidate tracks.
Original acceptance: **8/8 passed**. Native goals: **8/8 complete**.
Native usage captures: **8/8 complete**. One infrastructure-blocked
attempt was retained separately and replaced, giving nine paid attempts.

The main thread remains Sol 6.1/medium. Independent Codex review readers use
Sol 6.1/medium instead of xhigh, with a temporary admission exception in the
copied provider. Current implementation routing remains in effect. The eight
archived vanilla controls are reused; no new vanilla models ran.

The isolated Sevro 1.1.1 copy raises the cumulative app-server stream bound to
128 MiB, raw transcript capture and view bounds to 128 MiB, and encoded capture
to 192 MiB. The 30-minute native timeout remains. The installed package and
shipped reviewer catalog are unchanged. The first two Express cells use the
first frozen variant; the other six use a second snapshot that also makes
fixture-owned review storage private. Both manifests and all patch hashes are
retained in the machine-readable snapshot.

## All four tasks versus archived vanilla

Means per task. Tokens include parent and all retained delegates, counting each
session's final cumulative counters once. Costs are Standard API-equivalent
estimates using [official pricing](https://developers.openai.com/api/docs/pricing)
verified on 2026-10-30, not actual Codex charges. They cover participant
sessions, excluding experiment preparation and this analysis. Both reviewer
efforts use the same unit prices; estimates vary with observed usage.

| Track          | Condition     | Tasks | Mean wall | Mean tokens | Estimated cost/task |
| -------------- | ------------- | ----: | --------: | ----------: | ------------------: |
| implementation | vanilla       |     4 |    132.2s |     413,975 |              $0.187 |
| implementation | adaptive-goal |     4 |    485.9s |   4,645,859 |              $0.829 |
| delivery       | vanilla       |     4 |    176.0s |     764,488 |              $0.236 |
| delivery       | ticket-to-pr  |     4 |    649.3s |   6,094,186 |              $1.205 |

These remain different-assurance workflow comparisons. Vanilla implements,
tests and self-reviews in one context. Darrow can add readiness, routing,
independent review and bounded repair; both delivery conditions include Git,
PR publication through the isolated forge, and genuine required CI.

## Per-task outcomes

The old xhigh Click delivery attempt was host-aborted and unassessed.
Reader counts are observed independent reader sessions, including extra rounds
where selected; optional assurance remains optional.

| Track          | Task              | Original acceptance | Old xhigh wall | New medium wall | New tokens | Estimated new cost | Reader sessions |
| -------------- | ----------------- | ------------------- | -------------: | --------------: | ---------: | -----------------: | --------------: |
| implementation | express-links     | passed              |         342.7s |          534.2s |  4,615,680 |             $1.068 |               2 |
| implementation | click-streams     | passed              |        1094.1s |          524.5s |  6,063,675 |             $0.911 |               2 |
| implementation | ajv-instance-path | passed              |         400.5s |          355.3s |  3,856,187 |             $0.372 |               0 |
| implementation | go-git-insteadof  | passed              |         409.8s |          529.9s |  4,047,892 |             $0.965 |               2 |
| delivery       | express-links     | passed              |         546.2s |          481.9s |  3,989,926 |             $0.855 |               2 |
| delivery       | click-streams     | passed              |     unassessed |          998.0s | 10,182,180 |             $1.751 |               3 |
| delivery       | ajv-instance-path | passed              |         592.0s |          606.2s |  6,182,268 |             $1.279 |               2 |
| delivery       | go-git-insteadof  | passed              |         682.8s |          511.1s |  4,022,368 |             $0.937 |               2 |

## Previous xhigh versus medium

| Scope                            | Old xhigh mean wall | Medium mean wall | Medium / xhigh |
| -------------------------------- | ------------------: | ---------------: | -------------: |
| implementation, 4 assessed pairs |              561.8s |           485.9s |          0.87× |
| delivery, 3 assessed pairs       |              607.0s |           533.1s |          0.88× |

Token and cost comparisons below include only pairs with complete captures.
This excludes the old partial Click captures, independently of execution status.

| Scope                            | Old mean tokens | Medium mean tokens | Old estimated cost | Medium estimated cost |
| -------------------------------- | --------------: | -----------------: | -----------------: | --------------------: |
| implementation, 3 complete pairs |       3,467,775 |          4,173,253 |             $0.656 |                $0.802 |
| delivery, 3 complete pairs       |       6,230,027 |          4,731,521 |             $1.263 |                $1.024 |

Across 5 pairs with complete captures and readers in both
conditions, observed independent-reader spend averaged
**$0.143 at xhigh versus $0.086 at medium**.
Mean reader tokens were 284,912 versus
244,984. These reader totals include follow-up and
varying review work. Reader session durations overlap and cannot be added to
obtain workflow wall time.

Mean execution-cost attribution for the complete pairs uses distinct session
counters. Coordinator cost is verification plus review coordination; it is
observed work, not an estimate of removable overhead.

| Scope                   | Reviewer effort |   Main | Coordinators | Independent readers | Luna implementation |
| ----------------------- | --------------- | -----: | -----------: | ------------------: | ------------------: |
| implementation, 3 pairs | xhigh           | $0.332 |       $0.238 |              $0.072 |              $0.014 |
| implementation, 3 pairs | medium          | $0.399 |       $0.324 |              $0.067 |              $0.013 |
| delivery, 3 pairs       | xhigh           | $0.636 |       $0.452 |              $0.167 |              $0.008 |
| delivery, 3 pairs       | medium          | $0.576 |       $0.371 |              $0.077 |              $0.000 |

On the three complete implementation pairs, main-thread requests increased from
29 to 40 per task. Across all four implementation tasks the medium condition is
faster, but the other three pairs are 23% slower and 22% costlier in aggregate.
The overall improvement comes from Click, where this medium implementation
missed the defect that the previous xhigh workflow discovered and repaired.

## Quality and interpretation

The [supplemental Click probe](2026-10-30-review-medium-n1-click-probe.json) finds a concrete
difference beyond the original acceptance checks. Xhigh review caught a binary
<code>writelines</code> defect and the author repaired it. Both medium readers passed a
new implementation with the same defect class. Both archived vanilla sources
also miss that boundary. In the new delivery trial, a medium reader caught the
defect and another medium reader verified its repair; that source passes the
same probe. This demonstrates variable medium detection rather than a reliable
effort ranking. The probe reconstructs source identities from retained
diffs and checks them through public <code>CliRunner</code> behavior; the original checks
and verdicts remain unchanged.

This is N=1. Implementation routes, assurance selection, findings and repair
work can differ. The observer patch also removes a prior stopping condition.
The results do not isolate a causal reviewer-effort effect or establish equal
review quality. The targeted probe is post hoc, not a blind quality score or
a representative defect-detection rate.

## Excluded infrastructure attempt

The first medium Click implementation passed code acceptance but its goal was
blocked: fixture setup created review storage as 0755, while the backend requires
owner-only access. Independent readers never launched. After diagnosing this,
a fresh snapshot changed fixture setup to enforce 0700. The blocked attempt
used **443.8s, 5,109,566 tokens,
and $0.632 estimated API-equivalent cost**.
Those values remain outside valid-cell means and are preserved in JSON.

## Evidence

- [Results and variant hashes](2026-10-30-review-medium-n1.json)
- [Recovered native usage](2026-10-30-review-medium-n1-usage.json)
- [Supplemental Click probe](2026-10-30-review-medium-n1-click-probe.json)
- [Previous xhigh snapshot](2026-10-30-codex-n1.md)
- [Preparation and execution](../CURRENT-VALUE.md)

Raw Sevro results, transcripts, fixture CI receipts, copied callers and
reconstruction artifacts remain at the absolute paths recorded in the JSON.
