---
name: verify-change
description: Coordinate acceptance verification of an implementation candidate. Always select this skill first for requests to coordinate assurance that a change meets acceptance, verify an implementation against originating acceptance, or perform targeted verification across prior assessment findings; provider selection follows within this skill. Do not use for implementation, tests alone, readiness, direct code review alone, or evidence presentation alone.
---

# Verify a change

**Delegate the capability, not an axis review.** After binding its public
contract, launch the selected provider's **complete skill workflow** in a fresh
context. That provider must launch its own independent readers. Both initial
and targeted follow-up assessments retain this call chain:

```text
Verification coordinator → fresh provider coordinator → independent reader(s)
```

A single child that inspects the candidate and writes a report cannot fill both
provider and reader roles. Do not ask the provider coordinator to act as a Spec
or Standards reader. Reading its instructions does not transfer its role here.

Return one candidate-bound assessment through compatible independent review.
The active owner selects assurance, implements, repairs, controls budgets and
continuation, and decides completion. This capability performs none of those
owner actions. Verification selects review here; review is not mandatory for
every engineering task.

## 1. Bind the request

Establish from the request and authoritative sources:

- repository, candidate content identity, scope and base;
- originating objective, every material acceptance criterion and constraints;
- required checks and current successful evidence, or justified inapplicability;
- selected assessment intents and any supplied provider binding or results; and
- initial assessment versus targeted follow-up.

A request to verify earlier fixes is **follow-up**, even if it also asks for a
new full review or immediate clearance. Read the [closed handoff
contract](references/follow-up.md) before assessment. Require original findings
and target, original/prior/current history, attempted repairs and prior results.
Missing history returns **blocked** with the specific gap. Preserve this mode;
an initial review cannot establish historical fix status.

**Unsupported selection gate:** only independent review is supported here.
If the caller explicitly requires QA or evidence packaging, name the unsupported
requirement and return **blocked**; do not execute or waive it. With no completed
provider result, stop here before provider discovery, backend probes or launches.
With an already completed result, bind only the renderer as in step 2 and preserve
that result through step 5; launch no new assessment. Identify assessments not
performed. Unselected extras do not block review-only work.

Available sources may resolve ordinary omissions. Ask for a material missing
input or return blocked to the owner; do not invent acceptance, waive a criterion,
drop an assessment, or implement prerequisites. Preserve source provenance and
absolute evidence paths. An author's success claim is not independent proof.

The provider may pin a symbolic WORKTREE request. Bind its returned identity
before using findings; edits invalidate that evidence. Compare identities by
scheme and scope: a file checksum and a whole-scope fingerprint differ without
conflicting. Relate them through observed common content and scope evidence.
An unsupported relationship is a gap; only conflicting observations of the
same content establish a mismatch.

## 2. Bind compatible assessment

For an assessable request, discover and read the complete public instructions
of host-advertised independent-review capabilities **before implementation
inspection, checks or agent launches**. Match advertised intent, including
differently named providers; a literal `code-review` name proves nothing.
Honor the caller's compatible binding and resolve a consequential open choice.
Do not inspect sibling/private provider files or create another registry.
If a hook-advertised skill path is unreadable, preserve its exact error and
retry the **same capability's public catalog path**, expanding its documented
skill-root alias. A denied hook path does not prove its catalog installation
unavailable. Do not scan private storage or change access controls; if the
advertised catalog path also fails, return that concrete gap.

Check compatibility for this mode:

| Dimension | Required public behavior |
| --- | --- |
| Prerequisites | Accepts the bound repository, candidate, acceptance, constraints and checks; follow-up accepts the closed history |
| Effects | Fresh independent standards/acceptance judgments and applicable authorized checks; no implementation, owner repair, publication or goal control |
| Evidence | Current content identity, source-bound findings or gaps, original blocking/advisory disposition, checks and complete results; follow-up preserves finding identities and direct-regression lineage |
| Stops | Missing or stale evidence cannot pass; follow-up stays closed and distinguishes resolution, material progress, unchanged failure and unavailable judgment |

