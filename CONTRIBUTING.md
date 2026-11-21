# Contributing to Darrow

Contribute issues, plugin fixes, skills, eval cases or documentation.

## Licensing of contributions

Contributions within `plugins/capability/darrow-matt-pocock/` and
`plugins/capability/darrow-pstack/`, including moved Darrow adaptations, are
accepted and distributed under MIT. Preserve the complete Matt Pocock/Lauren Tan
notices, source pins and recorded differences. Do not claim rights to relicense
upstream work. Their package licenses govern those directories.

Other Darrow material is distributed under the [Business Source License 1.1](LICENSE), which
converts to the Mozilla Public License 2.0 two years after each version is
released. Contributions are accepted under different, broader terms so that
the maintainer can keep relicensing that material. Separately licensed borrowed
material retains its applicable notices, including Git's presentation sources.

**For contributions outside those two MIT bundle directories, by opening a pull
request you agree to the following:**

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

Read [`AGENTS.md`](AGENTS.md) before changing plugin content. `CLAUDE.md` links
to the same instructions. Its conditional routes identify the development rules
for the files you are changing.

## Documentation

Give each page one reader need, using [Diátaxis](https://diataxis.fr/):

- a **tutorial** helps a learner gain confidence through a guided experience;
- a **how-to guide** helps a competent user accomplish a specific goal;
- **reference** supplies accurate facts needed while working; and
- **explanation** provides context and answers why the system is designed as it
  is.

Use these distinctions to edit pages, not to impose a four-directory layout.
Landing pages can route to several needs. Other pages should link to a different
type of guidance when the reader needs it.

Keep current instructions with the plugin or development guide that owns them.
Use `docs/decisions/` for architectural choices and their rationale. Link ADRs
to the relevant commits for supporting investigations. Git history preserves
completed research, migration records and old experiment results.

## Set up repository development

```sh
bun install
bun run hooks:install
```

The hook checks staged files without changing them. Run `bun run test:evals`
for deterministic evaluation-tooling tests. See [test ownership](evals/README.md)
for narrower commands. Keep raw eval evidence under ignored `evals/results/` paths.

Follow the [documentation review rubric](docs/documentation-quality.md)
for user-facing pages. Run `bun run check:docs:external` separately from local
checks and triage network failures using that rubric.

## Before opening a pull request

```sh
bun run lint
bun run lint:ts
bun run lint:shell
bun run typecheck
bun run check:docs
bun run check:python
```

`check:python` is required when Python source, tests, package metadata, or locks
change; its standards and package inventory are defined in
[`docs/python-quality.md`](docs/python-quality.md).

Run script tests with both `bash` and `/bin/bash`. Run relevant evals with:

```sh
cd evals && bun runner/run.ts --case <substring> --harness <claude|codex> [--dry]
```
