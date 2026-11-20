# Curated upstream bundles: dependencies and host adaptations

Research for [Which adaptations and dependencies do the proposed upstream bundles require?](https://github.com/BjRo/darrow/issues/325), under [Simplify Darrow around curated upstream skills](https://github.com/BjRo/darrow/issues/318). Evidence checked November 20, 2026.

The proposed bundles can stay close to upstream, but copying the shortlist alone is insufficient. Matt's workflows invoke two additional discovery skills and point to a setup skill when tracker configuration is absent. They also need supporting files and host-aware skill/delegation calls. Pstack's selected leaves contain two conditional dependencies: `benchmark-checklist` and `typescript-best-practices`. Its explicit-only activation also needs a deliberate bridge to Darrow's authorized principle router. These are prerequisites and choices for the final lineup, not additions silently selected by this note.

This note records **source inspection**, not live host verification. No skill installation, host-entrypoint smoke test, behavioral eval, or upstream workflow execution was performed. Upstream manifests and adapters show intended support; they do not prove a successful Codex or Claude Code run.

## Accepted scope and evidence pins

The accepted scope is two independently installable plugins, `darrow-matt-pocock` and `darrow-pstack`, pinned snapshots with demand-driven updates, and minimal import glue. Both bundles, including Darrow adaptations moved into them, will be MIT with full upstream notices and prominent credits, explicitly outside the remaining repository's BUSL. Unchanged upstream behavior relies on upstream maintenance/community evidence; import checks cover structure/license and bundle entrypoints on each host. Material local adaptations and integrations need behavioral evidence. These are supplied decisions, recorded in [Which upstream skills should Darrow curate?](https://github.com/BjRo/darrow/issues/320#issuecomment-7041645770), [How should curated bundles receive upstream updates?](https://github.com/BjRo/darrow/issues/322#issuecomment-7041870940), and [What evidence is enough to support both hosts?](https://github.com/BjRo/darrow/issues/323#issuecomment-7042106915). This note does not choose the final subset or the future disposition of Darrow Verification.

| Source                                | Inspected immutable revision/version                                                       | Evidence                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Matt Pocock skills                    | `abeeaf95660ba9e8b7c753eb38f441ca707a8823`; plugin `1.3.2`                                 | [Manifest][m-manifest], [README][m-readme]                                                      |
| Lauren Tan pstack in `cursor/plugins` | `aaeb0ea3a0584995aa8f55ce44c6c5259414b896`; plugin `0.15.46`                               | [Manifest][p-manifest], [Cursor manifest][p-cursor-manifest]                                    |
| Vercel `skills` published installer   | `skills@1.9.0`; npm `gitHead` `50894c1d98bc45ca1ab127213e59d6525065b5e7`; Node `>=22.20.0` | [Release package][v-package], [versioned npm metadata](https://registry.npmjs.org/skills/1.9.0) |
| Darrow local contract baseline        | `de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`                                                 | [Design][d-design], [Plugin development][d-plugins]                                             |

The installer repository's current main was `57217cf86ba38148a57af9e90d14a4c049558330`; the recipe below deliberately follows the published `1.9.0` source instead. npm metadata reported tarball `https://registry.npmjs.org/skills/-/skills-1.9.0.tgz` and integrity `sha512-8p27fa6SnpDLrGIpqbhNIHg8+uukR2lg/0qDoKPk85pU3/zyXiU67tEjvXHLrzybBefIAWpWZ2Oc+enlvSSVqg==`. Record that alongside upstream revision and acquisition command, rather than interpreting an installer version as a content pin. [Versioned npm metadata](https://registry.npmjs.org/skills/1.9.0).

## Matt Pocock inventory

Paths below are under upstream `skills/`. Copy each complete skill directory, including its `SKILL.md` and `agents/openai.yaml`; the support column lists the other files at this revision. “Intent” means upstream omits `disable-model-invocation`; “Explicit” means it sets that field to `true`. These are upstream activation declarations, not a verified cross-host enforcement claim. The last column describes necessary compatibility work or an implementation constraint, not completed changes. [Manifest][m-manifest], [invocation mechanics][m-mechanics].

| Skill and source directory                                                                                      | Other required support            | Invoked or conditional dependencies                                                                       | Activation                                     | Host/integration adaptation                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [grilling][m-grilling] · `productivity/grilling/`                                                               | —                                 | No invoked skill; fresh fact-finding subagents                                                            | Intent: stress-test/grill                      | Map fresh-context delegation to the host; preserve human decision rounds.                                                                                         |
| [wayfinder][m-wayfinder] · `engineering/wayfinder/`                                                             | —                                 | research, prototype, grilling, domain-modeling; configured tracker; skills named dynamically in map Notes | Explicit                                       | Map skill calls/delegation and tracker operations; preserve one-ticket boundary and publication authority.                                                        |
| [grill-with-docs][m-grill-with-docs] · `engineering/grill-with-docs/`                                           | —                                 | grilling + domain-modeling                                                                                | Explicit                                       | Map both skill calls; do not broaden into implicit planning.                                                                                                      |
| [domain-modeling][m-domain-modeling] · `engineering/domain-modeling/`                                           | ADR-FORMAT.md; GLOSSARY-FORMAT.md | No invoked skill                                                                                          | Intent: terminology/glossary/ADR               | Honor established glossary/ADR scope and format; reconcile Darrow decision ownership.                                                                             |
| [diagnosing-bugs][m-diagnosing-bugs] · `engineering/diagnosing-bugs/`                                           | scripts/hitl-loop.template.sh     | No invoked skill                                                                                          | Intent: diagnosis/debug/broken/slow            | Keep redaction and human terminal loop; local runtime tools depend on the bug.                                                                                    |
| [to-spec][m-to-spec] · `engineering/to-spec/`                                                                   | —                                 | Configured tracker and labels; human confirmation of test seams                                           | Explicit                                       | Keep seam approval before publication; map configured tracker access.                                                                                             |
| [to-tickets][m-to-tickets] · `engineering/to-tickets/`                                                          | —                                 | Configured tracker and labels; human-approved breakdown                                                   | Explicit                                       | Keep approval, native blocking where available, one file/issue per ticket, and parent-preservation rule.                                                          |
| [wizard][m-wizard] · `engineering/wizard/`                                                                      | template.sh                       | No invoked skill                                                                                          | Intent: human-only setup/migration steps       | Retain Bash template and static checks; human runs interactive script; gh needed only for GitHub writes.                                                          |
| [codebase-design][m-codebase-design] · `engineering/codebase-design/`                                           | DEEPENING.md; DESIGN-IT-TWICE.md  | No named skill; parallel fresh design agents in DESIGN-IT-TWICE branch                                    | Intent: module/interface/seam design           | Map delegated design agents only when that branch is reached.                                                                                                     |
| [improve-codebase-architecture][m-improve-codebase-architecture] · `engineering/improve-codebase-architecture/` | HTML-REPORT.md                    | codebase-design; grilling; domain-modeling                                                                | Explicit                                       | Map fresh exploration/design agents and Skill calls; preserve user candidate choice. HTML report uses CDN Tailwind/Mermaid and OS opener.                         |
| [writing-for-agents][m-writing-for-agents] · `productivity/writing-for-agents/`                                 | SKILL-MECHANICS.md                | No external invoked skill; SKILL-MECHANICS links back to SKILL.md                                         | Intent: writing agent instructions/skills      | Preserve both files. Host invocation mechanics need host-specific interpretation.                                                                                 |
| [wait-what][m-wait-what] · `productivity/wait-what/`                                                            | —                                 | No invoked skill; existing glossary/map if present                                                        | Explicit                                       | Keep re-pitch behavior and existing domain vocabulary.                                                                                                            |
| [tdd][m-tdd] · `engineering/tdd/`                                                                               | tests.md; mocking.md              | codebase-design when interface shape is open; code-review reference for later refactoring                 | Intent: test-first/red-green/integration tests | Preserve pre-agreed seams. Resolve review integration by intent rather than assuming a bundled upstream reviewer.                                                 |
| [implement][m-implement] · `engineering/implement/`                                                             | —                                 | Upstream: tdd, code-review, configured tracker when ticket supplied                                       | Explicit                                       | Material LOCAL ADAPTATION: explicit approved-ticket/spec recipe; Adaptive Goal continuation; selected TDD/Review/Git capabilities and principles-first by intent. |

### Transitive closure and runtime dependencies

The shortlist contains 14 skills. Its named, non-review dependencies include **`research`**, **`prototype`**, and conditionally **`setup-matt-pocock-skills`**. The first two are called by wayfinder; the third supplies configuration required by wayfinder, to-spec, and to-tickets when the repository does not already provide it. Setup is an ordinary manifest-listed engineering skill at this snapshot. All three also have `agents/openai.yaml`. [Wayfinder][m-wayfinder], [setup][m-setup], [manifest][m-manifest].

| Added or conditional surface                                                  | Exact support files beyond `SKILL.md` and `agents/openai.yaml`                                                  | Closure and effects                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [research][m-research] · `engineering/research/`                              | None                                                                                                            | Fresh background researcher writes one cited Markdown note. Its instruction to spawn is a delegation requirement; an already-delegated researcher must not recursively spawn merely to recreate the same role.                                                                |
| [prototype][m-prototype] · `engineering/prototype/`                           | `LOGIC.md`, `UI.md`                                                                                             | Both branches return to the main skill; no further named skill dependency. Includes repository code changes, a throwaway branch/commit, and an issue context pointer after human feedback.                                                                                    |
| [setup-matt-pocock-skills][m-setup] · `engineering/setup-matt-pocock-skills/` | `issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`, `triage-labels.md`, `domain.md` | Human-confirmed per-repository tracker/domain setup; writes guidance and docs. `triage` detection is optional and does not require importing triage.                                                                                                                          |
| [code-review][m-code-review] · `engineering/code-review/`                     | None                                                                                                            | Upstream implement calls it and TDD points to its review stage. It requires a tracker, a resolvable fixed point, and a nonempty committed diff; it launches fresh Standards/Spec readers. Importing it is a conditional lineup choice, not accepted merely by this reference. |

Support references were followed through the named directories: prototype's two branches link back to the skill, design-it-twice links to deepening and its skill, and writing-for-agents links to SKILL-MECHANICS which links back. There is no larger hidden file tree for those references at this pin. [Prototype logic][m-prototype-logic], [prototype UI][m-prototype-ui], [design-it-twice][m-design-twice], [deepening][m-deepening], [mechanics][m-mechanics].

Wayfinder also invokes whichever skills the map's `Notes` names. That is an open runtime dependency, so no static import list can guarantee every possible map is executable. The invocation must resolve those skills and their prerequisites, or report the missing capability. Its core named closure is finite; user-authored Notes is not. [Wayfinder][m-wayfinder].

### Tracker setup is part of portability

Setup is a prompt workflow. It explores remotes and existing guidance, asks for tracker selection, confirms draft files, then writes `docs/agents/issue-tracker.md` and `docs/agents/domain.md`. It writes `triage-labels.md` and creates missing configured labels only when `triage` is installed. It prefers editing existing `CLAUDE.md`, then existing `AGENTS.md`, and asks which to create when neither exists. For a repository that runs both hosts, a pointer placed only in CLAUDE.md needs a reachable equivalent or shared pointer for Codex; existing guidance must be preserved. [Setup][m-setup].

| Tracker configuration                | Source-observed requirements and operations                                                                                                                                                                                                                                                | Darrow implication                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GitHub template][m-tracker-github]  | `gh`; reachable repository; issues/comments/labels; native sub-issues and blocking where available, otherwise documented fallbacks; claim via assignee; resolve via comment, close, map pointer. Template cites `gh` 2.94+ for direct sub-issue/blocking flags and supplies API fallbacks. | Treat those CLI flags as template instructions to check against the chosen runtime, not commands live-verified here. Preserve target-repository checks. Tracker provider and permissions must already be bound. |
| [GitLab template][m-tracker-gitlab]  | `glab`; project-specific issue reads/writes and relationships described in the template.                                                                                                                                                                                                   | Do not silently redirect an established GitLab workflow to Darrow's GitHub-only ticket adapter.                                                                                                                 |
| [Local template][m-tracker-local]    | Markdown issues under `.scratch/<feature>/`; explicit file conventions for wayfinding state/claims/relationships.                                                                                                                                                                          | Preserve local mode; do not create remote issues just because GitHub tools are installed.                                                                                                                       |
| [Triage vocabulary][m-triage-labels] | Five canonical roles have configurable strings.                                                                                                                                                                                                                                            | Setup skips this file without triage, but to-spec/to-tickets still use `ready-for-agent`. Decide how that label is supplied or mapped without forcing the unselected triage skill.                              |

The GitHub source's direct CLI flag requirements were not independently checked against a live `gh` version in this task. Access, authentication, sub-issue/dependency availability, chosen tracker, existing labels, and guidance locations remain deployment prerequisites. To-spec still asks the human to confirm test seams despite its “no interview” synthesis posture. To-tickets asks for breakdown approval before publication. Those are substantive upstream gates to preserve. [Setup][m-setup], [to-spec][m-to-spec], [to-tickets][m-to-tickets].

### Delivery, assurance, and publication boundaries

Upstream implement is explicit-only, fetches a supplied ticket, calls TDD at pre-agreed seams, runs checks, calls code-review, then commits the current branch. Its review source advertises WIP but fixes its actual command to `git diff <fixed-point>...HEAD`; uncommitted work is absent from that diff. Calling it before the final commit can therefore miss the work implement just created. Darrow Review explicitly supports an unambiguous uncommitted scope and working-tree layers. Preserve that distinction when choosing the local integration. [Implement][m-implement], [upstream review][m-code-review], [Darrow Review][d-review].

The accepted local implement recipe must preserve the explicit delivery envelope: approved ticket/spec intake; continuation delegated to Adaptive Goal; TDD, Review, Git, and principles-first selected through public intent; inherited seams reused, with human confirmation only for a new or changed seam. Default local commit is accepted; push and PR creation require explicit authority in that invocation. Adaptive Goal uses Verification as coordinator with independent Review readers under the current contract. The final disposition of `darrow-verification` remains open, so this note does not convert that implementation detail into a permanent new bundle dependency. [Darrow task-recipe/independent-plugin contract][d-design], [Adaptive Goal source][d-adaptive-goal], [What evidence is enough to support both hosts?](https://github.com/BjRo/darrow/issues/323#issuecomment-7042106915).

Self-contained plugins may cooperate through advertised intent; they may not read sibling plugin files or assume a sibling is installed. Thus the recipe needs clear missing-capability behavior, and TDD's upstream `code-review` reference needs to be reconciled with the selected Review provider. Do not acquire a duplicate reviewer solely to satisfy an unexamined string reference. [Darrow design][d-design], [plugin development][d-plugins], [TDD][m-tdd].

Wayfinder's **chart-a-new-map** step explicitly launches research workers on throwaway branches and tells them to push without a PR. Its **work-through-an-existing-map** path claims and resolves one ticket and does not repeat that research-push instruction. Prototype separately requests a throwaway branch/commit and issue pointer. These are different effects and cannot be flattened into blanket publication authority. Repository `Never push unless explicitly asked` and the caller's actual publication authority still govern each invocation. A local adaptation must preserve those boundaries and report an unavailable publication step. This research ticket itself supplied no independent push authority. [Wayfinder][m-wayfinder], [prototype][m-prototype], [Darrow repository instructions][d-agents].

## Pstack inventory and conditional closure

The proposed upstream subset is `unslop` plus all **24** `principle-*` leaves. Every one sets `disable-model-invocation: true`. Each raw upstream directory contains only `SKILL.md`; no agents, scripts, model rules, or playbooks are required by the prose-only leaves. The table enumerates every leaf so closure is reviewable. Source paths are under `pstack/skills/`. [Unslop][p-unslop], individual source rows below.

| Selected upstream skill                                                                                    | Additional dependency / portability finding                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [unslop][p-unslop]                                                                                         | No invoked skill or host-specific tool. Explicit prose editing.                                                     |
| [principle-attack-the-premise][p-principle-attack-the-premise]                                             | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-boundary-discipline][p-principle-boundary-discipline]                                           | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-build-the-lever][p-principle-build-the-lever]                                                   | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-encode-lessons-in-structure][p-principle-encode-lessons-in-structure]                           | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-exhaust-the-design-space][p-principle-exhaust-the-design-space]                                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-experience-first][p-principle-experience-first]                                                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-explain-the-number][p-principle-explain-the-number]                                             | For performance numbers, run `benchmark-checklist`; eval-result branch has its own evidence questions.              |
| [principle-fix-root-causes][p-principle-fix-root-causes]                                                   | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-foundational-thinking][p-principle-foundational-thinking]                                       | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-guard-the-context-window][p-principle-guard-the-context-window]                                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-laziness-protocol][p-principle-laziness-protocol]                                               | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-make-operations-idempotent][p-principle-make-operations-idempotent]                             | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-migrate-callers-then-delete-legacy-apis][p-principle-migrate-callers-then-delete-legacy-apis]   | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-minimize-reader-load][p-principle-minimize-reader-load]                                         | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-model-the-domain][p-principle-model-the-domain]                                                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-never-block-on-the-human][p-principle-never-block-on-the-human]                                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-outcome-oriented-execution][p-principle-outcome-oriented-execution]                             | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-prove-it-works][p-principle-prove-it-works]                                                     | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-redesign-from-first-principles][p-principle-redesign-from-first-principles]                     | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-separate-before-serializing-shared-state][p-principle-separate-before-serializing-shared-state] | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-sequence-verifiable-units][p-principle-sequence-verifiable-units]                               | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-subtract-before-you-add][p-principle-subtract-before-you-add]                                   | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-test-behavior-not-implementation][p-principle-test-behavior-not-implementation]                 | No named skill dependency; preserve explicit or authorized-router entry.                                            |
| [principle-type-system-discipline][p-principle-type-system-discipline]                                     | For TypeScript syntax, consult `typescript-best-practices`; that skill points back here and to boundary-discipline. |

