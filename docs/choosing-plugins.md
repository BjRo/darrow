# Choose Darrow plugins

Start with the work you want done. Install one matching plugin and try it on a
small request. Add another only when a new need appears. Each plugin stands
alone; its README owns its prerequisites, behavior, and safety rules.

## Choose by intent

- [Matt Pocock](../plugins/capability/darrow-matt-pocock/README.md): clarify decisions, research, diagnose, model a domain, write skills, or use TDD.
- [Pstack](../plugins/capability/darrow-pstack/README.md): investigate impact or rationale, correct mistakes, maintain verification, check measurements, edit writing, or apply principles.
- [Git](../plugins/capability/darrow-git/README.md): create a branch or an evidence-backed PR.
- [Readiness Gate](../plugins/capability/darrow-readiness-gate/README.md): assess whether a request is ready to implement.
- [Review](../plugins/capability/darrow-review/README.md): review a bounded change or independently verify repairs.
- [Adaptive Goal](../plugins/orchestration/darrow-adaptive-goal/README.md): explicitly execute bounded engineering work with acceptance accounting.
- [Explanation](../plugins/capability/darrow-explanation/README.md): show architecture, ownership, call flow, or state in conversation.
- [Information Architecture](../plugins/foundation/darrow-information-architecture/README.md): set up or audit agent guidance and host integration, or inspect context usage.
- [Ticket-to-PR](../plugins/task-recipe/darrow-ticket-to-pr/README.md): explicitly deliver one ticket through a PR and required green CI.
- [Documentation Drift](../plugins/task-recipe/darrow-documentation-drift/README.md): explicitly check documentation against authoritative sources and file verified correction tickets.

These are the ten entries in the [marketplace manifest](../.claude-plugin/marketplace.json).
Matt contains 16 selected skills and pstack contains 33. Their explicit-only
workflows stay explicit. Ticket-to-PR supplies publication authority and required
CI to Adaptive Goal, which owns continuation through completion.
Review is independently usable; acceptance also needs criterion-specific evidence.
Git creates the complete PR without requiring Explanation.

Use configured tracker guidance and native tools for issue operations. Maintain
ADRs and their catalog as ordinary documents with domain-modeling guidance.
There is no shipped automation plugin, general troubleshooting plugin or
general scheduler framework.

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
  delegate the bounded work. Recipes cover ticket delivery and documentation-drift investigation.
- **Automation** describes admission under explicit recurring authority. No
  automation plugin currently ships. Task recipes and their native owners retain
  engineering work.

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
