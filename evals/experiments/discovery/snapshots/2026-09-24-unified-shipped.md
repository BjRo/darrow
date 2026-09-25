# Shipped unified Darrow Discovery skill

The `darrow-discovery` plugin now exposes one `work-through-decisions` skill.
This snapshot records focused task and activation checks on the final entry
metadata and mode instructions. All rows below used the same prompt and fixture
on each host, one trial per host at medium effort.

| Boundary                                  | Codex `gpt-6-luna`                                                                                                   | Claude Code `claude-sonnet-5`                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Direct grilling                           | [1/1 pass](../../../results/discovery-unified-final-matrix-codex-grilling-direct-frontier-n1.json)                   | [1/1 pass](../../../results/discovery-unified-final-matrix-claude-grilling-direct-frontier-n1.json)                   |
| Natural feature discovery                 | [1/1 pass](../../../results/discovery-unified-final-matrix-codex-discover-feature-spec-out-natural-language-n1.json) | [1/1 pass](../../../results/discovery-unified-final-matrix-claude-discover-feature-spec-out-natural-language-n1.json) |
| Natural implementation planning           | [1/1 pass](../../../results/discovery-unified-final-matrix-codex-plan-implementation-lets-plan-this-n1.json)         | [1/1 pass](../../../results/discovery-unified-final-matrix-claude-plan-implementation-lets-plan-this-n1.json)         |
| Ordinary advice exclusion                 | [1/1 pass](../../../results/discovery-unified-final-matrix-codex-work-through-decisions-ordinary-advice-n1.json)     | [1/1 pass](../../../results/discovery-unified-final-matrix-claude-work-through-decisions-ordinary-advice-n1.json)     |
| Pressure with independent product choices | [1/1 pass](../../../results/discovery-unified-final-matrix-v2-codex-pressure-n1.json)                                | [1/1 pass](../../../results/discovery-unified-final-matrix-v2-claude-pressure-n1.json)                                |

The original 23 colocated cases each passed a Codex trial during the rework.
Seven representative Codex cases passed five trials each for task and
activation: natural planning, feature discovery, natural grilling,
ordinary-advice exclusion, migration planning, a complete plan, and generic
stress-testing. Their result links are in the
[issue #228 research report](../../../../docs/research/gpt-6-luna-evals-issue-228.md).

An additional combined discovery and writing case found an unsafe Codex
response that wrote a spec while the feature choices remained open. The skill
now states the read-only handoff boundary at entry and in feature mode. The
final case explicitly reserves those choices for the user and passed
[Codex 5/5](../../../results/discovery-unified-final-codex-write-pressure-v4-n5.json)
and [Claude Code 1/1](../../../results/discovery-unified-final-claude-write-pressure-v5-n1.json).
A [Codex trial after the last metadata edit](../../../results/discovery-unified-final-codex-write-pressure-v5-n1.json)
also passed. The 24-case dry run prepared all cases, and the copied-plugin
frontier backend passed its fresh-install test.

The runner retains entry-skill activation but does not retain reads of internal
mode references, so these results cannot prove that each selected reference
was read. The write-pressure case checks local repository state and the
response; it has no external ticket-state oracle. The cross-host matrix is one
trial per case and does not establish a multi-trial Claude reliability rate.
