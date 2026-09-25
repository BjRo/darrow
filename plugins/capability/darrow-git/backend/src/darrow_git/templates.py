"""PR template selection and literal Markdown section validation."""

import re
from pathlib import Path

from .process import emit, git, readable, require


def validate_choice(choice: str) -> None:
    require(
        not choice
        or (not choice.startswith(".") and "/" not in choice and "\\" not in choice),
        "--template must be one exact visible filename from .github/PULL_REQUEST_TEMPLATE/",
        2,
    )


def select(choice: str, *, inspecting: bool = False) -> Path | None:
    top = Path(git("rev-parse", "--show-toplevel"))
    single = next(
        (
            top / directory / name
            for directory in (".github", "", "docs")
            for name in ("PULL_REQUEST_TEMPLATE.md", "pull_request_template.md")
            if (top / directory / name).is_file()
        ),
        None,
    )
    if single is not None:
        require(
            not choice,
            f"--template is not valid when the repository has the single template {single}",
            7,
        )
        return single
    directory = top / ".github" / "PULL_REQUEST_TEMPLATE"
    choices = (
        sorted(
            path.name
            for path in directory.iterdir()
            if path.is_file()
            and not path.is_symlink()
            and not path.name.startswith(".")
        )
        if directory.is_dir()
        else []
    )
    return select_multiple(directory, choices, choice, inspecting)


def select_multiple(
    directory: Path, choices: list[str], choice: str, inspecting: bool
) -> Path | None:
    if choice:
        require(
            choice in choices,
            f"selected pr template is not available: {directory / choice}",
            7,
        )
        return directory / choice
    if len(choices) == 1:
        return directory / choices[0]
    if len(choices) > 1:
        require(
            inspecting,
            "multiple PR templates require --template <filename>; run inspect and establish a user choice or explicit delegation",
            7,
        )
        print(
            "## note: multiple PR templates in .github/PULL_REQUEST_TEMPLATE/ — use a user-named template or explicit delegation"
        )
        emit("\n".join(choices), 50)
    return None


def show(path: Path) -> None:
    relative = path.relative_to(git("rev-parse", "--show-toplevel"))
    if not readable(path):
        print(
            f"## note: pr template {relative} exists but is not readable — fix its permissions; create will refuse"
        )
        return
    print(
        f"## pr template ({relative}) — the body must follow it: keep headings verbatim, fill every section, follow comment instructions then delete the comments"
    )
    text = path.read_text(encoding="utf-8")
    emit(text, 100)
    count = len(text.splitlines())
    if count > 100:
        print(
            f"## note: template truncated at 100 lines ({count} total) — read {path} for the rest"
        )


def markdown_lines(text: str) -> list[tuple[str, int, bool]]:
    """Preserve the facade's ATX/fence semantics, including indented headings."""
    fenced = False
    lines = []
    for line in text.removeprefix("\ufeff").splitlines():
        fence = bool(re.match(r"^ {0,3}(```|~~~)", line))
        if fence:
            fenced = not fenced
        heading = re.match(r"^ {0,3}(#{1,6})[ \t]", line)
        level = len(heading[1]) if heading and not (fenced or fence) else 0
        lines.append((line.rstrip(), level, fenced or fence))
    return lines


def section_state(body: list[tuple[str, int, bool]], heading: str, level: int) -> str:
    start = next(
        (
            index
            for index, (line, _, fenced) in enumerate(body)
            if line == heading and not fenced
        ),
        None,
    )
    if start is None:
        return "missing from"
    for line, next_level, _ in body[start + 1 :]:
        if next_level and next_level <= level:
            break
        if line.strip():
            return ""
    return "empty in"


def validate(path: Path | None, body: str) -> None:
    if path is None:
        return
    require(
        readable(path), f"pr template is not readable: {path} — fix its permissions", 3
    )
    relative = path.relative_to(git("rev-parse", "--show-toplevel"))
    body_lines = markdown_lines(body)
    for heading, level, _ in markdown_lines(path.read_text(encoding="utf-8")):
        if level:
            state = section_state(body_lines, heading, level)
            require(
                not state,
                f"template section {state} the body: {heading} ({relative})",
                7,
            )
    require(
        not any("<!--" in line and not fenced for line, _, fenced in body_lines),
        "body still contains template comments (<!-- ... -->) — follow their instructions, then remove them",
        7,
    )
