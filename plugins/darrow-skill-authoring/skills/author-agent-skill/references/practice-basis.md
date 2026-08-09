# Practice basis

This reference records how the workflow adapts its sources. Read it only when a
design trade-off is unclear or when maintaining `author-agent-skill`; ordinary
skill runs should follow `SKILL.md` directly.

## Adopted

### Matt Pocock: `writing-for-agents`

Source: [`writing-for-agents`](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents)
and its
[`SKILL-MECHANICS.md`](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md),
inspected 2026-08-09.

- Treat the description or route as a context pointer whose wording controls
  retrieval; front-load the recognizable trigger branches.
- Budget both always-loaded context and human discovery effort.
- Keep ordered steps above in-file reference, progressively disclose
  branch-specific material, and colocate each concept with its rules and
  caveats.
- End phases with clear and demanding completion criteria to resist premature
  completion.
- Keep one source of truth and prune duplicated, derivable, stale, irrelevant,
  and behavior-neutral prose.

### obra/superpowers: `writing-skills`

Source: [`writing-skills`](https://github.com/obra/superpowers/tree/main/skills/writing-skills),
inspected 2026-08-09.

- Treat process-document behavior like a red/green/refactor loop: capture an
  uncontaminated baseline, observe concrete failure, add the smallest guidance,
  and close demonstrated loopholes.
- Create reusable techniques and workflows, not narratives about one solved
  incident; automate mechanical constraints and reserve prose for judgment.
- Optimize discovery metadata for concrete trigger conditions without copying
  the procedure into the description.
- Use pressure cases and fresh contexts, read the actual rationalizations or
  artifacts, and keep supporting files for reusable tools or heavy reference.

### Current Codex guidance

Sources: OpenAI's current
[`Build skills`](https://developers.openai.com/plugins/build/skills) and
[`Build plugins`](https://developers.openai.com/plugins/build/plugins) guidance,
retrieved through the current Codex manual on 2026-08-09.

- Use a skill for one task-specific workflow and an installable plugin for
  reusable distribution. Require `name` and `description`, keep the description
  concise and front-loaded, and point the plugin manifest at `./skills/`.
- Define expected input, ordered steps, output, non-inference boundaries,
  question/stop conditions, supporting-file use, and successful completion.
- Keep detailed policies and examples in `references/`, deterministic processing
  in `scripts/`, and add a script only when instructions and existing tools are
  not reliable enough.
- Test direct and indirect activation, incomplete input, requests that should
  not activate, and edge cases that could invent facts or unsupported actions.

### Current Claude Code guidance

Sources: Anthropic's official
[`Extend Claude with skills`](https://code.claude.com/docs/en/slash-commands) and
[`Extend Claude Code`](https://code.claude.com/docs/en/features-overview) pages,
inspected 2026-08-09.

- Claude Code follows the Agent Skills format, loads descriptions for discovery
  and full bodies on invocation, and packages distributable skills under a
  plugin `skills/` directory with plugin namespacing.
- Specific descriptions improve selection; supporting files should be colocated,
  linked from `SKILL.md`, and loaded only when relevant.
- Skills hold reusable knowledge and workflows, while hooks enforce lifecycle
  mechanics and subagents provide isolated execution context.
- Host-specific invocation controls can reduce context or prevent autonomous
  side effects, but they are not part of the smallest common cross-runtime
  frontmatter surface.

## Adapted

- The description includes a short statement of the recognizable goal plus
  concrete triggers, following current Codex guidance, while omitting ordered
  process detail as obra warns. This preserves discovery without making metadata
  a substitute for the body.
- Matt's model-invoked versus user-invoked trade-off becomes a deliberate
  cross-runtime decision. The default uses common `name` and `description`
  metadata; optional host-specific invocation controls require explicit need and
  compatibility verification.
- Matt's leading-word technique is used only for established terms that sharpen
  a repeated concept. The workflow does not require coined vocabulary or treat
  brevity as more important than an observable boundary.
- obra's repeated pressure testing is scaled to risk and claim strength. The
  workflow requires fresh evidence and reports sample size, but does not impose a
  universal repetition count when model calls are expensive or a deterministic
  seam already proves the mechanic.
- Baseline testing is required when an uncontaminated comparison is available.
  When the repository harness cannot provide it, the workflow records the
  limitation and relies on forward evidence instead of fabricating a failure.

## Rejected for Darrow

- Cross-skill required background, user-global skill paths, and references to
  arbitrary external files: an independently installable Darrow plugin cannot
  assume another skill, plugin, or machine-local checkout exists.
- Mandatory commit, push, contribution, installation, or deployment steps:
  authoring evidence never broadens the user's delivery authority.
- A router skill or a family of loosely related skills: this plugin has one
  memorable goal and one focused workflow, so another always-loaded pointer
  would add context without improving reachability.
- Sequence splitting through subagents by default: isolation is useful for the
  final adversarial evaluation, but ordinary phases stay visible unless observed
  premature completion justifies a real context boundary.
- Claude-only frontmatter as the default contract: host-specific fields can be
  added for an explicit target, while the shipped skill keeps the portable
  common surface and places Codex UI metadata in `agents/openai.yaml`.
