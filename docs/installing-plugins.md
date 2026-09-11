# Install a Darrow plugin

Darrow is a marketplace of independent plugins. Choose a plugin from the
[selection guide](choosing-plugins.md), then read its local README and manifests
before installing: helpers run with the host's granted permissions.

## Prerequisites

Use a signed-in Codex CLI or Claude Code installation with plugin support and
network access to the marketplace. Open a repository you can safely use for
the [read-only first workflow](getting-started.md). Follow organization policy
for trusted sources and installation scope.

The commands below identify their host. CLI syntax was checked against Codex
0.154.0 and Claude Code 2.1.223 on 2026-09-11. Host menus and account policies
can differ; consult local `--help` and the linked official documentation if
a command is unavailable. Syntax checks alone do not verify your account,
network, installed state, or the desktop UI.

### Select the command target

The commands below use `darrow-readiness-gate@darrow` as the worked example for
the [first workflow](getting-started.md). For another plugin, replace that
identifier in **every install, update, remove, and reinstall command** with the
selected plugin's name from its README, followed by `@darrow`. For example,
use `darrow-git@darrow` for Darrow Git. Keep the marketplace name `darrow`
unchanged. Before removal or replacement, check the installed listing and scope
against your intended target; do not run the readiness example literally for
a different plugin. Verify using the selected plugin's own usage instructions.

## Claude Code

Run these inside an interactive **Claude Code session**, one at a time:

```text
/plugin marketplace add BjRo/darrow
/plugin install darrow-readiness-gate@darrow
```

Expect a marketplace-added result, followed by an installation result naming
your selected plugin (`darrow-readiness-gate@darrow` in this example) and its
scope. Choose user scope for your own
sessions, project scope for shared project configuration, or local scope for
a private project choice. Project scope can change checked-in configuration.
Start a fresh session, or follow a host-provided reload instruction.

### Update or remove in Claude Code

From your **shell**, inspect installed plugins:

```sh
claude plugin list
```

For a plugin installed in user scope, update with:

```sh
claude plugin update darrow-readiness-gate@darrow --scope user
```

To uninstall that user-scoped plugin:

```sh
claude plugin uninstall darrow-readiness-gate@darrow --scope user
```

Use the actual installation scope when it differs. Expect the result to name
the updated or removed plugin. Start a new session after an update or removal.
The [official Claude marketplace guide](https://code.claude.com/docs/en/discover-plugins)
documents scope, trust, refresh behavior, and recovery. Claude Code support in
Darrow is best-effort; primary development uses Codex.

## Codex

Run these in your **shell**, one at a time:

```sh
codex plugin marketplace add BjRo/darrow
codex plugin add darrow-readiness-gate@darrow
```

Expect the marketplace and installation results to name `darrow` and the
selected plugin. To inspect available plugins from the shell:

```sh
codex plugin list
```

Alternatively, start Codex, then enter `/plugins` **inside the session**.
Choose the Darrow marketplace and inspect the plugin before installing it.
Start a fresh session in the repository where you want to use it.

### Update or remove in Codex

Refresh the configured Darrow marketplace snapshot from your shell:

```sh
codex plugin marketplace upgrade darrow
```

Inspect the plugin in `/plugins` for the installation action your version
offers. Refreshing the marketplace is not proof that an installed cached
plugin was updated. To deliberately replace its installed cache, remove the
selected plugin and add it again:

```sh
codex plugin remove darrow-readiness-gate@darrow
codex plugin add darrow-readiness-gate@darrow
```

Removal uninstalls the selected plugin and removes its local cache. To remove
it without reinstalling, run only the first command. Review the reported
target and your plugin configuration, then start a fresh session.

See the [official Codex plugin documentation](https://developers.openai.com/codex/plugins)
for supported surfaces and UI behavior. If your Codex surface has no plugin
support, use Codex CLI or browse the static documentation; do not assume that
a CLI installation enabled a different app or extension.

## Verify the installation

First check the installed listing names your selected plugin. In a fresh
session, follow that plugin README's **Usage** and **Expected result** sections,
including its host-support and safety limits. Use its documented skill name
and a request whose effects you authorize. A package listing alone does not
prove invocation or behavior; verifying readiness does not verify another plugin.

For the readiness worked example, select its installed skill explicitly:

- Codex: type `$` and choose `assess-implementation-readiness`.
- Claude Code: use `/darrow-readiness-gate:assess-implementation-readiness`.

Supply the request in the [first-workflow tutorial](getting-started.md).
Expect an assessment with a verdict, inspected basis, quality bar, and next
action; a non-ready verdict may leave the quality bar empty when required facts
are missing. No implementation, edits, or tracker writes should occur.
An installed listing proves package state; the observed assessment proves
that the skill can be invoked. Neither proves every plugin behavior.

If listing succeeds but invocation does not, follow
[an installed plugin does not appear](troubleshooting.md#an-installed-plugin-does-not-appear).
Keep the exact host version, scope, invocation, and error for escalation.
