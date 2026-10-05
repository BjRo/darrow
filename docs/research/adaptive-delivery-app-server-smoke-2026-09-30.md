# Adaptive Delivery: app-server owner smoke test

## Result

The native-goal execution-owner path is feasible on Codex CLI **0.159.2** with
**gpt-6-luna/medium**. Nine bounded protocol attempts, including one setup-only
failure, established user-role contract delivery before execution, owner goal
attachment, automatic continuation, final-response capture, restart recovery,
feedback, interruption acknowledgement, capability visibility, hook setup, and
matched available delegation capacity. These are feasibility observations, not
delivery success rates.

The smoke itself contains **no delivery trials**. The native control conceals
its submitted launch message. A trusted observation hook receives ciphertext;
the child thread's public history also omits the initial assignment. This
prevents complete attribution between launch omissions and execution drift in
control A. The user subsequently approved keeping A unchanged and reporting
this attribution gap. The approved [delivery pilot](adaptive-delivery-owner-pilot-2026-09-30.md)
records the instruction partition and experiment invariants.

Approved approach: preserve A unchanged, compare outcomes across A/B/C, and
attribute launch-versus-execution failures only where the actual retained
instructions support the conclusion. B/C can retain the full submitted contract
through app-server. Keep unavailable evidence explicitly unknown.

The original **300-trial baseline** and **80 eval-repair trials** are unchanged.
No production skill, review/verification capability, or runner implementation
changed during this investigation. The earlier uncommitted eval repairs remain.

## Approved scope

