# Darrow evaluation tooling

Darrow uses the exact `@bjoernrochel/sevro` dependency from `package.json`.
Install it with `bun install --frozen-lockfile`.

## Test ownership

| Group          | Owns                                                                         | Command                         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| `integration/` | Darrow's connection to the installed public CLI and extension protocol       | `bun run test:eval-integration` |
| `domain/`      | Darrow case translation, caller behavior, fixture oracles and grading policy | `bun run test:eval-policy`      |
| `history/`     | Interpretation of archived Darrow results and review proofs                  | `bun run test:eval-history`     |

`bun run test:evals` runs all three groups. The integration gate uses controlled
adapters or native executables; it makes no live model or reliability claim.
Policy tests may invoke the public CLI when repository behavior spans that
boundary. Historical-reader tests also prove operation without Sevro installed.

Sevro owns scheduling, isolation, host observation and continuation, built-in
graders, cancellation, and evidence persistence. Its repository tests those
mechanics. Darrow retains request translation and response handling, rather than
duplicating the engine matrix or comparing with the retired runner.

The commands under `runner/` preserve Darrow's evaluation entrypoints. The
extension and its policy live under [sevro-extension/](sevro-extension/README.md).
Read [eval development](../docs/eval-development.md) before changing or running
cases.
