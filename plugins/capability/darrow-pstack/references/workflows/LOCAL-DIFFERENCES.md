# Workflow source and Darrow adaptations

Source: [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/7a583913eb1b8d1a0ee76753d1a2cf072e7b54f9/pstack).
Revision: `7a583913eb1b8d1a0ee76753d1a2cf072e7b54f9`.
License: [the complete upstream MIT notice](UPSTREAM-LICENSE).

This selection adds `blast-radius`, `correct`, `create-verification-skill`,
`maintain-verification-skill`, `why` and `benchmark-checklist`, including all
three feature-map examples. It does not update the older `unslop` pin or the
24 preserved Darrow principles.

Acquire the original inputs with `bash scripts/acquire-curated-skills <new-output-directory>`
from the Darrow repository. The `pstack-workflows` output preserves the unchanged
files, acquisition logs and installer lock record. The [receipt](upstream-provenance.txt),
[selection](upstream-selection.tsv), [required files](upstream-required-files.txt)
and [original content hashes](upstream-files.sha256) record that input.
Run `shasum -a 256 -c files.sha256` inside its `pstack-workflows` directory.

## Local differences

- All six skills keep upstream's Claude explicit-only flag. Each gains a
  Codex `agents/openai.yaml` with `policy.allow_implicit_invocation: false`
  and an explicit invocation guard in its body.
- `blast-radius` keeps executable proof, uses scratch scripts and does not
  edit product code. Optional native read-only readers replace the unbundled
  `arena` dependency. Writing guidance links to the contained `unslop` rules.
- `correct` requires a named mistake class or bounded maintenance scope.
  It no longer starts whenever a user corrects an agent, nor requires one
  automatic commit per class. Local execution and configured CI are reported
  separately from observed CI results.
- Verification creation follows established repository paths, with Codex
  `.agents/skills` and Claude `.claude/skills` defaults and shared entrypoints
  when both hosts are targeted. Product startup failures are blockers unless
  repair is authorized. Generated instructions must run before completion.
- Verification maintenance preserves its edit boundary and required live
  coverage. It supports sequential source inspection when native subagents
  are unavailable. Corrections remain local unless publication is authorized.
- `why` preserves the original rationale-first procedure and adds a read-only
  boundary and explicit treatment of inaccessible sources. Its description
  no longer directs readers to the unbundled `how` skill.
- `benchmark-checklist` preserves the measurement questions. It uses available
  host tools, bounds scripts and tuning to authorized environments, and removes
  references to unbundled performance playbooks. Agent-evaluation standards
  remain separate.

The feature-map examples are unchanged upstream files. No workflow requires a
sibling Darrow plugin or a particular model. Git operations may use public
capabilities when installed and authorized.

## Evidence limits

Package checks cover pins, complete notices, support files, explicit invocation
metadata and both host mounts. Focused behavioral cases cover Darrow's changed
authority and completion rules. A passing package check does not establish that
each workflow ran on an application, that an agent activated it, or that native
Windows behavior was exercised. Matched pruning comparisons are unverified.
