# Reviewer-routing trials

Date: 2026-08-18

## Live Codex route-mechanism proof

One Codex Desktop review run used the bundled `openai/gpt-5.6-sol/xhigh`
reviewer route against
`WORKTREE@4e32d6d08438e92027a39664550129978d254bfd+3c05dc6e59f40e3fe9dc8650839fb49a77bc100a`.
The verifier-generated
`evals/results/code-review-route-native-final15-live.json` records:

- Standards call `call_m9DTddD22vQMmEjpY1FYNq84`, child
  `/root/final15_standards`, thread
  `01a014fd-e8e1-7060-b22a-5773840e7235`;
- Spec call `call_EnXai8hxq25z5Wz83p5DUaNg`, child
  `/root/final15_spec`, thread
  `01a014fe-100d-7f21-9243-4ec17ce10554`;
- exact `gpt-5.6-sol`, `xhigh`, and `fork_turns=none` request fields;
- two distinct axis-marked native task names, native start events, and accepted
  child paths; and
- both acceptances at session ordinals 7130 and 7135, before the first wait at
  ordinal 7147, with exactly those two spawn requests in the retained batch.

`evals/runner/native-review-proof.ts` derives the pass from the append-only
native session prefix, the selected-route record, both axis application
records, both native starts, both accepted outputs, and the closed retained
launch batch. Its negative tests reject an application record with no native
start, a missing or ambiguous native axis marker, and any additional retained
spawn. This is a passing mechanism case, not a matched review-quality
comparison.

## Historical Claude mechanism observation

One Claude Code 2.1.223 mechanism run used the bundled
`anthropic/claude-opus-5/xhigh` exact-tuple foreground agent. Its retained raw
parent and child transcripts record:

- Standards tool use `toolu_01DN8PNkX5MbDun8A3njUdFR`, child
  `adab4d4016fdd59bb`;
- Spec tool use `toolu_01GcjX6LakyJjWWER61pNq8u`, child
  `a2f162375872d9803`;
- the same native parent message ID for both Agent calls;
- `run_in_background=false`, the exact
  `darrow-review:review-reader-claude-opus-5-xhigh` type, and no per-call model
  alias;
- distinct host-completed child results with `resolvedModel=claude-opus-5`;
  and
- exact child transcripts whose every assistant turn records
  `claude-opus-5/xhigh` and the same host child ID.

Both Agent prompts used the historical undashed `review_axis:` marker. The
current protocol requires `- review_axis:` plus direct-provider evidence from
the current host environment, so the current
`evals/runner/claude-review-proof.ts` correctly rejects the legacy artifacts
and no passing JSON artifact is retained. The transcript remains useful evidence that
Claude can encode one native assistant turn as two envelopes sharing the same
`message.id`; the eval adapter now joins that shape into one retained parallel
batch. Deterministic tests reject the legacy marker and distinct message IDs.
A fresh live rerun was unavailable because the local Claude OAuth credential
had expired.

## Matched Codex CLI trials

Two N=1 control/candidate pairs used the same fixture, participant prompt,
checks, Codex CLI 0.147.0 harness, parent model `gpt-5.6-sol`, and parent effort
`xhigh` within each pair. The control omitted the skill; the candidate mounted
the source plugin. Results are retained under `evals/results/`.

| Case                                  | Arm              | Pass rate | Passed checks | Wall time |  Tokens | Cost    | Human minutes |
| ------------------------------------- | ---------------- | --------: | ------------: | --------: | ------: | ------- | ------------- |
| `code-review-standards-only`          | no-skill control |        0% |          6/11 |     27.4s |  56,998 | unknown | unknown       |
| `code-review-standards-only`          | skill candidate  |        0% |          7/11 |    170.5s | 477,302 | unknown | unknown       |
| `code-review-reviewer-route-override` | no-skill control |        0% |           2/6 |     45.7s |  97,213 | unknown | unknown       |
| `code-review-reviewer-route-override` | skill candidate  |        0% |           5/6 |    197.5s | 531,318 | unknown | unknown       |

The default-route candidate returned a short Markdown verdict with the core
finding and check result, but failed canonical-artifact validation, the complete
report and superficial-summary checks, and the native route oracle. The
repository-override candidate selected and
retained the configured `openai/gpt-5.5/xhigh` route and produced the complete
review, but likewise failed the native-launch oracle. The controls produced no
route artifacts. Neither pair supports a passing Codex CLI claim.

A direct read-only CLI probe requested one explicit Sol/xhigh fresh reader. The
CLI emitted only a `wait` collaboration event with an empty receiver list and
no spawn event. This explains the candidate failures and confirms that the
route oracle is failing closed instead of treating a same-context review or
coordinator-authored application record as launch evidence.

A separate N=1 full Claude skill trial activated `code-review` on
`claude-opus-5/xhigh` but returned a same-context review with no route records
or Agent telemetry. It therefore remained at 0% (2/6 checks, 106.6 seconds,
119,797 tokens, $0.466715). This failed end-to-end trial is retained as
`evals/results/code-review-route-override-live-claude-candidate.json`; it is not
the passing route-mechanism claim above.

## Limitations

- The live passing proof is N=1, Codex Desktop-only, and not a matched
  no-skill comparison. It proves route application and separate contexts, not
  review-quality improvement or cross-run variance.
- The matched Codex CLI trials are N=1 and both arms fail overall because CLI
  0.147.0 did not expose a native spawn boundary. Their token and wall-time
  deltas therefore must not be interpreted as the cost of a passing route.
- Actual cost and human-review minutes were unavailable.
- There is no current passing Claude live artifact. The historical transcript
  proves exact Opus/xhigh child observation and the host's same-turn envelope
  shape, but its legacy prompt marker and missing direct-provider evidence do
  not satisfy the final protocol.
