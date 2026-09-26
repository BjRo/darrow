# Darrow extension for Sevro

`index.ts` speaks the versioned `sevro.extension.v1` process protocol without
importing Sevro internals. Darrow owns case discovery and translation; Sevro
owns fixture construction, host execution, built-in checks, isolation, and
retained results.

This migration slice resolves one selected skill-free experiment case or
plugin-local skill case. It accepts generated Git commits, optional
working-tree and staged files, hidden shell checks with exit-code and stdout
assertions, combined final-message checks without external schema files, and
semantic propositions graded by Sevro's separate evaluator route.
For a plugin-local case, `prepare` mounts the selected skill's files under
`.agents/skills/` and excludes their exact paths from Git status. Colocated
`evals/` files and generated caches stay out of the candidate fixture. Skill
bytes enter the fixture identity through their retained artifact digests.
Executable skill files keep owner execute permission in the fixture and retained
artifact copy. Cases with `mount_plugin_skills: true` mount all sibling skills
from the owning plugin through the same project-discovery path, with a shared
artifact limit. Competition activation requires that sibling set.
Implicit positive and negative activation cases are supported when they mount
their owning skill. A complete host observation with `primarySkill` and ordered
`observedSkills` yields a separate `darrow.evals.activation` domain outcome.
The bundled Codex route supplies `sevro.codex.skill-reads` for completed direct
reads of a mounted skill body through direct `cat`, complete exact `sed` pages,
and exact `lean-ctx -c` wrappers around those reads. Synthetic adapters can
supply `darrow.activation` for parity tests. Missing, partial, duplicate,
foreign, or inconsistent observations make activation unavailable without
changing the task verdict. Other Codex read patterns still need parity work.

The extension preserves the invariant, source path, and check names in
namespaced extension data. Other case fields and fixture mechanics fail
explicitly. Plugin packaging, setup scripts,
`{{skill_invocation}}`, and other activation forms remain on Darrow's existing
runner. The legacy `{{repo_dir}}` prompt token maps to Sevro's per-trial
workspace token. Other prompt templates still fail explicitly.

For local protocol and public CLI validation, run:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun test evals/runner/parity/sevro-extension.test.ts
```

To run one supported case through the Darrow entrypoint, select an installed
Sevro command with `SEVRO_PACKAGE_BIN` or a local development checkout with
`SEVRO_CHECKOUT`. For example:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/run.ts \
  --case-id orchestration-routing-localized-mechanical \
  --results-root /absolute/path/to/results -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium \
  --condition passive --trials 1 --threshold 1 --shell-isolation
```

The entrypoint fixes the Darrow extension, project, case, results, and source
identity. Options after `--` go to Sevro. The results directory holds the
extension command file at a stable path. The command emits Sevro's JSON result
and exit category. Unsupported case features still fail during resolution.

The parity test also prepares the mounted skill through Sevro's bundled Codex
route with `--dry`, validating its protocol identity and retained artifacts
without starting a model turn. On macOS with Codex installed, it also drives a
controlled JSONL turn through the bundled host to verify complete and partial
native activation receipts end to end without a model call.
The first focused live run is recorded in [live-validation.md](live-validation.md).

The entrypoint supplies `index.ts`, `run.ts`, `sevro-command.ts`, the repository
`package.json`, and `bun.lock` as extension source files so the executable,
invocation, and YAML parser version are included in Sevro's source digest. Case
content enters the selected case, fixture, and check digests.

This development path uses an explicit Sevro checkout or local package tarball
until a release is pinned. It does not replace the existing eval command yet.
