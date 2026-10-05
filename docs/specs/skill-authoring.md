# Capability: Skill Authoring

Provides two focused capabilities for Claude Code and Codex: creating a new
agent skill and auditing an existing one without changing it. Creation treats
discovery, behavior, mechanics, packaging, and evaluation as one public
contract. Audit assesses that contract and returns actionable findings.

Plugin: `darrow-skill-authoring`. Skills: `create-agent-skill` and
`audit-agent-skill`.

## Why

Agent skills fail in several distinct ways: the runtime does not discover them,
their descriptions trigger too broadly or not at all, their bodies permit
premature completion, deterministic rules are left to model judgment, or their
supporting files depend on an author's local environment. A useful authoring
workflow makes these failure modes observable before declaring a skill ready.

These capabilities are not a general prompt-writing framework, plugin runtime,
marketplace publisher, or substitute for the target repository's own
instructions and evaluation harness. Implementing audit findings is ordinary
engineering work against those findings and the target repository's rules;
neither skill owns a general revision workflow.

## Public contract

### Intent triggers

- Creation: "create an agent skill", "turn this recurring workflow into a
  skill", "write a new SKILL.md", or explicit `create-agent-skill` invocation.
- Audit: "audit this skill", "validate a skill package", "check this skill's
  discovery and workflow", or explicit `audit-agent-skill` invocation.
- Implementation of audit findings, general skill revision, running an existing
  eval suite, and plugin metadata work alone do not select either capability.

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

Creation produces one focused skill with valid discovery metadata, a bounded
workflow, only the colocated resources it needs, and recorded behavior evidence.
Audit produces read-only findings with the inspected basis, severity or impact,
and concrete acceptance criteria for an implementing agent. Each result leads
with the outcome and next action while preserving required evidence.

## Invariants

- **SA-C1 — Observable contract before prose.** Define the user goal, expected
  inputs and outputs, stop/question boundaries, supported runtimes, and success
  criteria before implementation. Establish representative direct, indirect,
  incomplete-input, negative-trigger, and plausible counterexample requests.
  Delegating invention of an unspecified goal or destination does not satisfy
  the contract and must not authorize a repository or user-level skill change.
  Before creation, ask for every unresolved contract input together, including
  goal, destination, and supported runtimes when all three are unknown. Do not
  narrow the question to one missing input or infer another from a suggestion.
  Existing-skill repair follows the target repository's implementation rules
  and audit findings; it is not a third authoring-skill branch.
- **SA-C2 — Discovery is a tested interface.** Use a lower-case hyphenated,
  verb-led name. Front-load a concise description with the skill's recognizable
  goal and concrete trigger conditions, including meaningful exclusions where
  ambiguity is likely. Keep procedure details in the body so metadata does not
  become a lossy shortcut. Creation intent selects `create-agent-skill` and
  read-only audit intent selects `audit-agent-skill` when both are installed.
  Creation selects the plugin skill ahead of generic host skill creators,
  including when the user's request leaves required contract inputs missing.
  A request to fix audit findings selects neither Darrow authoring skill.
  Test each intended activation, cross-skill confusion, and non-activation.
  In validation, a syntactically valid description is not evidence that its
  trigger is useful; report that judgment separately from manifest and metadata
  parsing, even when another defect blocks installation.
  When comparing discovery descriptions, hold the skill body, installed
  catalog, prompts, fixtures, model, effort, and grading fixed. Measure both
  intended activation and false activation on declared cases before choosing
  new metadata.
- **SA-C3 — One bounded workflow.** Each skill serves one recognizable user
  goal. State expected inputs, ordered actions, output, facts that must not be
  inferred, and conditions to ask, stop, or refuse. Every phase ends in a
  checkable and sufficiently demanding completion criterion. The creation
  workflow may write the new skill under the supplied contract; the audit
  workflow remains read-only and does not perform the target skill's external
  actions. Both assess consequential actions: which user request or delegation
  authorizes each, what conditions make it ready, and when the workflow asks or
  stops. Audit reports unclear boundaries with evidence and repair acceptance
  criteria. An action such as publication is not itself a defect when its
  authority and conditions are clear.
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
  owned by one skill is colocated inside that skill; the inspector and shell
  matrix shared by creation and audit live at plugin level. Invoke packaged
  helpers from the host-provided installed path without a launcher solely to
  locate a helper or forward arguments. Add a compatibility launcher only when a stable external
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
  repository. Prepared target skills in authoring evals use draft filenames
  rather than `SKILL.md`; producing the standard skill file is an observable
  outcome of a creation case. Audit cases never promote a draft.
  Shell-reporting acceptance must allow observed successful runs and
  explicitly unverified coverage; it must not
  assume a required interpreter is unavailable when the fixture inherits the
  host's shell availability.
- **SA-C9 — One current independent challenge before creation completion.** Give a
  fresh-context reviewer the created artifact and task-local evidence without
  the intended answer or prior conclusions. Challenge discovery,
  self-containment, portability, safety, completion bounds, and eval loopholes.
  An earlier user-requested or enclosing-goal review satisfies this step when
  its independent reviewer received those inputs, covered those questions,
  returned a complete result, and reviewed the exact final content. Do not
  request another review merely because skill authoring reached this phase.
  When an enclosing goal already requires independent review, arrange one
  final-content review that covers both contracts and consume its result before
  claiming authoring complete. After a finding-driven repair, the original
  broad challenge plus fresh, closed verification of the attempted findings
  and direct regressions can establish the final result; do not restart a broad
  review solely because the repair changed content. A changed scope,
  unrelated edit, missing review input or coverage, inconclusive result, or
  unresolved blocker still needs the appropriate independent assessment.
  Resolve material findings and rerun affected script tests and evals. If a
  material finding cannot be resolved, report creation as incomplete rather
  than claiming completion. Read-only audit reports their own inspected
  evidence and do not launch a second review by default.
- **SA-C10 — Verified delivery.** Creation validates skill metadata, plugin
  manifests, marketplace/discovery entries, local-reference containment,
  relevant native platform or both-shell behavior, and repository gates.
  Audit checks the requested claims without changing checked-in files and
  labels unavailable evidence unverified. Both report exact commands,
  outcomes, limitations, and residual risks. Neither capability implies
  commit, push, pull request, publication, release, or deployment
  authority.
- **SA-C11 — Clear human-facing output.** Created skills and audit reports lead
  with the result and next action when their public contract permits it. They use
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
