"""Copy isolated fixture providers and inert templates into host-visible locations."""

from __future__ import annotations

import shutil
from pathlib import Path

from ..common import PLUGIN, RefusalError
from . import readiness
from .state import append, metadata

IGNORE = shutil.ignore_patterns(
    ".venv",
    "__pycache__",
    ".hypothesis",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".coverage*",
    "coverage.json",
    "tests",
)
HOSTS = {"codex": (".agents",), "claude": (".claude",), "both": (".agents", ".claude")}
SKILLS = {
    "readiness": ("implementation-readiness", "assess-implementation-readiness"),
    "review": ("independent-review", "independent-code-review"),
    "verification": ("verification", "assess-candidate"),
}


def template(kind: str, root: str) -> str:
    return (
        "SKILL.claude.fixture.md"
        if (kind, root) == ("readiness", ".claude")
        else "SKILL.fixture.md"
    )


def install_skills(
    repo: Path, root: str, fixtures: Path, kinds: tuple[str, ...]
) -> None:
    for selected in kinds:
        source, name = SKILLS[selected]
        destination = repo / root / "skills" / name
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(
            fixtures / source / template(selected, root), destination / "SKILL.md"
        )


def copy_backend(plugin: Path, backend: Path, kind: str) -> None:
    shutil.copytree(plugin / "backend", backend, dirs_exist_ok=True, ignore=IGNORE)
    if kind != "verification":
        (backend / "src/darrow_adaptive_delivery/fixtures/verification.py").unlink(
            missing_ok=True
        )


def install(
    kind: str, repo: Path, fixtures: Path, host: str, plugin: Path = PLUGIN
) -> str:
    if host not in HOSTS or kind not in SKILLS:
        raise RefusalError(
            "install requires readiness|review|verification REPO FIXTURE_DIR codex|claude|both"
        )
    git_dir = metadata(repo)
    (git_dir / "fixture-state").mkdir(exist_ok=True)
    kinds = ("review", "verification") if kind == "verification" else (kind,)
    for root in HOSTS[host]:
        backend = repo / root / "backend"
        copy_backend(plugin, backend, kind)
        install_skills(repo, root, fixtures, kinds)
        if kind in {"readiness", "verification"}:
            append(git_dir / "info/exclude", f"/{root}/\n")
    if kind == "readiness" and host in {"claude", "both"}:
        (git_dir / "fixture-state/implementation-readiness-result").write_text(
            readiness.assess(repo, "render-only"), encoding="utf-8", newline="\n"
        )
    return ""
