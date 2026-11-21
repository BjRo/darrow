# ADR-0015: Curate upstream workflows and retire duplicate providers

Status: Accepted
Date: 2026-11-21
Summary: Curate pinned MIT upstream workflows and retain Darrow-specific capabilities instead of maintaining duplicate standalone providers.

## Context

Maintaining parallel discovery, writing, TDD and decision-management providers
duplicates upstream work and increases the number of adoption choices.
The completed lineup change already selected curated bundles and focused
Darrow capabilities. This record preserves that choice without its migration reports.

## Decision

Package the selected Matt Pocock workflows and pstack's unslop as pinned,
independently installable MIT bundles. Preserve complete author notices, support
files, source pins and local adaptation records inside each package. The Darrow
principle adaptations retain their recorded local lineage; the unslop source
pin does not establish their upstream revision. Update deliberately when needed.

Matt supplies discovery, domain modeling, writing, TDD and approved implementation.
Pstack supplies unslop and optional principles routing. Use configured tracker
guidance and native tools for issue operations, and ordinary documents for ADRs.
Retire the separate Discovery, TDD, Principles, Verification, Tickets, Decisions,
Skill Authoring and Ticket Pipeline providers. Keep no executable aliases.

Adapted implement preserves approved intent, agreed test seams and inherited
permissions while composing through one Adaptive Goal owner. Local implementation
defaults to a local commit; publication requires explicit or inherited authority.
Ticket-to-PR supplies its delivery envelope. Capability refusals remain binding.

Codex is the primary development host. Codex and Claude Code are required targets
for the curated bundles and shared workflows, with evidence scoped to the tested
workflow. Artificer's documented Claude completion limitation remains. Installation
alone grants no execution or publication authority and never rewrites user-owned
principle tables or custom guidance.

## Authority and provenance

Repository fact: this records the implemented, previously accepted choice in
[the lineup commit](https://github.com/BjRo/darrow/commit/2258e604793a8b405dd290ea275e9e1a23e7d716).
The maintainer requested retaining useful choices as ADRs on 2026-11-21.

## Consequences

Trust upstream maintenance for unchanged workflows. Check packaged contents,
license closure and host entrypoints, and focus behavioral evals on Darrow's
adaptations. The bundle licenses do not relicense unrelated Darrow content.
Retiring source payload does not uninstall old cached user installations.
