# Focused live validation

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
