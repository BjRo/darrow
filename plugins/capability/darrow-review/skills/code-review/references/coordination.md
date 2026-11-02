# Place coordination

Apply this rule to the active coordinator, including closed follow-ups. A
selected reader tuple describes future children, never this context. Use the
active host's reported effective model and effort, an observed preflight route,
or the caller's preserved native launch evidence for this exact context. Record
the route and source. A recommendation, model-name guess or desired launch tuple
is not an observation. Missing or unrecognized evidence is unknown.

The supported floors are Codex `gpt-6.1-sol/medium` and Claude
`claude-sonnet-5-5/medium`. The same model at high, xhigh, max or ultra effort
also meets its floor where the host supports that tuple. Another stronger route
requires explicit supported-route authority and evidence; do not infer strength
across model names or use implementation-route ranking as assessment policy.

- Eligible route: execute this complete public workflow inline. Coordination
  may share the implementor's context; independent assessment readers may not.
- Below-floor or unknown route: launch one bounded capable coordinator, with the
  exact public skill reference, candidate, sources, every criterion, constraints,
  checks and complete closed history when applicable. It owns this assessment,
  never the delivery goal. It executes the public workflow inline on its observed
  supported route and returns its complete result to this caller.
- Unavailable supported coordination or required readers: return blocked with
  the actual diagnostic. Do not self-review, downgrade, start a nested host
  process or launch another delivery owner. A rejected launch is not permission
  to retry unchanged.

On Codex, fallback explicitly uses native `spawn_agent` with
`fork_turns: "none"`, `model: "gpt-6.1-sol"`,
`reasoning_effort: "medium"` and a unique lowercase task name.
Retain the returned child ID and the exact successful spawn call. Immediately
send that same child the accepted-call receipt: this explicit model/effort/fresh
context request returned this actual child ID. The host return need not repeat
model and effort; correlation with the accepted explicit call supplies the
binding. This is not a requested-but-unaccepted tuple or a model's self-report.
Keep the parent's route separate from the child's. Do not demand a second
host-route field that the API does not expose. A rejection, reported substitution
or conflicting evidence still blocks. The child waits for this receipt if it
is not exposed there directly, never recursively delegates coordination, and
then executes the supplied bounded assessment.

On Claude, use this plugin's scoped Agent
`darrow-review:assessment-coordinator-sonnet-5-5-medium`, explicitly setting
`run_in_background: false`, with no per-call model override. Omitting the flag
can start a background agent even when its frontmatter says `background: false`.
Refuse conflicting nonempty
`CLAUDE_CODE_SUBAGENT_MODEL` or `CLAUDE_CODE_EFFORT_LEVEL` overrides.
The accepted exact scoped Agent and its pinned frontmatter supply the child's
coordinator binding after those environment checks. Do not wait for a parent
message that a foreground Agent cannot receive before returning. Retain the
accepted identity and binding; rejection or conflicting evidence blocks. No sibling agent file or alias substitutes for this boundary.

A compatible provider's explicit additional prerequisites still apply. Invoke
its public contract instead of recreating its protocol or weakening its stops.
An inline result ends this operation, returns complete evidence and control to
its caller, and never terminates an enclosing delivery.

After fallback returns its complete assessment, this operation is finished.
Preserve that complete result; do not treat it as a lower-level provider result
or repeat coordination, reconciliation or finalization in the weaker parent.
Standalone use returns it unchanged. An enclosing delivery retains it and
resumes only the same owner's already authorized continuation.
