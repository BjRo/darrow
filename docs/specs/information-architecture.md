# Capability: Information Architecture

Builds and maintains repository instruction systems that give coding agents the
smallest useful resident context while keeping every behavior-changing rule
reachable at the moment it matters.

Plugin: `darrow-information-architecture`. Skills: `setup-information-architecture`,
`doctor-information-architecture`, `context-usage`.

## Portable mechanics

- **IA-P1 — Contained locked execution.** Setup inspection and doctor
  inspection/verification run through the plugin's frozen UV package on Python
  3.10–3.13, Linux, macOS, and native Windows. Preserve inventory groups,
  diagnostics, summary records, and statuses: 64 for invalid arguments, 2 for
  inaccessible repository/input, 1 for critical verification findings, and 0
  for completed inspection or successful verification. No Bash runtime shim is
  required. Setup and doctor retain separate intent and judgment in their skills.
  Resolve bundled reference and backend paths from the absolute directory
  containing the selected `SKILL.md`, retaining their declared upward segments.
- **IA-P2 — Filesystem semantics.** Resolve the primary worktree from Git's
  first porcelain record, otherwise the supplied directory. Accept native
  repository paths, including Windows drives and UNC paths. Interpret portable
  guidance routes with forward slashes; accept Windows separators on Windows.
  Match instruction names with their documented case even on case-insensitive
  filesystems. Case validation stays within the resolved repository root and
  does not require directory-listing access to its ancestors. Recognize CRLF,
  LF, and UTF-8 BOM guidance without changing bytes.
  Emit UTF-8 records even when a native pipe defaults to a legacy code page,
  so non-Latin repository paths remain reportable.
  Follow file adapters only within the repository; report broken, looping,
  external, unreadable, or non-file dependencies rather than silently dropping
  selected evidence. Existing native imports outside the repository retain
  their host-owned semantics and are outside the repository audit scope.
  Do not recurse into directory symlinks. An unavailable
  native symlink facility never authorizes replacing an existing adapter.
- **IA-P3 — Safe guidance updates.** Inventory and verification are read-only.
  Approved edits preserve the source of truth, newline convention, and file
  permissions. Publish complete replacement content atomically from a temporary
  file in the destination directory, preserving symlink adapters by updating
  their canonical source. A failed replacement leaves original bytes intact;
  concurrent source changes must be detected before replacement. Multi-file
  edits are not a transaction and must be verified as a complete graph.
- **IA-P4 — Release evidence.** Retain regression evidence for routing,
  reachability, native scope, adapters, duplicate content, stale references,
  refusals, and output. Enforce the repository Python quality gates, property
  tests, both skill eval suites, and fresh copied-plugin execution using only
  locked runtime dependencies on all three native platforms.

## Why

Large root instruction files spend context on every task. Bare repositories
have the opposite failure mode: agents repeatedly rediscover commands and
architecture, then miss non-obvious constraints. A useful information
architecture keeps a small root router, sends the agent to focused files by
path and intent, and moves repeatable procedures into skills without making
important guidance unreachable.

Setup and doctor are repository-scoped. Context usage inspects only the current
Codex thread. Installation health, runtime versions, global permissions and
plugin cleanup belong to an environment doctor, not this plugin.

## Shared model

- **Resident guidance** is loaded at session start. It contains universal
  constraints, universal or bootstrap safety and delivery gates, universal
  cross-project contracts, and the routing needed to reach deferred guidance.
- **Scoped guidance** applies to a subtree or identifiable kind of work. It is
  reached through native runtime scoping or an explicit router entry that names
  both the trigger and the file to read.
- **Procedural guidance** explains how to perform a repeatable task. It belongs
  in an intent-triggered skill when it need not be resident during unrelated
  work.
- **Derived facts** are reliable, inexpensive observations from canonical
  repository sources such as manifests and configuration. They normally stay
  out of resident guidance unless they carry a prohibition, rationale, or
  unusual operational consequence.
- **Settled knowledge** is a decision or constraint the team has already made
  that code alone cannot prove: a canonical choice between live patterns, a
  migration direction, an abandoned experiment, policy, or external contract.
  Record it at the narrowest reliably reachable scope and preserve its meaning.