The user approved the [three-arm proposal](darrow-adaptive-delivery-eval-repairs-2026-09-30.md#proposal-app-server-owner-with-a-native-goal):

- A: current native subagent owner without a goal;
- B: app-server execution owner without a goal;
- C: the same app-server execution owner with a native goal.

The parent keeps preflight, capability binding, model/effort selection, and
completion-response duties. Review and verification remain unchanged. The
proposal requires an isolated protocol smoke before four cases receive n:5
per arm. This document records that prerequisite investigation.

## Observations

| Boundary                  | Evidence                                                                                                                                          | Limit                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Contract before execution | `thread/inject_items` stored the full contract as a user message before goal activation; the completed final response included its receipt marker | The method requires the experimental API; this does not prove every instruction was obeyed            |
| Exact route               | Start response and retained native turn metadata showed `gpt-6-luna`, `medium`, provider `openai`                                                 | Smoke route only; the parent must still select each delivery route                                    |
| Goal attachment           | A paused goal was created and read back on the execution thread before activation; no parent goal was created                                     | No goal budget was requested or set                                                                   |
| Host continuation         | Activating the goal started execution without a client `turn/start`; the first probe continued automatically after a completed READY turn         | The corrected probe completed in one turn; persistence is demonstrated, not a reliability improvement |
| Capability access         | The owner read the installed review and verification skill bodies and package/lock metadata                                                       | This was inspection, not execution of either capability                                               |
| Goal and final response   | The corrected client retained both goal completion and the completing turn's final marker and capability evidence                                 | Goal completion alone proved insufficient as a transport completion signal                            |
| Recovery and feedback     | A new app-server process resumed the same thread ID, recovered the same goal state, and returned both earlier markers without rereading the files | Idle restart was tested; abrupt mid-effect recovery was not                                           |
| Interruption              | `turn/interrupt` returned and the identified sleep turn became `interrupted`                                                                      | This establishes host acknowledgement, not that all in-flight effects are prevented                   |
| Fixture preservation      | All nine fixture worktrees remained clean                                                                                                         | Host session, goal, hook-trust, and evidence files were deliberately created in isolated state        |

The full contract must remain separate from the compact goal objective. The
[official goal API](https://learn.chatgpt.com/docs/app-server#manage-a-thread-goal)
limits objectives to 4,000 characters. Neither a goal's existence nor its
`complete` state independently establishes fulfilled acceptance or complete
returned evidence.

## Defects and setup differences discovered

### Preserve the contract's instruction priority

The first two goal probes supplied the assignment through
`thread/start.developerInstructions`. That elevated the task contract above
later user feedback. A separate probe established a better interface: enable
the experimental API, create the thread, inject the full contract with
`thread/inject_items` as a `user` message, read it back, then activate the goal.
The completed final answer contained both the fixture marker and the marker
present only in that contract.

Use this same user-role interface in B/C. B then starts a turn; C activates its
goal and lets the host start execution. The compact goal does not replace the
full assignment. Later feedback priority is preserved by the message roles;
arbitrary conflicting-feedback scenarios have not been tested.

The first injection attempt used the incorrect method `thread/injectItems`.
The server rejected it before any goal or model execution. That setup failure
is retained alongside the successful snake-case method probe.

### Smoke client disconnected before the final response

The first client reacted to `goal.status=complete` by restarting the server.
Its retained `thread/read` still showed the completing turn as `inProgress`;
there was no final inspection response. This was a **smoke-client defect**,
not evidence of a skill or host failure.

The corrected client waits for the identified owner turn's completion as well
as goal settlement, then reads its final response. A fresh probe retained the
fixture marker and capability evidence before restarting. The first probe and
its missing response remain in the evidence inventory.

Interruption teardown also emitted `UnknownProcessId` and rollout-recording
diagnostics. The acknowledged interrupted state is retained, but this probe
does not establish fault-free teardown or recovery during an executing command.

### Commentary must not count as the final response

The independent evidence review found a second smoke-client defect: the check
concatenated commentary and final messages. Removing every final answer from
the retained response still satisfied the old marker check.

The corrected extractor requires the identified turn to be completed and reads
only `agentMessage` items with phase `final_answer`. Four deterministic tests
passed with nine assertions, covering commentary-only evidence, an unfinished
turn, the retained successful goal probe, removal of its final response, and
the successful user-role contract probe. The two successful saved probes
contain genuine final answers; their raw records were preserved unchanged.
These are assertion repairs, not additional live delivery trials.

### Available capacity must account for the native parent

The native control used the repository's five-spawned-thread limit. Its parent
launched one execution owner; that owner then launched four concurrent
assessment readers. A fifth reader was refused with an agent-thread-limit
error before the accepted readers were interrupted.

An app-server execution owner with a four-spawned-thread limit also accepted
four readers and refused the fifth. Both probes used fresh read-only fixtures,
the same reader assignment, `gpt-6-luna/medium`, and `fork_turns: none`.

Therefore the pilot should retain the parent's five-thread configuration and
give its separate app-server owner four spawned-thread slots. This matches the
observed available assessment capacity. Giving both roots the same numeric
limit would leave the app-server owner an extra slot. These probes cover
concurrent capacity; they do not establish every possible nesting topology.

The retained native launch returns independently confirm four accepted readers
and the fifth refusal in both probes. All eleven recorded root, owner, and
reader turn routes used `gpt-6-luna/medium`.

### App-server hook trust differs from the CLI automation path

The existing runner supplies `--dangerously-bypass-hook-trust` to `codex exec`.
In the app-server probe, passing that flag before the subcommand still left
the reviewed hooks untrusted and they did not execute.

The isolated TUI's supported hook-review flow successfully persisted trust for
the exact observer and unchanged review hook definitions. Its resulting local
configuration used `hooks.state.<hook-key>.trusted_hash`. A fresh probe applied
the same reviewed hashes through `config/value/write`, and `hooks/list`
confirmed trust. Retained `hook/completed` evidence showed the unchanged Darrow
Review SessionStart hook executing and returning its normal context.

This affects only the isolated experiment host. Global user configuration was
not edited. Installing a plugin alone does not trust its hooks; the
[official hooks documentation](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)
requires review of each exact definition. The pilot must reproduce the enabled
hook behavior of its control using only the already-reviewed fixture hooks.

### A working observer still cannot read the native launch contract

The `Agent` matcher did not match this host's collaboration launch. A fresh
probe with a trusted wildcard observer captured the actual canonical names:
`collaborationspawn_agent`, `collaborationwait_agent`,
`collaborationsend_message`, `collaborationlist_agents`, and `Bash`.

The launch record exposed the requested task name, concrete model/effort and
`fork_turns`. Its `message` value was encrypted. The feedback message was also
encrypted. Public child history exposed executed commands and the final
response, but no initial assignment. No decryption or inference from the
parent's intended wording was attempted.

Thus another passive hook does not close the native launch-evidence gap on
this tested path. Requiring a plaintext contract receipt would be a new
behavioral step. It must not be silently added to the unchanged control.

## Experiment implications

1. Preserve the parent and review/verification policies. Put the exact selected
   model and effort on the owner and verify the returned route.
2. Preserve the full submitted B/C contract as a user message with
   `thread/inject_items` before execution. Use the same delivery interface in
   B/C; goal attachment is their difference.
3. Match available capacity and enabled hook behavior explicitly.
4. Keep the transport alive until the owner has returned its complete final
   response. A goal-state event alone is insufficient.
5. Capture actual public provider results, owner results, parent relay, target
   identity and goal transitions. Keep missing evidence unknown.
6. If A stays unchanged, use it for behavioral comparison and assess launch
   omissions versus drift only when its available evidence supports that
   distinction. Use B/C to isolate the effect of goal persistence.

No claim that native goals improve Adaptive Delivery can be made from these
protocol probes. The matched delivery experiment remains necessary.

## Retained evidence

All raw protocol evidence and prototype scripts are local and gitignored:

- Smoke audit and closeout script hashes (`evals/results/adaptive-owner-proposal-2026-09-30/smoke-audit.json`)
- First goal probe, with premature disconnect (`evals/results/adaptive-owner-proposal-2026-09-30/smoke-2026-09-30T15-18-41.531Z/summary.json`)
- Corrected goal and response probe (`evals/results/adaptive-owner-proposal-2026-09-30/smoke-2026-09-30T15-20-51.514Z/summary.json`)
- Native capacity control (`evals/results/adaptive-owner-proposal-2026-09-30/capacity-native-2026-09-30T15-24-21.213Z/summary.json`)
- App-server capacity probe (`evals/results/adaptive-owner-proposal-2026-09-30/capacity-app-2026-09-30T15-25-31.933Z/summary.json`)
- Untrusted hook probe (`evals/results/adaptive-owner-proposal-2026-09-30/launch-evidence-2026-09-30T15-27-34.345Z/summary.json`)
- Persisted trust, Agent matcher probe (`evals/results/adaptive-owner-proposal-2026-09-30/launch-evidence-2026-09-30T15-30-39.096Z/summary.json`)
- Trusted wildcard observer, encrypted launch (`evals/results/adaptive-owner-proposal-2026-09-30/launch-evidence-2026-09-30T15-32-58.013Z/summary.json`)
- Contract injection setup failure (`evals/results/adaptive-owner-proposal-2026-09-30/contract-order-2026-09-30T15-41-20.684Z/summary.json`)
- User-role contract before goal activation (`evals/results/adaptive-owner-proposal-2026-09-30/contract-order-2026-09-30T15-41-52.031Z/summary.json`)
- Native capacity returns and effective routes (`evals/results/adaptive-owner-proposal-2026-09-30/capacity-native-evidence.json`)
- Final-response regression checks (`evals/results/adaptive-owner-proposal-2026-09-30/final-response.test.ts`)

The audit hashes describe the prototype sources at closeout. These sources
evolved during the probes; the hashes are not proof of a frozen candidate for
every earlier run. Freeze the delivery experiment's inputs before its trials.
