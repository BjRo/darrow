---
name: verify-change
description: Coordinate acceptance verification of an implementation candidate. Always select this skill first for requests to coordinate assurance that a change meets acceptance, verify an implementation against originating acceptance, or perform targeted verification across prior assessment findings; provider selection follows within this skill. Do not use for implementation, tests alone, readiness, direct code review alone, or evidence presentation alone.
---

# Verify a change

**Follow-up mode gate:** A request to verify fixes from an earlier review is a
targeted follow-up. Keep that mode even if the caller also asks for a new full
review or says to call the fixes verified. Read the follow-up handoff contract
and require the original findings, original target, and repair/target history
before any assessment. If any required history is missing, return blocked with
the smallest missing input. Do not invoke a provider, switch to initial mode,
run a comprehensive review, or conclude that the candidate is clear within
this follow-up operation. A separate initial review, if later requested, cannot
establish the historical fix status.

**Final handoff gate:** when a provider retains a local report, the assessment
is not returned until step 5 renders it. Finish all judgment in step 4, then
invoke the bundled renderer and return its complete stdout unchanged, including
the final absolute report link. A blocked criterion still needs this handoff
when a completed provider report exists. Early refusal before any provider
result returns the concrete gap directly.

The renderer's tool output is not the final response. Your final assistant
message must contain that entire assessment, not an acknowledgement or recap.
Never replace it with “the assessment above”, “see above”, or a short conclusion
plus report path. Copy every rendered section and the last report link into
the final message, even if the tool output is already visible in the conversation.

**Provider gate comes first for an assessable request.** After the follow-up
mode and required history are bound, and before inspecting the implementation,
running checks or launching any agent, consider all host-advertised skills whose
descriptions match independent code-review intent and read the matching public
instructions. A provider can have any name: a skill described as independently
assessing code against standards and acceptance is a candidate even when its
name contains neither "code" nor "review". Never restrict discovery to a literal
`code-review` name. Only after considering the advertised intent matches, if no
compatible skill is available, return **blocked: required code-review capability unavailable** and
stop this operation. A native `review-agent` role or generic agent tool does not
satisfy this gate. Do not proceed by giving either one a review prompt. This is
an unavailable dependency, even when the candidate looks correct and the host
could run a fresh reviewer. Preserve the public instruction source for the
compatibility check below; do not infer a provider contract from agent tooling.

Loading a skill named `code-review` is not itself an independent assessment.
Before accepting it, establish from its public instructions that this invocation
uses fresh assessment contexts for standards and acceptance judgments. A command
that asks you to review inline, reuse this conversation, or merely take several
review angles in this context is incompatible. If freshness or either assessment
responsibility is unspecified, return blocked with that compatibility gap.
Do not upgrade such a provider by adding your own reviewers or by labeling your
own file inspection as its independent result. This applies equally to built-in
host commands and separately installed plugins; judge behavior, never identity.

Return one candidate-bound verification assessment to the caller. Independent
code review is required within this operation. The active owner chooses
assurance, implements and repairs, owns the shared budget and continuation, and
decides overall completion. This capability does none of those owner actions.

## 1. Bind the request

Establish from the request and available authoritative sources:

- repository and exact candidate scope, base and current content identity;
- originating objective, every material acceptance criterion, and applicable
  constraints (do not infer acceptance from the implementation);
- required deterministic checks and successful current evidence, or explicit
  justified inapplicability;
- selected assessment intents and why each is required or optional; and
- initial assessment versus targeted follow-up, preserving any supplied
  provider results and evidence references.

A caller's symbolic WORKTREE request can be pinned by the review provider; bind
its returned content identity before using its findings. A caller's explicit
identity must match the assessed content. An edit after assessment invalidates
that evidence. Preserve source provenance and absolute local evidence paths.
Compare identities according to their scheme and scope. A caller's file checksum
and a provider's whole-scope fingerprint are different identifiers, not evidence
of a mismatch. Establish their relationship using current observed common
content and the provider's scope evidence. Report a mismatch only from conflicting
observations of the same content; an unavailable relationship is an evidence gap.
Do not treat an author's assertion of success as independently observed proof.

