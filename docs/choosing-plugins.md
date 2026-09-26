# Choose Darrow plugins

Start with the work you want done. Install one matching plugin and try it on a
small request. Add another only when a new need appears. Each plugin stands
alone; its README owns its prerequisites, behavior, and safety rules.

## Choose by intent

| Your next task                                                              | Plugin and local instructions                                                                                    |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Assess whether a request is ready to implement                              | [Readiness gate](../plugins/capability/darrow-readiness-gate/README.md)                                          |
| Clarify behavior or make an implementation plan                             | [Discovery](../plugins/capability/darrow-discovery/README.md)                                                    |
| Implement an observable behavior test-first                                 | [TDD](../plugins/capability/darrow-tdd/README.md)                                                                |
| Review a change independently                                               | [Review](../plugins/capability/darrow-review/README.md)                                                          |
| Verify implementation acceptance through independent assessment             | [Verification](../plugins/capability/darrow-verification/README.md)                                              |
| Create a branch, commit, or pull request                                    | [Git](../plugins/capability/darrow-git/README.md)                                                                |
| Read, list, create, or update GitHub issues                                 | [Tickets](../plugins/capability/darrow-tickets/README.md)                                                        |
| Install reusable GitHub issue templates                                     | [Tickets](../plugins/capability/darrow-tickets/README.md#install-ticket-templates)                               |
| Understand technical structure in a compact visual                          | [Explanation](../plugins/capability/darrow-explanation/README.md)                                                |
| Export Codex turn telemetry to Langfuse                                     | [Langfuse observability](../plugins/capability/darrow-observability-langfuse/README.md)                          |
| Organize repository agent guidance                                          | [Information architecture](../plugins/foundation/darrow-information-architecture/README.md)                      |
| Capture or find accepted decisions                                          | [Decisions](../plugins/foundation/darrow-decisions/README.md)                                                    |
| Create or validate a reusable skill                                         | [Skill authoring](../plugins/foundation/darrow-skill-authoring/README.md)                                        |
| Explicitly hand a bounded engineering task to one execution owner           | [Adaptive Delivery](../plugins/orchestration/darrow-adaptive-delivery/README.md)                                 |
| Check whether Codex or Claude Code can support Adaptive Delivery delegation | [Adaptive Delivery doctor](../plugins/orchestration/darrow-adaptive-delivery/README.md#doctor-adaptive-delivery) |
| Explicitly request one ticket through a new branch to a PR                  | [Ticket to PR](../plugins/task-recipe/darrow-ticket-to-pr/README.md)                                             |
| Study the former static workflow or run a comparison                        | [Ticket pipeline reference](../plugins/orchestration/darrow-ticket-pipeline/README.md)                           |
| Explicitly enable bounded local delivery of nominated GitHub issues         | [Local Artificer](../plugins/automation/darrow-artificer/README.md)                                              |

This is the complete shipped plugin catalog. Planned names are not installation
targets; consult the [marketplace manifest](../.claude-plugin/marketplace.json)
for package identity. In particular, there is no shipped general troubleshooting
plugin. Local Artificer supplies a specific authorized unattended entry, not a general scheduler framework.

### Planned names are not installation targets

The former landing-page roadmap named `darrow-troubleshooting` for debugging,
`darrow-domain-modelling` for domain work, and `darrow-evidence` for additional
PR evidence. It also described `darrow-artificer` as a future scheduler above
ticket-to-PR and GitHub tickets, with work-in-progress limits. These are roadmap
ideas, not shipped packages, release promises, or authority for unattended work.
Check the marketplace and accepted specifications before relying on them.

## Understand the layers

These are responsibilities, not steps every task must traverse.

- **Foundations** maintain durable repository context: guidance, decisions,
  and reusable skills. Their artifacts remain useful without the producing plugin.
- **Capabilities** own focused work and its checks. They match the user's intent
  or can be invoked explicitly, and work without orchestration.
- **Orchestration** owns a bounded completion contract and execution handoff.
  It begins only through explicit invocation. Adaptive Delivery selects a
  proportionate workflow and hands the task to one host-native owner.
- **Task recipes** package a familiar outcome and permission envelope, then
  delegate the bounded work. The current recipe is ticket to PR.
- **Automation** owns admission under explicit recurring authority. Local Artificer
  handles capacity, duplicate prevention, questions and local native continuation;
  task recipes and their native owners retain engineering work.

Foundations and capabilities support several layers directly. Evaluation and
observability assess behavior across the layers; neither grants execution
authority. Every plugin remains optional. This is also the long text description
of the [layer diagram](assets/darrow-plugin-layers.svg) on the landing page.
See [layer ownership and handoffs](specs/layer-composition.md) for the normative
contract and [design principles](design.md) for the rationale.

## Make the first choice

If you are exploring, follow the [read-only readiness tutorial](getting-started.md).
For a concrete need, read the selected plugin's README, check its prerequisites,
then follow the [host-specific installation procedure](installing-plugins.md).
A missing optional capability is a reason to use the documented fallback or
make a separate choice, not permission for one plugin to reach into another.

Return to the [documentation hub](README.md).
