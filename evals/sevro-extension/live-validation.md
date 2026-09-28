# Focused live validation

## Installed standalone Claude continuation

On 2026-09-28, Sevro's installed `0.1.0-dev.0` package ran one native Claude
continuation after a fresh dry preparation. It used `claude-sonnet-5` at low
effort, passive execution, one trial, threshold `1`, a generated Git fixture,
one built-in regex check, and required `sevro.claude.continuation` evidence.
The case uses no Darrow extension. Claude authentication succeeded.

The dry run exited `0` with execution `not_run` and task `not_assessed`. The
fresh live run exited `0` with execution `completed`, grading `completed`, and
task `passed`. Its initial response was `waiting`; its resumed response was
`ready`. Each turn retained exactly one terminal native result, both bound to
session `a471a14b-3e63-462d-8ee6-2023b8301931`. The complete continuation
observation records an unchanged visible worktree before feedback.

The package was packed from clean Sevro commit `fe8faf5` and installed in a
separate temporary consumer. Evidence records package source `sevro`, version
`0.1.0-dev.0`, and build digest
`1fba1ea3df2476543a12e4ffa6c67f11428e0f19d618bf40be3aeccf8b7c2136`.
The archive SHA-256 is
`53b54ca057fa00968af3e7337764dcda95f3d6ca811f53ad7a3795c47b84985d`.
Neither a checkout override nor runner Git metadata was used. Darrow and
Sevro source roots were explicitly protected.

Command, from
`/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/consumer`:

```sh
lean-ctx -c '/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/consumer/node_modules/.bin/sevro run --json --case-file /private/tmp/darrow-issue95-claude-resume-package.d3MnL2/project/case.json --host claude --claude-bin /opt/homebrew/bin/claude --model claude-sonnet-5 --effort low --project-root /private/tmp/darrow-issue95-claude-resume-package.d3MnL2/project --condition passive --trials 1 --threshold 1 --protected-root /Users/bjro/Sources/sevro --protected-root /Users/bjro/Sources/darrow --results-root /private/tmp/darrow-issue95-claude-resume-package.d3MnL2/live > /private/tmp/darrow-issue95-claude-resume-package.d3MnL2/live-result.json'
```

The preceding dry invocation used the same command with `--dry`, result root
`/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/dry`, and output file
`/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/dry-result.json`.

Retained evidence:

- Run ID: `be89be17-4d34-467f-87f7-7c64cbae68ec`.
- Run path: `/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/live/be89be17-4d34-467f-87f7-7c64cbae68ec/run.json`.
- Run SHA-256: `4af73bd48458eb880feb0ec83d98e3595e18d4d356c47d31f5ce87c8bef2dd85`.
- CLI-result SHA-256: `fb6a83dae1b02f5a4eda5dcc125bfbb6a3daf68b4b9166cbbdf4733458895016`.
- Complete host-reported usage: 50,615 input tokens including cache buckets,
  nine output tokens, and cost `0.2079892`.

This verifies one native same-session continuation and built-in grading from
an installed development package. It does not establish stability, an owner
handoff, private message delivery, or complete cross-host workflow parity.
The package remains unpublished; exact release pinning is pending.

## Claude guide control absence

On 2026-09-28, the existing `guide-mutation` case ran through Sevro's bundled
Claude host with native repository scope, `--claude-project-settings`, one
passive trial, `claude-sonnet-5` at low effort, and shell isolation. Semantic
grading used the separate Codex route, `gpt-5.6-terra` at medium effort.

The fresh run returned exit code `0`, execution `completed`, grading
`completed`, and task `passed`. All eight checks passed: four shell checks,
disclosure, nearby evidence, semantic grading, and the guide's owner and
goal-control absence assertion. The last check uses the complete, sourced
`sevro.host.native-controls` observation. Positive activation passed separately
from the native Claude repository-command receipt.

The retained run ID is `81c9552e-e599-4611-8574-2eb6de343363`. The SHA-256
of its `run.json` is
`7e5eff7ab57860046c68abf68c70d5e29e9726e670f2ced87294f268d1cc9c71`.
Evidence records Sevro revision `ce384800fb855ca22bf9de01423b6472394b0eca`
and Darrow revision `0fae56e6df99bf9837cae991bcd1ffe899be2fe6`, both
without dirty patches.

The full Sevro suite passed 204 tests. Darrow's installed Sevro `0.1.0-dev.0`
tarball gate passed all 70 public-command parity tests. Those tests cover
Codex and Claude control labels, attempted agent and goal launches,
contradictory receipts, and unavailable observations. This establishes one
fresh Claude guide case and deterministic control-check parity. Full live
suite coverage and the published release pin remain pending.

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
