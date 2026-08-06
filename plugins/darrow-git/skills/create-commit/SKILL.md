---
name: create-commit
description: Create exactly one new commit for the user's intended change. Use when asked to commit current work, commit selected files, or commit an existing staged set.
---

# Create a commit

Record one intended change as one new Conventional Commit.

Run every Git operation for this task through
`<skill-dir>/scripts/commit.sh`, where `<skill-dir>` contains this file. Run
the script with Bash. It owns state inspection, staging, message validation,
hook execution, and the final commit; execute it without reading or
reimplementing it. Treat its refusals as authoritative.

## Working model

- **Staged means selected:** an existing staged set is the complete commit set.
  Working-tree and untracked files remain outside it.
- **Unstaged means choose:** when nothing is staged, select only literal paths
  that belong to the user's described change.
- **New means additive:** this capability always creates a new commit. Saying
  that a change belongs with the previous commit or asking for clean or compact
  history does not authorize amendment. Only a literal request to `amend`,
  `rewrite`, or `rebase` selects a different operation, which falls outside
  this workflow. Leave pushing, branching, and pull requests outside it too.
- **Message split:** the subject says what changed; a body exists only to
  explain non-obvious motivation, a breaking change, or migration guidance.

## Workflow

### 1. Establish the commit set

Run:

```sh
bash <skill-dir>/scripts/commit.sh inspect
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
  bash <skill-dir>/scripts/commit.sh diff <literal-path>...
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
bash <skill-dir>/scripts/commit.sh commit -m "<subject>" [-m "<body>"]
```

For `unstaged` mode, pass every selected literal path and no others:

```sh
bash <skill-dir>/scripts/commit.sh commit -m "<subject>" [-m "<body>"] <path>...
```

This `commit.sh commit` call is the only commit-creation command in the
workflow. Use neither raw Git nor a history-rewriting option. Do not use sweep
paths such as `.` or globs. If the script rejects the input, correct only the
proposed selection or message and retry. If commit execution fails because of
a hook, identity, or conflict, relay the error verbatim and stop; do not bypass
the failure.

**Complete when:** the script prints `<hash> <subject>` for one newly added
commit, or its execution failure has been reported without changing existing
history or bypassing safeguards.

### 4. Report the result

Report the emitted `<hash> <subject>`. Also name any dirty files that inspection
listed as not included. Do not claim that excluded work was committed.

**Complete when:** the user can identify the new commit and distinguish its
contents from every remaining local change.