Two conditional support surfaces close those references. They are **implementation prerequisites or explicit adaptation choices**, not automatically selected additions to the shortlist:

| Conditional dependency                    | Exact files                                                           | Transitive closure / host detail                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [benchmark-checklist][p-benchmark]        | `skills/benchmark-checklist/SKILL.md`                                 | No further invoked skill. References Perf/Hillclimb as consumers, not mandatory imports. Uses `uptime`, `nproc`, and example profiling tools; `nproc` needs a platform equivalent where unavailable. Do not require Linux-only profiler examples on every host. |
| [typescript-best-practices][p-typescript] | `skills/typescript-best-practices/SKILL.md`, `references/patterns.md` | Routes to type-system-discipline and boundary-discipline, already in the 24. Carries `paths: ["**/*.ts", "**/*.tsx"]` plus explicit-only metadata. Preserve the reference file; verify host handling of `paths` before relying on it as activation.             |

Read as a dependency graph, the only cycle is type-system-discipline → typescript-best-practices → type-system-discipline; boundary-discipline terminates it. Follow the needed guidance once rather than recursively invoking the same reference forever. Full source scan of the selected leaves, those two conditional skills, and `patterns.md` found no further named skill dependency. [Number principle][p-principle-explain-the-number], [benchmark checklist][p-benchmark], [type principle][p-principle-type-system-discipline], [TypeScript skill][p-typescript], [patterns][p-typescript-patterns].

