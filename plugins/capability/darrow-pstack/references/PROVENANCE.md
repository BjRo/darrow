# Source provenance

This MIT bundle combines Lauren Tan's unchanged `unslop` with Darrow's selected
principle adaptations. The two sources have different revision evidence.

## Upstream unslop

Source: [cursor/plugins pstack](https://github.com/cursor/plugins/tree/aaeb0ea3a0584995aa8f55ce44c6c5259414b896/pstack).
Revision: `aaeb0ea3a0584995aa8f55ce44c6c5259414b896`.
Acquired with `npx --yes skills@1.9.0`, installer gitHead
`50894c1d98bc45ca1ab127213e59d6525065b5e7`.
The [acquisition receipt](upstream-provenance.txt),
[selected paths](upstream-selection.tsv), [required files](upstream-required-files.txt),
and [source digests](upstream-files.sha256) preserve the exact input inventory.
The inventory's `LICENSE` digest describes [the unmodified upstream notice](UPSTREAM-LICENSE);
the package [LICENSE](LICENSE) also includes Darrow's MIT notice.
No local changes were made to `unslop`. This original selection contains no benchmark or TypeScript helper. The separately pinned workflow selection now includes `benchmark-checklist`.

## Darrow adaptations

Source: [Darrow Principles](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-principles).
Selected Darrow revision: `de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`.
The 24 `principle-*` skill bodies, `principles-first`, `setup-principles`, and
default routing table are copied byte for byte. Their exact upstream revision
is not established. They must not be attributed to the unslop acquisition pin.
These are Darrow-maintained adaptations of Lauren Tan's pstack principles.
They retain Darrow's activation limits, caller authority, current wording,
optional routing, and customization behavior. Unlike the researched upstream
number/type leaves, these versions do not invoke `benchmark-checklist` or
`typescript-best-practices`.

Local packaging differences are the plugin identity, paired manifests, README,
MIT notices and provenance. Copied evals retain their behavior while package
references identify `darrow-pstack`. Existing principle IDs and personal state
are unchanged. Eval case IDs gain a `pstack-` prefix so the old and new package
fixtures can coexist during the migration. The copied source is preserved by independent original-source
digests in the repository's package fixture.

The copied decline-route evals no longer require final prose to repeat a route
ID already established in the conversation. Their unchanged state checks still
require the exact declined ID to be recorded while active custom routes remain
intact. This corrects an extra grading demand, not the setup contract.

Adopt upstream changes only for a wanted improvement, fix or release need. Reuse
the repository's pinned acquisition command, compare the complete input inventory,
record local differences, and repeat package and affected host checks before
changing the selected snapshot. Installer versions are not content revisions.

The contained `references/` directory mirrors the full root license, upstream
notice and provenance/input records so native filtered package copies preserve
the same notices and pins. README links use those contained copies. Standard
root distribution notices remain; no preserved skill or routing-table body changes.

## Additional engineering workflows

Six explicitly invoked workflows are pinned separately from `unslop`. Their source, full notice, support files and Darrow adaptations live in [workflow provenance](workflows/LOCAL-DIFFERENCES.md). The original pins and preserved principle bodies above remain unchanged.