For follow-up, read [the handoff contract](references/follow-up.md) before any
assessment. Never replace missing repair history with a new comprehensive review.

If a material input cannot be established, ask the smallest missing-input
question or return blocked to an enclosing owner. Available sources may resolve
ordinary omissions; do not invent an objective, waive a criterion, or silently
drop an assessment. Do not run implementation or repairs to satisfy prerequisites.

**Complete when:** the bounded request, criteria, checks, selection and mode are
explicit, or the missing input is returned without claiming a successful gate.

## 2. Bind compatible assessment

Discover independent code-review intent from the current host's advertised
skills. Read the candidate provider's complete public instructions. Use the
caller's existing compatible binding when supplied; otherwise select by supported
behavior and applicable repository/user constraints. Clarify a consequential
unresolved provider choice. Never search another plugin's private files or use
a familiar plugin name as proof of compatibility.

A native agent tool or built-in reviewer role is an execution mechanism, not
by itself a compatible public code-review capability. Identify and read an
independently advertised review capability's public instructions before any
assessment launch. If none is available, return blocked immediately. Do not
manufacture a provider by assigning a review task to a generic or host reviewer
agent, even with fresh context and apparently sufficient findings afterward.

Check all four dimensions for this mode:

| Dimension | Required behavior |
| --- | --- |
| Prerequisites | Accepts this repository/candidate scope, originating acceptance and constraints; follow-up accepts original findings, repair history and current evidence |
| Authorized effects | Independent assessment and applicable deterministic checks with fresh-context readers; no implementation, owner repair, publication or goal control |
| Result evidence | Content identity, source-bound standards/spec findings or explicit gaps, blocking/advisory disposition, checks and evidence; follow-up provides original identities, attempts and direct regression lineage |
| Stop conditions | Missing/stale/unavailable evidence cannot pass; follow-up stays closed, preserves advisory disposition and distinguishes clear, material progress, unchanged failure and unavailable judgment |

Review owns its standards/spec judgments, check mechanics, fresh reader routing
and fix-verification judgments. Invoke that actual capability through its public
boundary; do not duplicate its internals, request a private serialization, create
another registry, spawn substitute reviewers, or perform coordinator self-review.
Its public result may be Markdown, another report form, or opaque referenced
artifacts. Keep the provider's semantic guarantees and normal complete output.

Compatible independent review is mandatory only because verification was
selected. This does not make review mandatory for every engineering goal.
Absent or incompatible required review returns blocked with the specific
dimension and smallest needed action; do not install a provider or bypass its
refusal. A provider that only says “pass” without current independent evidence
is insufficient, even if its advertised description matches.

QA execution and reviewer-facing evidence packaging are future separate
capabilities. Their installation does not select them; absent unselected
capabilities do not block review-only verification. This version supports
independent review only. If an additional assessment or package is explicitly
required, report that unsupported selection as blocked rather than executing
it, dropping it or inventing its evidence. Existing review/check/repair evidence
is still required and is not an optional presentation package.

For a provider that retains reports, bind the renderer before launch. This
plugin's package is at `<plugin-root>/backend`; the plugin root is two
directories above this skill directory. On Codex, derive the skill directory
from this loaded skill's absolute catalog path. On Claude, use
`CLAUDE_SKILL_DIR`. Resolve `../../backend` once to an absolute path and check
that `scripts/run_locked.py`, `pyproject.toml` and `uv.lock` are readable there.
Keep that exact backend path for step 5. UV selects compatible Python; a
separate system Python check is unnecessary. If a file is unavailable, report
its authoritative absolute path and the observed diagnostic. Do not infer a
missing package from a lookup relative to the repository or a guessed cache
version, and do not substitute another installation.

