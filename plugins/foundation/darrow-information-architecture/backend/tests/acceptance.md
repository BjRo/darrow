# Migration acceptance

Both existing skills pass the bundled metadata inspector before migration.
The existing Bash regression suites are the mechanical baseline; retained
tests invoke the Python commands after migration. Full pre-migration live skill
baselines are not claimed; live trials exercise the migrated skills.

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
