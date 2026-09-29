# Public mounting fixture validation

The mixed `evals/runner/fixture.test.ts` is retired. Its Darrow policy now uses
public preparation requests and installed CLI results under `evals/domain/`.
Generic workspace allocation and cleanup belong to Sevro.

## Reconciliation

| Legacy example                                                  | Current coverage or deliberate migration                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hide reserved skill roots from setup snapshots                  | The installed setup example preserves exact snapshot bytes and excludes mounted artifacts. Unrelated `.agents/setup/state` remains visible, following the current exact-path exclusion contract. Blanket directory exclusion is retired. |
| Mount a Claude source plugin without a project copy             | Public Claude preparation retains both manifests, skill-local backend, agents, and hooks in declared native artifacts. Evals and caches stay absent.                                                                                     |
| Build a filtered Codex marketplace                              | The corresponding public Codex preparation checks package resources, filtering, Git exclusion, and marketplace declarations.                                                                                                             |
| Mount all sibling skills without evals                          | Public preparation checks both selected-only and all-sibling modes, with exact skill membership and no colocated eval files.                                                                                                             |
| Merge composition skills into a selected source plugin identity | The unsupported `source_plugin` field stays rejected in `prompt-policy.test.ts`. Each actual packaged manifest supplies its own namespace. The legacy merged identity is retired.                                                        |
| Install composition plugins separately                          | Public preparation on both hosts checks separate owner/provider skills, manifests, backend and bin resources, marketplace entries, and host declarations.                                                                                |
| Canonical workspace assertion embedded in the Claude example    | Sevro's public CLI regression checks the host's workspace against the OS canonical path. The allocation bug exposed by migration is fixed in Sevro `b7e01f8`.                                                                            |

The expanded mounting file has twelve examples: the previous five backend and
unsafe-link examples plus seven setup, native-resource, sibling, and composition
examples. These use controlled source packages and public interfaces; they import
no legacy runner implementation or private engine types. Native package paths
migrate from private `.git/eval-*` locations to declared
`.sevro-marketplace/` artifacts. Existing installed host integration tests cover
the consumer of those declarations.

This expands an existing domain file rather than relocating another whole file.
The inventory now has 74 runner TypeScript files, including 45 engine and host
files. There are 22 domain test files and nineteen whole-file relocations.
No mixed fixture test remains. The legacy fixture implementation remains for the
current default route until the published release is pinned.

## Canonical workspace regression

A preliminary diagnostic added a canonical-path assertion to the three cleanup
examples and exposed the macOS logical `/var/` alias. Those mixed diagnostic
assertions were removed before implementation; their failures are not the
recorded test-first Red.

The host workspace contract was documented before the fix. The isolated
regression invokes the public CLI with a controlled host, which returns its
workspace and `realpath(workspace)` as bounded observations. It imports no engine
implementation. The literal command for both recorded runs was:

```sh
bun test tests/cli.test.ts --test-name-pattern 'CLI supplies a canonical candidate workspace'
```

Red exited 1: one failed test and four assertions, with `/var/` received and
`/private/var/` expected. Green exited 0: one passed test and four assertions.
The engine resolves each candidate or semantic workspace allocation before
passing it to fixture creation and host execution. Reserved, retained, and
cleanup paths remain consistent.

After the fix, Sevro's `bun test` passed 244 tests with 1,403 assertions across
38 files in 94.77 seconds. `bun run typecheck` and `bun run format:check` passed.
See Sevro's `docs/fixture-cleanup-validation.md` for the source trace.

## Fresh installed archive

The candidate is an **unpublished development archive**, not a release pin:

- Sevro source revision: `b7e01f8`.
- Version: `0.1.0-dev.0`.
- Archive: `/Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/package/sevro-0.1.0-dev.0.tgz`.
- SHA-256: `c8bf5a903f4d55766c158eb8facd22fdc4f6b0343a9d5a910328506fc87a6330`.
- Runtime build digest: `9c4d100cd6f1ffbb3d3372021d39efd4f34ad0d936ef382304ee5b830731c93a`.
- Independent consumer: `/Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/consumer/`.

The consumer contains no source Git metadata. Three installed public CLI probes
cover a locked child, an unreadable workspace root, and a read-only workspace
root. All receive canonical workspace paths, complete execution and grading,
retain passing persisted results, remove the workspaces, and leave external
symlink targets' permissions and contents unchanged. Evidence is retained in
`/Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/installed-validation.json`.

This exact archive also passed:

```sh
bun run test:package-install --tarball /Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/package/sevro-0.1.0-dev.0.tgz
```

## Darrow gate

The initial draft's shell matcher incorrectly expected a final newline.
Sevro's public shell matcher removes one final newline; its output matcher
preserves final-message bytes. The test now checks exact setup-file bytes with
`cmp` and uses the documented shell expectation. This was fixture maintenance,
not a product Red.

Before packing the fixed engine, the twelve mounting examples and five prompt
policy examples passed against the older `d9bb6c5` installed archive: 17 tests
and 121 assertions in 13.48 seconds. That run does not prove the canonical fix.
The fresh full installed run used this literal command:

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL='/Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/package/sevro-0.1.0-dev.0.tgz' bun run test:eval-runner-sevro-package
```

It exited 1 after 1,045.07 seconds: 509 passing tests, one failed test, one
timeout error, and 4,561 assertions across 34 files. All twelve mounting
examples passed. The sole failure was
`suite preserves dry and adaptive-delivery record exceptions`, which exceeded
Bun's default 5,000 ms deadline while running a dry cell and two synthetic cells.
Its expectations are unchanged; it now has a bounded 20,000 ms test deadline.
The corrected suite file passed all 43 tests with 650 assertions in 195.01
seconds, using the same installed archive:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-fixture-mounting/b7e01f8/consumer/node_modules/.bin/sevro' bun test evals/runner/parity/sevro-suite.test.ts
```

The previously timed-out three-cell example passed in 6.17 seconds. The follow-up
log is `/Users/bjro/.darrow/issue95-fixture-mounting/installed-suite-deadline-gate.log`,
with SHA-256 `f4adcabbfcb35fa991bcb4c9b940c4e42f85b87c36b414ec14f39bc85516deae`.
Lint, typecheck, formatting, and the documentation check passed; the latter
checked 246 Markdown pages and 16 plugins. The original
full command remains failed; a follow-up does not relabel that evidence.

The full log is retained at
`/Users/bjro/.darrow/issue95-fixture-mounting/installed-full-gate.log`, with
SHA-256 `9c5b9fee9893ae4936481190c5cc81784d90219bcd7df9f9cb2ba0c42cd0aaf9`.

## Limits and remaining issue work

These checks ran on macOS with Bun and controlled synthetic hosts. They establish
public policy and package integration; they do not establish new live Claude or
Codex behavior, other-platform coverage, or remote CI success.

The user selected Darrow's BUSL-1.1 terms and task/native-owner-route benchmark
comparisons, with retired private assertions documented. Those changes remain
separate implementation milestones. Publication and the exact release pin,
default-route cutover, remaining generic implementation removal, enforced-condition
migration, installed CI, and focused native acceptance remain unfinished.
A saved Claude login is now available; the focused guide retry is separate from
these synthetic mounting checks.
