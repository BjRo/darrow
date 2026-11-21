# Troubleshoot documented Darrow problems

Use the symptom below to find a safe check and a next step. These instructions
explain known behavior; they do not establish the cause of a failure on your
machine. The repository guide can explain them without running diagnostics.

## The repository guide is missing

The guide belongs to this checkout, not the marketplace. Its canonical source
is `.agents/skills/darrow-guide`; `.claude/skills/darrow-guide` is a relative
symlink to that directory. Start the host at the
Darrow repository root and open a new session after pulling a version that
contains it. Confirm that the checkout contains the appropriate entrypoint:

- Codex: `.agents/skills/darrow-guide/SKILL.md`; select `$darrow-guide`.
- Claude Code: `.claude/skills/darrow-guide/SKILL.md`; select `/darrow-guide`.

An older checkout, a different working directory, a disabled project skill
source, or a host restriction can explain missing discovery, but must be checked
before naming a cause. If the skill is unavailable, the
[documentation hub](README.md) is the complete static alternative.
Codex remains the primary development host. Claude support is scoped to
[plugin-specific evidence and exceptions](choosing-plugins.md).

## An installed plugin does not appear

Check the installation result and the selected scope using the host's plugin
list or browser. Confirm the exact marketplace and plugin name against the
[selection guide](choosing-plugins.md), then start a fresh session.
Use the explicit invocation from the plugin README to separate discovery from
installation. See [installation verification](installing-plugins.md#verify-the-installation).

If a command is unknown, read that host's local help and compare its version
with the procedure's verification note. Do not paste commands for the other
host or edit credentials as a speculative fix.

## Old and new copies both appear

Marketplace removal does not uninstall cached plugins or repository-local skills.
Check the exact installed identity and scope, compare local changes, and use the
[current catalog](choosing-plugins.md) and
[update/removal commands](installing-plugins.md). Reinstall the selected
replacement, then open a fresh session. Preserve custom
principle tables, relative custom files, removed routes and unrelated installations.
Do not delete cache directories while old processes still use them.

## The first assessment returns needs-discovery

That can be a successful result. The
[readiness tutorial](getting-started.md#3-inspect-the-result) deliberately
leaves repository details to inspection. A missing CLI entrypoint or unclear
behavior can require discovery or a decision. Read the assessment's missing
fact and required next action, then clarify it. Do not ask the guide to invent
a ready verdict.

## A capability refuses an operation

Keep the complete refusal and inspect the named plugin's troubleshooting and
safety instructions. For example, the Git workflows preserve existing branches
and refuse conflicts; Review refuses stale candidate evidence.
A refusal does not authorize force, fallback mutations, or bypassing hooks.
Resolve the exact missing input or authority through the responsible workflow.

## Adaptive Goal cannot launch a nested coordinator or reader

Invoke `doctor-adaptive-goal` from the installed
`darrow-adaptive-goal` plugin. It performs a read-only check of the current
host's effective configuration, reports the exact source, and distinguishes
the one-slot delegated implementation path from inline assessment (two reader
slots, one layer) and fallback assessment (three slots, two layers). The primary
thread is excluded. A replacement provider may have additional prerequisites.

For Codex, the effective diagnosis applies trusted project `.codex/config.toml`
layers after the user configuration and reports which checked sources supplied
the final controls. Keep `agents.max_concurrent_threads_per_session` separate
from `agents.max_depth`; V2 ignores the latter. In an isolated eval, diagnose
only the eval process's `CODEX_HOME/config.toml`, not this checkout's
`.codex/config.toml`. For Claude Code, the doctor checks concurrency and spawn
depth separately and reports whether the installed version supports each
control. Follow the source-specific guidance in the result and start a fresh
host session after changing configuration yourself.

## Two sources disagree

Cite both paths and the concrete claims. Applicable repository instructions and
accepted decisions govern policy; plugin-local skills, references, schemas and
documentation govern current behavior. Manifests establish package identity.
Code and tests can supply a labelled derived fact. See
[evidence states](glossary.md#evidence-states). Report stale published guidance
to its owner rather than silently selecting the more convenient claim.

## The answer is not documented

Say which answer is missing and which sources were checked. Ask the maintainer
for the smallest missing fact or open a focused documentation issue. Do not
turn an absent guarantee, planned feature, or unrun test into a positive claim.

## Environment-specific diagnosis and escalation

There is currently no shipped general `darrow-troubleshooting` plugin.
If your host has another applicable troubleshooting capability, request it
separately with your host/version, exact command or invocation, complete error,
plugin/version, installation scope, and expected result. Review logs before
sharing them and omit credentials.

The repository guide may identify that capability and explain the handoff,
but does not inspect your credentials, contact services, run diagnostics,
repair configuration, or start delivery. Without a suitable capability, use
the host's official troubleshooting documentation or
[report a Darrow issue](https://github.com/BjRo/darrow/issues).
Keep the relevant repository paths and reproducible symptom in the report.

Return to the [documentation hub](README.md).
