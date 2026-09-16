# Marketplace installation

The repository-level all-plugin installer reads the current
`.claude-plugin/marketplace.json` inventory at execution time and installs each
listed plugin through the selected host's ordinary per-plugin installation
command. It is not a plugin, does not introduce a runtime dependency between
plugins, and preserves every marketplace plugin as an optionality boundary.

The installer supports Codex and Claude Code. It stops at a failed installation
with a nonzero exit status, names the affected plugin, and prints its successful
completion message only after every listed plugin was installed. Claude Code's
installation scope is passed to every per-plugin command.

The all-plugin documentation must call out the deprecated ticket-pipeline entry
and the Langfuse plugin's UV/Python prerequisite, hook trust prompt, and
separate opt-in configuration requirements.
