---
name: author-agent-skill
description: Create, improve, or validate one reusable agent skill as a focused, self-contained capability for Claude Code and Codex. Use for any request to create or edit a skill, including open-ended requests whose capability, destination, or runtime support must be clarified; also use to define trigger metadata, add colocated resources or deterministic checks, repair an over-broad or unreliable skill, or evaluate discovery and workflow behavior. Do not use for general AGENTS.md or CLAUDE.md prose, plugin-only packaging without a skill, or merely running an existing suite.
---

# Author an agent skill

Turn one recognizable user goal into a discoverable, bounded, and evaluated
skill. Treat discovery metadata, workflow behavior, resources, and verification
as one public interface.

Run the bundled inspector through its locked UV entrypoint. In commands below,
`<skill-dir>` is the directory containing this file, `<target-skill>` is the
target skill directory, and `<plugin-root>` is its owning plugin root:

```text
uv run --quiet --frozen --no-dev --project "<skill-dir>/backend" inspect-skill inspect "<target-skill>" "<plugin-root>"
```

The inspector checks portable metadata and containment for inline
Markdown-linked local resources. Inspect command literals, reference-style
links, and other path forms separately. It does not replace native runtime
validators or decide whether the workflow is well designed.

Before adding executable mechanics, read
[`references/plugin-mechanics.md`](references/plugin-mechanics.md) and choose
existing tools, small glue, or a contained packaged helper from the target
repository's instructions, established toolchain, actual complexity, and
supported hosts. If the target establishes no runtime or package manager, make
that choice a contract input before writing mechanics. When verifying target
shell tests, also read
[`references/portable-shell.md`](references/portable-shell.md). If the target
requires both Bash 3.2 and Bash 5, run the version-aware helper through the same
backend:

```text
uv run --quiet --frozen --no-dev --project "<skill-dir>/backend" verify-shell-tests -- "<test-script>"...
```

Base every shell-version claim on its emitted evidence. Invoke both packaged
commands directly; this plugin has no runtime shell launchers.

## Workflow

### Choose the branch

Use **validation-only** when the user asks to inspect, audit, or validate an
existing skill without asking for fixes. Keep the repository read-only:

1. establish the target, supported runtimes, and claims to validate;
2. read applicable instructions, `SKILL.md`, manifests, tests, evals, and every
   required local resource;
3. run the bundled inspector, native validators, existing script tests, and
   scoped eval dry validation that do not mutate checked-in files;
4. inspect path forms the bundled inspector does not parse; and
5. report findings, exact evidence, limitations, and residual risks without
   adding tests, rewriting guidance, or implementing fixes.

**Validation-only completes when:** each requested claim has pass, fail, or
unverified evidence and the checked-in repository is unchanged.

Use **creation/revision** for a new skill or when the user explicitly asks to
apply fixes. Follow every phase below. A request to “validate and fix” selects
revision; validation alone never implies write authority.

For a new skill, make this input gate the first creation action. Classify each
item as known or unknown before creating a scaffold or changing repository or
user-level configuration:

1. the recognizable skill goal is supplied or explicitly approved by the user;
2. the destination is explicit or unambiguous from repository evidence;
3. the supported runtimes are explicit or unambiguous from repository evidence;
4. requested side effects and delivery authority are clear.

“Pick whatever capability is useful” leaves the goal unknown. “Put it wherever
is best” leaves the destination and runtime support unknown. Neither delegates
permission to invent those inputs.

If any item is unknown, ask one compact group of questions that includes every
unknown item, then stop. Never ask for only the goal when destination or runtime
support is also unknown, and never defer another known question to a later turn.
Leave the repository and user-level configuration unchanged; do not continue to
inspection or implementation until the user supplies or approves the contract.

### 1. Establish the contract

Read applicable repository instructions and the target plugin manifests. Name:

- the single user goal;
- expected inputs and user-visible output;
- supported runtimes and destination;
- facts the agent must not infer;
- conditions to ask, stop, or refuse; and
- observable completion criteria.

Write representative requests before changing skill prose: one direct, one
indirect, one incomplete-input, one that must not select the skill, and one
plausible counterexample or pressure case. For a revision, run these against the
current skill or an uncontaminated no-skill condition when the harness supports
it. Record observed failure behavior. If an honest baseline is unavailable,
state that limitation and continue with forward evidence; never invent a red
result.

**Complete when:** the goal and boundary are unambiguous, the request matrix is
written, and every success claim has an observable check or an explicit
evaluation limitation.

### 2. Inspect the existing surface

For a revision, run the inspector before editing and read the existing
`SKILL.md` completely. Follow its absolute paths to the local resources needed
for this task. Inspect the owning manifests, existing eval cases, script tests,
and relevant repository commands. An unreadable required input blocks dependent
recommendations.

For a new skill, inspect the destination plugin or repository conventions and
choose the standard local skill location. Use a repository-provided scaffold
when available; otherwise create the minimal standard layout directly. Never
assume a creator skill, sibling plugin, MCP server, or user-global file exists.

