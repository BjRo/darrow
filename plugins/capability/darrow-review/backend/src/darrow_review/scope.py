"""Pin immutable diff packets without changing the reviewed Git state."""

from __future__ import annotations

import difflib
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .common import (
    command_line,
    entrypoint,
    git,
    git_environment,
    read_text,
    require,
    root_directory,
    rows,
    run,
    safe_line,
    serialize,
)


@dataclass
class ScopeOptions:
    repo: str = "."
    base: str = ""
    target: str = ""
    merge_base: bool = False
    staged: bool = False
    unstaged: bool = False
    untracked: bool = False
    allow_empty: bool = False
    prior_manifest: str = ""


def manifest(path: str) -> dict[str, str]:
    require(Path(path).is_absolute(), "manifest path must be absolute")
    records = rows(read_text(path, "manifest"))
    values = {row[0]: row[1] for row in records if len(row) == 2}
    require(
        values.get("format") == "darrow-review-scope-v1",
        "unsupported scope manifest format",
    )
    for key in ("repository", "diff"):
        require(
            Path(values.get(key, "")).is_absolute(),
            f"manifest {key} path must be absolute",
        )
    return values


def show(path: str) -> bytes:
    values = manifest(path)
    packet = Path(values["diff"]).read_bytes()
    # Ask Git so repositories using SHA-256 retain their native object format.
    actual = (
        git(
            Path(values["repository"]),
            "hash-object",
            "--no-filters",
            values["diff"],
            message="cannot hash the pinned diff",
        )
        .decode()
        .strip()
    )
    require(
        actual == values.get("scope_checksum"),
        "pinned diff checksum does not match the manifest",
    )
    return packet


def compare(prior: str, current: str) -> str:
    before, after = show(prior), show(current)
    old, new = manifest(prior), manifest(current)
    require(
        old["repository"] == new["repository"],
        "repair scope manifests belong to different repositories",
    )
    require(
        old.get("base") and old.get("base") == new.get("base"),
        "repair scope manifests do not share the same effective base",
    )
    header = serialize(
        [
            ["format", "darrow-review-repair-delta-v1"],
            ["repository", old["repository"]],
            ["prior_target", old["target"]],
            ["current_target", new["target"]],
            ["prior_manifest", prior],
            ["current_manifest", current],
        ]
    )
    delta = difflib.unified_diff(
        before.decode("utf-8", errors="replace").splitlines(True),
        after.decode("utf-8", errors="replace").splitlines(True),
        fromfile=old["diff"],
        tofile=new["diff"],
    )
    return header + "\n" + "".join(delta)


def resolve_commit(repo: Path, revision: str, label: str) -> str:
    safe_line(revision, label)
    require(not revision.startswith("-"), f"{label} must not begin with '-'")
    return (
        git(
            repo,
            "rev-parse",
            "--verify",
            revision + "^{commit}",
            message=f"invalid {label}: {revision}",
        )
        .decode()
        .strip()
    )


def target_commit(repo: Path, options: ScopeOptions) -> str:
    head = resolve_commit(repo, "HEAD", "HEAD")
    if options.target.lower() == "worktree":
        if not any((options.staged, options.unstaged, options.untracked)):
            options.staged = options.unstaged = options.untracked = True
        return head
    target = resolve_commit(repo, options.target, "target")
    require(
        not any((options.staged, options.unstaged, options.untracked))
        or target == head,
        "working-tree layers require the target commit to resolve to HEAD",
    )
    return target


def effective_base(repo: Path, base: str, target: str, merge: bool) -> str:
    if not merge:
        return base
    bases = (
        git(
            repo,
            "merge-base",
            "--all",
            base,
            target,
            message="base and target have no merge base",
        )
        .decode()
        .splitlines()
    )
    require(
        len(bases) == 1,
        "base and target have multiple merge bases; choose the fixed point explicitly",
        4,
    )
    return bases[0]


def validate_prior(repo: Path, base: str, prior: str) -> None:
    if not prior:
        return
    show(prior)
    old = manifest(prior)
    require(
        old["repository"] == str(repo),
        "prior manifest belongs to a different repository",
    )
    require(
        old.get("base") == base,
        "prior manifest does not share the current effective base",
    )


def diff_layers(
    options: ScopeOptions, base: str, target: str
) -> list[tuple[str, list[str]]]:
    layers = [("committed", [base, target])]
    if options.staged:
        layers.append(("staged", ["--cached", target]))
    if options.unstaged:
        layers.append(("unstaged", []))
    return layers


def changed_paths(raw: bytes) -> list[str]:
    return [
        safe_line(path.decode("utf-8"), "changed path")
        for path in raw.split(b"\0")
        if path
    ]


