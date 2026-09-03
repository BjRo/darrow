# Capability: Skill Authoring

Creates or improves one focused agent skill as an observable, independently
adoptable capability for Claude Code and Codex. The workflow treats discovery,
instruction behavior, deterministic mechanics, packaging, and evaluation as one
public contract rather than polishing `SKILL.md` prose in isolation.

Plugin: `darrow-skill-authoring`. Skill: `author-agent-skill`.

## Why

Agent skills fail in several distinct ways: the runtime does not discover them,
their descriptions trigger too broadly or not at all, their bodies permit
premature completion, deterministic rules are left to model judgment, or their
supporting files depend on an author's local environment. A useful authoring
workflow makes these failure modes observable before declaring a skill ready.

The capability is a skill-development workflow, not a general prompt-writing
framework, plugin runtime, marketplace publisher, or substitute for the target
repository's own instructions and evaluation harness.

## Public contract

### Intent triggers

"create an agent skill", "write a SKILL.md", "improve this skill", "make this
skill work in Claude Code and Codex", "test skill triggering", "validate a skill
package", or an explicit skill invocation.

### Inputs

- The user goal and representative requests that should and should not select
  the skill.
- The target skill or requested destination and supported runtimes.
- Applicable repository instructions, packaging rules, and evaluation commands.

Missing information is resolved from repository evidence when safe. A choice
that materially changes the skill's goal, side effects, destination, or runtime
support is presented to the user rather than guessed. Asking the agent to pick
an arbitrary capability or destination does not supply or approve that missing
input.

### Output

One focused skill with valid discovery metadata, a bounded workflow, only the
colocated resources it needs, deterministic validation where mechanics are
checkable, and recorded evidence for trigger behavior and workflow quality.

## Invariants

- **SA-C1 — Observable contract before prose.** Define the user goal, expected
  inputs and outputs, stop/question boundaries, supported runtimes, and success
  criteria before implementation. Establish representative direct, indirect,
  incomplete-input, negative-trigger, and plausible counterexample requests.
  Delegating invention of an unspecified goal or destination does not satisfy
  the contract and must not authorize a repository or user-level skill change.
  For a behavior-changing revision, capture baseline behavior before relying on
  the revised skill unless the harness cannot provide an uncontaminated
  baseline; disclose that limitation instead of fabricating one.
- **SA-C2 — Discovery is a tested interface.** Use a lower-case hyphenated,
  verb-led name. Front-load a concise description with the skill's recognizable
  goal and concrete trigger conditions, including meaningful exclusions where
  ambiguity is likely. Keep procedure details in the body so metadata does not
  become a lossy shortcut. Test both activation and non-activation requests.
- **SA-C3 — One bounded workflow.** Each skill serves one recognizable user
  goal. State expected inputs, ordered actions, output, facts that must not be
  inferred, and conditions to ask, stop, or refuse. Every phase ends in a
  checkable and sufficiently demanding completion criterion. Split workflows
  whose triggers, inputs, or success criteria materially differ.
- **SA-C4 — Deliberate information hierarchy.** Keep the core workflow and
  universally needed judgment in `SKILL.md`. Move branch-specific or heavy
  reference behind an explicit one-level pointer. Keep definitions, rules, and
  caveats together; remove duplicated, derivable, stale, and behavior-neutral
  prose. Supporting resources are colocated in the skill or plugin and are
  loaded or run only under a stated condition.
- **SA-C5 — Mechanics are executable.** Put deterministic, repeatedly needed,
  or error-prone checks in a bundled script with narrow inputs and stable
  machine-readable output. Keep contextual decisions and trade-offs in
  `SKILL.md`. Do not add a script when existing tools and instructions are
  already reliable.
- **SA-C6 — Fail closed and identify evidence.** A required unreadable skill,
  manifest, configuration, instruction, or referenced local resource blocks the
  dependent result. Model-facing script output identifies inspected inputs and
  local references with absolute paths. Missing evidence is never treated as a
  successful empty state.
- **SA-C7 — Portable self-containment.** Bundled shell scripts work in Bash 5
  and `/bin/bash` 3.2, avoid GNU-only assumptions, and never require files from a
  sibling plugin. Normalize paths before emitting or comparing them, and handle
  ordinary environment spelling variants such as `TMPDIR` with or without a
  trailing separator. A packaged skill remains useful with no MCP server or
  other Darrow plugin installed unless its own manifest declares and supplies
  that dependency.
- **SA-C8 — Evaluation separates prompt from criteria.** Participant-visible
  eval prompts contain the task and repository evidence but not their pass
  criteria. Hidden deterministic checks or rubrics cover workflow behavior,
  output quality, safety boundaries, and relevant repository state. Run scoped
  dry validation before live trials on supported harnesses selected by the
  repository.
- **SA-C9 — Independent challenge before completion.** Give a fresh-context
  reviewer the resulting artifact and task-local evidence without the intended
  answer or prior conclusions. Address material discovery, portability,
  self-containment, safety, and loophole findings, then rerun affected script
  tests and evals.
- **SA-C10 — Verified delivery.** Validate skill metadata, plugin manifests,
  marketplace/discovery entries, local-reference containment, both-shell script
  behavior, and relevant repository gates. Report exact commands, outcomes,
  evaluation limitations, and residual risks. Authoring does not imply commit,
  push, pull request, publication, release, or deployment authority.

## Non-goals

Creating daemons, queues, general workflow runtimes, cross-plugin dependency
graphs, runtime installers, MCP servers, unrelated repository guidance, or a
catalog of loosely related skills. The capability does not publish, install,
commit, push, open a pull request, release, or deploy unless a separate user
request explicitly authorizes that action.
