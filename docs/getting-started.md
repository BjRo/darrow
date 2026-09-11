# Get started with Darrow

This tutorial takes you through one complete Darrow workflow without changing
your repository or requiring access to a ticket tracker. You will install the
read-only readiness gate, give it a small implementation request, and inspect
the result.

## What you need

- A signed-in Claude Code or Codex CLI with plugin support and network access
  for installation. See the [verified command versions](installing-plugins.md#prerequisites).
- Any local software repository you can open in that host.

## 1. Install the readiness gate

Follow [Install a Darrow plugin](installing-plugins.md) and install
`darrow-readiness-gate` for your host. Start a new session in your chosen
repository after installation.

## 2. Ask for a readiness assessment

Paste this request into the session:

```text
Assess whether this implementation request is ready before any code is changed:

Add a --json flag to the project's main CLI command. With the flag, print one
JSON object per result. Preserve the existing text output by default. Add tests
for both output modes.
```

You do not need to name the plugin. Darrow capability skills are intent-matched,
so an installed readiness skill can be selected from the request itself.

## 3. Inspect the result

The readiness gate should return exactly one of these verdicts:

- `ready`
- `needs-discovery`
- `needs-decision`
- `blocked`

It should also identify a concrete quality bar and the evidence needed to
verify the change in a human-readable report. JSON is available only when a
caller explicitly requests the versioned machine representation. The exact
verdict can differ between repositories. For example, a repository with no
identifiable CLI entry point may need discovery; that is a successful
assessment, not a failed tutorial.

The workflow is read-only. Confirm that it assessed the request without editing
files, creating tracker items, or starting implementation.

## 4. Invoke the skill explicitly

Repeat the assessment, this time selecting the skill yourself:

- In Claude Code, run
  `/darrow-readiness-gate:assess-implementation-readiness` and supply the same
  request.
- In Codex, type `$` and select `assess-implementation-readiness` from the
  installed skills, then supply the same request.

Explicit invocation is useful when several installed capabilities could match.
For ordinary focused requests, intent matching is usually enough.

## 5. Choose your next plugin

Return to [Choose Darrow plugins](choosing-plugins.md). Each plugin README
includes example requests and its safety boundaries. Install capabilities as
you need them rather than installing the entire marketplace.

## If your environment differs

If your repository has no CLI, ask the gate to assess a small behavior it does
have, with an observable expected result. Do not treat a different verdict as
failure. If the skill cannot be selected, use the
[installation checks](troubleshooting.md#an-installed-plugin-does-not-appear).
Keep the host version and exact symptom for escalation.

Return to the [documentation hub](README.md).