For the source reasoning behind disputed design choices, read
[`references/practice-basis.md`](references/practice-basis.md) only when choosing
between invocation, disclosure, or evaluation approaches, or when maintaining
this authoring workflow.

**Complete when:** the target, applicable loaders, manifests, tests, references,
and unreadable blockers are known from repository evidence.

### 3. Design discovery and hierarchy

Use a lower-case hyphenated, verb-led name that matches the skill directory.
Write one concise description that front-loads the recognizable goal and
concrete triggers. Include a meaningful exclusion when adjacent work could
mis-trigger it. Keep ordered procedure out of the description so metadata does
not become a shortcut around the body.

Keep one bounded workflow in `SKILL.md`. State inputs, ordered actions, output,
question/refusal boundaries, and a checkable, demanding completion criterion
for each phase. Split work whose triggers, inputs, or success criteria differ.

Keep universally needed judgment in the body. Put branch-specific or heavy
detail one link away in `references/`; put deterministic repeated mechanics in
`scripts/`; put output templates in `assets/`. Link every resource from
`SKILL.md` and state when to read or run it. Remove duplicated instructions,
cheaply derived facts, narrative history, no-op advice, and unused folders.

Prefer the portable `name` and `description` frontmatter common to both hosts.
Put optional Codex UI metadata in `agents/openai.yaml`. Add host-specific
frontmatter only when the target explicitly needs it, and verify the other
host's behavior rather than assuming compatibility.

The bundled inspector accepts Claude's optional boolean
`disable-model-invocation` field while remaining fail-closed on other unknown
frontmatter. Keep the corresponding Codex invocation policy in
`agents/openai.yaml`; do not treat either host's control as portable metadata.

**Complete when:** every instruction has one owner, every resource has a stated
load condition, and discovery metadata distinguishes this goal from adjacent
work without summarizing the procedure.

### 4. Add acceptance evidence

Add or update evidence at the most stable public seam before implementation:

- deterministic script or package tests for mechanical contracts and failure
  modes;
- behavior evals for judgment, sequencing, output, and safety boundaries; and
- activation cases for direct, indirect, incomplete, negative, and edge input.

Keep eval prompts participant-visible. Put pass criteria only in hidden checks
or rubrics. Prefer repository state and user-visible output over assertions
about private reasoning. Include at least one plausible counterexample that
could pass a superficial implementation.

Run the smallest applicable baseline or dry validation and confirm the new
evidence fails for the intended reason, not fixture or syntax errors.

**Complete when:** the acceptance evidence detects the missing behavior at a
durable seam and does not disclose its answer to the participant.

### 5. Implement the smallest slice

Write imperative instructions with explicit inputs and outputs. Add only the
resources required by the acceptance evidence. A script receives narrow
arguments, produces stable output, refuses unreadable inputs, and emits absolute
paths when its output is model-facing. Keep policy choices, trade-offs, and
contextual judgment in `SKILL.md`.

When the target adds or changes executable mechanics, read and apply
[`references/plugin-mechanics.md`](references/plugin-mechanics.md). For a shell
script or shell test, also apply
[`references/portable-shell.md`](references/portable-shell.md) to the
implementation and tests. Do not load either reference for prose-only skills.

Keep the skill independently installable. All required files live inside its
plugin; a reference must not escape the plugin or require a sibling plugin.
Avoid daemons, queues, hidden side effects, installation changes, and publication
steps. Preserve user authority for consequential actions.

**Complete when:** the focused evidence passes with the minimal coherent skill,
resources, and packaging changes, with no unrelated capability added.

### 6. Verify and challenge

Run, in order:

1. each bundled package test through the target repository's locked quality
   command and each shell test on the interpreter versions claimed by the
   target, preserving unavailable required versions as unverified;
2. the bundled inspector on the finished skill and plugin root;
3. the repository's skill and native plugin-manifest validators;
4. scoped eval dry validation and live trials on the supported harnesses chosen
   by the repository;
5. fresh copied-artifact entrypoints on each supported native platform;
6. affected documentation and marketplace/discovery checks; and
7. relevant repository lint, type, or test gates.

Then give a fresh-context reviewer the finished artifact and task-local
evidence, not the intended answer or prior conclusions. Ask it to challenge
discovery, self-containment, portability, safety, completion bounds, and eval
loopholes. Address material findings and rerun affected checks.

Review the final diff for external plugin references, prohibited runtime
machinery, accidental side effects, unrelated edits, and unsupported completion
claims.

**Complete when:** focused and repository gates pass after independent review,
every material finding is resolved or reported as residual risk, and the final
response lists exact evidence without implying commit, push, publication,
release, or deployment authority.

## Boundaries

- Do not use this workflow for ordinary instruction-file prose unless the user
  is actually extracting or authoring a reusable skill.
- Do not invent a useful capability when the user has not supplied or approved
  the goal.
- Do not require a fixed number of model trials regardless of risk; use enough
  fresh trials to support the claim and report the sample size.
- Do not commit, push, open a pull request, install, publish, release, or deploy
  unless a separate explicit request authorizes that action.
