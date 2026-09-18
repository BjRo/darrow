# Approved guidance updates

Use the writer only after the skill's proposal and authority checks. It receives
complete approved UTF-8 content; it makes no placement, policy, or edit decision.

Read the current source and record its SHA-256 (`missing` for a new file). Stage
the complete replacement in a temporary content file outside the guidance graph.
Create an approved parent directory first if needed. Then invoke:

```text
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" ia-write --expected <sha256-or-missing> --content-file <absolute-content-path> <repository-relative-guidance-path> [repository]
```

The writer resolves an existing file adapter to its in-repository source,
preserves its permissions, UTF-8 BOM, and LF/CRLF convention, and stages complete
bytes in the destination directory before `os.replace`. It checks the expected
digest and adapter destination again immediately before publication. A refused
or failed replacement leaves the original intact and removes the temporary file.
The caller must coordinate concurrent writers: the digest check detects observed
changes but is not an operating-system compare-and-swap or a multi-file
transaction. Re-read and re-evaluate the proposal after a conflict.

On native Windows, a locked destination can refuse replacement; report that
failure rather than falling back to truncation. Symlink creation may require
host privileges. Preserve existing adapters; for an approved new graph where
symlinks are unavailable, use a native import or explicit route. The writer does
not create, replace, or delete symlinks. Apply approved moves/deletions separately,
then verify the entire resulting graph using `ia-doctor verify`.