### Keep the Darrow router without importing poteto-mode

`principles-first` and `setup-principles` are identifiable Darrow extensions to move into the MIT curated plugin, together with `principles-first/assets/default-principles.md`. Their routing contract selects personal, worktree, or bundled tables; selected files replace rather than merge; custom references resolve beside the selected table; missing guidance and invalid configuration have distinct behavior. Setup preserves declined/deleted routes and requires scope for configuration. Moving only the skill entrypoints would omit the default table and break setup/default routing. [Principles-first][d-principles-first], [setup-principles][d-setup-principles], [default table][d-default-principles].

The upstream leaves' explicit-only flags must not be blanket-flipped to intent activation. Darrow's router deliberately authorizes reading a matching contained leaf or host-advertised guidance within an existing task. Pstack's own Claude adapter similarly tells consumers to read skill files because the Skill tool refuses most of them. Preserve the explicit boundary for independent leaf activation and document the contained-read bridge for authorized routing. The router must retain removal/customization behavior rather than allowing a leaf description to restore a deleted route. Host-entrypoint smoke checks must establish this on both hosts. [Upstream adapter][p-adapter], [Darrow principles-first][d-principles-first].

`poteto-mode`, `setup-pstack`, pstack agents, Custom Modes, Automations, and `cursor-team-kit` are outside this closure. They belong to the full upstream workflow, not these leaves. Poteto-help documents that full pstack is Cursor-first and other tools may read Agent Skills while Cursor-specific workflows may fail. It is evidence about support and routing, not an additional selected skill. [Poteto-help][p-help], [pstack README][p-readme].

