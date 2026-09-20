---
name: doctor-adaptive-delivery
description: Diagnose whether the effective Codex or Claude Code host configuration supports Adaptive Delivery ownership and its required verification/review delegation. Use for host-configuration checks, capacity troubleshooting, or concurrency-versus-nesting questions. Do not select this capability to implement work or start adaptive-delivery orchestration.
---

# Doctor Adaptive Delivery

Inspect the active host configuration without changing it, identify the exact
source checked, and explain whether it supports the baseline owner path and the
full required-assessment topology.

## 1. Bind the host and effective source

Use the current host when the request does not name one. If the request names a
different host, diagnose that host only when its effective source and installed
version are observable; otherwise ask for the missing source or version. Never
guess a backend or version.

Resolve the bundled backend without searching:

- Claude: use `${CLAUDE_PLUGIN_ROOT}/backend`; Claude substitutes the active
  plugin's absolute root in skill content.
- Codex: starting at the directory containing this `SKILL.md`, use
  `../../backend`.

Require readable `pyproject.toml` and `uv.lock` in that exact backend, plus UV
and Python 3.10–3.13. Do not search the repository, home directory, plugin
caches, or `PATH` for a replacement. The frozen entrypoint runs on Linux,
macOS, and native Windows without Bash.

For Codex, the user configuration is
`$CODEX_HOME/config.toml` when `CODEX_HOME` is set, otherwise
`$HOME/.codex/config.toml` on Unix or `%USERPROFILE%\.codex\config.toml` on
native Windows. Pass that exact path with `--config`.

For `--context effective`, establish the absolute trusted project root. Use
current host evidence or an explicit user statement for trust; if trust is not
observable, ask instead of guessing. Pass the root once as
`--project-root <absolute-trusted-root>`. The helper deterministically finds
applicable `.codex/config.toml` files from that root through the current working
directory, validates their chain, applies them root-first so the closest layer
has highest precedence, and reports both every checked layer and the source of
each effective applicable value. Do not construct or order the layer list
yourself.

Pass `--context isolated-eval` when the session or runner establishes an
isolated evaluation home. In that context, pass only the isolated
`CODEX_HOME/config.toml`; a checkout's `.codex/config.toml` never substitutes
for or augments it. Establish V1, V2, or unknown from current host evidence and
pass `--backend`; do not infer V2 merely from the presence of `max_depth`.

For Claude Code, the helper reads only the two named environment controls from
the current process. Supply `--version` when the installed version is already
known; otherwise let the helper inspect `claude --version`. Its source is the
effective process environment, including values injected from settings by the
host. Do not read or display unrelated environment variables or settings.

If the user provides a configuration path but the path is missing, confirm
whether absence is what they want diagnosed. If no host or usable effective
source can be established, ask one compact question and stop without invoking
the helper.

## 2. Run one read-only diagnosis

Run exactly one applicable command:

```sh
uv run --quiet --frozen --no-dev --project "<absolute-plugin-backend>" \
  host-config-doctor codex \
  --config <absolute-effective-config> --backend <v1|v2|unknown> \
  --context effective [--project-root <absolute-trusted-project-root>]

uv run --quiet --frozen --no-dev --project "<absolute-plugin-backend>" \
  host-config-doctor codex \
  --config <absolute-isolated-config> --backend <v1|v2|unknown> \
  --context isolated-eval

uv run --quiet --frozen --no-dev --project "<absolute-plugin-backend>" \
  host-config-doctor claude \
  [--version <installed-version>]
```

On PowerShell, put the selected command on one line and omit the trailing
backslashes while passing the same arguments.

The helper reports only the named controls and derived capacity. Preserve an
unreadable or malformed refusal; do not fall back to a repository copy, parse
around it, or suggest that unknown capacity is adequate.

## 3. Explain the conclusion

Base the conclusion on this topology:

```text
primary -> owner -> verification coordinator -> review coordinator
                                              -> Standards reader
                                              -> Spec reader
```

The baseline owner-only path needs one spawned-agent slot and one layer below
the primary. The full required-assessment path needs five concurrently open
spawned-agent slots and four nesting layers. Codex concurrency excludes the
primary. Keep concurrency and nesting separate: on Codex V2,
`agents.max_depth` is V1-only and ignored, so it cannot compensate for too few
concurrent threads.

For Claude Code, report
`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` and
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` separately and honor the helper's
installed-version applicability. Do not claim an older version supports a
control merely because the variable is present.

Return the exact checked source, host/version/backend evidence, baseline and
full-path result, and the helper's actionable source-specific guidance. Copy
the helper's `configuration_sources_checked`, `configuration_sources_used`,
and `checkout_config_used` records verbatim so absolute paths and contribution
status are not lost in summary. Copy its `concurrency_control` and
`nesting_control` names verbatim into the user-visible result so a numeric
conclusion cannot hide which setting was evaluated. The
diagnosis is complete only when those facts are present, no configuration was
changed, no credentials or unrelated values were emitted, and no owner was
launched.

## Boundaries

- This capability is read-only and never edits configuration.
- Doctor intent does not activate `adaptive-delivery`, launch an owner, or run
  delivery preflight.
- An absent file, unset control, unknown default, backend, or version is not
  evidence of adequate capacity.
- Never print complete configuration files, settings objects, environment
  dumps, tokens, or credentials.
