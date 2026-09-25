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

### UV and Python for plugin helpers

Plugins with bundled Python helpers require **UV** (the `uv` command) and
**Python 3.10–3.13** (`>=3.10,<3.14`). Check the selected plugin's
`Hosts and prerequisites` README section to see whether this setup applies,
which additional tools it requires, and which platforms it supports.

Install UV using the [official UV installation instructions](https://docs.astral.sh/uv/getting-started/installation/).
For macOS or Linux, run in your shell:

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

For Windows with WinGet, run in PowerShell:

```powershell
winget install --id=astral-sh.uv -e
```

Open a new terminal after installation. Provision a supported, UV-managed
Python version and check availability with these commands, which work in both
shells:

```sh
uv --version
uv python install 3.13
uv python find --managed-python 3.13
```

Expect a UV version and an absolute path to the managed Python interpreter.
Using `3.13` explicitly keeps the interpreter within Darrow's supported range;
a newer system Python alone may not satisfy it. UV can install Python itself,
so no separate Python installer is needed for this setup. See
[UV's Python management guide](https://docs.astral.sh/uv/guides/install-python/).

Make sure `uv --version` also succeeds in the command environment used by your
agent host. If it reports `uv: command not found`, check that UV's installation
directory is on that environment's `PATH`, then restart the host so it inherits
the updated environment.

Each plugin ships its own `pyproject.toml` and `uv.lock`. Its documented
bootstrap commands prepare an isolated environment from that lock on first use
without writing below the installed plugin. By default, environments live under
`$HOME/.darrow/cache` on Linux and macOS and
`%LOCALAPPDATA%\Darrow\Cache` on native Windows. Set `DARROW_CACHE_DIR` to a
non-empty absolute path to override that root. The selected root must be
readable and writable; invalid configuration fails without falling back to the
plugin, working directory, repository, or temporary storage.
These UV project environments are disposable cache files. The new default
does not move or delete files under the former cache location; remove those
manually when no older plugin process needs them. `UV_CACHE_DIR` still belongs
to UV or the caller. Review evidence uses a separate retained state directory
under `$HOME/.darrow/reviews` or `%LOCALAPPDATA%\Darrow\Reviews` and follows
the cleanup rules documented by `darrow-review`.

Ticket body drafts and the temporary copy passed to the GitHub CLI use
`$HOME/.darrow/tmp` on Linux and macOS or `%LOCALAPPDATA%\Darrow\Tmp` on
native Windows. Set `DARROW_TMP_DIR` to a non-empty absolute directory to
choose another root for antivirus exclusions. The ticket plugin creates it
on demand, requires private ownership and permissions on Linux/macOS, and
uses the selected directory's ACL on Windows. Choose a Windows override with
an appropriate ACL. Drafts are deleted after use; the GitHub CLI copy is
removed automatically.

Allow network access for Python, build requirements, and runtime dependency
downloads, plus write access to the Darrow and UV caches. Subsequent runs reuse
the backend-specific environment; plugin updates, moves, lock changes, and
explicit Python selections use distinct environments. The bootstrap leaves
`UV_CACHE_DIR` under UV and caller control. An installed `.venv` created by an
older Darrow version is stale and disposable; remove it only after older
processes have exited. See [UV's environment synchronization documentation](https://docs.astral.sh/uv/concepts/projects/sync/).

The marketplace install commands and bulk shortcut install plugins; they do
not install UV or provision Python. Complete this setup before using Python
helpers. Development tools and checks for contributing to Darrow are documented
separately in [Contributing](../CONTRIBUTING.md).

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

## Install supported marketplace plugins

The repository includes an inventory-driven shortcut for intentionally adopting
the current supported marketplace. It reads `.claude-plugin/marketplace.json`
when it runs, then invokes the selected host's normal per-plugin installation
command for each eligible entry. It does not make the plugins a combined package
or add dependencies between them.

First add the Darrow marketplace for the target host as shown above. You can
then run either shortcut directly, without cloning this repository:

```sh
curl -fsSL https://raw.githubusercontent.com/BjRo/darrow/main/scripts/install-all-plugins | bash -s -- --host codex
```

```sh
curl -fsSL https://raw.githubusercontent.com/BjRo/darrow/main/scripts/install-all-plugins | bash -s -- --host claude --scope user
```

These commands retrieve and execute the current Darrow installer and its
marketplace manifest from GitHub. Review the source first if your trust policy
does not permit remote shell execution. From a checkout, you can instead run
`bash scripts/install-all-plugins` with the same host arguments; it reads that
checkout's manifest locally.

Claude Code accepts `user` (the default), `project`, or `local` for `--scope`;
the script passes that scope to every `claude plugin install` call. A failed
plugin installation stops the shortcut, returns a nonzero status, and names the
plugin that failed. The success message appears only after every current
marketplace entry has installed.

The shortcut deliberately excludes two marketplace entries:

- `darrow-ticket-pipeline` is a deprecated reference implementation.
- `darrow-observability-langfuse` requires UV and a UV-managed Python
  `>=3.10,<3.14`; on Codex, review and trust its hooks when prompted. Installing
  it does not enable tracing: configure credentials and explicitly opt in before
  it exports anything. Read its local README before enabling it.

For plugins with Python helpers, complete the
[UV and Python setup](#uv-and-python-for-plugin-helpers) before using them.
The shortcut does not check or install these runtime prerequisites;
its success message confirms host installation only. Each plugin's local lock
and package remain independent of other Darrow plugins.

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
Expect an assessment that leads with its verdict and next action, followed by
the inspected basis, quality bar, and findings. A non-ready verdict may leave
the quality bar empty when required facts are missing. No implementation,
edits, or tracker writes should occur.
An installed listing proves package state; the observed assessment proves
that the skill can be invoked. Neither proves every plugin behavior.

If listing succeeds but invocation does not, follow
[an installed plugin does not appear](troubleshooting.md#an-installed-plugin-does-not-appear).
Keep the exact host version, scope, invocation, and error for escalation.