## Host support and necessary adaptations

| Bundle/host          | Source-observed support                                                                                                                                                                                                                                                                     | Necessary local work                                                                                                                                                                                                                                                                   | Live-verified here |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Matt / Codex         | Upstream README supplies Codex marketplace/plugin commands; plugin has a 27-skill Claude-compatible manifest and per-skill `agents/openai.yaml`. There is no separate `.codex-plugin/` tree in the inspected snapshot. [README][m-readme], [manifest][m-manifest], [example YAML][m-openai] | Create Darrow's contained Codex manifest pointing at `./skills/`; map literal Skill calls to available host skill reads/invocation and fresh-agent tools; confirm explicit-only enforcement, setup guidance reachability, and name collisions with existing Darrow skills.             | No                 |
| Matt / Claude Code   | Upstream ships `.claude-plugin/plugin.json` and marketplace metadata and documents installation. [Manifest][m-manifest], [marketplace][m-marketplace], [README][m-readme]                                                                                                                   | Curated manifest includes closure, keeps explicit-only fields, and resolves namespaced internal calls. Fresh/background research, foreground review, and host request-user tools need schema-correct mapping.                                                                          | No                 |
| Pstack / Claude Code | Marketplace points to generated `harness/pstack/claude-code`; generator copies skills/agents/guide/adapter/README/license and prepends an adapter read to skill bodies. [Marketplace][p-marketplace], [generator][p-generator], [generated leaf][p-generated]                               | Either preserve selected generated bodies plus their adapter path, or use raw bodies with a contained Darrow host bridge. Record that packaging choice. Do not copy generated bodies while dropping their adapter. Selected raw leaves do not need the entire workflow's agents/guide. | No                 |
| Pstack / Codex       | Upstream help says other tools can read Agent Skills but warns about Cursor-specific workflows. No Codex adapter is documented in the inspected pstack entrypoints. [Help][p-help], [Cursor manifest][p-cursor-manifest]                                                                    | Supply the Darrow Codex manifest and routing bridge. For selected raw prose leaves, most full-workflow tool/model/path mappings are unnecessary; conditional benchmark platform commands still matter.                                                                                 | No                 |

