# Python migration validation

This migration preserves the skill's activation and orchestration contract.
It changes deterministic preflight, route, and fixture mechanics and the frozen
commands that invoke them. The original Bash regression suites were run before
the conversion; their required scenarios now run in the Python package suite.

| Representative request                                                 | Required behavior                                 | Existing evidence seam                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Use adaptive-delivery to implement this bounded request                | Prepare and launch one native owner               | `bounded-native-goal.yaml`                                              |
| An invoked task recipe delegates its authorized request                | Preserve delegated authority                      | `authority-task-recipe-parent.yaml`                                     |
| Use adaptive-delivery on a specification with a missing product choice | Return the full non-ready assessment, launch none | `readiness-nonready-stops.yaml`, `claude-readiness-nonready-stops.yaml` |
| Implement this ordinary engineering change                             | Do not activate orchestration                     | `ordinary-engineering-nonactivation.yaml`                               |
| A review returns before another selected assessment                    | Wait for combined evidence before repairing       | `verification-combined-repair.yaml`                                     |

The request matrix reuses the existing judgment oracles. Deterministic baseline
tests cover exact record formats and ordering, route policy precedence and
refusal, repository binding, readiness reports, closed review history, and
assessment timing. Python tests add generated JSON and POSIX checksum oracles,
native path and subprocess boundaries, and separately gated line/branch coverage.

The six Bash test drivers are retired. Their retained assertions map to these
files under `backend/tests`:

| Retired driver                                  | Python coverage                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adaptive-delivery-preflight.test.sh`           | `test_preflight.py`, `test_route_matrix.py`: records, policy/explicit parity, all efforts, Git isolation, refusals                                   |
| `codex-launch.test.sh`, `claude-launch.test.sh` | `test_launch_contract.py`, `test_preflight.py`: native controls, manifest identities, resolver contracts                                             |
| `implementation-readiness.test.sh`              | `test_fixtures.py`, `test_installed_fixtures.py`: exact templates, host isolation, reports, passive prerender, iterative installed execution         |
| `independent-review.test.sh`                    | `test_fixtures.py`, `test_installed_fixtures.py`: fingerprints, closed outcomes/history, installed event records, non-subject mutation during review |
| `verification.test.sh`                          | `test_fixtures.py`, `test_installed_fixtures.py`: current checks, combined outcomes, refused resets, mutation between review and QA                  |

Installed-provider tests invoke frozen UV console entrypoints with argument
vectors. Race tests wait for recorded assessment events before changing the
candidate, then check the returned result and target history. The removed
conflicting-Bash-interpreter check applied only to the retired test runner.

The package follows the contained UV blueprint with no runtime dependencies.
Its deliberate migration difference is standard-library JSON syntax diagnostics
(line/column instead of the removed AWK parser's byte wording). Semantic route
validation, output records, and exit statuses retain their contracts. Fixture
installation copies a runtime-only package beside the host's fixture skills;
no compatibility script or discoverable fixture skill ships in the source tree.

Run `bun run check:python` for repository Python quality. Run
`uv run --quiet --frozen --no-dev --project backend python backend/tests/fresh_install.py`
from the plugin root for fresh copied-artifact validation. CI runs native Linux,
macOS, and Windows package/fresh-artifact checks, including the Python regression
suite. No separate Bash regression step remains.
Native live trials use `--owner-evaluation passive`; dry validation proves fixture
preparation only. Report actual host trials separately from deterministic and
installation evidence; installing the helper does not prove host acceptance.
