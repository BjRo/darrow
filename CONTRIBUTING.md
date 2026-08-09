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

## Trademarks

Contributing does not grant you rights in the Darrow name or marks. See
[TRADEMARK.md](TRADEMARK.md).

## Working agreements

Read [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) before changing
plugin content. In particular:

- Add or adjust the applicable invariant under `docs/specs/` before
  implementation.
- For skill creation or revision, follow
  [`author-agent-skill`](plugins/darrow-skill-authoring/skills/author-agent-skill/SKILL.md).
- Keep each plugin self-contained. Never reference files outside a plugin or
  assume a sibling plugin is installed.
- Use imperative Conventional Commits without trailing periods, and no AI
  attribution or `Co-authored-by` trailers.

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
