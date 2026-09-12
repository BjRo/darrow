# Preflight regression request matrix

| Request                                                                                  | Expected behavior                                                       | Evidence                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Explicit adaptive-delivery request in repository A while ambient Git selects B           | Prepare A's root, revision, dirty state, instructions, and route policy | Preflight shell regression                                    |
| Preserved orchestration delegation in a linked worktree subdirectory                     | Prepare that linked worktree and its policy                             | Preflight shell regression; existing delegated-authority eval |
| Explicit invocation with a missing required product decision                             | Ask before launch                                                       | Existing decision-gated eval                                  |
| Ordinary engineering request without orchestration invocation                            | Do not activate adaptive delivery                                       | Existing nonactivation eval                                   |
| Repository policy supplies a host/provider mismatch, `none` model, or unsupported effort | Refuse preparation and selection, as for the equivalent explicit tuple  | Preflight shell regression                                    |
| Valid off-catalog model and explicit user override                                       | Preserve the exact tuple and provenance                                 | Preflight shell regression                                    |

The unchanged preflight shell suite passed on Bash 3.2.57 before adding the
regressions. New cases exercise the public helper commands in disposable
repositories. Existing activation cases cover unchanged judgment boundaries;
dry preparation alone does not prove activation or native owner behavior.
