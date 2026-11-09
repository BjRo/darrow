# Capability: Principles first

`darrow-principles` provides optional engineering guidance on Codex and Claude
Code. It owns no execution or delivery lifecycle. These requirements record the
accepted scope of issue 296.

## Requirements

- **PF-R1 — Explicit approach and lazy guidance.** Activate `principles-first`
  when the user requests that approach or another skill requests it within
  authorized work. Read the effective table at entry and reevaluate triggers
  through design, debugging and completion. Fully read matching instructions
  before applying them; leave unrelated instructions unloaded. The effective
  routes alone control automatic bundled-leaf activation. Ordinary engineering
  starts neither the approach nor leaves; removed routes stay removed.
- **PF-R2 — Whole-table precedence.** Select the first existing file: personal
  `~/.darrow/principles.md`, current Git worktree root `.darrow/principles.md`,
  bundled defaults. Replace the whole table without merging or inheritance.
  Resolve the current worktree root from any subdirectory, including linked
  worktrees. Ignore subdirectory configuration. Outside Git use only personal
  or bundled configuration, never working-directory or ancestor lookup. Stop
  on an unreadable selected file with its path and actual read error.
- **PF-R3 — Editable routes and bare custom Markdown.** Users can add, edit or
  delete rows without editing installed plugin files. Export all bundled
  triggers and references as editable Markdown, without instruction bodies.
  Resolve `custom-principles/<name>.md` beside the selected table regardless of
  working directory. No frontmatter, registration or wrapper is required.
  Never scan unlisted files or substitute repository files for missing personal
  references. Read matching custom bodies completely. A deleted route remains
  excluded even when its file remains. Personal users copy wanted repository
  routes and files into the selected personal scope.
- **PF-R4 — Explicit setup scope.** Setup manages the configuration used by
  entry. Ask repository or personal scope when unspecified; never silently
  choose personal. Initialize an absent destination with the complete bundled
  table and considered-ID baseline before customization. Preserve existing
  routes; only an explicit reset replaces them with defaults. Keep bodies
  separate and lazy.
- **PF-R5 — Considered-ID update memory.** Store small setup metadata in the
  same Markdown file. Initialize considered bundled IDs with every installed
  ID and preserve them through edits and deletions. Later setup offers only
  installed IDs not yet considered. Add only selected new routes, preserving
  customizations; record both accepted and declined IDs so they are not offered
  again. Deleted considered routes are not new. Plugin updates never auto-add
  routes. Legacy files without metadata need no migration behavior.
- **PF-R6 — Configuration errors and missing guidance.** An unreadable selected
  table stops with path and read error. A readable unintelligible trigger or
  reference stops with file, problem row and needed correction; never skip it
  or fall back. For an applicable valid reference whose body is unavailable,
  briefly identify the unavailable skill or file, continue using judgment for
  it and any available guidance, and never claim it was applied. Missing
  guidance cannot waive a configuration error. Missing compatible guidance
  does not block normal delivery or require confirmation solely for guidance.
- **PF-R7 — Optional public composition.** Ticket-to-PR includes only “Apply
  the principles-first approach when it is available” in its quoted Adaptive
  Goal request. The recipe adds no separate discovery, binding, loading or
  omission-relay procedure. Adaptive Goal owns capability selection and carries
  selected guidance as ordinary task constraints while retaining goal,
  assignment, assurance, repair and completion ownership. Neither plugin
  depends on the other. Missing guidance preserves ordinary delivery, TDD,
  verification, review and CI requirements; it introduces no procedure or owner.
- **PF-R8 — Guidance cannot expand authority.** Guidance changes no scope,
  acceptance, compatibility obligation, authority, repair allowance, stop rule
  or completion rule. It mandates no external stack, workflow, agent, model,
  tool or Git effect. After two failed fixes sharing a premise, test an
  observation that could falsify that premise; an exhausted repair allowance
  still forbids another implementation attempt. Internal caller removal needs
  covered callers and no compatibility obligation; retain public and forwarding
  obligations. Compiler rejection can prove a type restriction, while persisted
  behavior requires execution and record inspection. Temporary migration
  breakage must be an agreed, scoped, reversible phase. Tools and delegation
  remain conditional.

## Acceptance

- **PF-AC1 — Acceptance.** Explicit entry fully reads matching guidance, leaves unrelated
  guidance unloaded, and loads newly matching debugging or completion guidance.
- **PF-AC2 — Acceptance.** Ordinary engineering loads neither entry nor leaves. Removing a
  route excludes its leaf even when its former trigger occurs.
- **PF-AC3 — Acceptance.** Exercise repository-from-subdirectory, default-only, personal
  replacement, subdirectory-only ignored, linked-worktree, outside-Git with and
  without personal, and unreadable-selected-file cases under PF-R2.
- **PF-AC4 — Acceptance.** Export contains all 24 routes and no bodies. Direct route add,
  edit and delete change effective guidance without lower-table inheritance.
- **PF-AC5 — Acceptance.** Observe scope question, initialization in both scopes, preservation
  of existing customization and explicit reset by inspecting destination files.
- **PF-AC6 — Acceptance.** Observe complete initialization baseline; deleted considered IDs
  remain excluded; new installed IDs do not alter config until setup; accepted
  new IDs add rows and metadata; declined IDs add metadata only and are not
  reoffered. Preserve custom rows throughout.
- **PF-AC7 — Acceptance.** Distinguish unreadable and unintelligible configuration stops from
  valid missing-skill or missing-custom-file notice-and-continue behavior.