- **Open decisions** have no repository or team arbiter yet. Present the
  evidence, options, trade-offs, and a recommendation, then ask the user. Never
  turn pattern frequency, recency, or an agent recommendation into canonical
  guidance without an explicit decision.

File mentions alone are not a routing contract. A route says when the target
must be read, using a path match, task intent, or both.

Every ordinary routed repository path in an instruction surface is resolved
from the session root. A path that works only relative to the containing file
is invalid even when a human reader can infer it. Loader-native imports and
skill-bundled resources keep their native resolution semantics; the structural
audit does not reinterpret them as ordinary routes.

## setup-information-architecture

### Intent triggers

"set up agent instructions", "create an AGENTS.md architecture", "organize
repository guidance", "add scoped agent rules", "build a context hierarchy",
or an explicit skill invocation.

### Contract

Inspect the repository and any existing instruction surfaces, distinguish
settled knowledge from open decisions, propose a repository-specific
instruction graph, obtain confirmation, then create or reorganize the approved
files. Verify the resulting graph before reporting it.

### Invariants

- **IA-S1 — Inventory before design.** Inspect existing instruction entrypoints,
  runtime adapters, referenced guidance, native rules, skills, relevant project
  runtime configuration, manifests, CI, hooks, and repository boundaries before
  proposing a structure. Unreadable required evidence blocks a proposal that
  depends on it. Existing guidance is never overwritten from a generic
  template.
- **IA-S2 — Reachable deferred guidance.** Every deferred instruction file has
  a route from an entrypoint or documented native scope. Each explicit route
  names the target and the path or intent that requires reading it.
- **IA-S3 — Thin, sufficient root.** Root guidance retains universal
  constraints, universal or bootstrap safety rules, unusual universal
  completion gates, universal cross-runtime contracts, and enough routing to
  reach everything else. Runtime parity does not broaden a narrow rule's
  scope. Directory tours, ordinary stack
  inventories, and generic engineering advice are omitted. A derived inventory
  is not rewritten as an imperative unless separate evidence already gives it
  behavioral force.
- **IA-S4 — Scope by ownership.** Guidance lives at the narrowest scope where
  it remains correct. A shared cross-cutting rule is not copied into several
  subtree files merely to obtain local loading, and a trigger-specific rule is
  not broadened into a universal rule merely to simplify placement.
- **IA-S5 — Procedures load by intent.** Multi-step task procedures become
  skills when they do not need to influence ordinary edits. The root retains a
  route only when automatic skill discovery is insufficient for the supported
  runtimes. Extract the procedure separately from its universal prohibitions;
  moving a workflow must not make an existing resident safety rule depend on
  skill discovery. The resulting `SKILL.md` must be repository-owned, not ignored,
  eligible for version control, validly front-mattered with non-empty `name`
  and `description`, and reachable; an ignored mount, external target,
  malformed skill, or ordinary documentation page is not a successful move.
- **IA-S6 — Deliberate runtime parity.** Multi-runtime repositories declare a
  source of truth and adapter relationship. Generated mirrors are not edited as
  independent guidance, and a runtime-specific optimization never silently
  breaks another runtime's reachability. Preserve a valid existing adapter
  unless an evidenced defect requires changing it. Recognize root symlink
  adapters in either direction as shared content, not independent duplicates.
- **IA-S7 — Confirm before mutation.** The initial inventory and proposal are
  read-only. Creation, movement, deletion, or rewriting begins only after the
  user confirms the proposed file-level actions. An explicit request to apply
  the proposed structural actions may confirm decision-free file changes in
  advance; a request to inspect or show the graph first requires a pause.
  Neither form of approval settles an open policy decision. No commit is an
  implicit side effect of setup.
- **IA-S8 — Verified result.** After applying changes, rerun the deterministic
  audit. A missing entrypoint, unrouted deferred guidance, broken local
  references, position-dependent ordinary paths, instruction cycles, declared
  adapter drift, unreadable required evidence, and active-root budget
  violations block a successful report. Check reachability separately for each
  selected runtime instead of inventing parity from file coexistence. Follow
  explicit guidance routes transitively regardless of directory, including
  deferred maps under `docs/agent-guidance/`; a traversal limit must not silently
  accept an unchecked dependency. Incidental source references are not guidance.
