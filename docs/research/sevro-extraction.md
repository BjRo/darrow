# Sevro extraction evidence

This is the historical record for [issue #95](https://github.com/BjRo/darrow/issues/95).
Current commands and development responsibilities live in the
[Darrow extension guide](../../evals/sevro-extension/README.md) and
[development and release guide](../../evals/sevro-extension/migration.md).

## Ownership and deliberate changes

Sevro owns generic execution, scheduling, fixtures, isolation, built-in grading,
host observations, cancellation, run ownership, persistence and reporting.
Darrow owns case layout and translation, skills and corpus inputs, activation,
route and review policy, benchmark conditions, caller behavior and historical
interpretation. Marketplace plugins gain no runner dependency.

Normal callers use Darrow's exact installed development dependency. A coordinated
checkout is an explicit override with its own revision and patch identity.
Public schemas now come from the installed package. The temporary comparison
against the old runner and the source-copy launcher are retired.

Historical result arrays, suite manifests, checkpoints and TSV review proofs
remain interpretable without Sevro installed. Archived rates do not establish
current evaluator equivalence. Missing, dry, partial, contradictory and
unavailable evidence remains unmeasured.

Private profile/workflow/risk and deprecated ticket-pipeline phase assertions
were deliberately retired. Current comparisons use task outcomes and independently
observed native routes. No phase instrumentation or active benchmark correction
was added. Passive and enforced conditions remain distinct; bundled hosts reject
unsupported enforced execution.

## Recorded milestones and limits

These are observations of the identified historical candidates, not a passing
claim for every later revision.

- Scoped rc.1 release: Sevro source `c24b919`, BUSL-1.1, 71 packaged files.
  Archive SHA-256:
  `5f0d9447e792f7454b4eb8ab069e43fef338919ab50753b9cfdd3569c90bc6b1`.
  The source gate passed 245 tests and 1,404 assertions with a 15-second timeout.
  The default five-second run had one timeout; no assertion was weakened.
- The corresponding installed Darrow run had 516 passes and three stale
  unscoped-package expectations among 519 tests. The complete affected benchmark
  file then passed six tests and 640 assertions against the unchanged archive.
  That targeted repair is not a second successful full-gate run.
- The default caller switch passed 40 tests and 418 assertions. Its three
  test-first slices cover direct, benchmark and guide callers using the exact
  installed package with runner overrides cleared.
- Main integration used Darrow main
  `763bd4b5887576866bdc9d9ccc34a680acb95c11`. All 393 cases resolved. The
  reviewed rc.2 archive passed 509 Darrow tests and 4,875 assertions.
  Archive SHA-256:
  `8387f3f09565d786c63acc84f292660a2a12559860b3fd108270ff929240372c`.
  This archive predates the later authentication repair.
- The early main-sync run had 482 passes, 39 failures and seven errors. It is
  diagnostic evidence, not a passing gate. Removed outer-owner assertions keep
  their original interpretation at Darrow commit
  `da67e82efa140342ca3e41367277f8b8fc0f56ab`.
- Sevro authentication repair `6387cca` restores environment and saved-file
  authentication before Keychain and keeps credentials inaccessible to candidate
  tools. Eleven focused tests and 66 assertions passed; independent review
  passed both axes.
- A controlled Claude 2.1.284 run with zero advertised tools and zero tool calls
  reproduced the startup query `npm root -g`. The original failed guide trial
  kept only the command basename, so its exact ancestry is unrecoverable.
  Darrow fixture repair `16a443f8` permits only that exact query against an
  empty fixture-owned directory. Other mocked calls still log and exit 73.
- The fresh 2026-10-06 guide-orientation trial completed execution and grading
  with exit 0: seven checks and activation passed. Candidate: Claude Sonnet 5.5,
  medium. Semantic grader: Codex GPT-6 Luna, medium. It used the Darrow
  `5110cb22` worktree plus the fixture patch and eight pending pin edits, with
  Sevro `6387cca`. One trial of one case does not establish corpus reliability.
  Prior authentication and guard failures remain unchanged.

The original release, caller and main-sync records below retain exact commands,
raw artifact paths, trials, routes, failed attempts and verification limitations.
Local workflow validation does not establish remote CI success, and synthetic
executables do not establish live host behavior.

## Cleanup of migration tooling

The permanent test groups are installed-package integration, Darrow policy and
historical readers. The candidate-only gate is folded into integration; a regular
domain test resolves all canonical cases. Generic engine assertions have been
removed in favor of option forwarding, request translation and policy checks.
The old migration command names are replaced by `test:eval-integration`,
`test:eval-policy`, `test:eval-history`, `test:evals` and `test:eval-package`.

## Original records

The following links pin complete original records to the pre-cleanup commit.
Their statements about pending work and source routes describe their milestone,
not the current installation. The records are retained byte-for-byte in Git
history; the SHA-256 values below identify the original Markdown content.

### Activation prompt validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/activation-prompt-validation.md) · SHA-256: `15292e7b506b0e5e8061db4e7a93d4a6d21e7d43b44b34319343468e41d9b40d`.

### Backend mount validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/backend-mount-validation.md) · SHA-256: `4604b367b60d31fa3a2eaf6bf0763bdee2ccac27d17a66179b10324e1bec2b47`.

### Benchmark caller validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/benchmark-caller-validation.md) · SHA-256: `0ac7b7d2cb86aadd903141b638bae168309ff8d01a65c0ff928eca65733c7dba`.

### Benchmark migration validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/benchmark-migration-validation.md) · SHA-256: `401ba08e47b9c48066587934267bc405bc816785533c7a011f58215c30c48d9a`.

### Cadence fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/cadence-fixture-validation.md) · SHA-256: `d67f457b3ccf4aaa61ee0952cee1bace0de8662fac4643a3b608d21de1a64d00`.

### Capability fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/capability-fixture-validation.md) · SHA-256: `9d75815088d2600eb130bf9c4ed5d50b46d0ec12ae5ef2047a49d0abaf41d3d9`.

### Completion policy validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/completion-policy-validation.md) · SHA-256: `1b5cf6c7bcf46bd19f9ce111e89b0ff891d7cb3dd510dec80adb67f4a241d9fb`.

### Composition fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/composition-fixture-validation.md) · SHA-256: `8b7c7ef6cf6d797621f894033766b1aee692f9fbb199c885bbd9fd57dd235ae7`.

### Corpus caller validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/corpus-caller-validation.md) · SHA-256: `d6561f799906c99313f065f9a5eedafa900d8e4e228adc1f3a845d21f030bdc6`.

### Default package validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/default-package-validation.md) · SHA-256: `16ecfdb51501d8e2067aff6294189f448682fa314cc0a4582e22fd66e81f6492`.

### Direct caller validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/direct-caller-validation.md) · SHA-256: `d30710257ca958923826184f3d83e739eaf97ec2abcebe5656102989615ee4b7`.

### Discovery oracle validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/discovery-oracle-validation.md) · SHA-256: `ae86ae2284bd5ff240a26d889a876f1f717be9c495454a8bd07b5f2fcd0a923b`.

### Feedback fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/feedback-fixture-validation.md) · SHA-256: `3daca0bcf58ece65ec31b3c393bd0b2a135943a24b493b33798a09d10d7c01da`.

### Fixture cleanup validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/fixture-cleanup-validation.md) · SHA-256: `31079ed872c674c345e22f4a9e6b45a0d25b735b24f8462ba94a1a853969c71d`.

### Fixture state validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/fixture-state-validation.md) · SHA-256: `3cbcbca8aa1ccc93bf2d73ddcf5149ad285ae8b29cb0a50f39e786b034ef607c`.

### Frozen ci validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/frozen-ci-validation.md) · SHA-256: `f98d297c91815daae2513a77715eeb82e3f3da3fda6c739c9c2a2a5d7260a7d2`.

### Goal review fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/goal-review-fixture-validation.md) · SHA-256: `7bbe049830096fde52d757e73ba159b5cb7aff2e1c6a22d7543667ecd10ecf86`.

### Guide validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/guide-validation.md) · SHA-256: `cdf117ef49da60e157f91b7fabc2c63230f07db89ce3226f6e59e1d1b85380c7`.

### Historical claims validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/historical-claims-validation.md) · SHA-256: `64bd1c34847cb97c122b0fe90f1f2fe3a8be4de98f0c162a303d95be106b5a44`.

### Historical review proof validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/historical-review-proof-validation.md) · SHA-256: `b8d9120084ce5b22c3e454098bd75dc80d34ed505913c6eaeed3e3780d3995cc`.

### History validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/history-validation.md) · SHA-256: `bcb464f8bb30f860be81b32b7ef1e5c36918b616b677e23b38ec245d2f27b2e5`.

### Installed ci validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/installed-ci-validation.md) · SHA-256: `3fa4cbd58cc9b94cbf4c37e9df8c18899dad7702d4df4b1bba6ba83fb2314dc4`.

### Legacy ablation validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/legacy-ablation-validation.md) · SHA-256: `f364fe32f6f9ac7f26c5291395f8cbb16170cfda204080c6be3c84594f494a1a`.

### Legacy compare validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/legacy-compare-validation.md) · SHA-256: `90e37d40774f545ea23958fb0cc77b5295d7b2297384e0cbb5b93a7e300ba696`.

### Legacy report command validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/legacy-report-command-validation.md) · SHA-256: `1033189da980f0d29bd1c71ee34a8a3cc341edda605a3c4776ebbfe525baab64`.

### Live validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/live-validation.md) · SHA-256: `15aedacc5939cf72e8b81e9d483abf6ed96e324bec5438ef6b4617d203b69b24`.

### Main sync validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/main-sync-validation.md) · SHA-256: `399f905ef1861b87e802b95d4bb37cdc85ce497cda81f3bdbeccb6daa4079238`.

### Manual review validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/manual-review-validation.md) · SHA-256: `663064b6dc282bb48f3a6ddb3a5b6e725c8209220a15fc54fa3574a71681e333`.

### Mounting fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/mounting-fixture-validation.md) · SHA-256: `38754bfb21dfbf258e5d6a3f2a26acc677881854cd4ff91681bb4a1fe39a2417`.

### Orchestration policy migration

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/orchestration-policy-migration.md) · SHA-256: `00c58867fa9582117d6c02357d906dda28e62ced55078b66f8e75d9f1226ab88`.

