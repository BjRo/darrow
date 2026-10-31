# Retained implementation comparison — October 30, 2026

The strongest observed differences concern API boundaries, serialization and test
integration. These runs do not show a consistent improvement in core algorithms
from adding orchestration or increasing reviewer effort.

This comparison covers vanilla implementation and delivery, Adaptive Goal with
xhigh and medium readers, and Ticket to PR with xhigh and medium readers. There
are 24 attempts across four tasks; 23 were assessed. The host-aborted xhigh Click
delivery remains partial evidence. No new model trials were run.

## Express: convergent implementation, different assurance

All retained variants use the existing map-and-join serializer. They reject
unsafe relation and target characters and escape quotes and backslashes before
the existing final header assignment. Most differences are error text, ordering
of validation and test organization.

The retained vanilla delivery and medium Adaptive Goal `lib/response.js` files
are byte-for-byte identical: Git blob
`664c64f69a811d22b915bed4dca3c8ef5f71127f`, SHA-256
`a8faf068e207f7ce67c5e52fbfbf829e9eac49f23b40d88d7afefe39f0d416c4`.
Their tests differ, but the handler does not.

Vanilla also wrote substantial boundary tests, including loops over control
characters and checks that invalid input cannot set or alter a header. The
orchestrated variants did not uniquely supply those ideas.

**Learning:** additional assurance may increase confidence without producing a
different implementation. Workflow time is not a measure of code improvement.

## Click: similar buffer design, materially different boundaries

Most solutions copy writes into separate and combined byte buffers. The
important behavioral difference was whether inherited binary `writelines` also
passed through that copying logic. Ordinary `write` tests did not expose the
gap. The [existing public-API probe](2026-10-30-review-medium-n1-click-probe.json)
records the source identities and observations:

| Retained source                    | Four probe checks passed |
| ---------------------------------- | -----------------------: |
| Vanilla implementation             |                      2/4 |
| Vanilla delivery                   |                      2/4 |
| Adaptive Goal, xhigh, after repair |                      4/4 |
| Adaptive Goal, medium              |                      2/4 |
| Ticket to PR, medium, after repair |                      4/4 |

Xhigh caught the defect in the earlier implementation run. Medium missed it in
the new implementation run but caught it in delivery, where a fresh reader
verified the repair. This shows useful independent defect discovery and variable
detection; it does not establish a reliable effort ranking.

There was a separate API-design choice. Most variants expanded
`CliRunner.isolation()` from two yielded streams to three, then changed callers
and tests that unpacked the tuple. The latest Ticket to PR solution kept the
two-stream return shape and obtained combined output from its internal capture
buffer. That avoided changing those callers, at the cost of coupling result
collection to a custom buffer property and a type-ignore annotation.

**Learning:** check alternate inherited entrypoints, and compare the public API
changes a solution requires. Similar-looking buffer implementations can differ
in both correctness and compatibility surface.

## Ajv: similar path propagation, different integration choices

The solutions thread an instance path through generated parser contexts, attach
it on failure and clear it between calls. Some reuse Ajv's `getErrorPath` helper;
others implement escaping locally. The medium Adaptive Goal snapshot passes the
path into recursive generated parsers as a fourth argument, while other observed
variants compose relative paths from nested-parser diagnostics. These are
structural alternatives, not measured performance or correctness rankings.

Adaptive Goal added cases to the existing TypeScript spec. Vanilla and Ticket
to PR also created standalone JavaScript regression files and ran them directly.
Direct execution was useful in the fixture, where full-suite dependencies were
unavailable, but it leaves a separate repository-integration question.

The latest medium Ticket to PR file is `spec/jtd-instance-path.test.js`, using
Node's test runner. Its eight tests were explicitly run with
`node --test spec/jtd-instance-path.test.js`. The upstream `test-spec` command
discovers `spec/**/*.spec.{ts,js}`. That pattern matches the other retained
`.spec.js` and `.spec.ts` names but does not match this `.test.js` file. The
published four-file scope does not change `package.json` to add it.

**Learning:** writing and explicitly running a regression is distinct from
integrating it into normal test discovery. Passing focused checks and independent
Standards/Spec reviews did not catch this integration gap.

## Go-git: serializer semantics distinguish otherwise similar solutions

The implementations agree on a prefix slice, scanning for the longest match,
validation of usable values, and deterministic URL-section output. They vary
more in serialization. Vanilla implementation builds a custom option list to
preserve original placement and key casing. Several other variants remove and
re-add entries using existing APIs. The earlier xhigh Ticket to PR source uses
variadic `SetOption`.

A new offline probe exercised the same public sequence on all six reconstructed
sources: `Config.Unmarshal`, edit `URL.InsteadOf`, `Config.Marshal`, and unmarshal
the result. The four cases reorder existing prefixes, increase duplicate
multiplicity, remove a prefix and preserve existing duplicates.

| Retained source        | Four serialization checks passed |
| ---------------------- | -------------------------------: |
| Vanilla implementation |                              4/4 |
| Vanilla delivery       |                              4/4 |
| Adaptive Goal, xhigh   |                              4/4 |
| Adaptive Goal, medium  |                              4/4 |
| Ticket to PR, xhigh    |                              2/4 |
| Ticket to PR, medium   |                              4/4 |

The xhigh Ticket to PR source retains `[a:, b:]` when the public slice is changed
to `[b:, a:]`, and serializes only one `a:` when an existing single value is
changed to `[a:, a:]`. Its `SetOption` call preserves existing matching options
and skips adding another occurrence of an already retained value. The other
implementations faithfully serialize both edits. The simpler unchanged round
trip and removal cases pass in every variant.

The failing source snapshot was emitted by the main thread after assessment and
immediately before committing. The remainder of the complete capture contains
commit, publication, CI and handover calls, with no further source-edit command.
Both xhigh readers had passed it without findings. The original hidden checks
do not exercise these slice mutations, and their verdicts remain unchanged.

**Learning:** an existing helper is useful only when its semantics match the
contract. Stateful edit-and-round-trip tests distinguished these implementations
where unchanged round trips and a passing review did not.

## What these results support

- Vanilla can produce small, well-tested solutions; its speed is not explained
  by universally omitting tests or using crude implementations.
- Independent review produced a concrete repair in Click. Both reviewer efforts
  also missed gaps elsewhere. Effort alone is not demonstrated to be a reliable
  quality selector in this small sample.
- Assurance should include alternate API entrypoints, edits to already parsed
  state, and normal repository test discovery. These probes exposed differences
  that original pass rates hid.
- To isolate reviewer effort, compare reviewers against the same frozen patch.
  Here implementation choices, generated tests and repair work varied alongside
  reviewer effort, so whole-workflow deltas cannot identify that effect alone.

## Evidence and limits

The [machine-readable comparison](2026-10-30-implementation-comparison.json)
retains source identities, script hashes, the Go probe, observations and raw
evidence paths. Seventy-eight file snapshots were reconstructed from complete
base-relative diffs, with Git blob identities verified against captured indexes.
Transcript commands were not replayed. The Go probe uses existing local
dependencies with network resolution disabled.

This is a retrospective comparison, not a blind code review or a new benchmark
score. A retained complete diff can precede later edits that did not emit another
complete diff, so structural observations refer to the identified source
snapshots. The supplemental probes characterize those exact reconstructions.
Original task checks, acceptance verdicts and cost records remain unchanged.
