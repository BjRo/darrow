# Fixture cleanup ownership

Sevro now owns regression coverage for removing permission-locked candidate
workspaces. Reconciling Darrow's remaining mixed fixture tests found that the
installed engine retained a completed workspace when a candidate directory had
mode `000`. The public command still retained its completed result and evidence.
The fix is committed in Sevro as `d9bb6c5`.

The public cleanup contract was documented before implementation. Three
successive CLI regressions reproduced locked children, a locked root, and a
readable but unwritable root. Each failed because the workspace remained, then
passed after its corresponding fix. Cleanup restores owner access to directories
inside the workspace when needed and skips symbolic links to external targets.
Evidence persistence and reserved-root bookkeeping retain their existing order.
The literal Red/Green commands and results are recorded in
`/Users/bjro/Sources/sevro/docs/fixture-cleanup-validation.md`.

## Installed package evidence

The candidate is an unpublished development archive, Sevro `0.1.0-dev.0`, built
from `d9bb6c5`:

- Archive: `/Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/package/sevro-0.1.0-dev.0.tgz`
- SHA-256: `4d99ac6d63d7e9cece1da452118f74fd618d0292d07e595a17eeddb9f0fa4cce`
- Runtime build digest: `ab69c1d8abf382cf6db927350924ed9098f32deaaad713c1b46d4704b3a45d70`

The archive installs in a separate consumer without source Git metadata. Three
independent public-command cases exercise child mode `000`, root mode `000`, and
root mode `500`. Each also contains a nested locked directory and a symbolic link
to an external read-only directory and file. All three retain matching completed
result/evidence, remove the observed workspace, and preserve the external modes
and file bytes. Inputs, commands, results, and archive identity are retained in
`/Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/installed-validation.json`.

```sh
bun run test:package-install --tarball /Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/package/sevro-0.1.0-dev.0.tgz
```

Sevro's exact-archive installation check passed. Its final source gate passed
243 tests and 1,399 assertions across 38 files in 93.83 seconds. Typecheck and
formatting passed. The suite includes concurrency, failed persistence, peer
isolation, cancellation, and extension lifecycle checks.

Darrow's focused installed fixture gate passed 14 tests and 160 assertions in
25.81 seconds:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/consumer/node_modules/.bin/sevro' bun test evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'fixture setup runs|plugin skill without|explicit Codex skill|Claude preparation passes|implicit and explicit repository|native Claude repository|additional plugins and selected skills|Claude guide composition|composition providers|ticket composition|Git hook fixtures|fixture binaries|local ticket|sibling skills for a competition'
```

The gate covers source binding, filtered skill resources, native package
preparation, repository skills, independent composition providers, Git hooks,
fixture binaries, and local tickets. Its log is retained at
`/Users/bjro/.darrow/issue95-fixture-cleanup/darrow-fixture-gate.log`.

## Darrow coverage retained

Only the redundant generic cleanup test is retired from
`evals/runner/fixture.test.ts`. Its ten mounting and ticket scaffolding tests
remain; they pass with 60 assertions in 1.021 seconds. Backend resource filtering
and exact ticket round trips still need reconciliation with public interfaces
before that mixed test file can be retired. No whole runner file moved in this
milestone; the inventory remains 75 TypeScript files.

Darrow's ESLint, typecheck, and formatting checks pass. Documentation validation
passes for 243 Markdown pages and 16 plugins.

These checks use real filesystem operations and synthetic host executables on
macOS with Bun `1.3.13`. They do not establish live model behavior, another
platform, or protection against concurrent link replacement. The full Darrow
domain and package integration suites were not repeated. The published release,
exact dependency pin, default cutover, generic runner removal, benchmark
decisions, and focused native acceptance remain pending.
