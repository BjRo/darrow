# ADR-0001: Custom eval runner (TS/Bun) with harness adapters

Status: Accepted
Date: 2026-07-05

## Context

Every Darrow skill must be evaluated across supported agent harnesses (Claude
Code and Codex) and explicitly pinned models.
Skills are prompts executed by a harness, so evals must run the skill in the real
harness, headless, and assert on outcomes (git state, files), not transcripts.
Off-the-shelf options fit poorly: skill-creator evals are Claude-only,
promptfoo is provider-centric (filesystem/git fixtures and assertions would
end up as custom JS anyway), inspect-ai is heavyweight and Python.

## Decision

Build a thin custom runner in TypeScript on Bun.

- **Cases are declarative YAML**: fixture (temp git repo state), task prompt,
  outcome checks (shell command + regex expectations), invariant traceability
  to the capability spec.
- **Harness adapters**: one module per runtime. MVP ships `claude`
  (`claude -p --output-format json`); `codex` (`codex exec`) follows once the
  loop is proven. Adapters mount the skill under test into the fixture repo.
- **Matrix**: case × harness × model. Models are always pinned explicitly;
  results are keyed by all three dimensions.
- **Statistical rigor**: N trials per cell (default 5); pass = pass-rate
  threshold, never a single green run. Wall time and token usage recorded per
  trial; mean/p95 reported.
- **Multi-metric**: accuracy, wall time, token count captured on every run so
  skills can be optimized for a selectable target.
- **Comparison mode** (planned): baseline vs candidate skill version with
  per-metric deltas.
- **Budget guard** (planned): per-suite cost cap; sampling mode for iteration,
  full mode for CI gating.

Deterministic checks first (git log format, staged-file containment);
LLM-judge only for qualitative checks, added when needed.

## Consequences

- New harness support = one adapter file; eval definitions stay agent-neutral,
  mirroring Darrow's runtime/adapter architecture.
- MVP mounts skills via the fixture repo's `.claude/skills/` (project-level
  discovery) rather than plugin installation — simpler and stable headless;
  plugin-level mounting can replace it later without touching cases.
- The runner is repository development infrastructure, not a plugin-shipped
  runtime dependency. Plugin mechanics follow the separate boundary in
  [ADR-0005](ADR-0005-use-portable-bash-facades-for-plugin-mechanics.md).
- Eval runs cost real tokens; CI gating uses a pinned model list and the
  budget guard once implemented.