The upstream Claude adapter maps `Task` to `Agent`, AskQuestion to AskUserQuestion or plain text, optional todolists, skill execution to contained `Read`, role/model fields, rule paths, transcript paths, and Cursor-only skips. Those mappings are upstream intentions, not current-host schema guarantees. Inspect available tools before invoking them; do not send Cursor model slugs or unsupported fields to another host. For the selected raw leaves and unslop, importing model configuration would add unrelated dependencies. [Adapter][p-adapter].

Darrow requires matching semantic versions in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, with the latter pointing at `./skills/`. Bundle acquisition is not the same operation as installing loose skills into an end-user project. The packaged plugin manifests, local paths, licensing boundary, and the material adaptations remain Darrow work. [Plugin development][d-plugins].

## Proposed pinned acquisition and placement recipe

**Not executed.** The commands below illustrate the current shortlist plus Matt's named setup/discovery closure. They stage editable copies outside the checkout, never install into the user's active `.agents/skills`, and leave final plugin mutation for an authorized implementation. Matt recommends Vercel's installer for editable/manual-update copies; pinning the installer and source replaces `@latest` and default-branch drift. [Upstream installation][m-readme], [installer parser][v-source], [SHA fetch implementation][v-git].

Installer `add` supports `--skill`, `--agent`, `--copy`, and `--yes`. Codex's destination is `.agents/skills/<name>` under the current working directory; Claude Code's is `.claude/skills/<name>`. There is no arbitrary `--output`, `--dest`, or `--cwd` add flag. Unknown add options are ignored, so inventing one is especially unsafe. The supported staging mechanism is to change shell working directory first. [Add option parser][v-add], [argument parser][v-args], [agent destinations][v-agents], [installation paths][v-installer].

