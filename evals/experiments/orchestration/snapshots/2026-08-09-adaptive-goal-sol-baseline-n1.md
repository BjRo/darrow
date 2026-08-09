# Adaptive Goal Loop versus raw Sol native — 2026-08-09

Status: **exploratory N=1 retrospective; accepted as directional product evidence**

This snapshot compares the latest `adaptive-goal` verification-cadence run with
the last accepted raw-native Sol/medium run on the same three unchanged OSS task
contracts. It corrects a benchmark interpretation error: the later
`native-promoted-route` cells prescribe lower per-case routes and therefore
measure orchestration overhead after model selection is supplied for free. They
are not the primary baseline for the end-to-end value of adaptive model, risk,
and workflow selection.

## Outcome

All three raw-native and adaptive implementations passed their repository
behavior contracts. At current API list prices, including cached-input rates,
the adaptive composite cost an estimated **61.0% less**, used **18.2% fewer
tokens**, and took **3.6% more wall time** than raw Sol/medium native goal.

| Case                             | Raw native route | Adaptive route | Native cost | Adaptive cost | Cost delta |     Native wall |   Adaptive wall |
| -------------------------------- | ---------------- | -------------- | ----------: | ------------: | ---------: | --------------: | --------------: |
| Cobra lifecycle                  | Sol/medium       | Terra/medium   |      $0.950 |        $0.318 |     -66.5% |          285.4s |          322.3s |
| Commander env                    | Sol/medium       | Terra/medium   |      $1.592 |        $0.586 |     -63.2% |          358.3s |          338.8s |
| Express links                    | Sol/medium       | Terra/medium   |      $0.587 |        $0.319 |     -45.7% |          206.3s |          219.5s |
| **Three-task total / mean wall** |                  |                |  **$3.130** |    **$1.222** | **-61.0%** | **283.3s mean** | **293.6s mean** |

Mean estimated cost was $1.043 per native task and $0.407 per adaptive task.
The latest adaptive run used Terra/low for classification and Terra/medium for
native execution in all three cases. It therefore retains a cost advantage over
Sol even though the current policy no longer sends Express to Luna.

## Quality and suite interpretation

The reviewed behavioral result is 3/3 for both variants. Every hidden product
contract and focused upstream check passed.

The unmodified latest suite reports the adaptive cell as 1/3. Its two failures
are preserved rather than rewritten:

- Cobra selected `refactor` / `elevated` / `scaled`; the suite expected the old
  `refactor` / `routine` / `scaled` dimensions.
- Express selected the current policy route Terra/medium; the suite expected the
  previously promoted Luna/high route.

Those are routing-oracle mismatches, not repository behavior failures. They
matter for route-policy maintenance but do not invalidate this comparison with
the raw Sol baseline. No condition-blind quality judge ran for either accepted
composite.

## Token and latency accounting

| Metric              | Raw native Sol/medium | Latest adaptive |  Delta |
| ------------------- | --------------------: | --------------: | -----: |
| Input tokens        |             3,063,370 |       2,499,611 | -18.4% |
| Cached input tokens |             2,882,816 |       2,275,584 | -21.1% |
| Output tokens       |                26,179 |          26,566 |  +1.5% |
| Total tokens        |             3,089,549 |       2,526,177 | -18.2% |
| Mean wall time      |                283.3s |          293.6s |  +3.6% |

Setup and dependency installation occurred before candidate timing. Adaptive
usage includes classification and native execution. The Codex adapter reported
tokens but not provider cost, so all monetary values are reconstructed.

## Pricing method

Prices are USD per million text tokens from the official OpenAI model pages,
read on 2026-08-09:

| Model         | Input | Cached input | Output |
| ------------- | ----: | -----------: | -----: |
| GPT-5.6 Sol   | $5.00 |        $0.50 | $30.00 |
| GPT-5.6 Terra | $2.00 |        $0.20 | $12.00 |
| GPT-5.6 Luna  | $0.20 |        $0.02 |  $1.20 |