### Ordering validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/ordering-validation.md) · SHA-256: `d6bd96a3c9a2d971ffe158555faf67b6226baf2a6bfb5687ef32abd792cedf65`.

### Owner evidence validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/owner-evidence-validation.md) · SHA-256: `79b96ea047259f2757254e146fd58d2a193dc0f1d8bb503442e8aeb38b890528`.

### Passive benchmark validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/passive-benchmark-validation.md) · SHA-256: `08b7b84c9a6607aa5a55c633e551dad6d084764df655a3fa20b581f01a629216`.

### Publication fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/publication-fixture-validation.md) · SHA-256: `676555a97ae0fb9f5e53d82379c709d14acb6764a639dadbbbe204bfbfac6195`.

### Quality validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/quality-validation.md) · SHA-256: `93bb09ecf72ac4cbc8d33d6e14265757d5d225a32ccd0b49e3c18657785b2461`.

### Readiness fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/readiness-fixture-validation.md) · SHA-256: `173a6444ce84b0cb856a2ec373c1427b3f3222105cb6bb032a486f6a46b64982`.

### Real commit fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/real-commit-fixture-validation.md) · SHA-256: `99d755e2378ea3c7534dac0e47e2aac74a492771df3b0a7dba4e8b356e149325`.

### Review outcome validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/review-outcome-validation.md) · SHA-256: `bedf5cc6909bcc08d9eb805a2613c2cf51f5326e741d4697fc1598a1dc6cc5c5`.

