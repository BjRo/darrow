---
name: context-usage
description: Show the current Codex context-usage breakdown for a person or an agent checking itself before starting a large multi-step phase, before pulling in large outputs, or before deciding whether to delegate. Use for plain-language context-usage requests or explicit invocation. Exclude repository guidance setup and doctor requests.
---

# Inspect context usage

Report a read-only snapshot of this thread. Report facts only; never recommend
compacting or handing off. Checks happen at decision points, not on a fixed
schedule.

## 1. Select the host and audience

On Claude Code, point to its native `/context` command and stop. Do not run the
backend or parse Claude transcripts.

On Codex, use `grid` for a person asking to see usage and `json` for an agent
checking itself as part of ongoing work. Require `CODEX_THREAD_ID`; an unknown
thread never authorizes selecting another session.

**Complete when:** the host and audience determine either the Claude redirect
or one Codex output format.

## 2. Capture the snapshot

Set `<skill-dir>` to the absolute directory containing this `SKILL.md`, ending
in `/context-usage`. Resolve `<skill-dir>/../../backend` once to its absolute
path as `<backend>`; it is the plugin's backend, beside `skills`, not a directory
inside this skill. Run:

```sh
uv run --quiet --no-project "<backend>/scripts/run_locked.py" ia-context --format grid
```

For self-checks, replace `grid` with `json`. Preserve the configured
`CODEX_HOME` and UV cache settings. The command reads this thread's rollout and
`config.toml`; its locked runtime has no third-party dependencies and supports
Python 3.10–3.13 on Linux, macOS and native Windows.

If the launcher path is missing before the backend starts, correct that binding
from this file's actual path. Once `ia-context` starts and refuses, report its
diagnostic and stop. Do not retry another thread, change configuration, repair
history or start doctor.

**Complete when:** one current-thread result or the exact refusal is captured
without changing repository, configuration or session files.

## 3. Report the evidence

For a person, reproduce the returned grid and category table in the final
response, including its path, exact total, estimates, remainder, snapshot note
and warnings. Tool output alone is not the final report. For a self-check,
use the JSON as factual input to the ongoing task and briefly report the total,
window and material warnings; keep the returned JSON available as evidence.

The last token count is exact; categories use UTF-8 bytes divided by four,
rounded up. The remainder includes unlogged content and estimation differences.
Keep negative values and warnings. Before the first token count, only estimates
are available. A buffer appears only for an explicit root compaction limit in
`CODEX_HOME/config.toml`; profiles and project overrides are not resolved.

**Complete when:** the audience receives the observed facts and limitations.