Sources: [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol),
[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), and
[Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

Each case is priced as:

```text
(input - cached_input) * input_rate
+ cached_input * cached_input_rate
+ output * output_rate
```

The result is divided by one million. No provider-specific enterprise discount,
subscription accounting, Batch discount, tool-call fee, or long-context
multiplier is applied. The accepted adaptive trace's largest recorded model-call
input was 65,874 tokens. The older native adapter exposes only cumulative usage
and does not preserve per-call prompt lengths, so this snapshot cannot
independently verify whether a long-context multiplier applied to native calls.
No multiplier is included; this is a residual pricing limitation.

The earlier routing snapshot estimated a 72.0% reduction by charging cached
input at the full input rate because no cached-input price had been supplied.
This snapshot's 61.0% estimate supersedes that cost interpretation while leaving
the historical snapshot unchanged.

## Static pipeline context and ergonomics

The latest adaptive mean of 293.6 seconds is 3.78 times faster than the
historical Codex ticket-pipeline mean of 1,110.4 seconds. This is directional,
not a controlled same-corpus comparison: the pipeline result used GPT-5.5 on the
original four-task corpus, while this adaptive composite uses GPT-5.6 Terra on
three held-out routing cases. The historical pipeline passed 3/4 tasks; the
latest adaptive composite passed 3/3 behavior contracts.

The execution logs also preserve the architectural ergonomic distinction:
adaptive-goal compiled one workflow, risk gate, verification cadence, and model
route, then activated one native goal with zero Darrow child sessions and zero
human interruptions. The static pipeline coordinated 6.25 child agents per
Codex task on average and required durable ticket state. This is an architecture
and interaction-count observation, not a measured user-experience study.

## Provenance and reruns

The three case YAML contracts are byte-unchanged between the native runner
revision and the latest adaptive runner revision.

Raw native Sol/medium:

- Cobra and Express:
  `evals/results/orchestration-gpt-5.6-routing-hypothesis/2026-08-08T16-54-23-392Z/codex-native-current-route.json`
  (SHA-256 `21eba4ef27ab65e9fb198e19ba39c85b488f28449b74e59bb6447b8a953b88c2`).
- Commander replacement:
  `evals/results/orchestration-gpt-5.6-routing-hypothesis/2026-08-08T17-42-05-230Z/codex-native-current-route.json`
  (SHA-256 `6147eedb81cf7095c634f8b1bad0512d9d7d29f9d3c2ea97eec8a14833898878`).
- Runner revision `5244dc5e2b29619490897d4a953a1b8421fef2a0`, dirty patch
  SHA-256 `c109585f8cd46c2b6224f9b9812912c5ce3fecb3285dc7928114b3e82b9428e5`,
  Codex CLI 0.145.0.
- The main suite's Commander Sol/high cell is excluded. The dedicated
  Sol/medium rerun is the accepted replacement.

Latest adaptive:

- `evals/results/orchestration-promoted-routing/2026-08-09T14-06-25-589Z/codex-darrow-promoted-route.json`
  (SHA-256 `d39aba661e2bb9461c215618e9088d20a6818ccf2fc053e3c1965876131780a3`).
- Runner revision `41c899aa0adcbc8501d363670de5013a9b37b83f`, clean worktree,
  order seed `2026-08-09-verification-cadence-rerun-n1`, Codex CLI 0.147.0.
- One dry fixture validation preceded the live suite. The accepted live result
  contains one completed trial per case; no candidate trial was replaced.

Historical pipeline context comes from
[`2026-08-07-n1.json`](2026-08-07-n1.json).

## Bounded conclusion

This retrospective supports the following product statement:

> In exploratory N=1 evaluations, adaptive-goal preserved task success while
> costing about 61% less than raw Sol/medium native execution, finishing within
> 4% of native wall time, and running roughly 4 times faster than the historical
> static ticket pipeline, while compiling workflow, risk, verification, and
> model selection into one native goal.

The cost and native-latency comparison uses the same three task contracts, but
the runs are non-contemporaneous and use Codex CLI 0.145.0 versus 0.147.0. The
runner and adaptive skill also changed between dates. The pipeline comparison
uses a different corpus and model. Trial count remains N=1, no blind judge ran,
and no claim here is a stable population estimate or proof that proportional
risk gates prevent escaped defects.
