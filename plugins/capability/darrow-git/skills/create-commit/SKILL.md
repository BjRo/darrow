---
name: create-commit
description: Create exactly one new commit for the user's intended change, including a guarded retry after a commit-hook failure. Use when asked to commit current work, commit selected files, commit an existing staged set, or retry or remediate that failed commit. Do not use for hook maintenance without commit intent.
---

# Create a commit

Record one intended change as one new Conventional Commit.

Select the operation from the user's literal request before inspecting Git:

| Request | Action |
| --- | --- |
| `commit`, including “commit this; it belongs with the previous commit” or “commit this and keep history clean/compact” | Create one new commit through this workflow without asking whether to amend. The literal commit request takes precedence over the implied history preference. |
| literal `amend`, `rewrite`, or `rebase` request | Stop before any Git operation because history rewriting is outside this workflow. |

Run every Git operation for this task through the frozen UV entrypoint below;
`<skill-dir>` contains this file. It supports Linux, macOS, and Windows and owns
state inspection, staging, message validation,
hook execution, and the final commit; execute it without reading or
reimplementing it. Treat its refusals as authoritative.

The package lives at `<skill-dir>/../../backend` inside this plugin.

## Working model

- **Staged means selected:** an existing staged set is the complete commit set.
  Working-tree and untracked files remain outside it.
- **Unstaged means choose:** when nothing is staged, select only literal paths
  that belong to the user's described change.
- **Message split:** the subject says what changed; a body exists only to
  explain non-obvious motivation, a breaking change, or migration guidance.

Leave pushing, branching, and pull requests outside this workflow.

## Workflow

### 1. Establish the commit set

Run:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit inspect
```

Follow the reported mode:

- `conflict`: report the unmerged files and stop. A merge or rebase must be
  resolved before committing.
- `staged`: accept the staged files as the exact commit set. Do not reconsider
  that selection or add paths later. Preserve every file listed under `not
  included`.
- `unstaged`: match changed and untracked files to the user's stated intent.
  Inspect an uncertain candidate with:

  ```sh
  uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit diff <literal-path>...
  ```

  Keep unrelated paths untouched. If the user's description conflicts with
  the available changes, report the mismatch instead of guessing.
- `unstaged` with no changed or untracked files: report that there is nothing
  to commit and stop.

**Complete when:** the exact commit set is known, every excluded path remains
excluded, and the repository is neither conflicted nor clean.

### 2. Compose the message

Use `<type>(<scope>): <imperative summary>`; omit the scope when it adds no
useful precision. Match relevant recent subjects from inspection. Allowed
types are `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`,
`ci`, `style`, and `revert`.

Keep the subject at most 72 characters with no trailing period. Add a body only
for non-obvious motivation, a breaking change (`<type>!:` plus `BREAKING
CHANGE:`), or migration guidance; wrap it at 72 characters. Follow repository
instructions for trailers and never add tool attribution. Use emoji only when
recent repository convention establishes it.

**Complete when:** the subject identifies the commit's actual effect, satisfies
the format, and any body contributes necessary why rather than restating the
diff.

### 3. Create the commit

For `staged` mode, pass no paths:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit commit -m "<subject>" [-m "<body>"]
```

For `unstaged` mode, pass every selected literal path and no others:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit commit -m "<subject>" [-m "<body>"] <path>...
```

This `darrow-create-commit commit` call is the only commit-creation command in the
workflow. Use neither raw Git nor a history-rewriting option. Do not use sweep
paths such as `.` or globs. If the script rejects the input, correct only the
proposed selection or message and retry. If commit execution fails because of
a hook, inspect its diagnostic before stopping: continue with §3a or §3b only
when their exact conditions are met. If execution fails because of identity or
conflict, relay the error verbatim and stop; do not bypass the failure.

### 3a. Retry an explicit hook-failure correction

Only after a hook failure has been reported in the request or by this workflow,
and only when the user literally authorizes refreshing named corrected paths,
offer one guarded retry. The authorization must name every path; “try again” or
“include my fixes” does not authorize refreshing the index. Each named path
must already be part of the existing staged set. Never use this path for an
unstaged selection, an outside path, or a new file.

When a reported hook failure includes corrected worktree content but lacks that
literal path-by-path authorization, refuse the retry and make no Git mutation:
do not run `commit`, `retry`, `git add`, or any alternative staging/commit
command. Ask for the exact staged paths to refresh. A normal staged commit
would retain stale index content, so it is not an authorized substitute.

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit retry --after-hook-failure \
  --refresh-staged <literal-staged-path>... -m "<subject>" [-m "<body>"]
```

This refreshes only the explicitly authorized staged paths from the working
tree, preserves every other staged blob and all excluded work, then reruns the
ordinary commit validation and hooks. If it refuses or a hook fails again,
relay the output and stop. Do not use a raw staging command, a hook bypass, or
a broader retry.

### 3b. Remediate an unambiguous hook diagnosis

When the hook diagnostic states one concrete corrective command, interpret and
run it when its effect is unambiguous and limited to the failed intended
commit's explicitly named staged paths. The literal command must occur in the
failed diagnostic; do not infer a command from prose or combine alternatives.
Do not reject a hook-provided command merely because its tool is unfamiliar.
If the diagnostic is ambiguous, ask the user to identify the remediation and
stop without mutation.

A diagnostic line in the ordinary form `run: <command>` names that one
concrete command. When it names only the authorized staged path, use §3b with
the text after `run:` exactly; do not fall back to an ordinary retry, which
would retain the stale index content.

Pass the literal command and every path the user explicitly authorizes to the
guarded script:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-commit remediate --after-hook-failure \
  --command "<literal hook-directed command>" \
  --refresh-staged <literal-staged-path>... -m "<subject>" [-m "<body>"]
```

The script binds remediation to the saved failed-commit `HEAD` and index
snapshot. It refuses a changed `HEAD`; if remediation changes the index, it
restores that failed snapshot and stops. Only after those checks does it invoke
the guarded staged retry, which refreshes the authorized paths and reruns the
ordinary hook. Never execute a diagnostic command directly in the shell.

**Complete when:** the script prints `<hash> <subject>` for one newly added
commit, or its execution failure has been reported without changing existing
history or bypassing safeguards. A guarded retry is complete only when it
preserves the original staged set except for the literally authorized paths.

### 4. Report the result

Report the emitted `<hash> <subject>`. Also name any dirty files that inspection
listed as not included. Do not claim that excluded work was committed.

**Complete when:** the user can identify the new commit and distinguish its
contents from every remaining local change.
