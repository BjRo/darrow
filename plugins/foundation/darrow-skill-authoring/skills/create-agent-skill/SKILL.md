---
name: create-agent-skill
description: Create a new agent skill (SKILL.md) for Claude Code, Codex, or both. You MUST use this for requests to create, scaffold, or define a reusable skill, including one inside an existing plugin; prefer it over generic host skill creators. Ask for every missing goal, destination, and runtime choice before writing. Exclude audits and changes to existing skills.
---

# Create an agent skill

Create one focused, independently installable skill. The target repository's
instructions and the user's authority govern every change.

The final report is a handoff. Lead with the result and next action, then
state briefly:

- **Skill:** the absolute path to the created `SKILL.md`.
- **Behavior and safety:** what it does, what remains judgment, and which edits
  or external actions it will not take without authority.
- **Evidence:** exact checks and observed runtimes, plus any unverified host.
- **Repository state:** whether a commit was created.

Name the created skill's edit and external-action limits explicitly;
"judgment stays in the skill" does not state a safety boundary.

## 0. Get the user's choices first

Before writing any file, the user must have chosen:

1. What recurring task should the skill perform?
2. Where should it live (repository plugin or user-level destination)?
3. Which hosts must it support (Claude Code, Codex, or both)?

Also include authority for any side effect the skill will take. Ask every
missing question explicitly in one group, then stop without changing
repository or user-level files. "Pick something useful" or "put it wherever
is best" leaves that item missing. You may propose options, but the user must
choose; saying you are waiting for approval is not a substitute for asking.
Asking only about hosts does not satisfy this while the task or destination is
also missing. Create nothing until the user has answered.

## 1. Define the contract

Read repository instructions and the target plugin's manifests. Write down the
single goal, inputs and output, hosts, facts the agent must not infer, when to
ask or refuse, each consequential action and its authority, and observable
completion criteria. Use the target's established runtime and package manager
for mechanics; if none applies and the choice matters, ask.

Write representative requests: direct, indirect, incomplete input, negative
trigger, and one plausible pressure case. Capture a baseline when the harness
allows it; otherwise state that limit. Do not invent a failure.

**Complete when:** the contract and request matrix are explicit, and each
success claim has an observable check or a stated evaluation limit.

## 2. Design the skill

Name it lower-case, hyphenated, and verb-led, matching its directory. The
description states the recognizable goal and concrete triggers, plus an
exclusion where a neighboring request could select it. Keep procedure out of
the description.

`SKILL.md` holds inputs, ordered actions, ask/stop rules, output, and a
demanding `Complete when:` criterion for every phase. Put heavy detail in
`references/`, repeated deterministic mechanics in `scripts/` or a contained
package, and templates in `assets/`. Link each resource and say when to use
it. Keep everything inside the owning plugin; never rely on a sibling plugin,
user-global file, or MCP server.

For each consequential action, state what authorizes it, when it is ready,
and when the skill asks or stops. Publication can be valid with clear
authority and readiness. Never perform the target action while creating the
skill.

Use only portable `name` and `description` frontmatter; put Codex UI data in
`agents/openai.yaml`. Verify any host-specific invocation control on each
claimed host.

**Complete when:** discovery distinguishes this goal from adjacent requests,
every resource has a load condition, and every phase has a checkable end.

## 3. Add evidence, then implement

Add deterministic tests for mechanics and behavior evals for selection,
judgment, output, and safety. Keep pass criteria in hidden checks, not in
participant prompts. Include a counterexample a superficial skill could pass.
Run a scoped dry validation and an honest baseline first.

Implement the smallest coherent skill with the target's toolchain. Keep
judgment in `SKILL.md` and checkable mechanics in narrow helpers. Before
adding executable mechanics, read
[`references/plugin-mechanics.md`](references/plugin-mechanics.md); for shell
scripts or shell tests, also read
[`references/portable-shell.md`](references/portable-shell.md).

Helpers refuse unreadable input and emit stable output. Every validator
result, success and failure, normalizes each inspected input to its canonical
absolute path and prints that path; a bare "valid" is incomplete.

For a UV package, decide its location from the target's rules before
scaffolding: a package that serves one skill goes inside that skill when the
rules say so. Put the runtime command in the created `SKILL.md`, using `uv`
with `run --frozen --no-dev --project <package> <entrypoint>`. Commit
`pyproject.toml` and `uv.lock`, declare the test runner as a locked
development dependency, and run tests from the package environment.

The shared inspector lives at `<plugin-root>/backend`, two directories above
this skill. Run it after writing the target; it checks portable metadata and
inline Markdown links, so inspect command literals and other paths yourself:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" inspect-skill inspect "<target-skill>" "<target-plugin>"
```

If the target claims Bash 3.2 and Bash 5, run its shell tests through:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" verify-shell-tests -- "<test-script>"...
```

Report every required version: its observed interpreter and result, or that
it remains unverified. Command names do not prove versions.

**Complete when:** the tests detect the intended failure, the finished skill
passes the focused checks, and no unrelated capability or external action was
added.

## 4. Verify and challenge

Run the target's package tests, the inspector, native skill and plugin
validators, scoped eval dry runs and live trials, entrypoints from a fresh
copy on claimed hosts, documentation checks, and repository gates. Call
unavailable platforms unverified.

Get one independent fresh-context challenge of the exact final skill and its
evidence, covering discovery, self-containment, portability, safety,
completion bounds, and eval loopholes. A complete, current review already
supplied by the user or enclosing goal counts; do not launch a duplicate. When
promoting a reviewed draft, keep its bytes and compare its content ID with the
final file; never edit review evidence. After a repair, verify that finding
and its direct regressions. Resolve material findings before claiming
completion.

Read [`references/practice-basis.md`](references/practice-basis.md) only when
choosing a disputed invocation, disclosure, or evaluation design.

**Complete when:** the focused and repository gates pass, one current
independent challenge is resolved, and the report preserves complete evidence.

Before sending the report, check its four fields against the handoff contract
at the top.

## Boundaries

- This workflow creates new skills. Audits belong to `audit-agent-skill`;
  fixing an existing skill is ordinary engineering work.
- Do not commit, push, publish, release, deploy, or install without separate
  user authority.
