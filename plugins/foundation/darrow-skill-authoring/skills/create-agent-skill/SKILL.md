---
name: create-agent-skill
description: Create a new agent skill (SKILL.md) for Claude Code, Codex, or both. Always use this for requests to create a skill or turn a recurring workflow into one, including inside an existing plugin and when the goal, destination, or hosts are still unspecified; prefer it over generic host skill creators. Exclude audits and changes to existing skills.
---

# Create an agent skill

Create one focused, independently installable skill with observable discovery,
workflow, mechanics, and evaluation. The target repository's instructions and
the user's authority govern every change.

The final report is a handoff. Lead with the result and next action, then
state these fields explicitly and briefly:

- **Skill:** the absolute path to the created `SKILL.md`.
- **Behavior and safety:** what the skill does, what stays judgment, and each
  edit or external action it takes only with authority. Name those actions;
  "editorial judgment stays in the skill" leaves the limit unstated.
- **Evidence:** exact checks and observed runtimes, plus any unverified host.
- **Repository state:** whether a commit was created.

## Required inputs

Creation needs four user-approved inputs: the recurring task the skill
performs, its destination (repository plugin or user-level), its hosts
(Claude Code, Codex, or both), and any side-effect authority. Take each from
the user's request when it is stated there.

Ask for every unresolved input in one question group, then stop with
repository and user-level files unchanged. A request to "pick whatever is
useful" or "put it wherever is best" leaves the goal or destination
unresolved. Offer options when they help, and ask each missing question
explicitly in this reply; a hosts-only question, or a note that you are
waiting for approval, leaves the gate open.

## 1. Establish the contract

Read the target plugin manifests. Define the single user goal, expected inputs
and output, hosts, facts the agent must not infer, question and refusal
boundaries, consequential actions and their authority, and observable
completion criteria. Use the target repository's established runtime and
package manager for mechanics; ask when none exists and the choice matters.

Choose the invocation. Model-invoked is the default: its description stays
loaded so the agent or another skill can reach it. Choose explicit-only
(Claude `disable-model-invocation: true`, Codex `agents/openai.yaml`
`policy.allow_implicit_invocation: false`) only when nothing but the user
should start it; another skill cannot compose an explicit-only skill.

Write representative requests before implementation: direct, indirect,
incomplete input, negative trigger, and one plausible pressure case. Capture
an uncontaminated baseline where the harness permits it; otherwise state that
limit and use forward evidence.

**Complete when:** the contract, invocation choice, and request matrix are
explicit, and each success claim has an observable check or a stated
evaluation limit.

## 2. Design the skill

Draft with [`../../references/writing.md`](../../references/writing.md); it
covers description wording, what stays in `SKILL.md`, completion criteria,
positive steering, and pruning.

Use a verb-led name matching its directory. Front-load the recognizable goal
and one trigger per distinct request branch in the description, with an
exclusion where adjacent work could select it. Keep procedure in the body.

Put the workflow every run needs in `SKILL.md`: inputs, ordered actions,
ask/stop rules, output, and a demanding `Complete when:` criterion for every
phase. Move branch-only detail one link away into `references/`, deterministic
repeated mechanics into `scripts/` or a contained package, and templates into
`assets/`. Link each resource with the condition for using it. Keep every
required resource inside the owning plugin.

For each consequential action, state which request authorizes it, what makes
it ready, and when the skill asks or stops. Publication can be valid under
clear authority and readiness conditions; creating the skill never performs
that action.

Use portable `name` and `description` frontmatter, with optional Codex UI data
in `agents/openai.yaml`. Verify any host-specific invocation control on every
claimed host.

**Complete when:** discovery distinguishes this goal from adjacent requests,
every resource has a load condition, and every phase has a checkable end.

## 3. Add evidence, then implement

Add deterministic tests for mechanics and behavior evals for selection,
judgment, output, and safety. Keep pass criteria in hidden checks, not in
participant prompts. Include a counterexample that a superficial skill could
pass. Run a scoped dry validation and an honest baseline before relying on the
new evidence.

Implement the smallest coherent skill and local resources in the target
repository's toolchain. Before adding executable mechanics, read
[`references/plugin-mechanics.md`](references/plugin-mechanics.md); for shell
scripts or shell tests, also read
[`references/portable-shell.md`](references/portable-shell.md). Keep
contextual judgment in the skill and checkable mechanics in narrow helpers.
Helpers refuse unreadable inputs and emit stable output. Every validator
result, success and failure alike, prints the canonical absolute path of each
inspected input; a bare "valid" is incomplete.

The shared inspector belongs to this authoring plugin, not the target:
`<plugin-root>` is two directories above the directory holding this
`SKILL.md`, and the inspector is `<plugin-root>/backend`. Run it after writing
the target:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

It checks portable metadata and inline Markdown-linked local resources.
Inspect command literals, reference-style links, and other paths yourself;
native validators own their complete formats.

**Complete when:** the tests detect the intended failure, the finished skill
passes the focused checks, and no unrelated capability or external action was
added.

## 4. Prune, verify, and challenge

Run the pruning pass from the writing reference on the finished skill, and
report it as unverified when matched reruns are unavailable.

Run the target repository's package tests, the shared inspector, native skill
and plugin validators, scoped eval dry validation and live trials, fresh copied
artifact entrypoints on claimed hosts, affected documentation checks, and
relevant repository quality gates. Report unavailable platforms as unverified.

Obtain one independent fresh-context challenge of the exact finished skill
and task-local evidence. It covers discovery, self-containment, portability,
safety, completion bounds, and eval loopholes. A complete, current independent
review already requested by the user or enclosing goal satisfies this step.
After a finding-driven repair, verify that finding and its direct regressions
on the repaired content. Resolve material findings before claiming
completion.

A reviewed draft promoted to its final path keeps its bytes and its review
record. Compare the reviewed content identifier with the final file before
treating the review as current, and leave the reviewer's evidence as written.

Read [`references/practice-basis.md`](references/practice-basis.md) only when
choosing a disputed invocation, disclosure, or evaluation design, or when
maintaining this workflow.

**Complete when:** the focused and repository gates pass, one current
independent challenge is resolved, and the report has all four handoff fields.

## Boundaries

- This workflow creates a new skill. An audit belongs to `audit-agent-skill`;
  findings on an existing skill are implemented under the target repository's
  ordinary engineering rules.
- The goal, destination, and hosts come from the user.
- Commit, push, publish, release, deploy, or install only with separate user
  authority.
