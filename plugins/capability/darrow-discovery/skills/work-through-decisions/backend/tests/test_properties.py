import string

from hypothesis import given
from hypothesis import strategies as st

from darrow_discovery.frontier import Frontier, render

words = st.lists(
    st.text(alphabet=string.ascii_letters, min_size=1, max_size=12),
    min_size=1,
    max_size=5,
).map(" ".join)


@given(evidence=words, rationale=words, deferred=words, terminal_period=st.booleans())
def test_rendered_prose_has_one_terminal_period(
    evidence: str, rationale: str, deferred: str, terminal_period: bool
) -> None:
    suffix = "." if terminal_period else ""
    rendered = render(
        Frontier(
            evidence=f"{evidence}{suffix}",
            question="Scope: local or shared?",
            options=("local", "shared"),
            choice="local",
            rationale=f"{rationale}{suffix}",
            deferred=f"{deferred}{suffix}",
        )
    )

    assert rendered.startswith(f"Evidence: {evidence}.\n")
    assert f"because {rationale}.\n" in rendered
    assert f"Deferred: {deferred}. After" in rendered