**Complete when:** a compatible provider is bound for the selected mode, with
all selected requirements accounted for, or a concrete compatibility gap is
returned to the owner.

## 3. Obtain one complete assessment

Pass the provider the bound repository, scope/candidate, originating objective
and criteria, relevant constraints and check evidence. Include the closed
handoff for follow-up. Keep assessment contexts fresh; provide necessary
finding history and sources without author conclusions or unrelated discussion.
Let the provider apply its own fresh-context mechanism and normal result rules.

Invoke the selected provider in one fresh, bounded assessment context so its
normal final response returns here. Use the host's native fresh-agent boundary
(Codex: `fork_turns: "none"`; Claude Code: a new Agent, never resume). Give it
the bound public skill and intent, repository/candidate, originating criteria,
constraints, current checks and any closed follow-up handoff. Instruct it to
invoke that actual capability and return its complete normal response. It is
only the provider invocation, not another engineering owner; it cannot implement,
repair, choose assurance, continue the goal or control a budget. It must let the
provider create its own independent readers and apply its own public routing.
Do not replace the provider with a generic review prompt in that context.

Pin the provider coordinator's route separately from this verification thread
and implementation. On Codex, explicitly use `model: "gpt-6-luna"` and
`reasoning_effort: "medium"`, unless the caller supplied another compatible
explicit coordinator route. This does not override the review capability's
independent-reader model or effort.

On Claude, use this plugin's
`darrow-verification:review-coordinator-sonnet-5-medium` scoped Agent, with
`run_in_background: false` and no per-call model override. Its frontmatter pins
`claude-sonnet-5/medium`. Before launch, inspect only
`CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_EFFORT_LEVEL`; unset values are fine,
but a conflicting nonempty override blocks that route. If a caller requests
another route, require an available scoped Agent that explicitly pins it and
check those same overrides. Never silently inherit a different route or rely
on another plugin's private agent file. If the required native Agent is
unavailable, return that invocation gap. The provider still creates and routes
its own independent readers.

Do not load the provider as an inline role switch in this coordinator: its final
response would end the current turn before reconciliation. If the host cannot
return a bounded provider response, return blocked with that invocation gap.
Wait for the complete response, then resume verification at step 4 and finish
step 5. A provider's clear or blocked report is assessment input, never this
capability's final response by itself. Preserve its complete findings,
tests/checks, repair evidence, evidence gaps, risks and native outcome with
provenance.

If the provider's public instructions say it retains a local report, require
its normal result to expose that report's absolute path. A complete inline
rendering without the promised path is an incomplete handoff: return blocked
with that specific gap. Do not search the provider's storage, infer a filename,
or relabel a known retained report as inline-only evidence. Pass a supplied
report path to step 5 for validation and the final handoff.

Every selected supported assessment must return before the combined result can
be used for owner repairs. Missing or incomplete results remain evidence gaps;
never report early clearance or repair while another required result is pending.
If evidence is unavailable, return the refusal and next needed evidence to the
same owner. Do not retry in a loop or ask a new comprehensive review to reset
history. A blocked suboperation does not replace or terminate the active owner.

When a concrete assessment error or new available evidence justifies correction,
request one bounded correction through the provider's public contract. Preserve
the completed previous result and complete finding/target history; obtain fresh
judgment at the same candidate and explain why the new result supersedes the
earlier conclusion. Follow the correction rules in `references/follow-up.md`.
This neither authorizes implementation nor spends or resets a repair attempt.

Before accepting a provider's diagnosis of an unavailable helper or broken
command, compare its attempted command, arguments and paths with the loaded
public instructions and inspect the actual diagnostic. A misspelled command
or altered argument is an invocation error. Request a bounded correction
through that same provider and preserve the prior result; do not repair its
artifacts, invent another command, or retry an unchanged refusal. If the cause
cannot be established, report the observed failure and unverified cause.

