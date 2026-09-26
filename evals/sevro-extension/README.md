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
artifact copy.
Implicit positive and negative activation cases are supported when they mount
their owning skill. A complete host observation named `darrow.activation` with
`primarySkill` and ordered `observedSkills` yields a separate
`darrow.evals.activation` domain outcome. Missing, partial, duplicate, or
inconsistent observations make activation unavailable without changing the task
verdict. The synthetic parity adapter proves this protocol path; the bundled
Codex route does not yet produce the required activation observation.

The extension preserves the invariant, source path, and check names in
namespaced extension data. Other case fields and fixture mechanics fail
explicitly. Plugin packaging, sibling skill mounts, setup scripts,
`{{skill_invocation}}`, and other activation forms remain on Darrow's existing
runner. The legacy `{{repo_dir}}` prompt token maps to Sevro's per-trial
workspace token. Other prompt templates still fail explicitly.

For local protocol and public CLI validation, run:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun test evals/runner/parity/sevro-extension.test.ts
```

The parity test also prepares the mounted skill through Sevro's bundled Codex
route with `--dry`, validating its protocol identity and retained artifacts
without starting a model turn.

An invocation supplies `index.ts`, the repository `package.json`, and
`bun.lock` as extension source files so the executable and YAML parser version
are included in Sevro's source digest. Case content enters the selected case,
fixture, and check digests.

This development path uses an explicit Sevro checkout or local package tarball
until a release is pinned. It does not replace the existing eval command yet.
