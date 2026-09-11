<p align="center">
  <img src="docs/assets/darrow-logo.png" alt="Darrow logo" width="420">
</p>

**Focused, eval-tested plugins for Codex and Claude Code. Adopt one plugin at
a time. Nothing starts unless you ask.**

Agent skills are usually bundles of untested prompt prose: install everything,
hope the model picks well, and watch a "workflow" occasionally take over your
session. Darrow makes the opposite bet. It is a marketplace of small plugins —
Git workflows, TDD, code review, ticket handling, readiness checks — where
each plugin adds exactly one bounded capability, ships with evals that
exercise it in the real agent harness, and installs the same way into Codex
and Claude Code.

## Why Darrow

- **Tested, not vibes.** Every skill carries colocated evals for its behavior
  and trigger boundaries, and behavior changes are compared against controls
  before Darrow claims an improvement.
- **One package, two hosts.** The same plugin installs into Codex and Claude
  Code.
- **You stay in charge.** Capabilities respond to your intent but never start
  longer-running work on their own. Orchestration begins only when you
  explicitly invoke it — and it hands work to your host's native goal loop
  instead of running a second agent runtime.
- **True à la carte.** No plugin assumes a sibling is installed. Take one,
  take five, skip the rest.

> **A note on hosts:** I currently develop and use Darrow primarily with
> Codex, so that is where the plugins get the most day-to-day exercise.
> Claude Code support is best-effort for now: the same packages install and
> carry evals, but expect rougher edges — and please open an issue for
> anything you hit.

## See it in action

```text
You:   Assess whether this implementation request is ready before any code
       is changed: add a --json flag to the main CLI command, keep the text
       output as default, and add tests for both output modes.

Agent: [selects assess-implementation-readiness from darrow-readiness-gate]
       Verdict: needs-decision — the JSON object shape is unspecified.
       Quality bar and required evidence: …
```

No skill was named: the installed capability matched the request on its own.
You can also invoke any skill explicitly, and orchestration helpers only ever
start explicitly.

## Get started

Codex, from your shell:

```sh
codex plugin marketplace add BjRo/darrow
codex plugin add darrow-readiness-gate@darrow
```

Claude Code, inside a session:

```text
/plugin marketplace add BjRo/darrow
/plugin install darrow-readiness-gate@darrow
```

Start a new session in a repository and follow the
[first-workflow tutorial](docs/getting-started.md) to run a safe, read-only
readiness assessment. [Install a Darrow plugin](docs/installing-plugins.md)
covers scopes, verification, and troubleshooting. Then choose other plugins
from the catalog below as you need them.

## The five layers

- **Foundations** keep the agent harness itself healthy: repository guidance,
  decision records, and skill authoring.
- **Capabilities** teach the agent focused software-engineering procedures —
  branching, TDD, review, tickets. Intent-matched, never self-starting.
- **Orchestration** packs one bounded task into a goal the host's native loop
  executes, with proportionate workflow, checks, model, and effort.
- **Task recipes** wrap common outcomes in a one-line invocation, owning
  authority and publication safety while delegating execution.
- **Automations** (coming soon) are the scheduler-driven outer loop that pulls
  work through everything below.

<p align="center">
  <img src="docs/assets/darrow-plugin-layers.svg" alt="Darrow's five plugin layers: automations invoke task recipes from a scheduler; task recipes add an ergonomic interface over orchestration; Adaptive Delivery frames bounded work and hands it to one host-native owner with proportionate cost and risk; capabilities teach software-engineering skills; foundations help build and maintain a healthy agent harness. Every plugin remains independently adoptable.">
</p>

## Plugin catalog

### Foundations

Skills for building and maintaining a healthy agent harness. Set up repository guidance, preserve decisions, and create high-quality skills.

| Plugin                                                                                            | Use it to                                                                    |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`darrow-information-architecture`](plugins/foundation/darrow-information-architecture/README.md) | Set up or audit lean repository guidance for Claude Code and Codex.          |
| [`darrow-decisions`](plugins/foundation/darrow-decisions/README.md)                               | Capture decisions at their canonical scope and find existing records.        |
| [`darrow-skill-authoring`](plugins/foundation/darrow-skill-authoring/README.md)                   | Create, revise, and validate focused agent skills for Claude Code and Codex. |

### Capabilities

Skills that teach the agent focused software-engineering procedures for
repeatable work: reading and updating tickets, writing code TDD-style,
everyday Git workflows, code review, and code explanation. All of them are
opinionated defaults, and all of them are optional — if you hold different
opinions, bring your own implementation and nothing else breaks.