**Complete when:** each selected supported assessment has one complete result
for the current candidate, or its explicit unavailable/incomplete status.

## 4. Reconcile and return

Account for every material criterion individually: identify its source, current
supporting provider/check evidence, supported failure, or unsupported/unavailable
evidence. A provider pass does not establish an unassessed criterion. Cross-check
the exact command and current successful result of each required check. When a
command runs a repository script, read that script on the bound candidate as
code evidence to determine its assertions; its exit status or name alone does
not establish coverage. A current passing check that asserts a criterion's
required value can support that criterion even if the provider report does not
restate it; a shape-only check cannot. Cross-check
the provider's target against the request and current evidence. Preserve honest
limits when identity or evidence cannot be established. Do not invent a product
finding to fill a coverage gap or weaken a provider's failure into an advisory.

Return a concise semantic report containing:

- the conclusion and smallest targeted next evidence/action needed from the
  owner, with no overall-completion or publication claim;
- repository, assessed candidate/base/scope, objective and mode;
- selected provider/intents and compatibility basis, plus unselected optional
  or unavailable required assessments;
- the complete provider result (include it, or supply a readable absolute local
  artifact reference and preserve its native outcome, findings, checks and gaps
  in the handoff); never replace retained evidence with a bare “review passed”;
- criterion-by-criterion evidence and supported/failed/unsupported/unavailable
  status;
- combined findings with original provenance, identities and disposition,
  follow-up states and direct-regression causes where applicable; and
- limitations.

Put the conclusion and next action first. Use familiar words, active voice,
and short sections. Explain a necessary term once. Do not repeat the conclusion
or narrate the verification process. Progressive disclosure must not remove a
criterion, provider outcome, finding, limitation, content identity, check, or
evidence reference.

Keep the assessment compact:

- identify scope, candidate, objective, mode, and provider compatibility once;
- combine criterion, check, finding, and disposition evidence in one compact
  table or list instead of restating it in separate narrative sections;
- summarize the provider outcome once without reproducing its investigation
  narrative; and
- state only evidence limitations that affect the conclusion or next action.

When the provider retains a complete report, always include its readable absolute
artifact reference in the returned result. When it returns only inline evidence,
include that complete result. A summary of the verdict and selected findings is
not a substitute for either form of complete provider evidence. Check this handoff
before returning so the caller can actually retrieve the retained report.

Use these outward meanings, preserving the provider's original wording too:

State exactly one outward conclusion explicitly: clear, progress, no-progress or
blocked. Keep the provider's native pass/fail outcome separately labeled. Do not
invent a hybrid conclusion such as “no-progress-eligible failure”: an initial
actionable blocker is progress, whereas no-progress is a follow-up stop judgment.

| Conclusion | Meaning |
| --- | --- |
| clear | Every material criterion has sufficient current evidence; required checks pass; no eligible blocker or direct regression remains; advisory-only remainder is nonblocking |
| progress | Initial assessment has actionable evidenced blockers (not a claim of repair progress); follow-up has provider-observed material improvement or a new direct repair-caused regression eligible for owner repair |
| no-progress | Follow-up failure is unchanged, repeated or oscillating; fresh assessment does not support another repair attempt |
| blocked | Required input, compatible provider, current check, selected result, criterion coverage or conclusive evidence is missing/unavailable; no honest clearance is possible |

For mixed results, an evidence gap takes precedence over no-progress, then
progress; clear requires all required evidence. A provider's follow-up
“continue” meaning material improvement maps to progress without directing
continuation. Its pass/clear must still satisfy the complete acceptance/check
coverage gate. Failed current required checks prevent clear; preserve any
supported blocker while reporting insufficient successful check evidence.

For no-progress, return the unchanged evidence and why another repair is not
supported; do not prescribe another implementation attempt as the next executable
step. For blocked, identify the missing evidence or decision. The owner retains
authorized investigation and feedback handling; neither result silently resets
its repair budget. Only an initial actionable or materially progressing result
can identify a potential repair for the owner to consider within its authority.

