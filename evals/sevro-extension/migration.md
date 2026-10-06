# Sevro development, updates and rollback

Darrow pins the exact published `@bjoernrochel/sevro` version in
[package.json](../../package.json) and `bun.lock`. Normal direct, guide and
benchmark callers use that installation. Run `bun install --frozen-lockfile`
before using them. No source checkout or Git metadata is required.

Sevro owns package releases, generic execution and host mechanics. Darrow owns
the extension, cases, policy, exact dependency pin and integration checks.
The boundary is recorded in
[ADR-0010](../../docs/decisions/ADR-0010-extract-the-evaluation-runner-into-sevro.md)
and [ADR-0011](../../docs/decisions/ADR-0011-negotiate-evaluation-extensions-across-the-runner-boundary.md).
Historical command changes and extraction observations are in the
[research record](../../docs/research/sevro-extraction.md).
Current caller behavior is in [README.md](README.md).

## Local and coordinated development

Select exactly one explicit absolute runner override:

| Variable                | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `SEVRO_CHECKOUT`        | Run a Sevro source checkout with its revision and dirty-patch identity |
| `SEVRO_PACKAGE_BIN`     | Run an installed executable with package/build provenance              |
| `SEVRO_PACKAGE_TARBALL` | Install an archive in a temporary consumer for the package gate        |

The tarball variable selects a verification input, not a candidate host.
With no runner override, Darrow validates its exact installed pin. Empty,
relative or conflicting overrides fail without fallback. There is no implicit
checkout discovery. Darrow project identity remains separate from runner identity.
Public schemas continue to come from Darrow's pinned package.

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun run test:eval-integration
SEVRO_PACKAGE_BIN=/absolute/path/to/sevro bun run test:eval-integration
SEVRO_PACKAGE_TARBALL=/absolute/path/to/bjoernrochel-sevro-version.tgz bun run test:eval-package
```

The package gate installs the archive without source Git metadata and runs the
integration, policy and historical-reader groups. It clears the checkout
override. Default-caller checks also clear both overrides and verify Darrow's
own frozen pin.

## Verification responsibilities

| Group                | Check                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Sevro package        | Sevro tests, typecheck, formatting and package-install gate                    |
| Darrow integration   | `bun run test:eval-integration` against the installed public boundary          |
| Darrow policy        | `bun run test:eval-policy` for translation, caller behavior and domain oracles |
| Historical readers   | `bun run test:eval-history`, including operation without Sevro                 |
| Complete Darrow gate | `bun run test:evals` with runner overrides cleared                             |
| Native behavior      | One understood trial at a time on the relevant host                            |

Generic scheduling, isolation, built-in grading, host continuation, cancellation
and persistence coverage lives in Sevro. Darrow does not repeat that engine
matrix. Test timeouts allow frozen backend startup; explicit per-test deadlines
still apply. Deterministic fixtures make no live model claim.

CI uses [.github/workflows/sevro-integration.yml](../../.github/workflows/sevro-integration.yml).
The automatic job installs the frozen pin and runs the complete Darrow gate on
macOS with Node 24, Bun 1.3.13, UV and the pinned Codex sandbox prerequisite.
It retains installed-package and lock identity plus verification logs.
The manual job downloads an exact published version, checks its reviewed SHA-256
and runs the archive gate. It publishes nothing and runs no live models.

Native isolation checks require the relevant host sandbox. Unsupported or
skipped platform combinations are not verified. Extend the matrix and retain
evidence before claiming another host/platform combination.

## Update the pin

1. Prepare and verify a versioned Sevro candidate using its repository's release
   instructions. Retain the archive, package inventory, checksum and build identity.
2. Run Darrow's archive gate against that exact tarball. Test the affected
   Darrow policies and native host behavior; inspect any failed checks before
   continuing. Record intentional protocol or command changes separately.
3. Publish the reviewed package through Sevro's authorized release process.
4. Update Darrow's exact dependency and frozen lockfile. Refresh expected
   package identities in the default-caller tests. Run
   `bun install --frozen-lockfile` and `bun run test:evals` without overrides.
5. Retain the runner version/build, Darrow revision/patch identity, extension
   digest, negotiated protocol, configuration, requested/actual conditions,
   host routes and result paths with the update.

Darrow imports public result schemas from the installed package. Updating the
pin updates those schemas; there are no local engine-schema copies to refresh.
Existing extension protocol and comparison-eligibility requirements still apply.

## Roll back

Restore the last verified exact dependency and lockfile through a new commit,
restore the corresponding default-caller expectations, and reinstall frozen
dependencies. Run the complete Darrow gate and affected native checks.
Preserve failed-version evidence and identify its original evaluator settings;
never relabel it as evidence from the restored release.

## Practical limits

Bundled hosts currently reject enforced execution. Choose a named passive suite
mode explicitly for native comparisons; passive trials keep ordinary fixture
and credential isolation. Dry preparation remains unassessed.

Current native evidence cannot prove retired private profile/workflow/risk or
deprecated ticket-pipeline phase assertions. Task outcomes and independently
observed routes remain supported. Neither the extension nor migration tooling
actively corrects a benchmark run.

A passing deterministic gate or a single live trial does not establish host
reliability. Historical evidence keeps its original routes and interpretation.
