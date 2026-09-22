---
name: publish-pr-evidence
description: Publish one candidate-bound evidence comment, with optional ordered image or video attachments, to the current branch's exact open pull request. Use when reviewer-facing PR evidence is explicitly requested or authorized by an enclosing delivery contract. Do not use for generic comments, issue comments, reviews, file hosting, or recovery of an uncertain prior attempt.
---

# Publish pull-request evidence

Publish one top-level PR conversation comment through the frozen UV entrypoint
below on Linux, macOS, and Windows; `<skill-dir>` contains this file. Treat every
result as authoritative. The script owns GitHub/CLI preflight, candidate
identity, attachment validation, deterministic identity, reconciliation, the
single comment invocation, and final observation. Do not reproduce those
mechanics with raw `gh` commands.

The package lives at `<skill-dir>/../../backend` inside this plugin.

## Inputs

Require explicit authority for one evidence operation and:

- the expected full commit ID already verified as the intended PR head;
- one readable body file containing the prepared reviewer-facing text; and
- zero or more attachments in presentation order. For each image require
  meaningful alt text; for each video require a textual explanation.

Text-only evidence is valid. Do not infer missing presentation text from a
filename. Do not accept authority for another PR, a generic comment, or an
unspecified current head.

## Operation

Run exactly one command:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-publish-pr-evidence publish \
  --expected-head <full-commit-id> --body-file <path> \
  [--image <path> --alt <text> | --video <path> --explanation <text>]...
```

Keep each presentation option immediately after its attachment. Preserve the
caller's attachment order. The facade validates all inputs and reconciles
top-level comments before any mutation. If it reports `refused`, `partial`, or
`ambiguous`, stop. Do not retry, edit, delete, replace, reuse a URL, change the
head, or attempt recovery. Fresh explicit authority is required for any later
operation.

## Result

Relay the complete stable result: outcome, stage, repository, canonical PR URL,
expected and observed full heads, evidence identity, intended and observed
attachment identities, known comment URL, command/effects, uncertainty,
prepared body path, and preservation checks. `published` and `existing` are the
only complete outcomes. A head change invalidates the operation even when the
comment command returned success.

The facade neither stages, commits, copies into the repository, deletes nor
cleans evidence files. Preserve its temporary prepared body and every caller
file for inspection. Do not claim attachment rendering beyond the facade's
observed comment evidence.

**Complete when:** the facade returns `published` or `existing` for the exact
candidate, or its refusal/uncertain result and all known effects have been
relayed without another mutation.