### Runner cutover inventory

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/runner-cutover-inventory.md) · SHA-256: `b729f7ce2713218b4a454e4faa61950f0b715cfc5dc6e6b1f7ae81b54b283c3a`.

### Runner retirement validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/runner-retirement-validation.md) · SHA-256: `f671fc341046dbfde982c777d6866dcce1343a814746173607a1cfa30b1ac14d`.

### Scoped release validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/scoped-release-validation.md) · SHA-256: `e698aecbb8b40444ee783141f4673a61f54c4c877f79e653723821e89ec4914a`.

### Selection validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/selection-validation.md) · SHA-256: `1fcf4a8f34edf48d5977ff7a74b43bad895c781cb63d88ec7cd5521517f074be`.

### Suite validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/suite-validation.md) · SHA-256: `fc7cc894e4e2372229b0dde47f3b00a7ef3c0af6d448e6d1d496b2dbdc6df680`.

### Ticket fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/ticket-fixture-validation.md) · SHA-256: `9f34a460cd0f9c72f233e495e4a17c755ac9cc2fceb4146b1c6ef60591f2c363`.

### Verification fixture validation

[Original record](https://github.com/BjRo/darrow/blob/16a443f896b0b25373a381e3a5b55cd471dbe27a/evals/sevro-extension/verification-fixture-validation.md) · SHA-256: `66a25e366ba5cf8cc4d4854b9b90bbc707ee019d451212e5f6151747efe23219`.
