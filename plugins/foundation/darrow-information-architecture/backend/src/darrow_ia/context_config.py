"""Narrow root scalar extraction; deliberately not a TOML implementation."""

import re
from pathlib import Path

LIMIT = re.compile(
    r"""^\s*(?:model_auto_compact_token_limit|"model_auto_compact_token_limit"|'model_auto_compact_token_limit')\s*=\s*([^#]*)(?:#.*)?$"""
)


LEXEMES = re.compile("\"\"\"|\\'\\'\\'|\"(?:\\\\.|[^\"\\\\])*\"|\\'[^\\']*\\'|#.*$")


def multiline_quote(line: str, quote: str) -> str:
    if quote:
        pattern = r'(?<!\\)(?:\\\\)*"""' if quote == '"""' else re.escape(quote)
        closing = re.search(pattern, line)
        return multiline_quote(line[closing.end() :], "") if closing else quote
    for match in LEXEMES.finditer(line):
        if match[0] in ('"' * 3, "'" * 3):
            return multiline_quote(line[match.end() :], match[0])
    return ""


def root_lines(text: str) -> list[str]:
    result = []
    quote = ""
    for line in text.splitlines():
        if quote:
            quote = multiline_quote(line, quote)
            continue
        if line.lstrip().startswith("["):
            break
        result.append(line)
        quote = multiline_quote(line, quote)
    return result


def compact_limit(home: Path) -> int | None:
    path = home / "config.toml"
    text = path.read_text(encoding="utf-8")
    matches = [
        match[1].strip()
        for line in root_lines(text)
        if (match := LIMIT.fullmatch(line))
    ]
    if not matches:
        return None
    if len(matches) != 1 or not re.fullmatch(r"[0-9]+(?:_[0-9]+)*", matches[0]):
        raise ValueError(f"{path}: invalid or duplicate model_auto_compact_token_limit")
    value = int(matches[0].replace("_", ""))
    if value <= 0:
        raise ValueError(f"{path}: model_auto_compact_token_limit must be positive")
    return value
