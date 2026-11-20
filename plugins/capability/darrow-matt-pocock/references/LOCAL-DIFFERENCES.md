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
documents receive repository-required formatting. The wizard template only adds
ShellCheck annotations for stage helpers and braces around a scalar expansion;
its runtime behavior is unchanged. These differences are recorded by file.

The paired manifests, README, compatibility guidance, this record, and focused
evals are Darrow additions. Implement is materially adapted: it carries approved
intent and inherited seams into one Adaptive Goal owner, composes selected TDD,
independent Review, Git and principles through advertised public contracts, and
defaults to local commit. Missing required providers stop dependent work;
push/PR require explicit or inherited authority. Only adapted implement removes
the Claude `disable-model-invocation` and Codex `allow_implicit_invocation: false`
controls so an explicitly invoked parent can discover and invoke it. Its
description and first workflow guard preserve explicit/delegated authorization;
ordinary implementation intent supplies no authority. Raw upstream hashes and
metadata remain the recorded baseline. Matt code-review, pr and implement-spec
are excluded.

Updates are demand-driven: acquire an intentional new revision with the repository's
pinned acquisition command, compare complete selected directories, reapply only
needed differences, and rerun package and affected host checks. This is not a
scheduled update service or a claim of byte-for-byte upstream identity.
