# ADR-0005: Use portable Bash facades for plugin mechanics

Status: Accepted
Date: 2026-08-13
Revisit when: Every supported Claude Code and Codex host provides a common, independently installable runtime that is more portable than Bash 3.2 plus baseline Unix utilities, or the supported macOS boundary no longer includes Bash 3.2.

## Context

Agent skills should spend model judgment on intent, evidence, authority, and
trade-offs. Reconstructing command syntax, capability discovery, escaping,
validation, parsing, and normalization in every invocation instead consumes
context and makes repeatable mechanics nondeterministic. Bundled scripts can
provide a smaller, testable interface for those operations.

Those scripts also become runtime dependencies of independently installed
plugins. Python, JavaScript or TypeScript, Ruby, JVM, and compiled helpers would
require users to install and trust another language runtime even when the host
and wrapped CLI already provide everything the capability needs. Darrow must
work in the default macOS and Linux environments of both supported agent
harnesses, including macOS `/bin/bash` 3.2.

## Decision

Put deterministic, repeatedly needed, or error-prone plugin mechanics behind
narrow bundled facades written in portable Bash.

- `SKILL.md` owns contextual judgment, authority checks, material choices, and
  semantic interpretation.
- A bundled script owns repeatable command construction, capability discovery,
  escaping, bounded validation, parsing, and normalization when those mechanics
  would otherwise be reconstructed by the model.
- Script interfaces accept intent-level inputs and return compact, stable,
  model-facing evidence. They fail closed on unreadable required inputs and
  identify local paths as absolute paths when paths are part of the result.
- Plugin-shipped executable mechanics use portable Bash, baseline Unix
  utilities, and only the host CLIs the capability explicitly wraps. They
  support Bash 5 and macOS `/bin/bash` 3.2 and avoid GNU-only assumptions.
- Plugins do not add Python, JavaScript or TypeScript, Ruby, JVM, compiled, or
  other full-language runtime dependencies for internal helpers.
- Repository development and evaluation infrastructure is outside this runtime
  boundary and may use another implementation when an accepted architecture
  decision establishes it. ADR-0001 establishes TypeScript on Bun for the
  shared evaluation runner.

Exact script behavior remains normative in the applicable capability
specification and direct script tests.

## Consequences

- Plugin mechanics are inspectable, directly testable, and available on the
  supported hosts without an additional language installation.
- Models receive smaller tool surfaces and spend less context reproducing
  protocol details.
- Bash 3.2 and BSD utility constraints require more conservative implementations
  and explicit bounds than newer shells or GNU-only environments.
- Contextual decisions cannot be hidden in scripts merely to make them
  deterministic; authority and consequences remain visible to the invoking
  model.
- Heavier repository infrastructure must remain clearly separated from plugin
  runtime packaging so it does not become an accidental user dependency.