- **IA-S9 — Codify decisions, not guesses.** A canonical rule that arbitrates
  between valid live patterns requires evidence of a prior team decision or an
  explicit user choice. When no arbiter exists, surface the decision and do not
  encode the agent's heuristic or recommendation as repository policy. Pause
  for the choice; merely documenting that the decision remains open is not a
  substitute for asking. A request to establish a pattern requires inspecting
  its relevant implementations as well as instruction files; their common
  parent directory does not resolve a choice between competing implementations.
- **IA-S10 — Path semantics match the loader.** Ordinary repository paths in
  routed agent guidance resolve from the repository session root. Setup
  rewrites lifted or nested-relative ordinary routes without rewriting
  or deleting loader-native imports, even when an imported file appears empty,
  and without relocating skill bundles or rewriting their skill-relative
  resource paths unless separate scope or reachability evidence requires it.
- **IA-S11 — Intent-matched setup.** Explicit invocation and requests to
  create or reorganize the repository guidance graph select setup. Requests
  only to audit or doctor an existing graph leave setup unselected so the
  narrower doctor capability can own them. Existing instruction files do not
  turn a reorganization request into an audit request.

### Non-goals

Installing agent runtimes or plugins, changing permissions, mining transcript
history, enforcing code architecture, replacing project documentation, or
implementing complete TOML, YAML, Markdown, or runtime-loader conformance.

## doctor-information-architecture

### Intent triggers

"doctor the agent instructions", "audit AGENTS.md", "trim CLAUDE.md",
"check the context architecture", "find stale agent guidance", "reduce
resident context", or an explicit skill invocation.

### Contract

Run a read-only structural audit, inspect repository evidence for the findings
that need judgment, and present a concise keep/move/rewrite/remove proposal plus
any genuinely open decisions. Apply only confirmed actions and explicitly made
decisions, then rerun the audit.

### Invariants

- **IA-D1 — Structure before prose.** Start with deterministic inventory:
  entrypoints, sizes and token estimates, local references, broken targets,
  cycles, duplicate content, relevant native scoped guidance, root runtime
  configuration, and declared adapter relationships. Ignore fenced examples
  when extracting routes. This is a compact IA-oriented structural audit, not a
  replacement parser for every runtime format. Do not read the whole repository
  before this report narrows the investigation.
- **IA-D2 — Cheap derivability only.** Remove a repository fact only when it is
  reliable and cheap to recover from a canonical source in a few reads. Keep
  behavior-changing constraints, prohibitions, safety rules, exact unusual
  commands, non-obvious reasons, cross-project contracts, and facts whose
  reconstruction would defeat the routing design. Do not manufacture
  behavioral force by rewriting a derived inventory as an imperative.
- **IA-D3 — Preserve routing value.** A generated rule index or short purpose
  map is not redundant when it prevents opening many files to discover which
  one applies. Optimize total retrieval cost, not root-file line count alone.
- **IA-D4 — Harness-aware recommendations.** Account for each supported
  runtime's discovery and scoping behavior relevant to reachability. A native
  Claude rule, a nested Codex `AGENTS.md`, and an explicit root route are not
  assumed to be interchangeable. Model the selected root entrypoint and native
  scoped guidance needed for the selected runtime. Read the configured Codex
  root budget when it is available. Treat adapter directories as mirrors only
  when repository evidence or an explicit `--mirror` argument declares that
  relationship. Keep repository inventory separate from verification scope:
  findings in unselected or shadowed entrypoints block only when selected
  guidance explicitly reaches them. Selected native scoped guidance and
  explicitly declared mirrors remain in scope.
- **IA-D5 — Usage is never deletion authority.** Missing or infrequent
  transcript usage may prompt investigation but never justifies removal or
  promotion of valid scoped guidance into the resident root. Eval runs, short
  windows, routing failures, and unobserved safety paths make usage evidence
  systematically incomplete.
- **IA-D6 — Separate invariant from procedure.** Keep concise invariants in
  their applicable scope. Move a repeatable ordered workflow to a skill only
  when it can load by intent without losing reachability. A structurally valid
  graph does not make an ordered workflow correctly resident: when safe
  reorganization is approved and a reachable skill destination exists, move
  the workflow and leave only its universal invariant and intent route
  resident.
