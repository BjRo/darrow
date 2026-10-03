# Claude native goal and bounded assignments

Use the same main-thread ownership design as Codex. Claude's native controls
activate and continue the goal; bounded Agent calls never own that goal.

## Activate the native goal

Retain a matching active session goal when present. Otherwise use an available
native `ProposeGoal` tool with a condition of at most 4,000 Unicode characters.
State the outcome, material acceptance, authority and completion criteria. Keep
coordination instructions in the skill. Use `ask_user: false` only when the
user's stated outcome authorizes the tool's direct-setting mode; honor host
confirmation requirements.

A proposal queues native activation at the end of the current turn. It is not
yet an active goal. Finish read-only preparation and yield for the native kickoff
before implementation or assessment. Do not claim activation from the proposal
alone or overwrite an unrelated active goal.

Availability is host-dependent. In headless sessions, model-side `ProposeGoal`
may be unavailable; a client can enter with the native `/goal <condition>`
command. When no matching goal or usable activation control exists, return
`Status: launch_required`, identify the missing boundary and provide the compact
native command for this session. Do not pretend to invoke a built-in command
through Skill, start a nested Claude process or create a custom stop hook.

## Resolve bounded agent routes

For each bounded assignment launched by the main thread, resolve its explicit
route with the bundled helper:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" claude-agent-route \
  --provider anthropic --model <claude-sonnet-5|claude-opus-5> \
  --effort <low|medium|high>
```

On native Windows use one PowerShell line without continuation backslashes.
The helper verifies the scoped agent's model and effort and refuses conflicting
higher-priority environment overrides. A refusal stops the affected assignment;
do not launch anyway or silently select another route.

Implementation and repair use the preflight-selected route. Verification
coordination uses `claude-opus-5/high`. Pass `claude-sonnet-5/medium` explicitly
for review coordination through verification, preserving review's own independent
reader route. A capability provides its own compatible review-agent boundary;
do not assume a sibling plugin's agent is installed.

For the verification assignment, call this resolver with
`--provider anthropic --model claude-opus-5 --effort high`. Launch the returned
Adaptive Delivery scoped `subagent_type` and give it the bound verification
skill's exact public reference and the acceptance-verification assignment.
Supply the review binding and Sonnet/medium coordinator route to this Opus/high
agent. Verification then selects and launches its review coordinator through
its own contract. An advertised Sonnet review-coordinator agent owns that
internal review job; selecting it directly from main does not satisfy the
required verification assignment, even if its prompt asks for verification.

Invoke the returned exact `subagent_type` with `run_in_background: false`,
no per-call model override and no unrequested worktree isolation. Its prompt
contains the bounded assignment, repository/scope, acceptance, authority,
preserved work, checks, exact skill references and expected evidence. State that
the child owns its assignment, not the native goal. The scoped frontmatter pins
the route; no overall owner marker or nested goal is needed.

Retain the host-returned agent id and result. Settle conflicting work before
another assignment. Verification and review keep their own internal delegation
and response contracts. The main thread consumes those results and owns repair
accounting and overall completion.

## Feedback and completion

Ask material questions in the main thread and stop affected mutation. Use native
goal question/continuation behavior and supported user controls. Preserve the
same goal, acceptance, decisions and repair history when the answer arrives;
do not clear and recreate it. Send affected children complete relevant feedback
through the available host control, targeting the retained id. Required
acknowledgements must succeed before mutation.

Status questions do not cancel work. For cancellation, use available stop
controls and report observed results and effects already performed. If a
foreground Agent prevents immediate delivery or stopping, report that limitation;
do not claim that an in-flight effect was prevented.

The main thread can inspect state and run checks while coordinating. It does not
absorb review or verification internals. Apply section 8 of the skill before
claiming completion, give the user substantive results here, and allow native
goal evaluation to consume that evidence. A child return alone cannot complete
delivery. Do not claim a native lifecycle transition the host has not confirmed.