```sh
# Shell proposal. Requires Node >=22.20.0, npm/npx, Git, and network access.
set -eu
research_stage=$(mktemp -d "${TMPDIR:-/tmp}/darrow-upstream.XXXXXX")
mkdir -p "$research_stage/matt" "$research_stage/pstack"
(
  cd "$research_stage/matt" || exit 1
  npx --yes skills@1.9.0 add \
    'mattpocock/skills@abeeaf95660ba9e8b7c753eb38f441ca707a8823' \
    --agent codex --copy --yes \
    --skill grilling wayfinder grill-with-docs domain-modeling \
    diagnosing-bugs to-spec to-tickets wizard codebase-design \
    improve-codebase-architecture writing-for-agents wait-what tdd implement \
    research prototype setup-matt-pocock-skills
)
(
  cd "$research_stage/pstack" || exit 1
  npx --yes skills@1.9.0 add \
    'https://github.com/cursor/plugins/tree/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack' \
    --agent codex --copy --yes \
    --skill unslop principle-attack-the-premise principle-boundary-discipline \
    principle-build-the-lever principle-encode-lessons-in-structure \
    principle-exhaust-the-design-space principle-experience-first \
    principle-explain-the-number principle-fix-root-causes \
    principle-foundational-thinking principle-guard-the-context-window \
    principle-laziness-protocol principle-make-operations-idempotent \
    principle-migrate-callers-then-delete-legacy-apis principle-minimize-reader-load \
    principle-model-the-domain principle-never-block-on-the-human \
    principle-outcome-oriented-execution principle-prove-it-works \
    principle-redesign-from-first-principles \
    principle-separate-before-serializing-shared-state \
    principle-sequence-verifiable-units principle-subtract-before-you-add \
    principle-test-behavior-not-implementation principle-type-system-discipline
)
curl -fsSL \
  'https://raw.githubusercontent.com/mattpocock/skills/abeeaf95660ba9e8b7c753eb38f441ca707a8823/LICENSE' \
  -o "$research_stage/matt/LICENSE"
curl -fsSL \
  'https://raw.githubusercontent.com/cursor/plugins/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/LICENSE' \
  -o "$research_stage/pstack/LICENSE"

# Assemble package content in staging; manifests/adaptations come afterward.
matt_bundle="$research_stage/packages/darrow-matt-pocock"
pstack_bundle="$research_stage/packages/darrow-pstack"
mkdir -p "$matt_bundle/skills" "$pstack_bundle/skills"
cp -R "$research_stage/matt/.agents/skills/." "$matt_bundle/skills/"
cp -R "$research_stage/pstack/.agents/skills/." "$pstack_bundle/skills/"
cp "$research_stage/matt/LICENSE" "$matt_bundle/LICENSE"
cp "$research_stage/pstack/LICENSE" "$pstack_bundle/LICENSE"
```

Both full 40-character `owner/repo@SHA` and `#SHA` refs are supported by the inspected parser; GitHub `tree/<ref>/<subpath>` is also supported. The pstack subpath avoids accidentally discovering the whole marketplace or its second generated harness tree. The installer copies selected skill directories recursively, with exclusions and symlink checks, but does not resolve invoked-skill closure or copy a repository-root license outside those directories. Hence the explicit lists and license steps. The installer algorithm is source-confirmed; this exact packaging command has not been run. [Source parser][v-source], [skill discovery][v-skills], [copy routine][v-installer].

