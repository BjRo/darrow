# Migration acceptance

Both existing skills pass the bundled metadata inspector before migration.
The original Bash regression suites supplied the mechanical baseline. Their
scenarios now run in pytest on every supported host; the shell suites are removed.
Full pre-migration live skill
baselines are not claimed; live trials exercise the migrated skills.

Regression coverage is retained in these native tests:

| Original scenarios                                                        | Pytest coverage                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Missing entrypoints, routes, cycles, scoped reachability, default budgets | `test_commands.py`: `test_graph_cases`, `test_long_graph_and_caps`                                                   |
| Deferred chains, arrow indexes, fences, native imports, skill lookalikes  | `test_regressions.py`: routing and parsing cases                                                                     |
| Selected runtimes, imported defects, broken adapters, shadowed budgets    | `test_regressions.py`: runtime and budget cases; `test_commands.py`: override cases                                  |
| Mirror alignment, drift, dependencies, unreadable mirrors, duplicates     | `test_commands.py`: `test_mirrors`; `test_regressions.py`: mirror and duplicate cases                                |
| Root adapters in both directions and independent copies                   | `test_commands.py`: `test_root_adapter`, `test_bad_selected_adapter`                                                 |
| Ordinary path boundaries, incidental mentions, source files               | `test_regressions.py`: boundary and mention cases; `test_failures.py`: `test_non_guidance_references`                |
| Setup inventory, no writes, subdirectory identity, output caps            | `test_commands.py`: `test_setup_inventory_and_limits`, `test_worktree_identity`, `test_long_graph_and_caps`          |
| Large Git worktree output for setup and doctor                            | `test_regressions.py`: `test_large_worktree_output` with real Python subprocess output, both NUL and newline records |

The fresh-artifact test additionally exercises the installed console commands
with frozen runtime dependencies. Permission-denial cases inject OS access
failures so they remain meaningful on Windows and under privileged test users.

Representative requests, covered by the existing colocated eval suites:

| Dimension  | Setup                            | Doctor                      |
| ---------- | -------------------------------- | --------------------------- |
| Direct     | Set up repository agent guidance | Audit AGENTS.md             |
| Indirect   | Reorganize our guidance graph    | Trim duplicated agent rules |
| Incomplete | Propose the graph before editing | Show findings before fixing |
| Negative   | Only audit existing guidance     | Create a new guidance graph |
| Pressure   | Preserve reverse symlink adapter | Preserve rare safety route  |

The migration additionally exercises native path handling, CRLF/BOM parsing,
case sensitivity, unavailable symlink support, read-only audit behavior, and
atomic source replacement. Fresh copied artifacts must run without Bash,
development dependencies, sibling plugins, or the original checkout.

The bounded independent review found two regressions: parent-relative native
and skill resources were rejected by case validation, and invalid encoding in
unselected Claude guidance could abort a Codex-only audit. Both have native
command regressions in `test_failures.py` and were repaired.

Live-trial diagnosis also corrected two eval calibration problems. The
Codex-only setup fixture now supplies an actual service contract instead of
expecting invented guidance in an empty repository. The unselected-runtime
semantic check accepts an issue-free outcome in context without requiring the
literal word “verified”; its deterministic verification check is unchanged.
A failed procedure-move trial motivated clearer skill instructions to confirm
the exact intent route in the inspector output, preserving the existing
cross-runtime reachability requirement.

## Context usage: issue #292

The public seam is `ia-context --format json|grid`, registered in the existing
locked backend. The oracle is the issue's category/accounting contract and
cleaned Codex 0.166 records. `tests/fixtures/context/normal.jsonl` retains no real
session content. `compacted.jsonl` includes two replacements so the last one
must win. Tests exercise the frozen installed command and the same registered
CLI entrypoint in process. The accounting property generates Unicode messages
and exact totals independently of the estimator.

The following slices ran from `backend/`. Each red preceded its product change;
each green used the identical command. Intermediate syntax, invocation-directory
and hand-count mistakes were corrected and are not claimed as red evidence.

