# Frozen installed CI

`Installed Sevro integration` now runs its `installed-pin` job on pull requests,
pushes, and manual dispatch. It installs Darrow's frozen exact development
dependency, verifies the installed public package name/version and absence of
package Git metadata, and runs the public integration and domain gate with both
runner overrides cleared. No Sevro source checkout is obtained.

The retained `installed-pin.json` records the observed package identity, lock
digest, Darrow revision, workflow run, and actual Node, Bun, Codex, and UV
versions. The test log and identity are retained for 30 days, including failed
runs. The command uses explicit Bash `pipefail`, so `tee` cannot hide a failed
gate. Candidate archive verification remains a separate manual-only job; its
exact version and reviewed SHA-256 remain required.

## Declared compatibility matrix

| Project | Gate                                                             | Platform and tools                                    | Boundary                                                                                                                |
| ------- | ---------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sevro   | `Verify Sevro` on pull requests, all pushes, and manual dispatch | macOS, Node 24, Bun 1.3.13, Codex 0.156.1             | Frozen standalone installation, types, formatting, 15-second source-test deadline, and independent package installation |
| Sevro   | Manual tagged release verification                               | Same tools                                            | Verify and install the retained exact archive before optional publication                                               |
| Darrow  | Automatic `installed-pin`                                        | macOS, Node 24, Bun 1.3.13, Codex 0.156.1, UV 0.11.21 | Frozen published pin, public CLI/protocol, domain fixtures, historical readers, and default callers                     |
| Darrow  | Manual `installed-candidate`                                     | Same tools                                            | Download and verify an explicitly chosen archive, then run installed public integration                                 |

The Codex executable supplies the real sandbox wrapper around deterministic fake
host responses. UV supplies the actual contained Python plugin mechanics used
by domain fixtures. Neither dependency becomes a marketplace plugin runtime,
and these jobs do not authenticate or run live models. Missing native sandbox
or tool support does not establish coverage for a skipped boundary.

Sevro's previous push filter selected only `main`, while its public repository's
default branch is `feat/issue-95-sevro-extraction`. Commit `017d202` removes that
filter and adds the tested sandbox prerequisite to verification and release
verification. These CI files are excluded from the published package.

## Observed local mechanics

Parsing the workflow confirmed all three events and the manual candidate guard.
Executing its unchanged pin-identity step against Darrow's installed dependency
passed, followed by its typecheck. The local record retained:

- package `@bjoernrochel/sevro@0.1.0-rc.1`;
- lock SHA-256 `d848e5975710935614ddad12f4037492d12f8fbb5c0865fe605b9b057d4446cb`;
- Node `v24.13.0`, Bun `1.3.13`, Codex `0.156.1`, and UV `0.11.21`.

The local record uses an explicit local candidate identifier and makes no remote
workflow-run claim. Raw mechanics are retained under
`/Users/bjro/.darrow/issue95-frozen-ci/`. Formatting passed for the workflow
changes. The verified npm archive and exact Darrow pin remain those recorded in
[release validation](scoped-release-validation.md).

For final acceptance, run the same frozen installed command:

```sh
bun install --frozen-lockfile
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun run test:eval-runner-compatibility
```

Retain its candidate-bound outcome and one understood native guide trial after
the package switch. Local mechanics and deterministic host fixtures alone do
not establish that live behavior or remote CI success.
