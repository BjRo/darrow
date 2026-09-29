# Local ticket fixture migration

The ticket scaffolding example now lives in `evals/domain/fixture-ticket.test.ts`.
It uses the installed Sevro command through the existing fixture transport,
without importing a legacy runner, copying engine source, or building a workspace
itself. Darrow owns the fixture definition, ticket tool, and named shell checks;
Sevro builds the workspace, executes those checks, and retains public results.

The migrated example preserves these requirements:

- Case scaffolding is committed and Git status is clean.
- Setup reads the case's marker asset through `{{case_dir}}`.
- The first `ticketctl get` returns the ticket title and original body bytes,
  including the final newline.
- `describe` followed by a second `get` preserves the replacement body bytes.
- `.git/ticketctl.log` remains a symbolic link to `fixture-state/ticketctl.log`.
- Both log paths contain exactly `get 17`, `describe 17`, `get 17`, in that order.

The round trip runs in one shell check so independent check scheduling cannot
reorder ticket mutations. It also checks the complete first response and that
both scaffolding files are tracked. All candidate actions are deterministic;
the synthetic host returns a fixed response. This migration changes no product,
plugin, normative contract, or standalone Sevro behavior. No TDD Red is claimed.

## Validation

The focused gate retains source-change rejection, local ticket source binding,
fixture-state preparation, and setup's system Git lookup alongside the migrated
example:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-fixture-cleanup/d9bb6c5/consumer/node_modules/.bin/sevro' bun test evals/domain/fixture-ticket.test.ts evals/domain/fixture-state.test.ts evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'commits case scaffolding|prepares fixture state|setup resolves system Git|prepares state for a canonical|fixture setup runs|local ticket works'
```

All six tests and 40 assertions across three files passed in 10.85 seconds.
The installed Sevro `0.1.0-dev.0` development archive comes from `d9bb6c5`, with
SHA-256 `4d99ac6d63d7e9cece1da452118f74fd618d0292d07e595a17eeddb9f0fa4cce`.
The log and exact command are retained under
`/Users/bjro/.darrow/issue95-ticket-round-trip/`.

The duplicate legacy example is removed. The remaining nine mounting examples
in `evals/runner/fixture.test.ts` pass with 50 assertions in 902 milliseconds.
ESLint, typecheck, and formatting pass. Documentation validation passes for
244 Markdown pages and 16 plugins. The full Darrow domain and package integration
suites were not repeated, and no live model or additional platform claim is made.

The runner inventory remains 75 TypeScript files. `evals/domain/` now contains
21 test files; nineteen whole test files have moved out of the runner tree, and
this milestone extracts one example from a mixed file. Backend resource
filtering and the remaining mounting policy still need reconciliation before
that file can be retired. The published pin, default cutover, generic runner
removal, benchmark decisions, and focused native acceptance remain pending.