After a final lineup decision, an implementation would add either conditional pstack skill directories in the same staging tree, or an explicitly recorded contained-reference adaptation. Likewise it would resolve the upstream code-review reference through the accepted local review integration or deliberately acquire that directory. No unspecified dependency should silently expand the final subset. [Pstack number/type dependencies][p-principle-explain-the-number], [TypeScript closure][p-typescript], [Matt implement][m-implement], [TDD][m-tdd].

Place the staged `.agents/skills/<name>/` copies into each new plugin's `skills/<name>/` without flattening nested `agents/`, `scripts/`, `references/`, or support files. Copy the fetched license into that plugin's local LICENSE, retain full upstream copyright/permission text, and add clear credits plus provenance: upstream repo/revision/path, installer version/gitHead, selected list, acquisition command, and local changes. Using `--agent codex` here is a neutral acquisition destination, not a claim that it produces both plugin manifests. [Installer copy/path behavior][v-installer], [Matt license][m-license], [pstack license][p-license], [Darrow packaging contract][d-plugins].

For a checked-out local source instead, the parser records a local source path; do not rely on that lock entry alone as an upstream revision record. Keep separate commit provenance and hashes for the imported directory and local adaptation diff. Preserve generated lock evidence as acquisition evidence, then delete only the staging directory owned by the importer after comparing all required files. [Local-source parsing][v-source], [lock-writing implementation][v-add].

The full upstream MIT notices name Matt Pocock and Lauren Tan respectively. MIT requires preserving the copyright and permission notices. Prominent credits, an explicit exclusion from Darrow's BUSL, and licensing Darrow adaptations in the curated bundles as MIT are accepted project choices in addition to that upstream notice requirement. Repository licensing documentation must be reconciled when the bundles are implemented; this research note changes no license or contribution contract. [Matt license][m-license], [pstack license][p-license], [current contribution terms][d-contributing], [How should curated bundles receive upstream updates?](https://github.com/BjRo/darrow/issues/322#issuecomment-7041870940).

## Follow-up decisions and implementation prerequisites

