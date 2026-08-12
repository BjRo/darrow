# Install a Darrow plugin

Darrow is a marketplace, not one all-or-nothing plugin. Add its marketplace,
inspect the available plugins, and install only the capabilities you want.

Before installing a plugin, review its README and manifest. Plugins can include
instructions and executable helpers that run with the permissions granted by
the host.

## Claude Code

From an interactive Claude Code session, add the Darrow marketplace:

```text
/plugin marketplace add BjRo/darrow
```

Install a plugin by its catalog name. For example, install the read-only
readiness gate used by the getting-started tutorial:

```text
/plugin install darrow-readiness-gate@darrow
```

The details view lets you inspect the plugin and choose user, project, or local
scope. Follow the installation summary if it asks you to run
`/reload-plugins`; otherwise start a new session before using the plugin.

To install a different capability, replace `darrow-readiness-gate` with a name
from the [plugin catalog](../README.md#plugin-catalog).

See the official Claude Code guide to
[plugin marketplaces](https://code.claude.com/docs/en/discover-plugins) for
scope, updating, removal, and troubleshooting.

## Codex

Add the Darrow marketplace from your shell:

```sh
codex plugin marketplace add BjRo/darrow
```

Start Codex CLI and open the plugin browser:

```text
codex
/plugins
```

Choose the `darrow` marketplace, inspect `darrow-readiness-gate`, and install
it. You can also install it directly from your shell:

```sh
codex plugin add darrow-readiness-gate@darrow
```

Start a new Codex session in the repository where you want to use the skill.
The plugin browser can enable, disable, or uninstall installed plugins.

Codex plugins are supported in Codex CLI and Codex in the ChatGPT desktop app,
but not in the IDE extension. See the official OpenAI documentation for
[installing and using plugins](https://developers.openai.com/codex/plugins) and
[local marketplace discovery](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work).

## Verify the installation

Start a new session in a repository and ask:

```text
Assess whether this implementation request is ready before any code is changed.
```

If `darrow-readiness-gate` is installed and enabled, the agent should apply its
read-only readiness workflow. Continue with the
[first-workflow tutorial](getting-started.md) for a complete example.