Fresh assessment contexts for standards and acceptance must be explicit in the
provider contract, as applicable to the mode. Inline role switching, inherited
conversation or several review angles in this thread are incompatible. A native
reviewer role or generic agent tool is not an advertised review capability.
Absent/incompatible required review returns blocked with the exact gap. Do not
install a provider, invent its contract, substitute self-review, or manufacture
compatibility by adding your own readers. A bare provider "pass" is insufficient.

If the provider retains reports, bind **this plugin's renderer backend** before
launch. Derive this skill directory from its loaded absolute catalog path on
Codex, or `CLAUDE_SKILL_DIR` on Claude. Resolve `../../backend` once to an
absolute path; require readable `scripts/run_locked.py`, `pyproject.toml` and
`uv.lock`. Keep that path for step 5. UV selects Python; no separate system
Python probe is needed. Failed lookups must name the authoritative path and
actual diagnostic, not a guessed cache/repository path or another installation.
This backend renders verification; provider review commands belong to the provider.

## 3. Obtain one complete assessment

Invoke the actual bound capability in **one fresh provider context**, with a
response boundary that returns its complete normal result here. Pass its public skill
and intent, bound sources/candidate, objective/criteria, constraints, checks and
closed follow-up handoff. Exclude author conclusions and unrelated discussion.
The provider owns its independent readers, their routes, checks and judgments;
ask it to execute that complete workflow, including its own reader delegation.
Do not reproduce those internals or request private serialization.

- **Codex:** use the advertised native `spawn_agent` with `fork_turns: "none"`,
  `model: "gpt-6.1-sol"`, `reasoning_effort: "medium"`, unless the caller bound
  another compatible explicit coordinator route. This does not override the
  provider's reader routes. Code Mode's nested tool list can omit top-level
  agent tools; an empty search there does not establish native unavailability.
- **Claude:** use this plugin's scoped Agent
  `darrow-verification:review-coordinator-sonnet-5-5-medium`,
  `run_in_background: false`, without a per-call model override. It pins
  `claude-sonnet-5-5/medium`. Inspect only `CLAUDE_CODE_SUBAGENT_MODEL` and
  `CLAUDE_CODE_EFFORT_LEVEL`; conflicting nonempty overrides block. Another
  caller route needs an available explicitly pinned scoped Agent and the same
  checks. Do not inherit silently or use another plugin's private Agent file.

If the required native boundary is unavailable, return its concrete invocation
gap. Never substitute a generic review prompt or act as another engineering
owner. Wait for every selected supported result before reconciliation or owner
repairs. A provider's final response is input to step 4, not this operation's
final response. Preserve findings, checks, repair evidence, risks, gaps and native
outcome with provenance. Missing/incomplete results remain blocked evidence;
they do not terminate or replace the owner.

A provider promising a retained report must expose its absolute path through
its public result. Missing that path is an incomplete handoff, even with a full
inline rendering. Do not search storage, infer filenames or relabel it inline-only.

For a demonstrated invocation error or concrete new evidence, request one bounded
correction through the same provider's public contract. Compare attempted
arguments/paths with its instructions and actual diagnostic before accepting a
broken-installation claim. Preserve the completed prior result and all history;
obtain fresh judgment at the same candidate and explain supersession. Read the
correction rules in [the handoff contract](references/follow-up.md). Do not edit
provider artifacts, retry unchanged refusals, restart comprehensive review or
spend/reset an owner repair attempt. Unverified causes stay unverified.

## 4. Reconcile and return

Bind the provider's target to the request and current content. Account for every
criterion using its source and current independent/check evidence, a supported
failure, or an explicit evidence gap. Read a required check's current script to
establish its assertions and confirm its exact command/result. A passing check
supports only what it asserts: shape checks do not prove required values, while
a current value assertion may support a criterion the provider did not restate.
Do not invent findings to fill gaps or weaken provider blockers into advisories.

