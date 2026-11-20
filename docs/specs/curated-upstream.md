# Curated upstream inputs

## Acquisition invariant

`bash scripts/acquire-curated-skills <new-output-directory>` must produce
disposable, pinned inputs for the curated bundles. It must use `skills@1.9.0`
in isolated project directories, never install skills into this checkout or
the user's home, and refuse an existing destination without modifying it.
An unsuccessful acquisition must leave no destination presented as complete.

Matt's source is `mattpocock/skills` at
`abeeaf95660ba9e8b7c753eb38f441ca707a8823`. Select grilling, wayfinder,
grill-with-docs, domain-modeling, diagnosing-bugs, to-spec, to-tickets, wizard,
codebase-design, improve-codebase-architecture, writing-for-agents, wait-what,
tdd, implement, research, prototype, and setup-matt-pocock-skills. Preserve
every selected directory, host metadata, and support file. Exclude Matt's
code-review and pr.

Lauren Tan's pstack source is `cursor/plugins` at
`aaeb0ea3a0584995aa8f55ce44c6c5259414b896`, under `pstack`. Acquire only
unslop. The downstream pstack bundle retains the current 24 Darrow principle
implementations and routing/customization. Their exact upstream revision is
unknown; this acquisition must not misattribute them to the pstack pin or
replace them with raw upstream principles or conditional helper skills.

Each input must include its full upstream MIT notice, source/revision/tool
record, selection and source paths, required-file list, content hashes, and
local adaptation boundary. Fetch root licenses separately because the
installer copies selected skill directories, not repository-root notices.
Fail on missing required files, unexpected selections, or changed notices.

These upstream inputs and the eventual curated bundles, including their moved
Darrow adaptations, belong outside the remaining Darrow BUSL boundary under
MIT. This acquisition does not relicense unrelated Darrow content. Downstream
bundle assembly owns manifests, local adaptations, and repository-level
license/contribution reconciliation. Updates are deliberate and demand-driven.

The accepted package seam and pins come from [migration #328](https://github.com/BjRo/darrow/issues/328)
and its [acquisition slice #329](https://github.com/BjRo/darrow/issues/329).
The [pinned research](https://github.com/BjRo/darrow/blob/aa4fa30b4413211138790604eefa45c3e141e310/docs/research/curated-upstream-bundle-portability.md)
supplies the required support-file inventory; its earlier raw-principle
proposal is superseded by the accepted current-Darrow selection above.

## Run and consume

Requires Bash 3.2 or later, Node 22.20.0 or later, npm/npx, Git, curl, shasum,
and network access to npm and GitHub. Choose a new disposable directory:

```sh
bash scripts/acquire-curated-skills /tmp/darrow-curated-inputs
```

For each of `matt/` and `pstack/`, the result contains:

- `skills/`: complete copied skill directories, ready for downstream assembly.
- `LICENSE`: the complete upstream MIT notice, checked against its pinned hash.
- `provenance.txt`: source, revision, installer, attribution and adaptation limits.
- `selection.tsv`: selected skill name and original source directory.
- `required-files.txt`: the required entrypoints, metadata and support files.
- `files.sha256`: hashes of every acquired skill file and the full notice.

`acquisition/matt/` and `acquisition/pstack/` retain the original install
directories, `skills-lock.json`, and `installer.log`. The project-local Codex
destination is only an acquisition mechanism; it does not establish a plugin's
Codex or Claude support. npm's download cache stays inside disposable staging
and is removed after success. Failure removes staging; retry with the same
unused destination. An existing destination is refused, so compare a second
acquisition in another new directory rather than overwriting inputs.

```sh
cd /tmp/darrow-curated-inputs/matt
shasum -a 256 -c files.sha256
```

Preserve the original inputs and record downstream differences separately.
Do not edit these provenance records to imply that an adapted skill is still
identical to upstream. The current Darrow principle migration needs its own
local source revision and adaptation record; the unknown upstream revision
remains unknown. No principle code is acquired or moved by this command.

## Deterministic check

The existing Bun domain-test pattern exercises the public command with
disposable input trees and substitutes only the network installer/download
collaborators. It checks selection, copied support, notices and refusal of
incomplete inputs. It does not execute upstream skills or simulate a host.

```sh
bun test ./evals/domain/curated-inputs.test.ts
CURATED_TEST_SHELL=/bin/bash bun test ./evals/domain/curated-inputs.test.ts
scripts/lint-shell scripts/acquire-curated-skills
bun run check:docs
```

A real acquisition is separate network evidence. Compare `files.sha256` from
two fresh acquisitions to establish reproducible packaged content; installer
logs can contain temporary paths. Neither deterministic fixtures nor a live
download establish host behavior or final bundle acceptance.
