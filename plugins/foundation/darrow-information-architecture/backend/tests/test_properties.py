"""Generated invariants for portable parsing, graph closure, and updates."""

from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_ia.checks import valid_mirror_path
from darrow_ia.graph import reachable
from darrow_ia.references import clean_reference, references
from darrow_ia.updates import replacement_bytes

settings.register_profile(
    "deterministic", derandomize=True, deadline=None, max_examples=60
)
settings.load_profile("deterministic")


@given(
    st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789_-", min_size=1, max_size=30)
)
def test_portable_reference_roundtrip(name: str) -> None:
    value = f"docs/{name}.md"
    assert clean_reference(f"<{value}#anchor>") == value
    assert references(f"Before changes, read `{value}`.\r\n")[0].value == value
    assert references(f"```md\nRead `{value}`.\n```\n") == []
    assert valid_mirror_path(value)
    assert not valid_mirror_path("../" + value)
    assert not valid_mirror_path("C:\\" + value)


@given(
    st.sets(st.tuples(st.integers(0, 15), st.integers(0, 15))),
    st.sets(st.integers(0, 15)),
)
def test_graph_closure(edges: set[tuple[int, int]], seeds: set[int]) -> None:
    pairs = {(Path(str(left)), Path(str(right))) for left, right in edges}
    start = {Path(str(node)) for node in seeds}
    closure = reachable(start, pairs)
    assert start <= closure
    assert all(target in closure for source, target in pairs if source in closure)
    assert reachable(closure, pairs) == closure


@given(
    st.text(
        alphabet=st.characters(
            blacklist_categories=["Cs"], blacklist_characters="\r\ufeff"
        )
    )
)
def test_newline_update_idempotence(text: str) -> None:
    content = text.encode()
    result = replacement_bytes(content, b"\xef\xbb\xbf# Root\r\n")
    assert result.startswith(b"\xef\xbb\xbf")
    assert result.decode("utf-8-sig").replace("\r\n", "\n") == text
    assert replacement_bytes(result, result) == result