| Plugin                                                                                        | Use it to                                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`darrow-git`](plugins/capability/darrow-git/README.md)                                       | Create branches, commits, and pull requests through bounded Git workflows.                        |
| [`darrow-tickets-github`](plugins/capability/darrow-tickets-github/README.md)                 | Create, read, list, and update GitHub issues through bounded ticket workflows.                    |
| [`darrow-readiness-gate`](plugins/capability/darrow-readiness-gate/README.md)                 | Check whether a request, ticket, specification, or plan is ready to implement.                    |
| [`darrow-discovery`](plugins/capability/darrow-discovery/README.md)                           | Grill ideas, discover feature behavior, and plan implementation without inventing unknowns.       |
| [`darrow-explanation`](plugins/capability/darrow-explanation/README.md)                       | Explain technical structure through compact, source-grounded visual forms.                        |
| [`darrow-tdd`](plugins/capability/darrow-tdd/README.md)                                       | Implement behavior changes and reproducible fixes through a red-to-green test slice.              |
| [`darrow-review`](plugins/capability/darrow-review/README.md)                                 | Review a pinned change for repository standards and specification fulfillment without editing it. |
| [`darrow-observability-langfuse`](plugins/capability/darrow-observability-langfuse/README.md) | Export Codex turns to Langfuse with privacy controls and work-item attribution.                   |

Coming soon:

- `darrow-troubleshooting` — debugging and figuring out what is going on.
- `darrow-domain-modelling` — better management of the core domain.
- `darrow-evidence` — like `darrow-review` and `darrow-readiness-gate`, pulled
  by `adaptive-delivery` when extra evidence needs to be presented for the PR.

### Orchestration

The work-package primitive in this layer is the `adaptive-delivery` skill inside
`darrow-adaptive-delivery`. Give it a bounded engineering task and it sizes up the
cost and risk, picks the workflow, checks, model, and effort, then hands a
properly packed brief to the host's native goal loop. It improves the handoff
instead of bringing its own agent runtime.

| Plugin                                                                                          | Use it to                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`darrow-adaptive-delivery`](plugins/orchestration/darrow-adaptive-delivery/README.md)          | Run Darrow's core orchestration helper. It prepares repository evidence, compiles a bounded completion contract, selects a proportionate workflow and risk gate, and hands the work to one host-native goal owner without building a second agent runtime. |
| [`darrow-ticket-pipeline`](plugins/orchestration/darrow-ticket-pipeline/README.md) (deprecated) | An earlier static orchestrator implementation kept for comparison and executable benchmark baseline. For new orchestration work, use `darrow-adaptive-delivery`.                                                                                           |

### Task recipes

Where `adaptive-delivery` is a general-purpose primitive, task recipes package one
common outcome and a consistent grant of authority behind one explicit
invocation. A recipe owns the outcome and permission envelope, then delegates
workflow selection, assurance and execution. The current `ticket-to-pr` recipe
does no preflight and chooses no workflow, model, branch name or verification
command.

| Plugin                                                                     | Use it to                                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`darrow-ticket-to-pr`](plugins/task-recipe/darrow-ticket-to-pr/README.md) | Turn one ticket reference into the usual new-branch implementation and one-PR request, then delegate it once to `adaptive-delivery`. |

### Automation

Planned automation decides when eligible, explicitly authorized work may start
under configured admission and capacity rules. It is not implemented. Before
unattended execution ships, it needs explicit contracts for recurring authority,
duplicate-work prevention, capacity, waiting for a person and reconciliation.
The current recipe requires explicit invocation in the current host thread;
scheduler delegation needs a separately authorized entry path.

Coming soon:

- `darrow-artificer` — runs on a scheduler on top of `darrow-ticket-to-pr` and
  `darrow-tickets-github`: pulls tickets and works on them while respecting
  work-in-progress limits.

## How Darrow works

These are responsibility layers, not stages every task traverses. Foundations
and capabilities support several layers directly; ordinary repository artifacts
remain useful after their producing foundation plugin is removed. Evaluation
and observability assess behavior alongside all layers. See the
[layer contracts and decision ownership](docs/specs/layer-composition.md) for
implemented handoffs, recommendation dispositions and automation's future
requirements.

Capabilities teach the agent one focused kind of work. Each skill advertises
the intent it serves, so the model can select it when a matching request
appears, and you can always name it explicitly. Capabilities stay useful
without any orchestration installed and never take ownership of work you did
not ask for.

