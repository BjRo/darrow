# Inspect personal configuration in Principles evals

Use `runtime-principles-personal.json` for Principles cases whose checks inspect
personal configuration. It grants grading read-only access to the isolated
candidate's `.darrow` directory as `SEVRO_CANDIDATE_ARTIFACT_PRINCIPLES`.
The grader has a separate credential-free home; its own `HOME` does not locate
the candidate's configuration.

These fixtures create an empty candidate `.darrow` directory during setup,
before the candidate runs. A missing `principles.md` there is then an observed
absence. Each state check requires a nonempty grant naming a readable,
searchable directory before inspecting file absence or values. Missing, empty,
nonexistent or inaccessible grants fail instead of establishing absence.
The profile includes no real-home, credential, cache or review grant,
and retains native-goal hook isolation.

From the repository root, for example:

```sh
bun run eval --plugin darrow-principles --skill setup-principles \
  --case setup-principles-matrix-personal-initialize --harness codex \
  --trials 1 --jobs 1 --owner-evaluation passive -- \
  --runtime-config-file "$PWD/plugins/capability/darrow-principles/skills/setup-principles/evals/fixtures/runtime-principles-personal.json"
```

Use the same profile for bundled-default application and saved-catalog probes,
setup scope questions, repository initialization,
explicit reset, customization preservation, export, and new-default acceptance
or decline cases that check personal effects. Unreadable selected-table entry
cases keep their normal profile; they do not grant an unreadable file to grading.
