# Workflow and risk held-out calibration — 2026-08-08

Status: **exploratory, N=1, not decision-bearing**

This calibration compares raw Codex native goal mode, workflow-only Darrow
preflight, and workflow-plus-risk Darrow preflight on three held-out,
human-authored OSS repositories. The workflow playbooks were written before
these tasks were selected. The corresponding machine-readable record is
[`2026-08-08-workflow-risk-heldout-n1.json`](2026-08-08-workflow-risk-heldout-n1.json).

## Corpus and controls

| Task shape  | Snapshot                     | Raw / implementation route |
| ----------- | ---------------------------- | -------------------------- |
| Bug fix     | Requests 2.25.1 at `c2b307d` | `gpt-5.6-sol` / `medium`   |
| New feature | Commander 7.2.0 at `327a3dd` | `gpt-5.6-sol` / `high`     |
| Refactor    | Cobra 1.1.3 at `8380ddd`     | `gpt-5.6-sol` / `medium`   |

Every revision predates public GitHub Copilot availability. Each comparison
cell received the same task, repository guidance, setup, and hidden checks. A
route guard rejected any Darrow selection that did not match the corresponding
raw implementation route.

No quality judge was run. All nine valid cells passed their deterministic
hidden behavior and focused upstream checks.

## Results

| Mode            | Pass | Mean time | Mean tokens | Delta vs raw time | Delta vs raw tokens |
| --------------- | ---: | --------: | ----------: | ----------------: | ------------------: |
| Raw native goal |  3/3 |    322.6s |   1,340,257 |                 — |                   — |
| Workflow        |  3/3 |    327.8s |   1,291,222 |             +1.6% |               −3.7% |
| Workflow + risk |  3/3 |    429.0s |   1,623,755 |            +33.0% |              +21.2% |

Per-case totals:

| Case      |            Raw |       Workflow | Workflow + risk |
| --------- | -------------: | -------------: | --------------: |
| Requests  | 355.8s / 1.21M | 337.9s / 1.13M |  400.2s / 1.70M |
| Commander | 308.7s / 1.81M | 418.1s / 2.08M |  585.4s / 2.13M |
| Cobra     | 303.2s / 1.01M | 227.5s / 0.66M |  301.3s / 1.04M |

Workflow selection was correct for all held-out shapes: `fix-bug`,
`implement-feature`, and `refactor`. Workflow-only forced `routine` risk.
Workflow-plus-risk selected `elevated`, `high`, and `elevated`, respectively.

## Execution-log audit

The reviewed app-server logs, not model self-report, establish that:

- every Darrow cell used one structured classifier response and zero classifier
  tool calls;
- every selected implementation model and effort matched the effective route;
- every selected workflow was loaded on the receiving execution turn;
- the recorded SHA-256 values matched the bundled `fix-bug`,
  `implement-feature`, and `refactor` Markdown files;
- every Darrow run used a host-API boundary with zero Darrow child sessions and
  zero human interruptions;
- harness cumulative usage includes cached input and is therefore much larger
  than token counts sometimes claimed in final model prose. The harness values
  above are authoritative.

The initial Requests workflow-only run is excluded. Its Markdown condition
contained the characters `\t`, so the adapter defaulted the recorded stage to
`workflow-risk`, although the prose still caused routine-risk behavior. The
corrected rerun used a real tab and recorded `dimensionStage: workflow`. The
marker is now in a fenced block so Prettier preserves the tab, with a regression
test rejecting the escaped form.

Log review also found that the suite inherited `Terra/medium` for the
classifier rather than the intended `Terra/low`, and phase timing omitted a
short first native execution turn. Both were corrected after the aggregate.
A separate Requests verification, excluded from the aggregate, proved the
final configuration used `Terra/low` for one classifier response and
`Sol/medium` for implementation, loaded the correct workflow hash, and passed
all checks. It took 535.6s and 2.81M harness tokens, further demonstrating large
single-trial variance.

## Bounded conclusion

Workflow-only preflight is approximately neutral in this small calibration:
one task improved substantially, one regressed, and one was close to raw. It
does not yet demonstrate a quality advantage, but it also does not show a
consistent aggregate efficiency penalty.

The risk dimension did not improve the observed pass rate and added about 31%
wall time and 26% tokens over workflow-only. On this evidence, workflow+risk
should not become the default. Do not spend on N=3 replication until the risk
gate or the corpus includes cases where proportional verification can actually
prevent an escaped defect; otherwise the experiment only measures additional
test activity on already passing solutions.

The technical reference dimension remains removed. The retained workflow
documents are independently evolvable playbooks under
`references/workflows/`, not a third composable selection dimension.

## Limitations

- N=1 cannot promote or reject a default; the repository specification still
  requires at least three trials for a decision-bearing cell.
- There is no blind quality score or provider cost.
- The aggregate classifier used `Terra/medium`; the corrected `Terra/low`
  configuration has one separate route-verification run only.
- Raw run bundles are gitignored and large. This reviewed snapshot preserves
  the reproducible inputs, per-cell totals, route selections, workflow hashes,
  exclusions, and conclusions needed by future agent runs.
