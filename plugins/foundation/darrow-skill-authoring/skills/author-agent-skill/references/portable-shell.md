# Portable shell mechanics

Read this reference when the target skill adds or changes a shell script or
shell test. Apply it to both the implementation and its deterministic tests.

## Paths and temporary directories

- Treat path spelling and filesystem identity separately. Normalize a path with
  `cd` and `pwd -P` before emitting it as an absolute path or comparing it with
  another canonical path.
- Do not construct an expected canonical path by concatenating raw environment
  variables. `TMPDIR` can be unset, empty, or spelled with or without a trailing
  separator.
- Give `mktemp` exactly one separator between the parent and template, then
  canonicalize the directory it returns:

  ```bash
  temp_parent=${TMPDIR:-/tmp}
  case "$temp_parent" in
    /) temp_template=/skill-name.XXXXXX ;;
    */) temp_template=${temp_parent}skill-name.XXXXXX ;;
    *) temp_template=${temp_parent}/skill-name.XXXXXX ;;
  esac
  work_dir=$(mktemp -d "$temp_template") || exit 1
  work_dir=$(cd "$work_dir" && pwd -P) || exit 1
  ```

- Quote path expansions. Avoid `readlink -f`, GNU-only `realpath` options, and
  assumptions that the caller starts in the skill directory.

## Portable mechanics

- Support both Bash 5 and `/bin/bash` 3.2. Avoid associative arrays,
  `${var,,}`, `${var^^}`, and other features newer than Bash 3.2.
- Use baseline Unix utilities and portable options. Account for old BSD `awk`,
  `sed`, `grep`, and `find` behavior instead of relying on GNU extensions.
- Under `set -o pipefail`, do not use an early-exit consumer in a pipeline when
  the producer may receive `SIGPIPE`. Capture bounded output or use a
  here-string when that is safer.
- Refuse unreadable required inputs and make failure output identify the input
  that could not be processed.

## Interpreter evidence

Run every target shell test through the authoring skill's bundled matrix helper:

```text
uv run --quiet --frozen --no-dev --project "<skill-dir>/backend" verify-shell-tests -- "<test-script>"...
```

The helper discovers actual Bash 3.2 and Bash 5 interpreters, queries their
versions, deduplicates equivalent candidates, and labels results from observed
version data. Pass one or more `--shell <executable>` options before `--` only
when repository evidence supplies additional interpreter paths. Never infer a
version from an executable name, install a missing shell, or count two command
names resolving to the same version as two compatibility results.

In Bash test scripts, invoke nested implementation helpers with `"$BASH"`
instead of literal `bash` or a hard-coded `/bin/bash`. This preserves the
interpreter executing the test even when `PATH` resolves another Bash. Exercise
that boundary with a conflicting `bash` on `PATH`; expected-failure assertions
must not hide calls through the wrong interpreter.

Interpret its final `matrix_status` and exit status together:

- `complete` / exit `0`: both required versions were observed and all tests
  passed;
- `failed` / exit `1`: at least one observed interpreter failed a test;
- exit `2`: invocation or input evidence was invalid; and
- `unverified` / exit `3`: at least one required version was unavailable.

Exit `3` is evidence of incomplete coverage, not a successful two-version
matrix. Continue the remaining non-dependent checks, preserve the helper's
interpreter paths and versions in the final report, and name each unavailable
required version explicitly.

## Tests

- Require support for Bash 5 and `/bin/bash` 3.2, but claim a live result only
  for versions observed by the matrix helper.
- When code uses `TMPDIR` or compares paths, run it with `TMPDIR` both with and
  without a trailing separator. Compare canonical paths, not the raw strings
  used to construct them.
- Run at least one test from outside the skill directory when the script opens
  repository or caller-provided paths.
- Assert stable public output and exit status. Do not make a test pass only
  because implementation and expectation repeat the same path-construction
  mistake.