- Red — `uv run --group dev pytest tests/test_context.py -q`: the frozen launcher could not spawn the missing `ia-context` command.
- Green — `uv run --group dev pytest tests/test_context.py -q`: normal-session JSON, exact total, categories, absolute path and unchanged files passed.
- Red — `uv run --group dev pytest tests/test_context.py -q`: discarded history remained in the compaction estimates.
- Green — `uv run --group dev pytest tests/test_context.py -q`: replacement history and subsequent messages alone were counted.
- Red — `uv run --group dev pytest tests/test_context.py -q`: a session without token counts raised `IndexError`.
- Green — `uv run --group dev pytest tests/test_context.py -q`: estimates remained available with null exact fields.
- Red — `uv run --group dev pytest tests/test_context.py -q`: the negative remainder had no warning.
- Green — `uv run --group dev pytest tests/test_context.py -q`: signed remainder, warning and accounting equality passed.
- Red — `uv run --group dev pytest tests/test_context.py -q`: an explicit compaction limit produced no buffer fields.
- Green — `uv run --group dev pytest tests/test_context.py -q`: the configured 800-token limit in a 1000-token window produced a 200-token buffer.

The missing-thread slice ran from the worktree root:

- Red — `uv run --project plugins/foundation/darrow-information-architecture/backend --group dev pytest plugins/foundation/darrow-information-architecture/backend/tests/test_context.py -q`: missing `CODEX_THREAD_ID` raised `KeyError` instead of a clear refusal.
- Green — `uv run --project plugins/foundation/darrow-information-architecture/backend --group dev pytest plugins/foundation/darrow-information-architecture/backend/tests/test_context.py -q`: missing thread refused with status 2 and no traceback.

Subsequent slices ran from `backend/`:

- Red — `uv run --group dev pytest tests/test_context.py -q`: a missing rollout returned an unpacking error.
- Green — `uv run --group dev pytest tests/test_context.py -q`: missing and duplicate rollouts produced specific refusals, including known CLI version.
- Red — `uv run --group dev pytest tests/test_context.py -q`: malformed JSON lacked a rollout path, line and known CLI version.
- Green — `uv run --group dev pytest tests/test_context.py -q`: malformed and unknown shapes produced contextual refusals.
- Red — `uv run --group dev pytest tests/test_context.py -q`: live structured base instructions failed with `AttributeError`.
- Green — `uv run --group dev pytest tests/test_context.py -q`: structured base instructions, custom calls/outputs, visible reasoning and logged definitions passed without counting encrypted content.
- Red — `uv run --group dev pytest tests/test_context.py -q`: grid output was JSON with no category table.
- Green — `uv run --group dev pytest tests/test_context.py -q`: a bounded grid, numeric table and snapshot limitation were displayed.
- Red — `uv run --group dev pytest tests/test_context.py -q`: a compaction limit above the window produced no warning.
- Green — `uv run --group dev pytest tests/test_context.py -q`: the signed buffer and warning passed along with unreadable/invalid config refusals.
- Red — `uv run --group dev pytest tests/test_context.py -q`: the grid legend mentioned a configured buffer when no limit was set.
- Green — `uv run --group dev pytest tests/test_context.py -q`: buffer information was omitted when unset.
- Red — `uv run --group dev pytest tests/test_context.py -q`: an inline quoted triple-quote marker hid the subsequent root limit.
- Green — `uv run --group dev pytest tests/test_context.py -q`: quoted markers remained string contents and the explicit limit was read.
- Red — `uv run --group dev pytest tests/test_context.py -q`: an assistant's quoted skill tag increased the skills category.
- Green — `uv run --group dev pytest tests/test_context.py -q`: quoted assistant content stayed in messages.