- **IA-D7 — Propose, confirm, apply.** The report groups exact file-level
  actions as keep, move, rewrite, or remove, with estimated resident-context
  impact and reasoning. An explicit request to apply safe fixes may confirm
  decision-free actions in advance; a request to see the proposal before
  changes requires a pause. Neither form of approval settles an open policy
  decision. No checked-in file changes before applicable confirmation and no
  automatic commit.
- **IA-D8 — Fail closed on unreadable evidence.** An unreadable instruction,
  relevant project configuration, skill, or declared adapter source is reported
  and blocks dependent recommendations. Guidance and skills selected for the
  repository architecture must be repository-owned and version-control-eligible.
  Never treat missing evidence as proof that guidance is redundant.
- **IA-D9 — Verify after changes.** Rerun the structural audit and report the
  before/after resident bytes and approximate tokens for each selected
  runtime's inventoried root guidance. Remaining critical structural findings
  and metric limitations are explicit; do not present the compact audit as an
  exact simulation of runtime context assembly.
- **IA-D10 — Preserve decision status.** Do not infer a canonical rule from the
  number, age, or apparent popularity of competing implementations. Keep an
  evidenced settled decision; surface an unresolved choice without rewriting
  it into policy.
- **IA-D11 — Reject position-dependent ordinary paths.** Report an ordinary
  routed repository path that resolves only relative to its containing
  instruction file. Routed maps and nested entrypoints use session-root paths.
  Loader-native imports and skill-bundled resources are outside this ordinary
  route rule and retain their native semantics. Recognize bare Claude imports
  such as `@AGENTS.md` and resolve imports relative to the importing file.
  Resolve skill resources against the owning skill directory, including from
  its deferred references; repository-root lookalikes must not mask a missing
  bundled resource. Missing native or bundled dependencies still block.
  Generic inline-code mentions of entrypoint filenames in skill prose are not
  bundled resource declarations. Continue validating explicit read routes,
  Markdown links, and native imports.
- **IA-D12 — Intent-matched doctoring.** Explicit invocation and requests to
  audit, doctor, trim, deduplicate, or improve an existing repository guidance
  graph through diagnosed corrections select doctoring. Requests to create,
  set up, or reorganize the guidance graph select setup unless the user
  explicitly asks for doctoring, even when instruction files already exist.
  Naming an installed doctor skill in a proposed file graph or a future audit
  route does not itself claim that doctoring was selected or used.

### Non-goals

General repository cleanup, rewriting documentation for style, removing
installed extensions, changing agent settings, optimizing global user memory,
or serving as a complete runtime configuration/schema validator.

## context-usage

### Intent triggers

A request for the current Codex context breakdown, `$context-usage`, or an
agent checking its context before a large multi-step phase, before pulling in
large outputs, or before deciding whether to delegate. Fixed-schedule checks
and repository setup or doctor requests do not select this skill.

### Contract

Report a read-only snapshot of the exact current Codex thread through
`ia-context --format grid|json`, launched by `backend/scripts/run_locked.py`.
People receive the grid and category table; agents checking themselves receive
JSON. On Claude Code, point to `/context` and stop without running a command.
Report facts only; never recommend compaction or handoff.

### Invariants

- **IA-C1 — Exact session binding.** Require `CODEX_THREAD_ID`; find exactly
  one `sessions/**/rollout-*-<thread_id>.jsonl` beneath `CODEX_HOME` (default
  `~/.codex`). Never select a recent or unrelated session. Emit its absolute
  path and `schema_version: 1` in JSON. Refuse missing or duplicate rollouts,
  malformed lines, unsupported record/content shapes, and unreadable evidence.
  Diagnostics include the rollout path/line when applicable and `cli_version`
  when session metadata has supplied it.
