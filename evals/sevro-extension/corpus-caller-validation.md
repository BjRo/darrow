# Corpus caller validation

## Scope

The direct command accepts `--corpus-manifest` relative to its invocation directory.
The Sevro migration entrypoint accepts an absolute path before `--`. Default
corpus discovery still resolves under the evaluated project.

Explicit manifest validation precedes execution. Prepared repositories retain
the existing revision, license-file, and clean-checkout requirements. Each corpus
run retains `darrow-corpus-source-v1` evidence with the manifest path and SHA-256
and the resolved source's repository, revision, license, date, and provenance.
Repeated attempts keep the same source identity; changed metadata changes it.
Provenance filenames bind their content digest. Reusing a results root preserves
prior snapshots; an existing snapshot with changed bytes is refused.

Sevro owns source isolation. Mapped sources contribute their actual paths to
bundled candidate and grader protection, including primary and linked Git
worktrees outside the declared cache. The engine also protects the selected
repository during isolated shell grading. Darrow supplies source declarations
and protects the manifest directory.

## Observed test-first changes

### Direct corpus selection

The public command test initially failed with exit `64` because
`--corpus-manifest` was unknown. After adding the option and source declaration,
the identical command passed: one test, 13 assertions.

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-model-routes/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-corpus-caller.test.ts --test-name-pattern 'direct caller binds a separately located custom corpus manifest'
```

The identity test was already green when introduced. It is compatibility
evidence and is not claimed as a Red/Green slice.

### Source worktree isolation

The installed-package corpus preparation test exposed a readable primary
worktree outside the cache. Fixture overlay, scaffolding, setup, and the other
private-input checks passed; the primary-worktree check failed.

Sevro's public CLI regression then checked a mapped repository, its primary
checkout, and a sibling worktree. The native test uses the installed Codex
sandbox with each bundled role's generated permission profile and synthetic
host responses. With the source protection absent it returned execution failure
before a completed candidate; after the repair the identical command passed:
one test, seven assertions.

```sh
bun test tests/cli.test.ts --test-name-pattern 'CLI isolates mapped repository worktrees for native execution'
```

The first native test probe ran outside the generated sandbox. That probe was
corrected before the native regression's observed Red and is not claimed as
valid test-first evidence. The shell and native regression pair passes with
13 assertions and leaves all source README files unchanged.

### Retained provenance

An exact-case test reused one results root with changed corpus provenance.
Both dry invocations initially succeeded, but the second replaced the first
provenance file. After assigning content-digest filenames and refusing changed
existing files, the identical command passed with both snapshots retained.
The test's initial missing shell-isolation flag was corrected before this Red.

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-corpus-caller.test.ts --test-name-pattern 'reusing a results root preserves prior corpus provenance'
```

## Validation gates

Sevro commit `ed60be6` passed 240 standalone tests (1,375 assertions),
typecheck, formatting, and installation without source Git metadata.

The unpublished `0.1.0-dev.0` tarball is:

```text
/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/package/sevro-0.1.0-dev.0.tgz
SHA-256: 480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65
```

### Installed package parity

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/package/sevro-0.1.0-dev.0.tgz bun run test:eval-runner-sevro-package
```

PASS: 255 tests, 3,089 assertions. This installs the tarball into a separate
consumer without Git metadata and runs all public parity tests. It includes
the default corpus fixture and the existing direct, selection, guide, suite,
historical, and concurrency gates.

The full gate preceded the final extraction of the retained-provenance writer
into a local helper for lint compliance. The changed helper then passed the
following focused final gate against the same installed package.

### Final corpus gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-corpus-caller.test.ts
```

PASS: 11 tests, 118 assertions. This covers explicit manifest selection,
attempt-stable identity, changed metadata, repeated results-root reuse,
overlay/setup/source-worktree isolation, invalid manifests, and pinned-source
refusals.

### Repository checks

`bun run typecheck` and ESLint for the five changed TypeScript files pass.
Formatting for all ten milestone paths and `bun run check:docs` pass.
Documentation checks cover 224 Markdown pages and 16 plugins.

`bun run eval:sevro:compatibility --allow-unsupported` reports 377/377 cases
resolve. This is case translation coverage, not evidence of live execution.

## Limits

These are local package, fixture, and native-sandbox checks with synthetic host
responses. They do not establish live host stability, a published release,
default cutover, or completion of issue #95. Non-macOS runs do not exercise the
macOS sandbox checks. Private goal assertions remain a migration gap.
The separate [manual-review validation](manual-review-validation.md) covers
supplied review-minute annotations.
