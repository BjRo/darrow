# darrow — Product Specification

## 1. What darrow is

darrow is a reusable, multi-runtime **agentic delivery factory**: a kernel of agent-neutral templates (phases, rules, skills, personas) that is forward-generated into runtime-optimized setups for Claude Code and Codex (Pi later), and distributed as plugins from a custom marketplace hosted in this repository.

The domain app it builds is irrelevant to darrow; any project is a workload.

**Runtimes:** Claude Code and Codex are first-class. Pi is on the roadmap, not an immediate goal.

## 2. Baseline factory (proven elements we build on)

### High-level features
- **8-phase delivery pipeline**: refine → challenge → implement → QA → review → rework → codify → post-merge. Same contract on every runtime.
- **Living spec ("beans")**: tickets as markdown files in-repo (`.beans/`), versioned with code; commit-msg hook enforces that app changes touch beans.
- **Glob-routed rules + ADRs**: rules matched to file paths (read-before-edit), append-only decision log; auto-generated rule index.
- **Personas**: backend / frontend / QA / UX engineer lenses used in the challenge and review phases.
- **Guard CLI**: `issue`, `guard`, `run`, `dev` bin facade for branch/commit/push gates and area-aware lint/test.
- **QA evidence**: visual proof per issue in `.demos/`; codify blocked without it.
- **Lifecycle hooks**: shell hooks for rule sync, issue priming, completion validation, pre-bash dispatch.

### How the elements were set up
- A shared core (`.agent-shared/`) as canonical source of truth: project topology, rules, personas, normative phase contracts, shared bin/lib.
- Each runtime (`.claude/`, `.codex/`, `.pi/`) as a thin adapter mirroring the shared core (agents, hooks, settings).
- Parity enforced by a large hand-maintained adapter contract + validator.

**Core weakness darrow fixes:** parity by mirroring and hand-maintained contracts. darrow replaces mirrors with generation.

## 3. Architecture: kernel → forward generation → marketplace

Decision: **B+C hybrid** (deterministic generator + pre-generated marketplace artifacts).

One repo (darrow) contains:

1. **Kernel** — agent-neutral templates with markers (e.g. `<ARGUMENTS>`, `<PROJECT>`, `<AREAS>`). Phases, rules, skills, personas, hook logic live here exactly once.
2. **Generator** — deterministic CLI that substitutes markers and emits runtime-optimized setups (scripts, markdown, configs) per target: token-, tool-call- and agent-optimized for each runtime. Path tooling runs only at generation time.
3. **Builder skill** — thin wrapper shipped as a plugin; interviews the target project (name, areas, ports, commands, runtimes) and feeds answers to the generator. LLM does judgment; the CLI does mechanics.
4. **Marketplace** — same repo hosts the generated Claude and Codex plugin variants; consumers point their marketplace config here.

**Modularity: capability = plugin = opt-in unit.** Each capability ships as its own plugin (`darrow-git`, `darrow-pipeline`, `darrow-tickets`, …) with a matching capability spec (`docs/specs/<capability>.md`) and eval suite. Consumers adopt per capability — e.g. keep their own git conventions but use the pipeline. Cross-plugin references go through intent ("create a branch for issue X"), never assume a sibling plugin is installed; inter-capability contracts live in the specs.

Loop: edit kernel → generate → variants land in marketplace dir → commit → consumers update plugin. Kernel bump in a target project = regenerate + review diff (idempotent).

Dogfooding: darrow develops itself with its own generated setup.

## 4. Features

### F1 — Delivery pipeline (inherited, open to revision)
The 8-phase pipeline is the base. Steps and orchestration may change during the rebuild; the kernel defines phase contracts, the generator emits runtime bindings. Phases exchange state via issue workspaces (F5a), not a single shared document. The pipeline shape itself is under question — see R3; treat the current chain as baseline to beat, not settled design.

### F2 — Skill evals (new)
Every skill in the kernel has an eval suite. CI **gates** kernel changes on passing evals. Evals are also the optimization loop: skills are iterated against their evals (skill-creator style benchmarking).

Eval runner: custom, thin (Bun/TS), harness adapters per runtime (Claude headless, Codex exec; later Pi). Cases are declarative fixtures + outcome assertions (git state, files), tracing to capability-spec invariants; LLM-judge only for qualitative checks. Requirements:
- **Multi-metric**: each run records accuracy, wall time, token count; optimization target selectable per run.
- **Model-pinned**: runs execute against explicit models (matrix: case × harness × model); results keyed accordingly. CI gates on a pinned model list; comparison mode also compares across models.
- **Statistically relevant**: N trials per case; pass = pass-rate threshold, plus mean/p95 for time and tokens. Never single-run green.
- **Comparison mode**: baseline vs candidate skill version with per-metric deltas — the optimize loop.
- **Budget guard**: per-suite cost cap; sampling mode for iteration, full mode for CI gate.

