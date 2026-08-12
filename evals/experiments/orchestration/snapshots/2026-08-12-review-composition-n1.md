# Adaptive review composition snapshot — 2026-08-12

Status: **exploratory N=1; useful directional evidence, not a default-policy decision**

This snapshot measures the current `adaptive-goal` after independent review
became an environment-mapped capability. It compares three clean raw Codex
native-goal controls on Sol/medium with adaptive preflight on Terra/low and
policy-selected Terra/medium execution. The adaptive environment exposed the
unchanged `code-review` skill by ordinary capability discovery; neither plugin
referenced or assumed the other.

## Outcome

Both variants passed all three deterministic repository behavior contracts.
Adaptive review selection was proportional: routine Cobra omitted review,
elevated Commander selected it, and high-risk Express selected it.

After reconciling every fresh review-reader thread from raw host events, the
adaptive composite used **31.4% fewer tokens**, cost an estimated **65.9% less**,
and finished **16.6% faster** on average than the clean Sol/medium control.

| Case                  | Native Sol/medium | Adaptive route | Review                                            |     Behavior |     Native wall |   Adaptive wall | Native cost | Adaptive cost |
| --------------------- | ----------------- | -------------- | ------------------------------------------------- | -----------: | --------------: | --------------: | ----------: | ------------: |
| Cobra lifecycle       | Sol/medium        | Terra/medium   | omitted, routine                                  |    both pass |          276.9s |          263.8s |      $1.667 |        $0.539 |
| Commander env         | Sol/medium        | Terra/medium   | selected, elevated; stale-scope fail + final pass |    both pass |          632.7s |          627.0s |      $4.370 |        $1.804 |
| Express links         | Sol/medium        | Terra/medium   | selected, high; pass                              |    both pass |          462.7s |          253.1s |      $2.333 |        $0.509 |
| **Total / mean wall** |                   |                |                                                   | **3/3 each** | **457.4s mean** | **381.3s mean** |  **$8.370** |    **$2.852** |

The terminal goal state needs separate treatment. All raw-native responses
reported completion. Adaptive Commander and Express completed, but Cobra
stopped `blocked`: its focused lifecycle evidence passed while `go test ./...`
failed on pre-existing ShellCheck and stale-year golden-fixture behavior. The
repository behavior result is therefore 3/3 for both variants, while terminal
completion is native 3/3 versus adaptive 2/3 complete and 1/3 honestly blocked.

## Review selection and pinned-scope behavior

Cobra was classified `refactor` / `routine` / `routine`, so review was omitted.
Commander was `implement-feature` / `elevated` / `scaled`; its compatibility and
caller impact caused review selection. Express was `fix-bug` / `high` /
`routine`, so independent review was required by default.

The most informative event occurred on Commander, but its chronology limits
what can be claimed. The goal first pinned an initial review scope. Before it
spawned the fresh readers, it inspected a later upstream implementation of this
exact feature in commit `8571a75`, aligned its implementation with that source,
and reran checks. The first readers then reviewed the already-stale initial
scope. Its Spec reader correctly found that the initial implementation applied
the environment value before CLI parsing. An accumulating
`argParser(value, previous)` could therefore receive the environment-derived
value as `previous` and merge it into the CLI result, violating
CLI-over-environment precedence.

The finding independently corroborated a real defect in the pinned initial
scope, but it did not cause the repair. The goal then repinned the changed
content and reviewed a different target fingerprint:

```text
initial: WORKTREE@769abff2...+8a7a27284e9f3ef80a206960cf43547dc10e1cba
final:   WORKTREE@769abff2...+296a00f3684ca6c4f056cfc94067851799e0795c
```

The second Spec review passed; the second Standards review retained one low
advisory and passed. Express used one two-axis review round and passed without
findings. The adaptive goal interpreted the ordinary capability outcome and
continued; it did not parse or reproduce the provider's result serialization.

This is concrete evidence that proportional capability selection, pinned-scope
review, invalidation, and different-target rereview occur on a real repository.
It does not demonstrate that review changed the implementation trajectory: the
repair preceded the fresh readers and was informed by an upstream solution.
Nor is it evidence that adaptive review produced a better final implementation
than the clean Sol control. The control independently chose to parse CLI before
environment fallback and included a single-parser-call precedence test, so its
final design also avoided the found defect.

## Reconciled usage

The runner's headline adaptive token field contains the parent goal thread but
not native descendant reviewer threads. Raw app-server events preserve the
cumulative usage of those readers, so this snapshot adds their last usage event
once per thread.

| Metric              | Raw native Sol/medium | Adaptive parent | Review readers | Adaptive reconciled |  Delta |
| ------------------- | --------------------: | --------------: | -------------: | ------------------: | -----: |
| Input tokens        |             9,913,247 |       6,106,407 |        673,684 |           6,780,091 | -31.6% |
| Cached input tokens |             9,444,864 |       5,770,496 |        530,176 |           6,300,672 | -33.3% |
| Output tokens       |                43,536 |          43,059 |          9,692 |              52,751 | +21.2% |
| Total tokens        |             9,956,783 |       6,149,466 |        683,376 |           6,832,842 | -31.4% |
| Estimated cost      |                $8.370 |          $2.343 |         $0.509 |              $2.852 | -65.9% |

