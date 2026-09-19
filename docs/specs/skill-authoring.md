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
Its human-facing output leads with the result and next action in concise,
understandable language while preserving required evidence and protocol data.

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
  `SKILL.md`. Follow the target repository's instructions and established
  toolchain when choosing how to implement executable mechanics. If the target
  has no applicable convention, treat the runtime and package manager as
  contract inputs instead of importing them from the authoring skill's source
  repository. Do not add a script when existing tools and instructions are
  already reliable.
  A migration preserves the required public behavior, not the source
  implementation's structure. When Python is selected, use idiomatic Python
  and standard-library operations, simplify control flow, and reuse focused
  mechanics within the package instead of translating shell code verbatim.
  Remove obsolete wrappers, aliases, and compatibility branches, updating
  callers and tests to the canonical entrypoints. A legacy path alone does not
  establish a requirement to retain a shim.
- **SA-C6 — Fail closed and identify evidence.** A required unreadable skill,
  manifest, configuration, instruction, or referenced local resource blocks the
  dependent result. Model-facing script output identifies inspected inputs and
  local references with absolute paths. Missing evidence is never treated as a
  successful empty state.
- **SA-C7 — Portable self-containment.** A packaged helper keeps its manifest,
  lock, entrypoints, dependencies, and state inside the owning plugin. A helper
  owned by one skill is colocated inside that skill; a plugin-level location is
  reserved for helpers shared by multiple skills or non-skill plugin
  components. Invoke a skill-local helper from the host-provided installed
  skill directory without adding a launcher solely to locate the helper or
  forward arguments. Add a compatibility launcher only when a stable external
  command contract or host lifecycle or protocol adaptation requires one. The
  helper follows the target repository's runtime and development dependency
  conventions, uses reproducible locked execution, and verifies its public
  entrypoints from a fresh artifact on every claimed native platform. Bundled shell scripts work
  on every shell version claimed by the target, avoid unsupported utility
  assumptions, and never require files from a sibling plugin. Normalize paths
  before emitting or comparing them. Label shell evidence by the interpreter's
  observed version, deduplicate equivalent interpreters, and leave an
  unavailable required version explicitly unverified. Shell tests preserve
  their executing interpreter in nested implementation calls. A packaged skill
  remains useful with no MCP server or other Darrow plugin installed unless its
  own manifest declares and supplies that dependency.
  This plugin exposes its inspector and shell-test matrix only through their
  frozen UV console entrypoints, without legacy launchers or module-execution
  aliases. Internal simplification preserves argument consumption, interpreter
  selection, diagnostic order, output records, and exit statuses. Regression
  shell suites live with the backend tests, not as runtime skill scripts.
- **SA-C8 — Evaluation separates prompt from criteria.** Participant-visible
  eval prompts contain the task and repository evidence but not their pass
  criteria. Hidden deterministic checks or rubrics cover workflow behavior,
  output quality, safety boundaries, and relevant repository state. Run scoped
  dry validation before live trials on supported harnesses selected by the
  repository. Shell-reporting acceptance must allow observed successful runs
  and explicitly unverified coverage; it must not assume a required interpreter
  is unavailable when the fixture inherits the host's shell availability.
- **SA-C9 — Independent challenge before completion.** Give a fresh-context
  reviewer the resulting artifact and task-local evidence without the intended
  answer or prior conclusions. Address material discovery, portability,
  self-containment, safety, and loophole findings, then rerun affected script
  tests and evals.
- **SA-C10 — Verified delivery.** Validate skill metadata, plugin manifests,
  marketplace/discovery entries, local-reference containment, relevant native
  platform or both-shell behavior, and repository gates. Report exact commands,
  outcomes, evaluation limitations, and residual risks. Authoring does not
  imply commit, push, pull request, publication, release, or deployment
  authority.
- **SA-C11 — Clear human-facing output.** New and revised skills lead with the
  result and next action when their public contract permits it. They use
  familiar words, active voice, and short sentences and paragraphs; explain
  necessary domain terms; and remove repetition and unnecessary process
  narration. Progressive disclosure never removes technical meaning, safety
  rules, complete evidence, exact commands or identifiers, or required
  protocol fields. Behavior evals assess clarity, concision, completeness,
  activation, and safety by meaning rather than exact prose unless wording is
  itself the public contract.

## Non-goals

Creating daemons, queues, general workflow runtimes, cross-plugin dependency
graphs, runtime installers, MCP servers, unrelated repository guidance, or a
catalog of loosely related skills. The capability does not publish, install,
commit, push, open a pull request, release, or deploy unless a separate user
request explicitly authorizes that action.
