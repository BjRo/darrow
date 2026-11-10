"""Prepare a real recipe/capability composition against disposable local effects."""

from __future__ import annotations

import json
import shlex
import shutil
import sys
from pathlib import Path
from uuid import uuid4

from assurance_control import FIXTURE_REPOSITORY, git
from darrow_artificer import setup
from darrow_artificer.installation import Installation
from darrow_artificer.models import Grant


def write(path: Path, value: str, *, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)
    if executable:
        path.chmod(0o700)


def repository(root: Path) -> Path:
    repo = root / "repository"
    repo.mkdir()
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.name", "Fixture")
    git(repo, "config", "user.email", "fixture@example.invalid")
    write(repo / "config.json", '{"timeoutMs":1000,"retries":3}\n')
    write(
        repo / "check.sh",
        (
            "#!/bin/sh\nset -eu\n"
            + shlex.quote(sys.executable)
            + ' -c \'import json; assert json.load(open("config.json")) == '
            '{"timeoutMs":2500,"retries":3}\'\n'
        ),
    )
    write(repo / "AGENTS.md", guidance(root))
    write(repo / "SPEC.md", (root / "ticket.txt").read_text())
    git(repo, "add", ".")
    git(repo, "commit", "-m", "chore: initialize assurance fixture")
    remote = root / "remote.git"
    remote.mkdir()
    git(remote, "init", "--bare", "-b", "main")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-u", "origin", "main")
    git(repo, "remote", "set-head", "origin", "main")
    return repo


def guidance(root: Path) -> str:
    return (
        "# Fixture instructions\n\nRun bash check.sh before and after changing config.json.\n"
        "Use SPEC.md as originating acceptance. Only config.json may change.\n"
        "This is an authorized local engineering integration fixture. All forge "
        "effects use the advertised fixture capabilities and local bare remote. "
        "Never contact real GitHub or alter other repositories.\n"
        f"Use DARROW_REVIEW_STATE_DIR={root / 'reviews'} for review artifacts and "
        f"DARROW_CACHE_DIR={root / 'cache'} for locked plugin environments. "
        "Preserve these configured paths in every helper invocation.\n"
    )


def skill(plugin: Path, name: str, description: str, body: str) -> None:
    write(
        plugin / "skills" / name / "SKILL.md",
        f"---\nname: {name}\ndescription: {description}\n---\n\n{body}\n",
    )


def fixture_plugin(root: Path) -> Path:
    plugin = root / "fixture-assurance"
    write(
        plugin / ".codex-plugin/plugin.json",
        json.dumps(
            {
                "name": "fixture-assurance",
                "version": "1.0.0",
                "skills": "./skills/",
            }
        ),
    )
    command = shlex.quote(str(root / "control"))
    skill(
        plugin,
        "read-ticket",
        "Read one exact authoritative current-project ticket without mutation.",
        f"Run {command} ticket '<complete ticket URL>' once and retain its complete output.",
    )
    skill(
        plugin,
        "ship-proposal",
        "Publish a committed branch to one authorized pull request with verified head evidence.",
        f"After current checks and complete clear verification, run {command} publish "
        "'<intended full commit ID>'. This writes only the local fixture remote and "
        "proposal receipt. Return its complete result. It grants no commit or merge authority.",
    )
    skill(
        plugin,
        "observe-ci",
        "Observe required CI for an exact published commit.",
        f"Run {command} ci '<intended full commit ID>'. Return its complete result. "
        "Unavailable or mismatched evidence blocks completion.",
    )
    return plugin


def tools(root: Path) -> None:
    modules = repr(str(Path(__file__).resolve().parent))
    prefix = f"#!{sys.executable}\nimport os, sys\nsys.path.insert(0, {modules})\n"
    write(
        root / "control",
        prefix + "from assurance_control import main\nmain()\n",
        executable=True,
    )
    write(
        root / "gh",
        prefix
        + f"os.environ['ARTIFICER_TEST_STATE'] = {str(root)!r}\n"
        + "from service_stub import main\nmain()\n",
        executable=True,
    )
    write(
        root / "forge.json", json.dumps({"ready": [291], "claimed": [], "comments": []})
    )


def ticket_text() -> str:
    return (
        "ticket-id: 291\n"
        "#291 Configure timeout with retained assurance\n"
        "Objective: config.json must set timeoutMs=2500 and preserve retries=3.\n"
        "Acceptance C1: timeoutMs equals 2500. C2: retries equals 3.\n"
        "Required product check: bash check.sh. Preserve all other product files.\n"
        "Require independent review through acceptance Verification; bind the real "
        "advertised verify-change and code-review capabilities.\n"
        "Use advertised ship-proposal for publication, and observe-ci for required "
        "CI on the final published commit. The fixture PR is ready for review into main.\n"
        "All effects are local fixtures. Never access real GitHub.\n"
    )


PROVIDERS = (
    "task-recipe/darrow-ticket-to-pr",
    "orchestration/darrow-adaptive-goal",
    "capability/darrow-verification",
    "capability/darrow-review",
    "capability/darrow-git",
    "capability/darrow-readiness-gate",
)


def installation(root: Path, codex: Path, profile: Path | None = None) -> Installation:
    write(root / "ticket.txt", ticket_text())
    tools(root)
    repo = repository(root)
    site = Installation(root / "state")
    setup.bind(
        site,
        Grant(
            id=str(uuid4()),
            repository=FIXTURE_REPOSITORY,
            checkout=str(repo),
            common_git=str(repo / ".git"),
            grantor="writer",
            executable=str(codex.resolve(strict=True)),
            profile_dir=None if profile is None else str(profile),
            gh=str(root / "gh"),
            git=shutil.which("git") or "git",
            effects="claims,reports,worktrees,recipe,commits,push,pr",
        ),
    )
    return site


def route_options(model: str, effort: str) -> dict[str, str]:
    return {
        "model": model,
        "model_reasoning_effort": effort,
        "model_provider": "openai",
        "forced_login_method": "chatgpt",
        "cli_auth_credentials_store": "file",
    }


def profile(model: str, effort: str) -> str:
    """The unattended host profile Artificer inherits instead of configuring."""
    values = {
        **route_options(model, effort),
        "approval_policy": "never",
        "sandbox_mode": "danger-full-access",
    }
    return "".join(f"{key} = {json.dumps(value)}\n" for key, value in values.items())


def codex_home(
    home: Path, credentials: Path, model: str, effort: str, plugins: list[Path]
) -> Path:
    """Prepare an isolated host profile with this checkout's plugins installed."""
    home.mkdir(mode=0o700, parents=True)
    if not (credentials / "auth.json").is_file():
        raise ValueError(f"Run normal Codex ChatGPT login in {credentials}")
    (home / "auth.json").symlink_to(credentials / "auth.json")
    write(home / "config.toml", profile(model, effort))
    for plugin in plugins:
        source = plugin.resolve(strict=True)
        manifest = json.loads((source / ".codex-plugin/plugin.json").read_text())
        shutil.copytree(
            source,
            home / "skills" / str(manifest["name"]),
            ignore=shutil.ignore_patterns(
                ".venv", "__pycache__", ".git", "evals", "tests"
            ),
        )
    return home


def fixture_plugins(root: Path) -> list[Path]:
    source = Path(__file__).resolve().parents[5]
    return [source / "plugins" / provider for provider in PROVIDERS] + [
        fixture_plugin(root)
    ]
