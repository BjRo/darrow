# Matt Pocock bundle

The independently installable `darrow-matt-pocock` plugin curates Matt Pocock's
MIT skills at revision `abeeaf95660ba9e8b7c753eb38f441ca707a8823`.
This contract implements migration issues #330 and #333 under #328. The
[approved implementation recipe](implement.md) owns the adapted implement contract.

## Package contract

MP-C1: Ship exactly grilling, wayfinder, grill-with-docs, domain-modeling,
diagnosing-bugs, to-spec, to-tickets, wizard, codebase-design,
improve-codebase-architecture, writing-for-agents, wait-what, tdd, research,
prototype, setup-matt-pocock-skills, and adapted implement. Preserve every
selected support file and host metadata file. Do not ship Matt code-review, pr, or implement-spec.

MP-C2: Both native manifests name `darrow-matt-pocock` at one version; Codex
points to `./skills/`. All runtime resources are contained in the plugin.
Keep upstream explicit-only entrypoints explicit on both hosts. Installation
never starts orchestration. Cooperate through advertised public skill intent,
without sibling-plugin reads or a capability registry.

MP-C3: Include the complete upstream MIT notice, source/revision and pinned
installer provenance, selection, upstream content inventory, and a precise
local-difference record. Darrow adaptations in this package are also MIT.
Adopt upstream changes deliberately when needed, with a new content pin.

## Compatibility contract

MP-C4: Resolve skill and delegation operations through the actual host's
advertised capabilities. Do not assume a Claude Skill tool exists on Codex.
Preserve bounded delegation and explicit activation. Missing required host
support must be reported rather than invented.

MP-C5: Honor the configured tracker, native relationships, existing label
vocabulary, and inherited permissions. Missing configuration routes to bundled
setup on both hosts; never silently selects a different provider. Setup makes
configuration reachable from both AGENTS.md and CLAUDE.md while preserving user
content. Publishing workflows retain human confirmation of new test seams and
ticket breakdowns. Previously agreed seams remain authoritative.

MP-C6: Relevant review intent resolves to independent code review, including
Darrow Review when installed. No duplicate reviewer or PR publisher is shipped.
Local work does not authorize push, PR publication, or unrelated tracker effects.

## Evidence

Use the accepted packaged-plugin boundary and existing installed-package fixture
pattern for selection, support closure, provenance/notices and independent host
mounts. Use the existing Sevro caller for one scoped ordinary-task smoke on each
actual host, sequentially, stopping at the first unexplained failure. Separate
package, mount, activation and outcome evidence. Trust unchanged upstream behavior;
these checks do not establish full behavioral coverage or reliability of every
skill. Root marketplace publication, duplicate local-copy migration, and license
boundary documentation are coordinated in the final migration cutover.