- Carry the two conditional pstack dependencies, or adapt their references to contained supporting material. Confirm exact final surfaces in [What final lineup should Darrow publish?](https://github.com/BjRo/darrow/issues/324); do not make them accidental additions.
- Implement the activation bridge for explicit pstack leaves under authorized principles-first routing, and select the raw-versus-generated Claude packaging route. Keep direct activation explicit and preserve custom route removals. The disposition of existing principle skills belongs to [Which existing Darrow plugins should survive?](https://github.com/BjRo/darrow/issues/321).
- Reconcile tracker setup's CLAUDE.md-first pointer and triage-label omission with a dual-host bundle that does not select triage. Preserve the user's chosen tracker and existing repository doc conventions.
- Resolve public skill-name collisions, upstream review references, missing Adaptive Goal/Review/Git/principles providers, and the future Verification disposition in the integration/final-lineup decisions. A plugin may not require sibling file access to work.
- Confirm the implementation's publication envelope for wayfinder research/prototype captures. Preserve approved publication actions precisely; installation alone grants none.

These choices do not reopen the accepted two-plugin, MIT, snapshot, demand-driven-update, or scoped-assurance decisions.

## Validation limits and next evidence

Source inspection covered the 14 Matt candidates, their named closure and supporting references, all 24 pstack leaves, unslop, both conditional dependencies, upstream metadata/adapters, the published installer source, and local Darrow boundary contracts. Repository HEADs and npm release metadata were read directly. External sources were also opened through web browsing. No upstream scripts, installer commands, skills, evals, or host workflows were executed.

Before declaring an implementation portable, check imported paths/license/provenance and smoke-test each packaged host entrypoint: discovery, explicit activation, authorized contained reads, selected supporting-file access, and tracker setup reachability. Behavioral checks should target material Darrow changes such as implement delegation/authority, router preservation, and changed host integration. This is the accepted assurance scope; it does not require rerunning full behavioral QA for each unchanged upstream skill. Any failures or unsupported host behavior must stay visible rather than being inferred away from manifests.

[m-grilling]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/productivity/grilling/SKILL.md
[m-wayfinder]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/wayfinder/SKILL.md
[m-grill-with-docs]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/grill-with-docs/SKILL.md
[m-domain-modeling]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/domain-modeling/SKILL.md
[m-diagnosing-bugs]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/diagnosing-bugs/SKILL.md
[m-to-spec]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/to-spec/SKILL.md
[m-to-tickets]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/to-tickets/SKILL.md
[m-wizard]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/wizard/SKILL.md
[m-codebase-design]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/codebase-design/SKILL.md
[m-improve-codebase-architecture]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/improve-codebase-architecture/SKILL.md
[m-writing-for-agents]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/productivity/writing-for-agents/SKILL.md
[m-wait-what]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/productivity/wait-what/SKILL.md
[m-tdd]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/tdd/SKILL.md
[m-implement]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/implement/SKILL.md
[p-principle-attack-the-premise]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-attack-the-premise/SKILL.md
[p-principle-boundary-discipline]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-boundary-discipline/SKILL.md
[p-principle-build-the-lever]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-build-the-lever/SKILL.md
[p-principle-encode-lessons-in-structure]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-encode-lessons-in-structure/SKILL.md
[p-principle-exhaust-the-design-space]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-exhaust-the-design-space/SKILL.md
[p-principle-experience-first]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-experience-first/SKILL.md
[p-principle-explain-the-number]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-explain-the-number/SKILL.md
[p-principle-fix-root-causes]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-fix-root-causes/SKILL.md
[p-principle-foundational-thinking]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-foundational-thinking/SKILL.md
[p-principle-guard-the-context-window]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-guard-the-context-window/SKILL.md
[p-principle-laziness-protocol]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-laziness-protocol/SKILL.md
[p-principle-make-operations-idempotent]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-make-operations-idempotent/SKILL.md
[p-principle-migrate-callers-then-delete-legacy-apis]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md
[p-principle-minimize-reader-load]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-minimize-reader-load/SKILL.md
[p-principle-model-the-domain]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-model-the-domain/SKILL.md
[p-principle-never-block-on-the-human]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-never-block-on-the-human/SKILL.md
[p-principle-outcome-oriented-execution]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-outcome-oriented-execution/SKILL.md
[p-principle-prove-it-works]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-prove-it-works/SKILL.md
[p-principle-redesign-from-first-principles]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-redesign-from-first-principles/SKILL.md
[p-principle-separate-before-serializing-shared-state]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-separate-before-serializing-shared-state/SKILL.md
[p-principle-sequence-verifiable-units]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-sequence-verifiable-units/SKILL.md
[p-principle-subtract-before-you-add]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-subtract-before-you-add/SKILL.md
[p-principle-test-behavior-not-implementation]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-test-behavior-not-implementation/SKILL.md
[p-principle-type-system-discipline]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/principle-type-system-discipline/SKILL.md
[m-manifest]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/.claude-plugin/plugin.json
[m-readme]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/README.md
[m-marketplace]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/.claude-plugin/marketplace.json
[m-mechanics]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/productivity/writing-for-agents/SKILL-MECHANICS.md
[m-setup]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/setup-matt-pocock-skills/SKILL.md
[m-research]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/research/SKILL.md
[m-prototype]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/prototype/SKILL.md
[m-code-review]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/code-review/SKILL.md
[m-prototype-logic]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/prototype/LOGIC.md
[m-prototype-ui]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/prototype/UI.md
[m-design-twice]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/codebase-design/DESIGN-IT-TWICE.md
[m-deepening]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/codebase-design/DEEPENING.md
[m-tracker-github]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md
[m-tracker-gitlab]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/setup-matt-pocock-skills/issue-tracker-gitlab.md
[m-tracker-local]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md
[m-triage-labels]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/setup-matt-pocock-skills/triage-labels.md
[m-openai]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/skills/engineering/tdd/agents/openai.yaml
[m-license]: https://github.com/mattpocock/skills/blob/abeeaf95660ba9e8b7c753eb38f441ca707a8823/LICENSE
[p-manifest]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/plugin.json
[p-cursor-manifest]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/.cursor-plugin/plugin.json
[p-marketplace]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/.claude-plugin/marketplace.json
[p-generator]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/scripts/generate-pstack-harness-trees.mjs
[p-generated]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/harness/pstack/claude-code/skills/principle-type-system-discipline/SKILL.md
[p-adapter]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/docs/harness/claude-code.md
[p-help]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/poteto-help/SKILL.md
[p-readme]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/README.md
[p-unslop]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/unslop/SKILL.md
[p-benchmark]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/benchmark-checklist/SKILL.md
[p-typescript]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/typescript-best-practices/SKILL.md
[p-typescript-patterns]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/skills/typescript-best-practices/references/patterns.md
[p-license]: https://github.com/cursor/plugins/blob/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack/LICENSE
[v-package]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/package.json
[v-source]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/source-parser.ts
[v-git]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/git.ts
[v-add]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/add.ts
[v-args]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/cli-args.ts
[v-agents]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/agents.ts
[v-installer]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/installer.ts
[v-skills]: https://github.com/vercel-labs/skills/blob/50894c1d98bc45ca1ab127213e59d6525065b5e7/src/skills.ts
[d-design]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/design.md
[d-plugins]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/plugin-development.md
[d-agents]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/AGENTS.md
[d-review]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-review/skills/code-review/SKILL.md
[d-adaptive-goal]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/SKILL.md
[d-principles-first]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-principles/skills/principles-first/SKILL.md
[d-setup-principles]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-principles/skills/setup-principles/SKILL.md
[d-default-principles]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-principles/skills/principles-first/assets/default-principles.md
[d-contributing]: https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/CONTRIBUTING.md