- **IA-C2 — Active history.** Count `session_meta.base_instructions` once,
  then only the last `compacted.payload.replacement_history` and subsequent
  response items. Earlier history contributes no estimates. Validate the whole
  rollout, including discarded history, rather than hiding malformed input.
  Count response items once; event-message copies are not additional context.
  Ignore known non-content `inter_agent_communication_metadata` records.
  Count visible `agent_message` content as messages, without its routing metadata.
  Codex also logs the base instructions as a developer message, including in
  replacement history. Exclude that exact echo from developer estimates so the
  system prompt is counted once.
- **IA-C3 — Honest estimates.** Use the doctor's ceiling of UTF-8 bytes / 4
  per category: system prompt, other developer instructions, skills, plugins,
  AGENTS.md, environment, messages and tool output. Split tagged skills,
  plugins and environment blocks from surrounding instructions. Recognize the
  user AGENTS.md heading. Tool calls belong to messages; outputs belong to tool
  output. Visible reasoning summaries belong to messages; encrypted reasoning
  is unmeasurable. Encrypted `compaction` items in replacement history are
  recognized but unmeasurable; their tokens remain in the remainder. When
  `additional_tools` carries definitions, estimate their compact JSON in a separate logged-tool-definitions category. This does not
  establish that all tool/MCP definitions are logged.
- **IA-C4 — Exact accounting.** Use the last usable `token_count` event's
  `last_token_usage.total_tokens` (normally input plus output) and
  `model_context_window`, never cumulative session usage. After compaction,
  Codex can emit a synthetic total with zero input/output components; retain the
  reported total rather than recomputing it from those components.
  The remainder is exact context used minus all category estimates. Preserve
  a negative remainder and warn; never clamp it. Before the first token count,
  report estimates with null exact total, window, free space and remainder.
  Estimates can include items recorded after the last usage measurement; label
  this snapshot limitation in both formats. Estimates plus remainder equal the
  exact total whenever it is available.
- **IA-C5 — Configuration and display.** Read `CODEX_HOME/config.toml` and
  refuse clearly if it cannot be read. Without a TOML dependency, recognize only
  the root integer `model_auto_compact_token_limit`, allowing comments and digit
  separators and ignoring table-scoped settings and quoted-string contents.
  Invalid or duplicate root limits refuse. This is not a complete TOML or Codex
  configuration resolver: profiles, project overrides and default thresholds
  are not inferred. Only a configured limit adds autocompact buffer information
  (window minus limit, with a warning if the limit exceeds the window). The
  buffer is a window reservation, not another used-context category. Render a
  bounded grid with a legend and numeric category table, retaining signed
  numeric remainder and warnings even when the grid cannot depict them.
- **IA-C6 — Read-only facts.** Never edit guidance, configuration, session
  history or repository files, recommend compaction/handoff, or start doctor.
  The locked launcher may prepare its ordinary external runtime cache.
- **IA-C7 — Evidence.** Keep cleaned normal and compacted fixtures, public
  CLI regression tests, a generated accounting property, colocated selection,
  Claude redirect and clean-Git evals, and fresh copied-plugin execution.

### Non-goals

Doctor integration and Claude Code parsing. This is not an exact tokenizer,
model billing report, complete configuration parser, or measurement of
unlogged tool/MCP definitions.

### Live Codex comparison

On 2026-11-02, Codex CLI 0.166.0, GPT-6.1-Sol, a read-only live
session produced 19,587 input tokens and 954 output tokens (359 reasoning
tokens included in output). Its final token-count total was 20,541 and its
window was 475,000. `/status` displayed `20.5K used / 475K`, establishing
input plus output rather than input alone. A shorter control yielded 19,576
input + 6 output = 19,582, displayed as 19.6K. No private prompt, tool output
or account data is retained in this evidence.

The live rollout also contains `additional_tools` developer items with actual
tool definitions. These can be estimated separately; the remainder still
contains unlogged definitions and tokenizer/serialization differences. Both
plugin manifests expose the shared skill directory; the Claude manifest does
not declare a per-skill host exclusion. Keep its short `/context` redirect
available on Claude rather than claiming it is excluded there.

A real compaction of the disposable long-response probe retained an encrypted
`compaction` item and a developer message identical to the base instructions.
Its last usage record reported 22,896 total tokens with zero input/output
components, and `/status` displayed `22.9K used / 475K`. The field
`last_token_usage.total_tokens` remains authoritative in this synthetic case.
