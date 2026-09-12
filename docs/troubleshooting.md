# Troubleshoot documented Darrow problems

Use the symptom below to find a safe check and a next step. These instructions
explain known behavior; they do not establish the cause of a failure on your
machine. The repository guide can explain them without running diagnostics.

## The repository guide is missing

The guide belongs to this checkout, not the marketplace. Start the host at the
Darrow repository root and open a new session after pulling a version that
contains it. Confirm that the checkout contains the appropriate entrypoint:

- Codex: `.agents/skills/darrow-guide/SKILL.md`; select `$darrow-guide`.
- Claude Code: `.claude/skills/darrow-guide/SKILL.md`; select `/darrow-guide`.

An older checkout, a different working directory, a disabled project skill
source, or a host restriction can explain missing discovery, but must be checked
before naming a cause. If the skill is unavailable, the
[documentation hub](README.md) is the complete static alternative.
Claude Code support is best-effort; primary development uses Codex.

## An installed plugin does not appear

Check the installation result and the selected scope using the host's plugin
list or browser. Confirm the exact marketplace and plugin name against the
[selection guide](choosing-plugins.md), then start a fresh session.
Use the explicit invocation from the plugin README to separate discovery from
installation. See [installation verification](installing-plugins.md#verify-the-installation).

If a command is unknown, read that host's local help and compare its version
with the procedure's verification note. Do not paste commands for the other
host or edit credentials as a speculative fix.

## The first assessment returns needs-discovery

That can be a successful result. The
[readiness tutorial](getting-started.md#3-inspect-the-result) deliberately
leaves repository details to inspection. A missing CLI entrypoint or unclear
behavior can require discovery or a decision. Read the assessment's missing
fact and clarify it; do not ask the guide to invent a ready verdict.

## A capability refuses an operation

Keep the complete refusal and inspect the named plugin's troubleshooting and
safety instructions. For example, the Git workflows preserve existing branches
and refuse conflicts; ticket retrieval refuses a foreign-project URL.
A refusal does not authorize force, fallback mutations, or bypassing hooks.
Resolve the exact missing input or authority through the responsible workflow.

## Two sources disagree

Cite both paths and the concrete claims. Specifications and accepted decisions
govern invariants; plugin-local documentation and manifests govern local identity
and published surface. Code and tests can supply a labelled derived fact.
Research is context only. See [evidence states](glossary.md#evidence-states).
Report stale published guidance to the owner of the affected plugin or
specification; do not silently select the more convenient claim.

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
