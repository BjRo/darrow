# Plugin backend mounting

Implicit Codex preparation now retains the owning plugin's contained backend
under `.agents/backend`, alongside its project-discovered skills. The public
preparation response previously contained the skill files but omitted that
backend, unlike the legacy project mount. The documented contract was updated
before implementation; the public protocol and command seams are unchanged.

The extension reuses its existing contained plugin-file collector. Backend files
retain their bytes, digests, executable permission, and Git exclusion, and share
the skill artifact limits. Nested `evals/` directories and generated caches stay
excluded. Unsafe links are refused. Project preparation does not install plugin
hooks or agents into project settings. Native Claude and explicit Codex packages
retain their independent provider layout.

## Public regression trace

The regression uses the public extension `resolve` and `prepare` requests. Its
expected `.agents/backend/pyproject.toml` resource comes from the legacy fixture
example and the preserved project layout, rather than a private engine helper.

Red — `bun test evals/domain/fixture-mounting.test.ts --test-name-pattern 'public project preparation'`:
exit `1`; the expected backend resource was undefined. One test failed with one
assertion in 176 milliseconds, while product code was unchanged.

Green — `bun test evals/domain/fixture-mounting.test.ts --test-name-pattern 'public project preparation'`:
exit `0`; one test and six assertions passed in 179 milliseconds after the fix.

The initial implementation exceeded the extension's function size and complexity
lint limits. Extracting the project artifact assembly into a small helper kept
the existing collector and limits. The identical regression command then passed
again with six assertions in 178 milliseconds. This refactor required no protocol
or runtime change in Sevro.

## Preserved fixture coverage

`evals/domain/fixture-mounting.test.ts` preserves the three legacy backend
examples for project, native Claude, and explicit Codex preparation. They check
backend bytes and digests, Git exclusion, hidden evals and virtual environments,
and native-only hook packaging through public protocol requests.
An additional installed-command example checks the actual implicit Codex
workspace and clean Git status with a synthetic host. A public counterexample
refuses an external link in the implicit backend. Those additional assurance
checks do not claim separate TDD Red observations or live model behavior.

Only the three duplicate backend examples are removed from
`evals/runner/fixture.test.ts`; its six remaining mounting examples pass with
35 assertions in 688 milliseconds. The runner still contains 75 TypeScript
files. `evals/domain/` contains 22 test files; nineteen whole test files have moved
out, and ticket/backend examples have been extracted from this mixed fixture
file. The remaining mounting and composition policy needs reconciliation before
that file can be retired.

## Installed candidate

The candidate is the unpublished Sevro `0.1.0-dev.0` development archive from
`d9bb6c5`, SHA-256
`4d99ac6d63d7e9cece1da452118f74fd618d0292d07e595a17eeddb9f0fa4cce`.
It contains no source Git metadata. Validation records are retained under
`/Users/bjro/.darrow/issue95-backend-mount/`.

The full installed Darrow gate uses this exact archive:

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL='/Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/package/sevro-0.1.0-dev.0.tgz' bun run test:eval-runner-sevro-package
```

All 503 tests and 4,528 assertions across 34 files passed in 878.87 seconds.
The gate installed the exact archive in a separate consumer, checked the absence
of package Git metadata, cleared the checkout override, and ran all public parity
and domain tests. All five backend examples are present in the retained log at
`/Users/bjro/.darrow/issue95-backend-mount/installed-full-gate.log`.

The focused backend gate passed five tests and 24 assertions in 2.68 seconds.
ESLint, typecheck, and formatting pass after the helper extraction. Documentation
validation passes for 245 Markdown pages and 16 plugins. These checks ran on
macOS with Bun `1.3.13`; no additional platform or remote CI run is claimed.

The published pin, default cutover, generic runner removal, remaining benchmark
decisions, and focused native acceptance are still pending. Synthetic host
executables and protocol declarations do not prove live native behavior.
