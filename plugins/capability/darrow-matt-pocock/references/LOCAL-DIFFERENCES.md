# Source and local differences

This is a Darrow-maintained adaptation of [Matt Pocock's skills](https://github.com/mattpocock/skills)
at revision `abeeaf95660ba9e8b7c753eb38f441ca707a8823`, acquired with
`npx --yes skills@1.9.0`. The installer version pins the acquisition tool;
the commit pins the content. Both upstream content and these adaptations are MIT.

The [provenance](upstream/provenance.txt), [selection](upstream/selection.tsv),
[required files](upstream/required-files.txt), and [upstream hashes](upstream/files.sha256)
identify the imported baseline. Hashes describe upstream bytes, not adapted bytes.
The [file-level difference record](upstream/local-differences.json) names every
changed imported file and why it changed. Unlisted imported files retain their
exact upstream bytes, including support templates, scripts and host metadata.

The adaptations resolve host skill/delegation calls, configured tracker and labels,
setup reachability on both hosts, inherited human-approved seams, independent
Review intent, and publication authority. Setup no longer requires the unselected
triage skill to configure labels consumed by to-spec and to-tickets. Existing
provider choices and unrelated host guidance remain authoritative. Six support
documents receive repository-required formatting. Seven example fences in
grilling, codebase-design, domain-modeling and setup domain guidance add only
`text` language labels; their prose and behavior remain unchanged. The wizard template only adds
ShellCheck annotations for stage helpers and braces around a scalar expansion;
its runtime behavior is unchanged. These differences are recorded by file.

The paired manifests, README, compatibility guidance, this record, and focused
evals are Darrow additions. The curated selection excludes Matt's `code-review`,
`pr`, `implement`, and `implement-spec` skills.

Updates are demand-driven: acquire an intentional new revision with the repository's
pinned acquisition command, compare complete selected directories, reapply only
needed differences, and rerun package and affected host checks. This is not a
scheduled update service or a claim of byte-for-byte upstream identity.