### F3 — Git utility skills (new)
`create-branch`, `create-commit`, `create-pr` — intent-triggered skills that consolidate the git workflow across the pipeline and ad-hoc use.

### F4 — Improved ideate skill (new)
Rework ideate using obra-superpowers brainstorm and related skills as reference material.

### F5 — Living spec, rules, ADRs (inherited, CLI-wrapped)
Beans, glob-routed rules, and ADRs carry over. Templates live in the kernel; instances live in target projects. Skills never touch bean files directly: a **ticket CLI** is the interface for all issue operations (create, read, status, update) and encapsulates beans underneath — the backing store is swappable without touching skills.

### F5a — Issue workspaces (new)
Per-issue artifact directory replaces the read-modify-write cycle on one growing ticket document:

```
.darrow/issues/<issue-id>/
  refine.md, challenge.md, qa-evidence.md, review.md, ...
```

Each phase/skill reads only the artifacts it needs and writes its output as a separate small document. Downstream phases load one small file, not the whole ticket history. Cuts token load and write contention across the pipeline.

### F6 — Custom marketplace (new)
Distribution channel for darrow's own generated plugins (Claude + Codex). Hosted in this repo.

## 5. Research spikes (outcomes become ADRs)

- **R1 — Plan-prompt learning**: HTTP-proxy Claude Code to inspect the native plan prompt; harvest techniques to improve the refine phase.
- **R2 — Native review vs custom lenses**: evaluate whether native review functionality (e.g. `codex review`, Claude Code `/code-review`) beats the baseline review + challenge persona lenses; adopt, blend, or keep.
- **R3 — Orchestration fit for frontier models**: the fixed phase chain (idea → refine → challenge ⇄ refine → implement → review → QA …) was designed as scaffolding for weaker models. Frontier models (Fable/Opus 4.8+, GPT-5.x) self-plan and self-correct better — prescribed process may now cost more than it catches. Explore alternatives before hardening the pipeline into the kernel:
  - *Outcome gates instead of phase sequence*: define required artifacts + quality gates (plan reviewed, tests green, QA evidence, review passed); agent chooses its own path to satisfy them.
  - *Dynamic depth*: model triages issue size and picks which phases to run; small change skips challenge/personas.
  - *Verification-heavy, process-light*: fewer prescribed steps up front, more adversarial checking at the end (multi-agent verify, eval-style acceptance).
  - *Harness-native orchestration*: deterministic workflow engines / subagent fan-out instead of sequential skill invocations.
  Decision criteria: measured quality + token cost + wall-clock on real issues vs the baseline pipeline. Outcome becomes the ADR that fixes F1's phase set.

## 6. Non-goals

- Pi adapter at launch (roadmap only).
- Building a domain application inside darrow.
- Curating third-party plugins in the marketplace (own kernel distribution only, for now).
- Hand-maintained parity contracts or per-runtime mirrors.

## 7. Milestones

- **M0 — Plugin infra + git plugin + eval loop**: marketplace scaffold; `darrow-git` plugin with `create-branch`, `create-commit`, `create-pr` (F3), capability spec, and full eval suites (F2). Skills authored directly in the plugin; darrow dogfoods via its own marketplace. Small surface to prove the skill → eval → optimize loop and pick the eval harness before scaling to the pipeline.
- **M1 — Kernel + generator + builder skill** (tentative): extract kernel from the M0 plugin; generator emits plugin variants (Claude, Codex) into the marketplace.
- **M2 — Pipeline phases + issue workspaces + ticket CLI** (tentative).
- **M3 — Marketplace publishing** (tentative).
- Research spikes (R1, R2) run opportunistically alongside.

## 8. Open questions

- Final phase set and orchestration model (agent-led with gates vs script-driven workflow engine).
- Generated files in target projects: committed vs regenerated (leaning committed + drift check in CI).
- How eval gating integrates with the marketplace release flow.
- Marker/template syntax and generator implementation language.
- Language for shipped CLIs (ticket CLI, guards) — TS vs Go static binary; decide when the first shipped CLI lands. Eval runner: decided TS/Bun.
