# Skill creation evals

Run these cases with the shared runner using `--plugin darrow-skill-authoring`.
All cases mount both public skills so the creation and audit intent boundaries
compete as they do in an installed plugin. Use one trial and one job while
diagnosing a failure, then five fresh Luna/medium trials per case for the
reliability claim.

| Boundary                                          | Case                       |
| ------------------------------------------------- | -------------------------- |
| Direct creation and portable shell mechanic       | `create-focused-skill`     |
| Contained Python mechanic                         | `create-python-mechanic`   |
| Target repository toolchain                       | `respect-target-toolchain` |
| Indirect reusable-workflow request                | `indirect-discovery`       |
| Missing capability, destination, and runtimes     | `refuse-undefined-skill`   |
| Reuse a current independent review of a new draft | `reuse-current-review`     |

The creation fixtures keep prepared drafts under names other than `SKILL.md`.
The participant must produce the real file. The complex historical
`repair-skill-boundaries` case is [archived](../../../../../../evals/experiments/skill-authoring-description/archive/repair-skill-boundaries.yaml)
because implementing changes to an existing skill is outside both public
capabilities; its prior task failures remain in the comparison snapshot.

For shell-reporting checks, observed Bash 3.2 and Bash 5 versioned runs count
as full coverage. An unavailable or unexecuted target must be labeled
unverified. Merely invoking `bash` and `/bin/bash` does not prove distinct
versions. The semantic check grades the final report; inspect the retained
matrix output when assessing actual coverage.
