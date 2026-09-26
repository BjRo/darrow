# Darrow extension for Sevro

`index.ts` speaks the versioned `sevro.extension.v1` process protocol without
importing Sevro internals. Darrow owns case discovery and translation; Sevro
owns fixture construction, host execution, built-in checks, isolation, and
retained results.

This first migration slice resolves one selected skill-free case from
`evals/experiments/*/cases/*.yaml`. It accepts generated Git commits, optional
working-tree and staged files, hidden shell checks with exit-code and stdout
assertions, combined final-message checks without external schema files, and
semantic propositions graded by Sevro's separate evaluator route.
It preserves the invariant, source path, and check names in
namespaced extension data. Other case fields and fixture mechanics fail
explicitly. In particular, this slice does not mount skills, run setup scripts,
or grade activation. Those cases still use Darrow's existing runner.

For local protocol and public CLI validation, run:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun test evals/runner/parity/sevro-extension.test.ts
```

An invocation supplies `index.ts`, the repository `package.json`, and
`bun.lock` as extension source files so the executable and YAML parser version
are included in Sevro's source digest. Case content enters the selected case,
fixture, and check digests.

This development path uses an explicit Sevro checkout until a package release
is pinned. It does not replace the existing eval command yet.
