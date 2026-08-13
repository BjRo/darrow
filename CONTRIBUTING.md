# Contributing to Darrow

Contributions are welcome — issues, plugin fixes, new skills, eval cases, and
documentation.

## Licensing of contributions

Darrow is distributed under the [Business Source License 1.1](LICENSE), which
converts to the Mozilla Public License 2.0 two years after each version is
released. Contributions are accepted under different, broader terms so that
the maintainer can keep relicensing the project as a whole.

**By opening a pull request, you agree to the following:**

1. You are the author of the contribution, or you have the right to submit it
   under these terms.
2. You license your contribution to Björn Rochel and to all recipients of
   Darrow under the **Apache License, Version 2.0**.
3. You additionally grant Björn Rochel a perpetual, worldwide, non-exclusive,
   irrevocable, royalty-free right to use, reproduce, modify, distribute, and
   **sublicense your contribution under any terms**, including the Business
   Source License 1.1, the Mozilla Public License 2.0, and commercial licenses.
4. You retain your copyright in your contribution. This grant is a license,
   not an assignment.

You keep every right you had before contributing. The extra grant exists only
so the project can be relicensed without tracking down past contributors.

If you cannot agree to this — for example because your employer owns the
copyright in your work — say so in the pull request before it is reviewed.

## Working agreements

Read [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) before changing
plugin content. In particular:

- Add or adjust the applicable invariant under `docs/specs/` before
  implementation.
- For skill creation or revision, follow
  [`author-agent-skill`](plugins/foundation/darrow-skill-authoring/skills/author-agent-skill/SKILL.md).
- Keep each plugin self-contained. Never reference files outside a plugin or
  assume a sibling plugin is installed.
- Use imperative Conventional Commits without trailing periods, and no AI
  attribution or `Co-authored-by` trailers.

## Documentation

Use [Diátaxis](https://diataxis.fr/) as an editorial guide for reader-facing
documentation. Give each page one primary user need:

- a **tutorial** helps a learner gain confidence through a guided experience;
- a **how-to guide** helps a competent user accomplish a specific goal;
- **reference** supplies accurate facts needed while working; and
- **explanation** provides context and answers why the system is designed as it
  is.

Apply the distinctions incrementally. Do not create empty four-part directory
scaffolding or reorganize documents solely to make their paths match the four
labels. Landing pages may route to multiple documentation types, but a content
page should link to a different mode instead of interrupting its primary job.

The existing repository directories express authority and lifecycle rather
than reader need. Keep normative contracts in `docs/specs/`, accepted choices
in `docs/decisions/`, and exploratory material in `docs/research/`.

## Before opening a pull request

```sh
bun run lint
bun run lint:ts
bun run lint:shell
bun run typecheck
```

Run script tests with both `bash` and `/bin/bash`. Run relevant evals with:

```sh
cd evals && bun runner/run.ts --case <substring> [--dry]
```