State exactly one conclusion and preserve the provider's native outcome separately:

| Conclusion | Meaning |
| --- | --- |
| clear | Every material criterion has current evidence, required checks pass, and no eligible blocker/direct regression remains; advisories are nonblocking |
| progress | Initial actionable evidenced defects; or follow-up material improvement/new direct repair-caused regression eligible for owner consideration |
| no-progress | Follow-up failure is unchanged, repeated or oscillating; another assessment alone provides no repair eligibility |
| blocked | Required input, provider, check, result, criterion coverage or conclusive evidence is missing/unavailable |

Evidence gaps take precedence, then no-progress, then progress. Missing staging
or deployment observation is blocked even if the provider calls it a failed
criterion. Failed required checks prevent clear; retain any evidenced blocker
while reporting insufficient successful-check evidence. A provider's "continue"
meaning improvement maps to progress without authorizing continuation.

Draft a compact assessment with:

1. Conclusion and smallest next evidence/action first. **No-progress returns its
   stop reason/investigation need, never another repair recipe or conditional
   edit-and-reverify advice.** Clear ends this assessment without new authority.
2. Repository, base/scope/content identity, objective, mode and provider/intents
   with compatibility basis, stated once. Account for required/unselected extras.
3. One compact criterion/finding/check table: provenance, observed evidence,
   supported/failed/unavailable state and blocking/advisory disposition. Follow-up
   must visibly preserve every original finding/regression identity, original
   axis/disposition, current state and direct causing-original identity as the
   handoff contract requires; a report link alone does not preserve those states.
4. Provider native outcome and complete evidence, plus limitations affecting the
   conclusion or next action. With retained evidence, use step 5's final report
   reference. For inline-only providers, include their complete normal result.

Combine evidence instead of repeating conclusions or narrating the process.
Concision must preserve every material criterion, finding, check, identity, gap
and evidence reference. Keep all supported required assessments together before
returning eligible blockers. The owner alone implements, repairs and chooses
continuation under its shared limits (default maximum two repair attempts, finite
explicit overrides, strictest remaining limits). Do not allocate/count its
remaining allowance, create a lifecycle ledger or claim overall completion.

## 5. Render a retained-report handoff

When a provider retained a report, finish semantic judgment first and use the
existing renderer for the final handoff, including blocked assessments with a
completed provider report. Early refusal without a provider result returns its
concrete gap directly. A genuinely inline-only provider needs no invented artifact.

Create a unique temporary draft **outside product scope** (`mktemp`, or
`[System.IO.Path]::GetTempFileName()` in PowerShell). Write and read back the whole
step 4 assessment. Reserve the report link and `Complete provider result` label
for the renderer; exclude both from the draft.

Take the plain absolute report path from the provider result. Decode Markdown
destination escapes and remove link delimiters; do not pass Markdown syntax or
reconstruct a path from provider storage. Reuse the backend bound in step 2:

```text
uv run --quiet --no-project "<absolute-backend-path>/scripts/run_locked.py" --isolated darrow-render-assessment --assessment "<absolute-draft-file>" --provider-report "<absolute-provider-report>"
```

The frozen helper validates readable, nonempty regular inputs and the absolute
report reference, then preserves assessment bytes. It neither interprets provider
formats nor decides findings. Do not create a launcher or reproduce its rendering.
Correct a demonstrated wrong-path invocation before diagnosing installation;
preserve its diagnostic. A correctly invoked refusal is a blocked handoff with
the precise gap, not permission to substitute another report or repair its files.

On success, return **the complete stdout unchanged as the entire final assistant
message**, including its assessment and final line:

```text
Complete provider result: [report](<absolute-path>)
```

Tool output is not the final response. Do not summarize, rewrite, acknowledge,
append to it, or return only its link. Finish all checks before rendering so no
later tool or commentary displaces the complete assessment and canonical link.