- **PF-AC8 — Acceptance.** Verify standalone installation, recipe with available and absent
  approach, and unchanged independent Adaptive Goal assurance requirements.
- **PF-AC9 — Acceptance.** Bundle 24 distinct principle leaves and matching routes. Preserve
  their accepted decision guidance, including all PF-R8 decision checks.
- **PF-AC10 — Acceptance.** Fully read matching bare custom Markdown, leaving unmatched,
  unlisted and deleted files unloaded. Resolve repository and personal files
  from elsewhere, never substitute repository content for a missing personal
  file, and require no host registration. Missing valid files follow PF-R6.

## Bundled catalog

Each name below has a `principle-` prefix in its skill and route ID:

laziness-protocol, foundational-thinking, redesign-from-first-principles,
attack-the-premise, subtract-before-you-add, minimize-reader-load,
outcome-oriented-execution, experience-first, exhaust-the-design-space,
build-the-lever, model-the-domain, boundary-discipline, type-system-discipline,
make-operations-idempotent, migrate-callers-then-delete-legacy-apis,
separate-before-serializing-shared-state, prove-it-works, fix-root-causes,
sequence-verifiable-units, test-behavior-not-implementation, explain-the-number,
guard-the-context-window, never-block-on-the-human, encode-lessons-in-structure.

## Catalog decision guidance

These are the accepted rules for the 24 separate instruction bodies. Routing
metadata contains triggers and references, not these instructions.

| Principle                                | Required guidance                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| laziness-protocol                        | Choose the smallest complete solution and consolidate repeated decisions.                                                                                                                                                                                                                     |
| foundational-thinking                    | Settle data shape and access before logic. Build only needed foundations, without infrastructure for imagined future use.                                                                                                                                                                     |
| redesign-from-first-principles           | Imagine the requirement existed originally, then make the smallest coherent change within scope and compatibility. Seek a decision when broader redesign is necessary.                                                                                                                        |
| attack-the-premise                       | After two failed fixes, state their shared premise and test a falsifying observation before an authorized fix. Grant no extra attempt.                                                                                                                                                        |
| subtract-before-you-add                  | Remove relevant dead weight before adding.                                                                                                                                                                                                                                                    |
| minimize-reader-load                     | Reduce needless indirection and state the reader must remember.                                                                                                                                                                                                                               |
| outcome-oriented-execution               | Converge on the agreed target through phases without temporary compatibility solely for intermediate edits. Declare permitted breakage and phase-ending checks; keep phases scoped and reversible, preserve external compatibility, and preserve behavior when no breakage allowance exists.  |
| experience-first                         | Consider the end user, API caller and maintainer. Distinguish requirements from preferences. Recommend product changes unless their decisions are delegated.                                                                                                                                  |
| exhaust-the-design-space                 | For consequential choices without precedent, compare two or three structural alternatives using proportionate sketches, types, callers or experiments. Require no agents, models or complete alternative implementations.                                                                     |
| build-the-lever                          | Prefer an existing deterministic tool. Use the smallest justified script, codemod, generator or check, validating representative output before broader use. Benefit must justify maintenance; nontrivial work alone is insufficient.                                                          |
| model-the-domain                         | Encode stateful, repeated branch and shape rules in structure.                                                                                                                                                                                                                                |
| boundary-discipline                      | Validate where trust or state is established. Use validated domain values, thin adapters and testable business logic. Avoid redundant guaranteed checks while retaining invariants and checks of potentially invalidated state.                                                               |
| type-system-discipline                   | Use the simplest adequate types to prevent domain mistakes, represent valid variants and separate noninterchangeable values. Derive from schemas where available. Avoid blanket branding and generics; retain runtime validation.                                                             |
| make-operations-idempotent               | Reconcile existing state so repetition converges.                                                                                                                                                                                                                                             |
| migrate-callers-then-delete-legacy-apis  | When all internal callers can migrate together with no remaining compatibility obligation, migrate callers, tests, examples and docs, then remove the old API. Verify intended original entrypoints. Preserve required external and forwarding compatibility through a compatible transition. |
| separate-before-serializing-shared-state | Eliminate unnecessary sharing before introducing coordination.                                                                                                                                                                                                                                |
| prove-it-works                           | Use the actual current artifact and observable behavior that directly establish acceptance. Static evidence proves static properties; compilation does not establish runtime behavior. Retain verification and review contracts.                                                              |
| fix-root-causes                          | Reproduce and trace the first wrong behavior. Distinguish legitimate state handling from an invalid producer. Check related scope, fix or report related cases, and seek a decision for scope expansion.                                                                                      |
| sequence-verifiable-units                | Establish a baseline and check each coherent unit before advancing. Respect agreed phases and red/green failures expected within a unit. Grant no Git authority.                                                                                                                              |
| test-behavior-not-implementation         | Test observable contracts with independent expected results, not private implementation choices.                                                                                                                                                                                              |
| explain-the-number                       | Define the metric and decision first. Confirm intended work ran, use equivalent conditions, account for variation and retain supporting evidence. Consider limiting factors for performance and valid trials with independent checks for evals. Mandate no tool or fixed trial count.         |
| guard-the-context-window                 | Narrow searches and bound reads. Retain material constraints, decisions and evidence references. Mandate no delegation; host and owner rules govern.                                                                                                                                          |
| never-block-on-the-human                 | Continue routine choices within scope and authority and report consequential choices for correction. Reversibility grants no authority. Respect waits, gates and product permission decisions.                                                                                                |
| encode-lessons-in-structure              | Prefer enforceable structure where possible while retaining guidance for judgment.                                                                                                                                                                                                            |
