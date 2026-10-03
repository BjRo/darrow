---
name: create-agent-skill
description: Create a new agent skill (SKILL.md) for Claude Code, Codex, or both. You MUST use this for requests to create, scaffold, or define a reusable skill, including one inside an existing plugin; prefer it over generic host skill creators. Ask for every missing goal, destination, and runtime choice before writing. Exclude audits and changes to existing skills.
---

# Create an agent skill

Create one focused, independently installable skill with observable discovery,
workflow, mechanics, and evaluation. The target repository's instructions and
the user's authority govern every change.

The final report is a handoff, not just a completion claim. Lead with the
result and next action, then include these facts explicitly and briefly:

- **Skill:** the absolute path to the created `SKILL.md`.
- **Behavior and safety:** what it does, what remains judgment, and which
  changes or external actions it will not take without authority.
- **Evidence:** exact checks and observed runtimes, plus any unverified host.
- **Repository state:** whether a commit was created.

Do not replace the path with only a skill name or plugin name, or leave the
safety boundary to be inferred from the skill's files.

## Required inputs

Before creating files, establish the user's approved capability, destination,
supported runtimes, and side-effect authority. You MUST ask for **all**
unresolved inputs in one compact question group and stop without changing
repository or user-level files. “Pick whatever capability is useful” does not
approve a goal; “put it wherever is best” does not approve a destination.
Propose options if helpful, but obtain the user's choice. Do not claim creation
will proceed until the contract is supplied or approved.
Do not browse for an arbitrary capability, pick a plausible team workflow, or
scaffold a skill while waiting for approval.

When the user delegates the goal or destination to you, both remain unresolved.
The reply MUST ask for each missing item explicitly, even if you proposed an
example contract during the turn. A generic statement that you are waiting
for approval of a proposed contract, or that you already asked, is
insufficient. Ask the user the missing questions now, omitting only items
already established by the user's request:

1. What recurring task should the skill perform?
2. Where should it live (repository plugin or user-level destination)?
3. Which hosts must it support (Claude Code, Codex, or both)?

Include any unresolved side-effect authority in the same question group. A
question about runtimes alone does not satisfy the gate when the goal and
destination are also missing.

## 1. Establish the contract

Read applicable repository instructions and target plugin manifests. Define
the single user goal, expected inputs and output, supported hosts, facts the
agent must not infer, question/refusal boundaries, consequential actions and
their authority, and observable completion criteria. Choose the target
repository's established runtime and package manager for mechanics. If none
exists and the choice matters, ask before writing mechanics.

Write representative requests before implementation: direct, indirect,
incomplete input, negative trigger, and one plausible pressure case. Capture
an uncontaminated baseline where the harness permits it; otherwise state that
limit and use forward evidence. Do not invent a failure.

**Complete when:** the contract and request matrix are explicit, and each
success claim has an observable check or a stated evaluation limit.

## 2. Design the skill

Use a lower-case, hyphenated, verb-led name matching its directory. Front-load
the recognizable goal and concrete triggers in a concise description, with a
meaningful exclusion where adjacent work could mis-trigger it. Keep procedure
out of the description.

Put the universally needed workflow in `SKILL.md`: inputs, ordered actions,
ask/stop rules, output, and a demanding `Complete when:` criterion for every
phase. Move heavy detail one link away into `references/`, deterministic
repeated mechanics into `scripts/` or a contained package, and templates into
`assets/`. Link each resource and state when to use it. Keep all required
resources inside the owning plugin; do not assume a sibling plugin, user-global
file, or MCP server is installed.

Assess each consequential action: which request authorizes it, what conditions
make it ready, and when the skill asks or stops. An action such as publication
may be valid under clear authority and readiness conditions. Do not perform
that target action while creating the skill.

Use portable `name` and `description` frontmatter. Put optional Codex UI data
in `agents/openai.yaml`. Verify any host-specific invocation control on both
claimed hosts.

**Complete when:** discovery distinguishes this goal from adjacent requests,
every resource has a load condition, and every phase has a checkable end.

