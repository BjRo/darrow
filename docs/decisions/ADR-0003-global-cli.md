# ADR-0003: Global orchestration CLI uses TypeScript on Bun

Status: Accepted
Date: 2026-07-16

## Context

ADR-0002 selects Bash for small plugin-local facades because those tools must be
self-contained and portable into arbitrary consumer repositories. The global
Darrow CLI has different responsibilities: workflow schema validation,
dependency resolution, immutable plans and locks, Temporal integration,
structured protocols, concurrent run coordination, and artifact management.
Those responsibilities exceed the maintainable boundary established for the
plugin-local Bash tools.

The repository already uses TypeScript and Bun for the eval runner. Temporal has
a TypeScript SDK, allowing the CLI and durable worker to share contract types and
implementation language.

The CLI must still be independently installable from plugins. It must support a
developer who prefers a global executable and a repository that prefers a pinned
project-local version.

## Decision

Implement the global Darrow CLI and worker in TypeScript on Bun. Canonical source,
schemas, package metadata, and tests live under `/cli` in this repository.

- The CLI and CLI protocol version independently from plugin packages and
  plugin-local facades.
- Users install through Bun or through a dedicated explicit installer command
  skill.
- Darrow has no default installation scope. If the user has not chosen, the
  installer asks whether to install globally or repository-locally.
- A repository-local installation may modify package and lock files only after
  that explicit choice.
- A global installation does not modify repository files.
- Only the installer command skill may install or update the CLI. Ordinary
  entrypoint, command, and capability skills report missing or incompatible
  versions and provide the installer skill or direct Bun command.
- No skill starts hosted infrastructure or installs another plugin as an
  implicit side effect.

Standalone binaries or additional package channels may be added later if they
preserve the same CLI protocol and installation-scope choice.

## Consequences

- The first global CLI requires Bun unless distributed through a future
  self-contained channel.
- CLI, worker, compiler, and Temporal integration can share TypeScript schemas
  and contract types with the existing eval infrastructure.
- Plugin consumers that use only capability skills and plugin-local Bash facades
  do not need the global CLI or Bun.
- `/cli` becomes a separately versioned product surface with its own tests,
  release process, and compatibility policy.
- ADR-0002 remains authoritative for plugin-local Bash facades and does not
  constrain the global CLI.