Orchestration owns the continuation of longer-running work: how the outcome is
framed, what must remain true, and what counts as complete. It starts only
through an entrypoint you explicitly invoke — never merely because a task
looks complex or multi-step — though an invoked entrypoint may delegate a
bounded phase to another orchestration helper while preserving your original
authority. The core helper is the `adaptive-delivery` skill in `darrow-adaptive-delivery`:

```text
request + repository -> read-only preflight -> goal contract -> host-native goal owner
```

Preflight turns the request into observable acceptance criteria, selects a
proportionate workflow, risk gate, model, and effort, then activates the
narrowest host-native goal boundary available. From that point the host owns
implementation, adaptation, recovery, and completion — Darrow does not run a
second agent runtime.

Every skill carries colocated evals for its public behavior and intent
boundaries, and behavior-changing variants are compared with relevant controls
under matched fixtures, prompts, routes, and checks before Darrow attributes
an advantage to the variant. See [Design principles](docs/design.md) for the
full rationale and architectural boundaries.

## Status and compatibility

Darrow is under active development, and plugin interfaces may change between
versions; every plugin is semantically versioned in both host manifests. It
requires Codex CLI or Codex in the ChatGPT desktop app (the Codex IDE
extension does not support plugins), or Claude Code with plugin support. Codex
is the primary development host; Claude Code support is best-effort as
described above.

## Repository reference

- [Capability specifications](docs/specs) define normative behavior.
- [Accepted decisions](docs/decisions) record settled repository choices.
- [Research](docs/research) preserves exploratory, non-normative analysis.
- [Contributing](CONTRIBUTING.md) explains repository working agreements and
  verification.

The shared repository marketplace manifest is
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). Every
plugin also includes native Claude Code and Codex manifests.

## Standing on the shoulders of giants

Darrow stands on the shoulders of excellent open-source work. I took
inspiration from [obra's Superpowers](https://github.com/obra/superpowers) and
especially [Matt Pocock's skills](https://github.com/mattpocock/skills). I also
learned a great deal from studying
[Ouroboros](https://github.com/Q00/ouroboros) and
[oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex). They are wonderful
projects—go check them out. Matt Shumer's
[Gauntlet Loop](https://somethingbig.ai/gauntlet-loop) directly prompted the
native goal-loop research: give an agent the outcome and an inspectable quality
bar, let it choose the route, use fresh critics, and keep improving against the
bar.

Dexter Horthy's
[“show-me: a coding agent skill for compact visual representations”](https://www.linkedin.com/pulse/show-me-coding-agent-skill-compact-visual-dexter-horthy-w5yac/)
and HumanLayer's open-source
[`show-me` skill](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)
directly inspired the compact, smallest-fitting-view approach in
`darrow-explanation`.

## Development

```sh
bun install
bun run hooks:install
bun run lint
bun run typecheck
bun test
bun run check:decisions
```

`bun run lint` checks all Prettier-supported tracked project content. The
pre-commit hook applies the same formatting gate to staged files.

## License

Darrow is source-available under the
[Business Source License 1.1](LICENSE), with the Mozilla Public License 2.0 as
the Change License. **Each released version becomes MPL-2.0 two years after it
is published.**

**In short:** free for internal use, client work, research, personal projects,
and teaching without commercial interest. Commercial education and offering
Darrow's functionality as a product or service require a commercial license.

The standard BSL terms permit copying, modification, redistribution, and all
non-production use.

Additional production use that is free, without asking:

- Use Darrow within your own organization for purposes other than commercial
  education.
- Use it in client work that is not commercial education.
- Use it to teach third parties, run workshops or courses, give talks or
  presentations, and publish blog posts or articles when the activity has no
  commercial interest.
- Use it in research, evaluation, and personal projects.

Not included in the free production-use grant:

- Use Darrow in education with a commercial interest, whether the audience is
  inside or outside your organization. That includes compensation or
  sponsorship, bundling with or promoting paid offerings, lead generation, and
  other direct or indirect commercial benefits.
- Offer Darrow, or a derivative of it, to third parties as a product or service
  whose principal value is Darrow's functionality.

Under the BSL terms, production use outside the Additional Use Grant requires
you to purchase a commercial license or refrain from that use. For commercial
licensing, contact bjoern@bjro.de.

Production-use grants are version-specific. Earlier versions remain available
under the Additional Use Grant distributed with those versions.

Contributions are accepted under Apache-2.0 plus a relicensing grant; see
[CONTRIBUTING.md](CONTRIBUTING.md).
