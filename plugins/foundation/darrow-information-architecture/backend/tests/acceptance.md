# Migration acceptance

Both existing skills pass the bundled metadata inspector before migration.
The original Bash regression suites supplied the mechanical baseline. Their
scenarios now run in pytest on every supported host; the shell suites are removed.
Full pre-migration live skill
baselines are not claimed; live trials exercise the migrated skills.

Regression coverage is retained in these native tests:

| Original scenarios                                                        | Pytest coverage                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Missing entrypoints, routes, cycles, scoped reachability, default budgets | `test_commands.py`: `test_graph_cases`, `test_long_graph_and_caps`                                                   |
| Deferred chains, arrow indexes, fences, native imports, skill lookalikes  | `test_regressions.py`: routing and parsing cases                                                                     |
| Selected runtimes, imported defects, broken adapters, shadowed budgets    | `test_regressions.py`: runtime and budget cases; `test_commands.py`: override cases                                  |
| Mirror alignment, drift, dependencies, unreadable mirrors, duplicates     | `test_commands.py`: `test_mirrors`; `test_regressions.py`: mirror and duplicate cases                                |
| Root adapters in both directions and independent copies                   | `test_commands.py`: `test_root_adapter`, `test_bad_selected_adapter`                                                 |
| Ordinary path boundaries, incidental mentions, source files               | `test_regressions.py`: boundary and mention cases; `test_failures.py`: `test_non_guidance_references`                |
| Setup inventory, no writes, subdirectory identity, output caps            | `test_commands.py`: `test_setup_inventory_and_limits`, `test_worktree_identity`, `test_long_graph_and_caps`          |
| Large Git worktree output for setup and doctor                            | `test_regressions.py`: `test_large_worktree_output` with real Python subprocess output, both NUL and newline records |

The fresh-artifact test additionally exercises the installed console commands
with frozen runtime dependencies. Permission-denial cases inject OS access
failures so they remain meaningful on Windows and under privileged test users.

Representative requests, covered by the existing colocated eval suites:

| Dimension  | Setup                            | Doctor                      |
| ---------- | -------------------------------- | --------------------------- |
| Direct     | Set up repository agent guidance | Audit AGENTS.md             |
| Indirect   | Reorganize our guidance graph    | Trim duplicated agent rules |
| Incomplete | Propose the graph before editing | Show findings before fixing |
| Negative   | Only audit existing guidance     | Create a new guidance graph |
| Pressure   | Preserve reverse symlink adapter | Preserve rare safety route  |

The migration additionally exercises native path handling, CRLF/BOM parsing,
case sensitivity, unavailable symlink support, read-only audit behavior, and
atomic source replacement. Fresh copied artifacts must run without Bash,
development dependencies, sibling plugins, or the original checkout.

The bounded independent review found two regressions: parent-relative native
and skill resources were rejected by case validation, and invalid encoding in
unselected Claude guidance could abort a Codex-only audit. Both have native
command regressions in `test_failures.py` and were repaired.

Live-trial diagnosis also corrected two eval calibration problems. The
Codex-only setup fixture now supplies an actual service contract instead of
expecting invented guidance in an empty repository. The unselected-runtime
semantic check accepts an issue-free outcome in context without requiring the
literal word “verified”; its deterministic verification check is unchanged.
A failed procedure-move trial motivated clearer skill instructions to confirm
the exact intent route in the inspector output, preserving the existing
cross-runtime reachability requirement.
