# ADR-0014: Keep current documentation with its owner

Status: Accepted
Date: 2026-11-21
Summary: Keep current rules with their owners, architectural rationale in ADRs, and completed investigations in Git history.

## Context

The separate specification catalog repeats instructions in skills and development
guides. Completed migrations and investigations add reports, snapshots, absence
tests and historical-link exceptions that require maintenance after their work ends.

## Decision

Keep usage in plugin READMEs, execution instructions in skills and their local
references, and contributor standards in development guides. A plugin change
does not require a separate specification. Record consequential architectural
choices in ADRs and link supporting commits instead of keeping supporting reports.

Remove the specification catalog, completed research, migration reports, obsolete
experiment snapshots, migration-specific tests, and historical-link preservation
machinery. Remove the specification-ID coverage command with its definition
catalog. Behavioral tests, activation checks and matched comparisons remain;
their distinct evidence meanings from ADR-0007 still apply. Existing invariant
labels in eval cases remain descriptive metadata, not a maintained coverage claim.

Keep the five plugin categories. A category remains useful even when its current
inventory is small. Remove the private fixture plugin and its dependent evals.
Keep the repository guide in `.agents/skills/darrow-guide`; the Claude entrypoint
is a relative directory symlink to that canonical source.

This replaces the separate-specification ownership clause in ADR-0006, the
required specification-ID catalog in ADR-0007, and the tracked historical
snapshot/specification obligations in ADR-0010. Their other decisions and
statuses remain unchanged.

## Authority and provenance

The maintainer explicitly chose this cleanup in the 2026-11-21 conversation,
including keeping the category layout and using a symlink for the guide.
The [pre-cleanup repository](https://github.com/BjRo/darrow/commit/2258e604793a8b405dd290ea275e9e1a23e7d716)
preserves the removed documents and evidence.

## Consequences

Current instructions have one owner. Older evidence remains inspectable at its
recorded revision, but the main branch no longer promises a browsable archive
or reproduces old experiments. This cleanup does not establish new host support
or change published workflow permissions.
