# Marketplace installation

The repository-level installer reads the current `.claude-plugin/marketplace.json`
inventory at execution time and installs each listed plugin except
`darrow-ticket-pipeline` and `darrow-observability-langfuse` through the selected
host's ordinary per-plugin installation command. `darrow-adaptive-delivery`
remains included. The installer is not a plugin, does not introduce a runtime
dependency between plugins, and preserves every marketplace plugin as an
optionality boundary.

When executed from a checkout, the installer reads that checkout's manifest.
When executed through the documented remote `curl` shortcut, it downloads the
current marketplace manifest from the Darrow GitHub source. A failed download
is a named nonzero refusal.

The installer supports Codex and Claude Code. It stops at a failed installation
with a nonzero exit status, names the affected plugin, and prints its successful
completion message only after every listed plugin was installed. Claude Code's
installation scope is passed to every per-plugin command.

The installation documentation must identify both excluded entries: the
ticket-pipeline entry is deprecated, and the Langfuse plugin requires UV/Python,
hook trust, and separate opt-in configuration. Before the host installation
commands, it identifies plugins with Python helpers and documents UV, the
supported Python range, platform-specific setup, and runtime availability checks.
It distinguishes installing a plugin from preparing its helper environment:
the marketplace installer does not provision UV or Python. Each plugin uses its
own locked package without creating a dependency on another Darrow plugin.

Every plugin containing Python code links its README prerequisites to the
shared installation guide's UV and Python section using an absolute published
URL. Runtime version requirements and general setup instructions live in that
shared section; plugin-specific tools, host constraints, helper commands, and
development checks remain documented locally.
