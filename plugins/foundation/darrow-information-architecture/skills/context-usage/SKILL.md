---
name: context-usage
description: Show how the current Codex thread's context window is used, by category. Use when someone asks how full or how split up the context is, on explicit invocation, or when an agent checks its own context before a large multi-step phase, a large output, or a delegation decision. Not for repository guidance setup or doctor requests.
---

# Context usage

Report a read-only snapshot of this Codex thread. State facts only; never
recommend compacting or handing off.

On Claude Code, point to the built-in `/context` command and stop.

## Run

Set `<backend>` to the absolute path of `../../backend` from this file's
directory (the plugin's `backend`, beside `skills`). Run:

```sh
uv run --quiet --no-project "<backend>/scripts/run_locked.py" ia-context --format grid
```

Use `--format json` instead when you check your own context during other work.

If the command refuses, report its error and stop. Never read another session
or change any configuration.

## Report

- **For a person:** the user cannot see command output. Copy the grid and
  category table into your reply as returned, including the rollout path and
  any warnings.
- **For a self-check:** state the used total, the window and any warnings, then
  continue the task.

The used total is exact: Codex's last token count. Categories are estimates
(UTF-8 bytes / 4). The remainder holds unlogged content, such as tool
definitions, plus estimation error, and it can be negative. Early in a new
thread, Codex may not have recorded a token count yet; then only the estimates
exist, and you should say so.
