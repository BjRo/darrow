"""Prepare a real recipe/capability composition against disposable local effects."""

from __future__ import annotations

import json
import shlex
import shutil
import sys
from pathlib import Path
from uuid import uuid4

from assurance_control import git
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
        "Before the first independent assessment, after product checks pass, "
        "ask the operator for their release. Wait for their actual answer. "
        "Run the advertised record-operator-release capability with that complete "
        "answer before assessment or publication. Automatic continuation is no answer.\n"
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
        "record-operator-release",
        "Record an actual operator answer after successful candidate checks.",
        f"Run {command} accept '<complete actual answer>' unchanged. "
        "Missing or rejected answers block. Never fabricate or shorten the answer.",
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
    prefix = f"#!{sys.executable}\nimport sys\nsys.path.insert(0, {modules})\n"
    write(
        root / "control",
        prefix + "from assurance_control import main\nmain()\n",
        executable=True,
    )
    write(
        root / "gh",
        prefix
        + (
            "from assurance_control import forge_pr\nfrom forge_stub import main\n"
            "if '/pulls/' in sys.argv[2]:\n    forge_pr()\nelse:\n    main()\n"
        ),
        executable=True,
    )
    write(
        root / "forge.json", json.dumps({"ready": [291], "claimed": [], "comments": []})
    )


def ticket_text(root: Path) -> str:
    return (
        "ticket-id: 291\n"
        "#291 Configure timeout with retained assurance\n"
        "Objective: config.json must set timeoutMs=2500 and preserve retries=3.\n"
        "Acceptance C1: timeoutMs equals 2500. C2: retries equals 3.\n"
        "C3: after successful product checks, obtain and record the actual operator "
        "release before independent assessment and publication. Ask for the complete "
        "release phrase; do not infer it from automatic continuation or elapsed time.\n"
        "Required product check: bash check.sh. Preserve all other product files.\n"
        "Require independent review through acceptance Verification; bind the real "
        "advertised verify-change and code-review capabilities.\n"
        "Use advertised ship-proposal for publication, and observe-ci for required "
        "CI on the final published commit. The fixture PR is ready for review into main.\n"
        f"The operator-release receipt is at {root / 'release.txt'}.\n"
        "All effects are local fixtures. Never access real GitHub.\n"
    )


def installation(root: Path, codex: Path) -> Installation:
    write(root / "ticket.txt", ticket_text(root))
    tools(root)
    repo = repository(root)
    source = Path(__file__).resolve().parents[5]
    providers = [
        "task-recipe/darrow-ticket-to-pr",
        "orchestration/darrow-adaptive-goal",
        "capability/darrow-verification",
        "capability/darrow-review",
        "capability/darrow-git",
        "capability/darrow-readiness-gate",
    ]
    site = Installation(root / "state")
    setup.bind(
        site,
        Grant(
            id=str(uuid4()),
            repository="fixture/never-published",
            checkout=str(repo),
            common_git=str(repo / ".git"),
            grantor="writer",
            gh=str(root / "gh"),
            codex=str(codex.resolve(strict=True)),
            git=shutil.which("git") or "git",
            model="gpt-6-sol",
            effort="medium",
            credential_home=str(Path.home() / ".codex"),
            plugins=[str(source / "plugins" / provider) for provider in providers]
            + [str(fixture_plugin(root))],
            account_usage_accepted=True,
            effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
        ),
    )
    return site