def diff_layer(repo: Path, label: str, revisions: list[str]) -> tuple[list[str], bytes]:
    names = changed_paths(
        git(
            repo,
            "diff",
            "--name-only",
            "-z",
            "--no-ext-diff",
            *revisions,
            "--",
            message=f"cannot enumerate {label} changes",
        )
    )
    if not names:
        return [], b""
    patch = git(
        repo,
        "diff",
        "--binary",
        "--full-index",
        "--no-ext-diff",
        *revisions,
        "--",
        message=f"could not render the {label} diff",
    )
    return names, f"### darrow-review layer={label}\n".encode() + patch + b"\n"


def untracked_layer(repo: Path) -> tuple[list[str], bytes]:
    names = changed_paths(
        git(
            repo,
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
            message="cannot enumerate untracked changes",
        )
    )
    if not names:
        return [], b""
    packet = b"### darrow-review layer=untracked\n"
    for name in names:
        # Git accepts /dev/null as the empty side on Windows as well as Unix.
        result = run(
            [
                "git",
                "-C",
                str(repo),
                "diff",
                "--no-index",
                "--binary",
                "--full-index",
                "--",
                "/dev/null",
                name,
            ],
            env=git_environment(),
        )
        require(
            result.returncode in (0, 1), f"cannot render untracked file: {repo / name}"
        )
        packet += f"### untracked-file {name}\n".encode() + result.stdout + b"\n"
    return names, packet


def assemble(
    repo: Path, options: ScopeOptions, base: str, target: str
) -> tuple[list[str], list[str], bytes]:
    chunks = [
        (label, diff_layer(repo, label, revisions))
        for label, revisions in diff_layers(options, base, target)
    ]
    if options.untracked:
        chunks.append(("untracked", untracked_layer(repo)))
    names = sorted({name for _, (files, _) in chunks for name in files})
    labels = [label for label, (files, _) in chunks if files]
    return names, labels, b"".join(packet for _, (_, packet) in chunks)


def prepare(options: ScopeOptions) -> str:
    require(options.base, "--base is required")
    require(options.target, "--target is required")
    require(
        not options.allow_empty or options.prior_manifest,
        "--allow-empty is valid only with --prior-manifest for fix verification",
    )
    repo = root_directory(options.repo)
    safe_line(str(repo), "repository path")
    target = target_commit(repo, options)
    base = effective_base(
        repo, resolve_commit(repo, options.base, "base"), target, options.merge_base
    )
    validate_prior(repo, base, options.prior_manifest)
    names, layers, packet = assemble(repo, options, base, target)
    require(names or options.allow_empty, "the declared review scope is empty", 3)
    git_dir = Path(
        git(
            repo,
            "rev-parse",
            "--absolute-git-dir",
            message="cannot resolve the repository Git directory",
        )
        .decode()
        .strip()
    ).resolve()
    artifact = Path(tempfile.mkdtemp(prefix="darrow-review.", dir=git_dir))
    try:
        return write_scope(artifact, repo, options, base, target, names, layers, packet)
    except BaseException:
        shutil.rmtree(artifact)
        raise


def write_scope(
    artifact: Path,
    repo: Path,
    options: ScopeOptions,
    base: str,
    target: str,
    names: list[str],
    layers: list[str],
    packet: bytes,
) -> str:
    diff = artifact / "diff.patch"
    diff.write_bytes(packet)
    checksum = (
        git(
            repo,
            "hash-object",
            "--no-filters",
            str(diff),
            message="cannot fingerprint the pinned diff",
        )
        .decode()
        .strip()
    )
    label = target
    if any((options.staged, options.unstaged, options.untracked)):
        label = f"WORKTREE@{target}+{checksum}"
    path = str(artifact / "scope.tsv")
    records = [
        ["format", "darrow-review-scope-v1"],
        ["repository", str(repo)],
        ["base_input", options.base],
        ["base", base],
        ["target_input", options.target],
        ["target_commit", target],
        ["target", label],
        ["merge_base", str(int(options.merge_base))],
        ["layers", " ".join(layers)],
        ["diff", str(diff)],
        ["scope_checksum", checksum],
        ["changed_count", str(len(names))],
    ]
    records.extend(["changed_file", str(repo / name)] for name in names)
    records.append(
        [
            "show_command",
            command_line(entrypoint("review-scope", "show", "--manifest", path)),
        ]
    )
    if options.prior_manifest:
        records.extend(
            [
                ["prior_manifest", options.prior_manifest],
                [
                    "repair_show_command",
                    command_line(
                        entrypoint(
                            "review-scope",
                            "compare",
                            "--prior-manifest",
                            options.prior_manifest,
                            "--current-manifest",
                            path,
                        )
                    ),
                ],
            ]
        )
    records.append(["manifest", path])
    body = serialize(records)
    Path(path).write_text(body, encoding="utf-8", newline="\n")
    return body
