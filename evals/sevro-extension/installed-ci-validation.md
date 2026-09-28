# Installed candidate CI validation

The `Installed Sevro integration` workflow prepares the published-package gate
before the first Sevro release. It is manually dispatched with an exact version
and the reviewed tarball's SHA-256. Automatic verification of Darrow's eventual
frozen dependency pin remains a separate cutover requirement.

## Local workflow checks

The workflow passes `actionlint` 1.7.12. Its first check found an unavailable
`runner` context in job-level environment configuration. The corrected workflow
sets its artifact directory through `GITHUB_ENV` in a preparation step.

The exact download-and-verification step was also executed with macOS
`/bin/bash`, Node, and a fixture npm command. The fixture supplied the existing
Sevro `0.1.0-dev.0` archive from source commit `ed60be6`, with SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
This exercises the workflow's archive binding; it does not prove an npm download
or a remote GitHub Actions run.

| Input                                          | Observed result                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Exact version and reviewed archive digest      | Exit `0`; candidate identity retained and tarball exported for installation |
| Distribution tag, version range, or shell text | Exit `1` before npm; no tarball exported                                    |
| Malformed digest                               | Exit `1` before npm; no tarball exported                                    |
| Different archive digest                       | Exit `1`; no tarball exported                                               |
| Different package version or name              | Exit `1`; no tarball exported                                               |

All eight scenarios passed. The fixture retains its JSON summary and process
logs outside the repository at
`/Users/bjro/.darrow/issue95-installed-ci/`.

## Gate and evidence

The workflow runs the existing `test:eval-runner-sevro-package` command after
clearing `SEVRO_CHECKOUT` and `SEVRO_PACKAGE_BIN`. That command installs the
verified archive in a temporary consumer, refuses package Git metadata, and runs
Darrow's public-interface parity suite through the installed executable.
The command and its tests are unchanged in this milestone. The latest execution
of that installed archive is recorded in
[corpus validation](corpus-caller-validation.md); it was not repeated solely for
the workflow change.

The workflow retains the archive, npm metadata, verified candidate identity,
Darrow revision, and parity log for 30 days, including failed runs. It has read-only
repository permissions and performs no publication or live model evaluation.
Its first remote execution requires a published version and separately reviewed
archive digest. No remote execution is claimed here.