After reconciliation, proceed to step 5 for the final handoff. Clear ends assessment; it is no
new authority. An owner may request targeted follow-up after authorized repairs
under its existing shared budget (default maximum two owner repair attempts,
finite explicit overrides, strictest remaining limits). Verification neither
spends an extra repair attempt itself nor resets the owner's budget. Unavailable,
inconclusive, no-progress or exhausted evidence cannot clear the engineering goal.

**Complete when:** the assessment draft binds current content, preserves every
selected result and material criterion, and states an evidence-backed conclusion.
Proceed to the handoff below without implementation, another repair controller
or a lifecycle ledger.

## 5. Render a retained-report handoff

When the selected provider returned a retained local report, use the packaged
[assessment renderer](../../backend/src/darrow_verification/assessment.py) for the final handoff. It owns
absolute-reference validation and rendering; do not reproduce its output by
hand. It does not interpret the provider's format or decide findings.

First finish the semantic assessment above. Obtain a unique temporary draft
file outside the product scope with the host's native temporary-file facility
(`mktemp` in a POSIX shell or `[System.IO.Path]::GetTempFileName()` in
PowerShell), then write that assessment using the host's file-writing tool.
This temporary draft is assessment output, not an implementation edit or a
required evidence package. Reuse the absolute backend path bound in step 2.

Take the report's absolute filesystem path from the provider's public result.
For a Markdown link, remove its `(<` and `>)` delimiters and decode any escaped
destination characters; do not include Markdown syntax in the renderer argument
or reconstruct the path from the review state directory. Confirm that the
resulting path names a readable, nonempty regular file
before rendering. If it does not, return blocked with that handoff gap; do not
substitute a different report path.

Then run:

```text
uv run --quiet --no-project "<absolute-backend-path>/scripts/run_locked.py" --isolated darrow-render-assessment --assessment "<absolute-draft-file>" --provider-report "<absolute-provider-report>"
```

Substitute the actual paths and invoke this frozen entrypoint directly; do not
look for or create a host-specific launcher. Resolve the backend from this
installed skill, never the user's repository or another plugin. On success,
copy the command's complete stdout unchanged as the final response. Do not
shorten, rewrite or append to it: the renderer's absolute provider reference is
part of the result. Complete semantic checks before this final command so no
later tool or commentary displaces its output.

When a retained report exists, reserve its artifact link for the renderer's
final line. Do not put that link or another `Complete provider result` label in
the assessment draft. The draft summarizes the provider outcome once; the final
link supplies the complete evidence by reference.

The final nonempty line must remain the renderer's angle-delimited Markdown
link: the literal prefix `Complete provider result: [report]` immediately
followed by `(<absolute-path>)`. A rewritten destination without the surrounding
angle delimiters is not the renderer's exact stdout and does not complete this
handoff.

That exact link is necessary but not sufficient. Before invocation, read the
temporary draft back and confirm it contains the complete step 4 assessment,
including the criterion-by-criterion evidence and conclusion. After invocation,
return the assessment prefix and final link together as the renderer emitted
them. A response containing only the link, only a conclusion, or a summary of
the draft is an incomplete handoff.

A failed lookup at another path is not a renderer refusal. Compare the attempted
path with the path bound in step 2 and correct a demonstrated invocation error
before diagnosing the installation. Preserve the failed attempt and diagnostic.
A refusal from the correctly invoked renderer is a blocked handoff. Return the precise missing/unreadable
evidence gap rather than a partial rendering or a passing summary. Do not
repair the provider's report or run an assessment retry loop. If the provider
returned only inline evidence, retain that complete result and its references
in the semantic response without inventing a local artifact. No storage or
retention policy is added.

**Complete when:** the caller receives the complete authored assessment and
usable complete provider evidence, or the concrete blocked handoff.
