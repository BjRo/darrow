# Choose Darrow plugins

Start with the work you want done. Install one matching plugin and try it on a
small request. Add another only when a new need appears. Each plugin stands
alone; its README owns its prerequisites, behavior, and safety rules.

## Choose by intent

| Your next task                                                                                                                                  | Plugin and local instructions                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Clarify a decision, research, diagnose, model a domain, write skills, use TDD or implement approved work                                        | [Matt Pocock](../plugins/capability/darrow-matt-pocock/README.md)                           |
| Investigate change impact or rationale, correct recurring mistakes, maintain verification, check measurements, edit writing or apply principles | [Pstack](../plugins/capability/darrow-pstack/README.md)                                     |
| Create a branch, commit or evidence-backed PR                                                                                                   | [Git](../plugins/capability/darrow-git/README.md)                                           |
| Assess whether a request is ready to implement                                                                                                  | [Readiness Gate](../plugins/capability/darrow-readiness-gate/README.md)                     |
| Review a bounded change or verify repairs independently                                                                                         | [Review](../plugins/capability/darrow-review/README.md)                                     |
| Explicitly execute bounded engineering work with acceptance accounting                                                                          | [Adaptive Goal](../plugins/orchestration/darrow-adaptive-goal/README.md)                    |
| Understand architecture, ownership, call flow or state in conversation                                                                          | [Explanation](../plugins/capability/darrow-explanation/README.md)                           |
| Set up or doctor agent guidance, host integration, or inspect context usage                                                                     | [Information Architecture](../plugins/foundation/darrow-information-architecture/README.md) |
| Explicitly deliver one ticket through a PR and required green CI                                                                                | [Ticket-to-PR](../plugins/task-recipe/darrow-ticket-to-pr/README.md)                        |
| Explicitly admit nominated GitHub issues for local unattended delivery                                                                          | [Artificer](../plugins/automation/darrow-artificer/README.md)                               |

These are the ten entries in the [marketplace manifest](../.claude-plugin/marketplace.json).
Matt contains 17 selected skills; pstack contains 33. Their unchanged explicit-only
workflows stay explicit. Adapted implement accepts explicit invocation or authorized
parent delegation and defaults to local commits. Ticket-to-PR supplies publication
authority and required CI; Adaptive Goal remains the one continuation owner.
Review is independently usable; acceptance also needs criterion-specific evidence.
Git creates the complete PR without requiring Explanation.

Use configured tracker guidance and native tools for issue operations. Maintain
ADRs and their catalog as ordinary documents with domain-modeling guidance.
Artificer's Claude path can hand off work and produce a PR but returns
`needs-attention` when native completion evidence is unavailable. That exception
remains; a PR is not proof of native completion. There is no shipped general
troubleshooting plugin or general scheduler framework.

For host telemetry, use configured native exporters. See
[the telemetry decision](decisions/ADR-0013-retire-the-langfuse-observability-plugin.md)
for attribution limits and rationale.

## Understand the layers

These are responsibilities, not steps every task must traverse.

- **Foundations** maintain durable repository context: guidance, decisions,
  and reusable skills. Their artifacts remain useful without the producing plugin.
- **Capabilities** own focused work and its checks. They match the user's intent
  or can be invoked explicitly, and work without orchestration.
- **Orchestration** owns a bounded completion contract and execution handoff.
  It begins only through explicit invocation. Adaptive Goal selects a
  proportionate workflow while the main thread keeps the native goal and completion.
- **Task recipes** package a familiar outcome and permission envelope, then
  delegate the bounded work. The current recipe is ticket to PR.
- **Automation** owns admission under explicit recurring authority. Local Artificer
  handles capacity, duplicate prevention, questions and local native continuation;
  task recipes and their native owners retain engineering work.

Foundations and capabilities support several layers directly. Evaluation and
observability assess behavior across the layers; neither grants execution
authority. Every plugin remains optional. This is also the long text description
of the [layer diagram](assets/darrow-plugin-layers.svg) on the landing page.
See [design principles](design.md) for ownership, handoffs and rationale.

## Make the first choice

If you are exploring, follow the [read-only readiness tutorial](getting-started.md).
For a concrete need, read the selected plugin's README, check its prerequisites,
then follow the [host-specific installation procedure](installing-plugins.md).
A missing optional capability is a reason to use the documented fallback or
make a separate choice, not permission for one plugin to reach into another.

Return to the [documentation hub](README.md).
