# Bundle smoke evidence

The local setup case exercises one ordinary explicit bundle entrypoint. It
preserves a configured local tracker, an existing readiness label, user guidance,
and shared configuration reachable from both hosts. It performs no external
tracker operation. It does not validate every imported workflow.

The package test copies the installable package away from this checkout and
checks selection, complete notice, pin and recorded local differences. The mount
test resolves and prepares this case through the existing public extension
protocol with only this plugin in its disposable project. Native host trials
separately observe explicit activation and the resulting repository files.

Run the case sequentially on Codex and Claude Code with the existing Sevro
caller; stop at the first unexplained failure. Retain raw evidence outside the
checkout and distinguish dry preparation from actual host execution.

## Observed checks — 2026-11-20

The bounded #330 candidate passed the following test-first slices:

- Red — `bun test ./evals/domain/matt-pocock-bundle.test.ts`: the independent
  package copy failed because `darrow-matt-pocock` did not exist.
- Green — `bun test ./evals/domain/matt-pocock-bundle.test.ts`: the complete
  selected package, notices and recorded upstream/local bytes passed.
- Red — `bun test ./evals/domain/matt-pocock-bundle-mount.test.ts`: the public
  protocol could not resolve the bundle smoke entrypoint before it was added.
- Green — `bun test ./evals/domain/matt-pocock-bundle-mount.test.ts`: independent
  Codex and Claude package preparation retained skills and contained resources.

During mount development, an unsupported YAML check field and an omitted Claude
host capability declaration were fixture defects and were corrected. A failed
resource assertion exposed the existing mounting contract: shared guidance and
notice copies must live under the supported `references/` directory. No shared
mounting code was changed.

Native trials used the installed `@bjoernrochel/sevro@1.1.2`, passive execution,
one trial, one job, threshold one, and retained diagnostics. Codex used 0.171.0
with app-server, `gpt-6-luna/medium`; Claude Code used 2.1.328,
`claude-sonnet-5-5/medium`. The semantic route was independently resolved as
Codex `gpt-6-luna/high`, but these cases used deterministic artifact checks and
no semantic or advisory grading.

| Trial                         | Task   | Activation                 | Candidate time | Retained run ID                        |
| ----------------------------- | ------ | -------------------------- | -------------- | -------------------------------------- |
| Codex local setup             | Passed | Explicit dispatch passed   | 58.6 s         | `fcab6e9d-6295-4b63-a3f1-61a8a8024638` |
| Claude local setup diagnostic | Passed | Unavailable                | 58.0 s         | `c9193be6-c716-47d6-a27b-ce0bf8a8a49b` |
| Claude glossary update        | Passed | Native Skill result passed | 23.1 s         | `477c671b-e3cf-4fe8-a531-ebc2bdf96c73` |

Commands, run from the repository root in this order:

```sh
bun eval --plugin darrow-matt-pocock --case matt-bundle-setup-local --harness codex --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-matt-330-host-codex -- --retain-host-diagnostics
bun eval --plugin darrow-matt-pocock --case matt-bundle-setup-local --harness claude --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-matt-330-host-claude -- --retain-host-diagnostics
bun eval --plugin darrow-matt-pocock --case matt-bundle-domain-local --harness claude --owner-evaluation passive --trials 1 --jobs 1 --threshold 1 --results-root /tmp/darrow-matt-330-host-claude-domain -- --retain-host-diagnostics
```

Each root contains `selection-run.json`, pointing to the raw run and trial
artifacts. These private temporary files are not committed. The second command
records the diagnostic before the setup activation case was restricted to Codex;
it is not a current passing selector. No trial followed its failure until the
retained host output and artifact result were classified.

Claude's setup trial advertised all 16 native commands and expanded the explicit
setup command. It saved the expected local-provider configuration and preserved
the existing readiness label and user guidance. It produced no structured Skill
call, which the installed activation grader requires. That observation remains
unavailable. The separate glossary case proves ordinary domain-modeling selection
and a saved glossary change, not setup activation. Explicit-only metadata stayed
unchanged. The mounted owning SKILL.md bytes for all three trials match this
candidate; unrelated support formatting and wizard lint normalization occurred
after the first mount.

Focused package/mount tests, canonical case resolution, TypeScript lint/typecheck,
Prettier, ShellCheck, and Bash syntax checks on both shell paths passed. A local
Markdown target check covered all new documentation links. The repository-wide
`bun run check:docs` remained blocked by the known retired Ticket Pipeline
marketplace path, pending final cutover. These observations do not establish a
reliability rate, publication behavior, every workflow's semantics, or completion
of the parent migration.
