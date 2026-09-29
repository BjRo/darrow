# Activation and prompt policy migration

The twelve tests from `evals/runner/activation.test.ts` and five tests from
`evals/runner/prompt.test.ts` now live under `evals/domain/`. They import no legacy
runner implementation or private types. The legacy implementations still serve
the default runner and remain until the exact published-package cutover.

## Preserved policy

| Surface                        | Public evidence                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supporting reads               | Either order passes; missing reads fail; partial evidence remains unavailable                                                                      |
| Declaration and mounting       | Required membership needs an activation class and nonempty list; missing mounted providers fail; plugin and selected-skill providers pass          |
| Explicit and implicit dispatch | Resolution retains the shared placeholder; preparation binds the exact owning plugin and skill; implicit preparation declares no invocation        |
| Owner requirements             | Current owner cases declare three ownership checks; composition declares two; negative cases without owner policy and unrelated cases declare none |
| Selection classes              | Positive primary selection, negative avoidance, and competition retain their separate outcomes                                                     |
| Sequence and exclusions        | Missing or reversed sequence fails; a forbidden supporting skill fails despite negative primary avoidance                                          |
| Invalid declarations           | Unknown classes, competition without siblings, invalid sequence owner, negative sequence, and empty exclusions fail                                |
| Unknown trials and thresholds  | Unknown stays unavailable with a null pass rate; undeclared activation is not requested; measured pass rate gates at the exact threshold           |

Resolve, prepare, and evaluate use `sevro.extension.v1` subprocess requests.
Controlled observations use the documented Codex skill-read source and method.
They preserve the class, target, primary skill, ordered skills, and declared
membership in public domain outcomes. Legacy probe-kind strings become the
public namespaced host source. The standalone Darrow gate consumes those public
outcomes with separate execution and grading states. No private engine field or
numeric guess stands in for an unknown observation.

The owner example checks declared public policy in current case syntax. It does
not retain the legacy host's private `expectGoalOwner` control field. Explicit owner
and composition declarations preserve their observable child requirements;
negative cases leave owner policy absent. Native delegation itself remains a
separate acceptance requirement.

## Prompt migrations

Seven successful installed-command trials echo the prompt supplied to a
controlled host adapter. Exact output checks independently require the expected
text. Each trial asserts public exit, format, selected case, execution, grading,
task verdict, and output-check status. No model call or authentication is used.

Repository tokens retain `$skill` on Codex and `/skill` on Claude. Plugin tokens
retain `$plugin:skill` on Codex and use `/plugin:skill` on Claude, matching the
installed manifest namespace. The old unqualified Claude plugin expectation is
deliberately retired. Explicit Claude repository commands must lead the prompt;
the old inline repository example is explicitly rejected with exit `64`, no
execution, no grading, and an unassessed task. A leading command passes. Codex's
inline repository example still passes.

The composition example keeps the original packaged-source namespace and skill
token even when its directory name differs. Namespace authority comes from the
actual matching plugin manifests. No current repository YAML uses the legacy
`source_plugin` field; the public extension rejects it explicitly. Skill-less
prompts remain unchanged on both hosts, and a placeholder without an owner is
rejected.

The normative token and command-placement text now records these supported
public forms. Sevro, marketplace plugins, and extension product behavior are
unchanged. Initial fixture-maintenance failures identified the old Claude forms,
a contradictory retained owner declaration on a negative example, and an
invalid attempt to combine `--host` with `--adapter-module`. Corrected fixture
inputs exercise the current contract. No TDD Red claim is made.

## Validation

The seventeen migrated examples pass with 105 assertions in 11.27 seconds.
The final gate adds the existing public activation, invocation, repository-skill,
and composition-provider tests:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/activation-policy.test.ts evals/domain/prompt-policy.test.ts evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'public skill activation policy|public participant prompt policy|activation|skill invocation packages|additional plugins|implicit and explicit repository skills|native Claude repository skills|composition providers|ticket composition'
```

All 28 tests and 254 assertions across three files passed in 24.89 seconds.
The gate uses the verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`,
SHA-256 `480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
The prior complete domain gate passed all 203 tests and 1,113 assertions before
this milestone. This gate covers both newly moved policy families and relevant
public integration tests; it is not a fresh complete-domain or full-parity gate.
ESLint, typecheck, and formatting pass. Documentation checks cover 240 Markdown
pages and 16 plugins.

Milestone records and the gate log are retained under
`/Users/bjro/.darrow/issue95-activation-prompt-policy/`. The current ownership
inventory is
`/Users/bjro/.darrow/issue95-runner-ownership/activation-prompt-inventory.json`.