The live `/status` comparison and token definition are recorded in the
[context contract](../../../../../docs/specs/information-architecture.md#live-codex-comparison).
The skill metadata inspector passed; Claude's native plugin validator passed
with existing author/icon and marketplace-install advice. Codex CLI 0.166 has
no native plugin-validation subcommand; installed native evals validate its
actual loading instead. Local fresh-artifact checks establish macOS execution;
Linux and Windows evidence comes from the release CI matrices.

The initial live Codex trial selected the skill and correctly refused an
unreadable isolated config. Successful context trials need the existing
`evals/sevro-extension/runtime-codex-state.json` profile; this grants access to
the trial's actual configuration rather than substituting a represented fixture.
The new cases grade clean Git state, outcomes and native activation separately.
Free-form transcript command assertions are unsupported by the pinned runner;
retained traces supply manual invocation/Claude-redirect evidence.

The pruning candidate removed only the repeated final safety sentence from the
completion criterion. The opening safety rule remains authoritative. The full
native eval runs exercise that pruned body. Single-trial results establish
bounded behavior, not a reliability improvement claim.

The independent review found malformed duplicate metadata and escaped multiline
config delimiters. Both were repaired at their input boundaries:

- Red — `uv run --group dev pytest tests/test_context.py -q`: malformed metadata in the first duplicate rollout raised `AttributeError`.
- Green — `uv run --group dev pytest tests/test_context.py -q`: duplicate evidence refused with `cli_version=unknown` and no traceback.
- Red — `uv run --group dev pytest tests/test_context.py -q`: an escaped triple quote exposed a decoy 123-token limit inside a multiline string.
- Green — `uv run --group dev pytest tests/test_context.py -q`: JSON and grid used the actual root 800-token limit; a string-only limit added no buffer.
- Red — `uv run --group dev pytest tests/test_context.py -q`: the real encrypted `compaction` response shape was rejected.
- Green — `uv run --group dev pytest tests/test_context.py -q`: the known encrypted item was recognized without inventing measurable text.
- Red — `uv run --group dev pytest tests/test_context.py -q`: a base-prompt echo in replacement history increased other developer instructions.
- Green — `uv run --group dev pytest tests/test_context.py -q`: the base prompt was counted once.

The real compacted probe also passed `ia-context --format json` with an exact
22,896-token total, matching `/status`'s 22.9K display. The cleaned fixtures now
retain its encrypted-item and base-echo shapes and synthetic usage components.

A later live-thread smoke found Codex's non-content inter-agent metadata. From
`backend/`, after correcting a fixture hand count that is not red evidence:

- Red — `uv run --group dev pytest tests/test_context.py -q -k inter_agent_metadata`: the known `inter_agent_communication_metadata` record refused as an unsupported record type.
- Green — `uv run --group dev pytest tests/test_context.py -q -k inter_agent_metadata`: the record was ignored and the fixture's exact total and category estimates were preserved.
- Red — `uv run --group dev pytest tests/test_context.py -q -k agent_message_content`: the live `agent_message` response shape refused as an unsupported response item.
- Green — `uv run --group dev pytest tests/test_context.py -q -k agent_message_content`: eight visible ASCII bytes added two estimated message tokens, excluding routing metadata.
- Red — `uv run --group dev pytest tests/test_context.py -q -k agent_message_content`: unrelated `summary: null` raised `TypeError`; a summary-shaped extra field inflated the estimate from nine to eleven message tokens.
- Green — `uv run --group dev pytest tests/test_context.py -q -k agent_message_content`: all three cases read only validated visible content and reported nine message tokens.

Native positive cases now capture the real frozen command's output, status,
arguments and thread through a fixture UV wrapper; they never replace the
backend. Hidden checks require successful invocation in the audience's format.
The Claude case requires the absence of this invocation receipt. A separate
requested report-copy case compares the saved report byte-for-byte with the
captured output. Its oracle tests reject a fabricated numeric report and a
report with no backend execution. This proves the saved artifact, while final
prose remains semantically assessed; native activation is a separate check.

The first Windows CI run exposed argument splitting in `os.execv` forwarding
inside the eval fixture. Its existing subprocess regression observed status 0
and a truncated Python `-c` argument instead of status 9 and `unchanged\n`.
The fixture now uses `subprocess.run` with an argument vector and inherited
streams for uncaptured calls. The local seven-test fixture suite passes; the
Windows CI rerun supplies the platform-specific repair evidence.