Commander used four fresh readers across two review rounds (544,008 tokens).
Express used two fresh readers in one round (139,368 tokens). Cobra used none.
These are native review descendants, not Darrow controller children; all runs
reported zero Darrow child invocations and zero human interruptions.

The estimate reuses the benchmark's 2026-08-09 API price basis: Sol input /
cached input / output at $5.00 / $0.50 / $30.00 and Terra at $2.00 / $0.20 /
$12.00 per million tokens. Fresh-reader events do not state an explicit model,
so their cost is calculated using normal inheritance of the Terra/medium
execution route. No provider-reported monetary charge was available.

## Control correction

The first run mounted `code-review` into both cells in an attempt to keep
capability availability symmetrical. Audit showed that raw-native agents read
or partially entered that skill despite being told not to invoke Darrow
orchestration. Those three raw trials were excluded before interpreting the
aggregate.

The accepted replacement reran exactly the raw Sol/medium cell with no Darrow
skills mounted. No candidate trial was replaced for quality, latency, or token
outcome. The excluded result remains preserved in the raw bundle.

## Provenance

Accepted adaptive result:

- `evals/results/orchestration-review-composition-n1/live/codex-adaptive-review-capable.json`
- SHA-256 `ddbd07027a4178b3bf7ea29c168c87d4896183296c1dc58c61da12c7df555af7`
- started `2026-08-12T10:04:43.840Z`
- seed `2026-08-12-review-composition-n1-live`
- runner revision `b1e4b3414e69128eb31b010efe5f5fdca87fa677`
- Codex CLI `0.147.0`
- dirty patch SHA-256
  `64562944b3c0a63a95c9b2998896b4bce228d8cdd3d42576d47980314aecab91`;
  audit confirmed it was only a concurrent README logo addition

Accepted clean native replacement:

- `evals/results/orchestration-review-composition-native-replacement-n1/live/codex-native-sol-clean.json`
- SHA-256 `4bec26654c28451ea87fad17910fc9a91413dd856df67873d2b161e00cf22a55`
- started `2026-08-12T10:50:52.197Z`
- seed `2026-08-12-review-composition-native-replacement-live`
- runner revision `1672e083991020a959362656f5ba27e020d61c90`
- clean worktree, no skills mounted, Codex CLI `0.147.0`

Excluded contaminated native result:

- `evals/results/orchestration-review-composition-n1/live/codex-native-sol.json`
- SHA-256 `e7fef771c0924959229b9477f0aaf29d43e82ad49084da2ab4cd81d8abb248eb`
- exclusion: `code-review` was visible to the raw control

Raw bundles are gitignored and retained locally. The tracked
[JSON companion](2026-08-12-review-composition-n1.json) preserves exact
aggregates, case values, review fingerprints, exclusions, and limitations.

## Limitations and bounded conclusion

- N=1 is not a stable latency, cost, or quality estimate; the cells ran
  sequentially and no blind judge ran.
- Unrelated documentation and license commits landed between accepted cells.
  The relevant plugins, runner, task contracts, and checks did not change.
- Raw native goal activation occurred inside a headless Codex turn, while the
  adaptive adapter applied the goal directly through the host API. Some of the
  control's cost is activation discovery, so this is an end-to-end surface
  comparison, not a review-only ablation.
- Every adaptive case first encountered a read-only sandbox failure, reported a
  blocked state, and was then resumed by the host with writable execution. Those
  failed attempts remain in the adaptive time and token totals, making the
  efficiency result conservative but the execution path less clean.
- The runner currently omits native reviewer usage from its headline total and
  reports only Darrow child invocations. This snapshot reconciles six reader
  threads manually from raw events.
- The deterministic Commander contract did not directly assert the
  accumulating-parser counterexample found by review.
- The Commander goal could inspect later repository history and used upstream
  implementation commit `8571a75` before the first review readers ran. This is
  solution leakage and prevents a causal claim that review triggered the
  repair.
- Equal behavior pass does not imply equal completion: adaptive Cobra stopped
  on an unrelated broad-suite gate.

The bounded conclusion is that environment-mapped review composition and
proportional selection work on real repositories without making review
universal. Pinned-scope invalidation and a different-target rereview were also
observed, but review-triggered repair remains unproven. In this N=1 sample, the
complete adaptive surface retained 3/3 behavior pass while using materially
fewer tokens and estimated dollars than raw Sol/medium. The Commander solution
leakage, Cobra stop, sandbox retries, and native-goal activation asymmetry are
important enough that this snapshot should guide the next experiment, not set
a default by itself.
