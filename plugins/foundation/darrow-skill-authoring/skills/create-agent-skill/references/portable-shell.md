# Portable shell mechanics

Read this when the target skill adds or changes a shell script or shell test.
It applies to the implementation and its tests.

## Paths and temporary directories

- Canonicalize a path with `cd` and `pwd -P` before printing it as absolute or
  comparing it with another canonical path.
- Never build an expected path by concatenating raw environment variables.
  `TMPDIR` can be unset, empty, or end with or without a separator.
- Give `mktemp` exactly one separator, then canonicalize the result:

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
  assuming the caller starts in the skill directory.

## Portability

- Support the shells, versions, operating systems, and utilities the target
  repository declares; do not import this repository's range.
- For Bash 3.2, avoid associative arrays, `${var,,}`, `${var^^}`, and other
  newer features. For macOS or BSD utilities, avoid GNU-only options.
- Under `set -o pipefail`, do not pipe into an early-exit consumer when the
  producer can get `SIGPIPE`; capture bounded output or use a here-string.
- Refuse unreadable required inputs and name the input in the failure.

## Interpreter evidence

Run shell tests with each interpreter version the target claims, using its
established test command when one exists. For a Bash 3.2 and Bash 5 target,
use the bundled matrix helper:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" verify-shell-tests -- "<test-script>"...
```

It finds real Bash 3.2 and Bash 5 interpreters, reads their versions,
deduplicates equivalent ones, and labels results by observed version. Pass
`--shell <executable>` before `--` only for interpreter paths the repository
supplies. Never infer a version from a command name, install a missing shell,
or count two names for the same version as two results.

In Bash tests, call nested helpers with `"$BASH"`, not `bash` or `/bin/bash`,
so the test keeps its interpreter. Test this with a conflicting `bash` on
`PATH`.

Read the matrix's final `matrix_status` with its exit status:

- `complete` / exit `0`: both versions were observed and all tests passed;
- `failed` / exit `1`: an observed interpreter failed a test;
- exit `2`: invocation or input was invalid; and
- `unverified` / exit `3`: a required version was unavailable.

Exit `3` means incomplete coverage, not success. Continue the other checks,
report the observed interpreter paths and versions, and name each missing
version.

## Tests

- Claim results only for versions actually observed.
- When code uses `TMPDIR` or compares paths, test with `TMPDIR` both with and
  without a trailing separator, and compare canonical paths.
- Run at least one test from outside the skill directory when the script
  opens repository or caller paths.
- Assert stable output and exit status. A test must not pass only because the
  implementation and the expectation build the same wrong path.
