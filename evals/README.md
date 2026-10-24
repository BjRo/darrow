# Darrow evaluation tooling

Darrow uses the exact `@bjoernrochel/sevro@1.0.0` dependency from `package.json`.
Install it with `bun install --frozen-lockfile`.

## Test ownership

| Group          | Owns                                                                         | Command                         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| `integration/` | Darrow's connection to the installed public CLI and extension protocol       | `bun run test:eval-integration` |
| `domain/`      | Darrow case translation, caller behavior, fixture oracles and grading policy | `bun run test:eval-policy`      |

`bun run test:evals` runs both groups. The integration gate uses controlled
adapters or native executables; it makes no live model or reliability claim.
Policy tests may invoke the public CLI when repository behavior spans that
boundary. Pre-Sevro result readers and their tests have been removed; retained
research keeps its original evidence and provenance.

Sevro owns scheduling, isolation, host observation and continuation, built-in
graders, cancellation, and evidence persistence. Its repository tests those
mechanics. Darrow retains request translation and response handling, rather than
duplicating the engine matrix or comparing with the retired runner.

Group domain tests by their current contract, rather than a Sevro release.
Use planning tests for selector and route permutations, with representative
public-CLI checks for actual execution and retained evidence. Backend validation
matrices belong to their owning packages; domain fixtures exercise the real
provider connection. Keep regression triggers such as an initially empty UV
cache, and cover unchanged-proof and stale-proof behavior in one dedicated
integration case rather than repeating that sequence for every valid report.

The commands under `runner/` preserve Darrow's evaluation entrypoints. The
extension and its policy live under [sevro-extension/](sevro-extension/README.md).
Read [eval development](../docs/eval-development.md) before changing or running
cases.
