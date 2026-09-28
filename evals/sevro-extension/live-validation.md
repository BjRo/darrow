# Focused live validation

## Claude repository dispatch and disclosure

On 2026-09-28, the existing `guide-explicit` case ran through Sevro's bundled
Claude host with native repository scope, `--claude-project-settings`, one
passive trial, `claude-sonnet-5` at low effort, and shell isolation. Semantic
grading used the separate Codex route, `gpt-5.6-terra` at medium effort.

The fresh run returned exit code `0`, execution `completed`, grading
`completed`, and task `passed`. Four shell checks, the retained-response
disclosure assertion, the nearby-evidence output check, and the semantic
question contract all passed. Positive activation passed separately from a
complete `sevro.claude.repository-invocation` observation with method
`native_repository_command`, `accepted: true`, and primary skill
`darrow-guide`. This receipt binds the native command to the mounted body,
arguments, and session; it does not depend on a later Skill call.

The retained run ID is `e84d70f6-882e-4bbd-85ed-12840ef493cb`. The SHA-256
of its `run.json` is
`1c9454ea21c95544baccf2f878a3a3d84a4b35d7c60c94bbf6f45975e0eb7c05`.
Evidence records Sevro revision `ca2c8f455c40ab34719c43f34badb73da9601306`
and Darrow revision `72fc24729069da82d6b8d087536217d78895e421`, both
without dirty patches.

Earlier attempts exposed two harness prerequisites: project settings are
required to discover Claude repository skills, and Claude reported a revoked
OAuth token. After the login was refreshed, a completed trial exposed a legacy
disclosure check that could skip its assertion because Sevro did not supply
the old environment variable and response file. The extension now grades the
same declared patterns against complete final-response evidence. Regrading
the retained response passed; a fresh trial then produced the result above.
The failed-authentication run remains execution `failed`, grading
`not_requested`, and task `not_assessed`, with private host artifacts retained.

The installed Sevro `0.1.0-dev.0` tarball also passed all 69 Darrow parity
tests across the three public-command test files. Those deterministic tests
include separate Codex and Claude suite routes, comparisons within each
harness, and rejection of contradictory candidate route evidence. They do
not establish live suite or ablation behavior.

This live result establishes explicit Claude repository dispatch, separate
positive activation, semantic grading, fixture effects, disclosure grading,
and retention for one case. It does not establish implicit or competition
activation parity, all guide transcript assertions, all suite options, or a
published release pin. The legacy command cutover remains pending.

## Codex negative activation

On 2026-09-26, the Sevro CLI ran the existing
`code-review-no-trigger-after-edit` case through the Darrow extension and the
bundled Codex host. A dry preparation completed first; it retained the selected
case and seven prepared artifacts with execution `not_run` and task
`not_assessed`.

The live invocation used one passive trial, `gpt-5.6-terra` at medium effort,
shell isolation, and no semantic or advisory route. It returned CLI exit code
`0`, execution `completed`, grading `completed`, and task `passed`. Both shell
checks and the final-message check passed. The separate negative activation
outcome passed from a complete `sevro.codex.skill-reads` observation with no
selected skill; its source was `sevro.host.codex`.

The retained run ID is `b1af2254-dfa8-476d-af90-37c74da81119`. The SHA-256
of its `run.json` is
`835edc276e21a73ce43c9e0fc066f81aa1f473e39082f724c96b78da8bcf62c5`.
Evidence records Sevro checkout revision `10d066f90a74048767bfc84d9d95e658100749dc`
and Darrow revision `73899af03972eab0f755d7a86b6ce2728ab4011a`, both
without dirty patches. The extension used `sevro.extension.v1` and recorded the
passive condition as applied.

This one negative case establishes a focused live path through discovery,
preparation, execution, built-in checks, activation grading, and retention. It
does not establish positive or competition activation parity, suite reporting,
or an installed release pin.