## 3. Add evidence, then implement

Add deterministic tests for mechanics and behavior evals for selection,
judgment, output, and safety. Keep pass criteria in hidden checks, not in
participant prompts. Include a counterexample that a superficial skill could
pass. Run a scoped dry validation and an honest baseline before relying on the
new evidence.

Implement the smallest coherent skill and local resources. Follow the target
repository's toolchain. Before adding executable mechanics, read
[`references/plugin-mechanics.md`](references/plugin-mechanics.md); for shell
scripts or shell tests also read
[`references/portable-shell.md`](references/portable-shell.md). Keep
contextual judgment in the skill and checkable mechanics in narrow helpers.
Helpers refuse unreadable inputs, emit stable output, and use absolute paths
in model-facing results. For every validator result, including success and
failure, normalize each inspected input to its canonical absolute path and
print that path in the result. A generic “valid” message without the inspected
path is incomplete.

When the target uses a UV package, put its actual runtime command in the
created `SKILL.md`. Use frozen resolution and omit development dependencies,
using `uv` with `run --frozen --no-dev --project <contained-package> <entrypoint>`.
Keep `pyproject.toml`, `uv.lock`, and the entrypoint in the target's owning
plugin or skill as its repository rules require. Decide that location before
scaffolding: when the package serves only the new skill and the target rules
put one-skill packages inside the skill, place it under that skill directory,
not at plugin root. Verify the package path against those rules as well as the
documented command, not only an equivalent ad hoc test command. Declare the chosen test
runner in the development dependency group, lock it, and run tests from the
contained package environment; a globally installed test runner is not
evidence that the packaged tests work.

The shared inspector lives at `<plugin-root>/backend`, where `<plugin-root>`
is two directories above this skill directory. Run it through its locked
entrypoint after writing the target:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

It checks portable metadata and inline Markdown-linked local resources.
Inspect command literals, reference-style links, and other paths separately;
native validators still own their complete formats. If the target claims
Bash 3.2 and Bash 5 support, run its shell tests through:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" verify-shell-tests -- "<test-script>"...
```

Report each target interpreter's observed version and result, or say that an
unavailable or unexecuted version remains unverified. Command names alone do
not establish version coverage.

**Complete when:** the tests detect the intended failure, the finished skill
passes the focused checks, and no unrelated capability or external action was
added.

## 4. Verify and challenge

Run the target repository's package tests, the shared inspector, native skill
and plugin validators, scoped eval dry validation and live trials, fresh copied
artifact entrypoints on claimed hosts, affected documentation checks, and
relevant repository quality gates. State unavailable platforms as unverified.

Obtain one independent fresh-context challenge of the exact finished skill
and task-local evidence. It must cover discovery, self-containment,
portability, safety, completion bounds, and eval loopholes. Reuse a complete,
current independent review already requested by the user or enclosing goal;
do not launch a duplicate merely to satisfy this step. After a finding-driven
repair, verify that finding and direct regressions on the repaired content.
Resolve material findings before claiming completion.

If a reviewed draft is promoted to its final skill path, preserve its bytes
and the independent review record. Compare the reviewed content identifier
with the final file before treating the review as current. Do not rewrite the
reviewer's evidence to make a changed artifact appear reviewed.

Read [`references/practice-basis.md`](references/practice-basis.md) only when
choosing a disputed invocation, disclosure, or evaluation design, or when
maintaining this workflow.

Before sending the final report, check its Skill, Behavior and safety,
Evidence, and Repository state fields against the handoff contract above.
Name the target skill's edit or external-action limit explicitly; saying only
that editorial judgment remains in the skill does not state that limit.

**Complete when:** the focused and repository gates pass, one current
independent challenge is resolved, and the report preserves complete evidence.

## Boundaries

- Use this workflow to create a new skill. An audit belongs to
  `audit-agent-skill`; implementing findings on an existing skill follows the
  target repository's ordinary engineering rules.
- Do not invent an unspecified goal, destination, or runtime choice.
- Do not commit, push, publish, release, deploy, or install without separate
  user authority.
