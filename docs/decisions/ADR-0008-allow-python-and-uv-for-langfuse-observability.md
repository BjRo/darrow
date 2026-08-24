# ADR-0008: Allow Python and UV for Langfuse observability

Status: Accepted
Date: 2026-08-24
Summary: Permit the independently installable Langfuse observability plugin to use a locked Python backend managed by UV while retaining a portable Bash hook launcher and keeping the exception scoped to that plugin.
Revisit when: Codex exposes equivalent native Langfuse export, the Langfuse SDK no longer requires Python, or the plugin can meet its rollout-reconstruction and export contract with the portable Bash baseline alone.

## Context

ADR-0005 normally restricts plugin-shipped mechanics to portable Bash and the
host CLI a capability wraps. GitHub issue #45 explicitly requires a Python
backend managed by UV and asks that the implementation be oriented on
Langfuse's Codex observability plugin. Reconstructing nested Codex rollout
events and exporting them through the supported Langfuse SDK would otherwise
require either reimplementing that SDK protocol or adding a general runtime
that exceeds the requested plugin boundary.

The exception needs to remain independently adoptable. It must not weaken the
portable baseline for other plugins or turn Python into shared Darrow runtime
infrastructure.

## Decision

Permit `darrow-observability-langfuse` to ship one contained Python backend
managed by UV.

- The Codex `Stop` hook entrypoint remains a portable Bash launcher compatible
  with Bash 3.2 and Bash 5.
- The plugin commits its `pyproject.toml` and `uv.lock`, invokes UV with frozen
  resolution, and documents the additional runtime requirement.
- Python code, dependencies, environments, and state remain inside the plugin
  boundary. No sibling plugin or repository runtime is required.
- The hook remains disabled by default and fails open by default, including
  failures that occur while UV resolves or starts the Python backend.
- This is a narrow exception to ADR-0005 for this plugin only. Other
  plugin-shipped mechanics continue to follow the portable Bash rule unless a
  separate accepted decision authorizes another exception.

## Consequences

- The plugin can use the maintained Langfuse Python SDK and model nested Codex
  rollout activity without inventing a second export protocol.
- Installation requires UV and a compatible UV-managed Python runtime, and the
  first invocation may create a local virtual environment and download locked
  dependencies.
- Frozen lock validation, both-Bash launcher tests, and pre-Python failure
  tests become part of the plugin's release evidence.
- The exception increases installation weight and supply-chain surface for
  adopters of this plugin, but does not affect users who do not install it.
