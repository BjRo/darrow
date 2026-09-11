# Darrow documentation

Start with the task you want to do. These pages work on their own; the
repository guide can explain them and answer follow-up questions.

| I want to…                                  | Read                                             |
| ------------------------------------------- | ------------------------------------------------ |
| Try one safe workflow                       | [Get started](getting-started.md)                |
| Install, update, remove, or verify a plugin | [Install a Darrow plugin](installing-plugins.md) |
| Choose what to adopt                        | [Choose plugins](choosing-plugins.md)            |
| Understand the layers and their rationale   | [Design principles](design.md)                   |
| Resolve a documented symptom                | [Troubleshooting](troubleshooting.md)            |
| Understand a project term                   | [Glossary](glossary.md)                          |
| Change Darrow or its documentation          | [Contributing](../CONTRIBUTING.md)               |

## Ask the repository guide

Open this checkout in a fresh Codex or Claude Code session and ask:
“What is Darrow, and which plugin should I try first?”

For explicit invocation, use `$darrow-guide` in Codex or `/darrow-guide` in
Claude Code. No guide plugin installation is needed. The canonical
[guide instructions](../.agents/skills/darrow-guide/SKILL.md) explain how it
reads sources, cites its evidence, and handles missing or conflicting answers.

The guide explains this checkout and remains read-only. It can suggest an
installation or a diagnostic capability, but does not execute those steps.
Claude Code support is best-effort; Darrow is developed primarily with Codex.
If discovery does not work, use the pages above and the
[guide discovery checks](troubleshooting.md#the-repository-guide-is-missing).

## Go deeper

- [Capability specifications](specs/README.md) define normative behavior.
- [Accepted decisions](decisions/README.md) record settled choices and lifecycle.
- [Research index](research/README.md) links exploratory, non-normative analysis.
- [Eval development](eval-development.md) explains evidence and native trials.
- [Documentation quality](documentation-quality.md) defines local checks and review.
- [Acknowledgements](acknowledgements.md) credits the work that inspired Darrow.

Return to the [Darrow introduction](../README.md).
