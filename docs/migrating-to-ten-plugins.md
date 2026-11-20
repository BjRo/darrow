# Migrate to the ten-plugin lineup

Install the selected replacements and compatible survivor versions, remove only
confirmed superseded copies, then start fresh sessions. Marketplace removal does
not uninstall existing plugins or cached skills. This procedure changes no user
installation by itself; use the host commands only for your chosen targets.

## Replacement map

| Retired plugin           | Replacement and accepted change                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `darrow-discovery`       | `darrow-matt-pocock`: grilling, wayfinder, grill-with-docs, to-spec and to-tickets. Upstream invocation and human publication boundaries replace the former unified Discovery protocol.                         |
| `darrow-tdd`             | Matt's selected `tdd`, including its support files and inherited agreed test seams. The standalone Darrow reminder hook and protocol retire.                                                                    |
| `darrow-principles`      | `darrow-pstack`: the same 24 Darrow principle bodies, stable IDs, router, setup and default table, plus Lauren Tan's unslop.                                                                                    |
| `darrow-verification`    | Adaptive Goal accounts for acceptance criteria, evidence, gaps and assessment/repair history; independent Review supplies code assessment and repair verification. Review alone is not complete acceptance.     |
| `darrow-tickets`         | Configured tracker guidance and native provider tools. Specialized CRUD/read wrappers and the issue-template installer retire; established provider, labels and permissions remain authoritative.               |
| `darrow-decisions`       | Ordinary ADR/catalog documents with Matt domain-modeling guidance. Dedicated authority/lifecycle/catalog backend and validator retire. Preserve status, authority and supersession history.                     |
| `darrow-skill-authoring` | Matt writing-for-agents with repository plugin, documentation and eval standards. Useful shared checks remain; the dedicated authoring provider retires.                                                        |
| `darrow-ticket-pipeline` | Explicit adapted implement, Adaptive Goal and Ticket-to-PR as appropriate. The installable static pipeline and executable benchmark retire; [frozen evidence and source](research/retired-workflows.md) remain. |

The other eight published plugins are Git, Readiness Gate, Review, Adaptive Goal,
Explanation, Information Architecture, Ticket-to-PR and Artificer. The
[complete catalog](choosing-plugins.md) includes exactly those eight plus the Matt
and pstack bundles. There are no old aliases, executable compatibility shells or
parallel legacy lineup.

## Upgrade in order

1. Inspect installed names, versions and scopes with `codex plugin list` or
   `claude plugin list`. Save any local edits before replacement. Read each
   selected replacement's prerequisites and full notice/provenance records.
2. Refresh the Darrow marketplace using the [host installation instructions](installing-plugins.md).
   Install `darrow-matt-pocock@darrow` and/or `darrow-pstack@darrow` for the
   capabilities you use. Adopt compatible survivors from the same marketplace
   revision; an old installed provider can still advertise the retired contracts.
3. Reinstall or update your selected survivors using their exact identities.
   Codex marketplace refresh alone does not replace an installed cached plugin:
   remove that selected plugin and add it again. Claude updates/uninstalls must
   use its actual installation scope. The installation guide gives those commands.
4. Uninstall each retired identity you actually have. For example, from a shell:

   ```sh
   codex plugin remove darrow-principles@darrow
   codex plugin add darrow-pstack@darrow
   ```

   Or for Claude's user scope:

   ```sh
   claude plugin uninstall darrow-principles@darrow --scope user
   claude plugin install darrow-pstack@darrow --scope user
   ```

   Substitute the verified installed identity and scope for other rows. Do not
   delete all plugin directories or clear unrelated caches to perform this move.

5. Compare repository-local duplicates as described below. End old sessions, then
   open a fresh session on each host. Verify the selected package and version,
   use its README invocation, and confirm the intended result. A listing proves
   installation state, not activation or task success.

The bulk installer installs every current manifest entry and stops on the first
failure. It does not remove retired identities, prepare UV/Python, reconcile
local copies, or start workflows. Install only the plugins you need.

## Preserve local and personal state

For each repository-local Matt skill, compare the complete directory with its
original source and the bundle's recorded adaptations. Preserve local edits in
a separate user-owned copy before removing anything. Remove only confirmed
superseded directories, Claude links that point to those same directories, and
matching entries in the local skills lock. Keep unrelated skills and lock entries.
Do not scan or delete unrelated personal installations.

Keep `.darrow/principles.md`, `~/.darrow/principles.md`, their relative custom files,
and considered/removed/declined-route metadata intact. Personal-over-worktree-over-
default precedence and whole-table replacement are unchanged. Package installation
never creates a personal table, resets routes or restores deliberately removed IDs.
Keep unrelated scratch files and user caches; old ignored `.venv` and `__pycache__`
directories are not active plugins and are not a reason for destructive cleanup.

## Workflow and evidence limits

Matt ships exactly 17 selected skills, including research, prototype and tracker
setup closure, and no duplicate reviewer or PR publisher. Pstack ships exactly 27
skills and no benchmark or TypeScript helper. Both complete bundles and moved
adaptations are MIT; unrelated Darrow content retains BUSL and applicable borrowed
notices. Updates are deliberate pinned imports, not a scheduled service.

Adapted implement requires approved intent and agreed test seams, composes through
public capabilities and uses one Adaptive Goal owner. Local implementation defaults
to a local commit; push/PR need explicit or inherited authority. Ticket-to-PR retains
ticket intake, branch/publication and required green CI. Git supplies the complete
PR experience with the repository template taking precedence. Explanation remains
for conversational structure, ownership, flow and state. Information Architecture
retains setup, doctor/repair, host integration and context operations.

Both hosts have focused bundle and shared-workflow observations, with conditions
and gaps in the [acceptance evidence](research/ten-plugin-migration-328.md).
Single trials are not reliability guarantees. Artificer's Claude handoff/PR path
still reports `needs-attention` when native completion evidence is unavailable.

## Host support and evidence

Codex is the primary development host. Both Codex and Claude Code are required
targets for the curated bundles and revised shared workflows. Support is scoped
to each workflow's documented evidence, including unavailable activation evidence
and failed task checks. A support target does not mean every observed task passed.
[Artificer's Claude exception](../plugins/automation/darrow-artificer/README.md)
remains explicit; this migration does not establish support for other unverified
operations. See the [migration evidence record](research/ten-plugin-migration-328.md)
for the precise observed conditions and remaining acceptance work.
