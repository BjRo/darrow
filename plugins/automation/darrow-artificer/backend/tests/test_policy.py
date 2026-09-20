"""Shared admission and explicit human-reply contracts."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_artificer.policy import Limits, allowance, reply_payload


@pytest.mark.parametrize(
    ("wip", "starts", "occupied", "eligible", "expected"),
    [
        (5, 1, 2, 9, 1),
        (5, 3, 2, 9, 3),
        (5, 3, 5, 9, 0),
        (0, 3, 2, 9, 0),
        (5, 3, 2, 1, 1),
        (1, 1, 3, 4, 0),
    ],
)
def test_admission(
    wip: int, starts: int, occupied: int, eligible: int, expected: int
) -> None:
    assert allowance(Limits(wip, starts), occupied, eligible) == expected


def test_defaults() -> None:
    assert Limits() == Limits(1, 1, 5, 900)


@pytest.mark.parametrize("value", [-1, 0, 1.5, True, "1", None])
def test_invalid_start_limit(value: object) -> None:
    with pytest.raises(ValueError, match="MAX_STARTS_PER_ACTIVATION"):
        Limits.from_mapping({"MAX_STARTS_PER_ACTIVATION": value})


@pytest.mark.parametrize("field", ["SESSION_RETENTION_DAYS", "SCHEDULE_SECONDS"])
def test_invalid_positive_settings(field: str) -> None:
    with pytest.raises(ValueError, match=field):
        Limits.from_mapping({field: 0})


def test_invalid_wip() -> None:
    with pytest.raises(ValueError, match="WORK_IN_PROGRESS_LIMIT"):
        Limits.from_mapping({"WORK_IN_PROGRESS_LIMIT": -1})
    assert Limits.from_mapping({"WORK_IN_PROGRESS_LIMIT": 0}).wip == 0


@settings(derandomize=True)
@given(
    st.integers(0, 100), st.integers(1, 100), st.integers(0, 100), st.integers(0, 100)
)
def test_allowance_bounds(wip: int, starts: int, occupied: int, eligible: int) -> None:
    count = allowance(Limits(wip, starts), occupied, eligible)
    assert 0 <= count <= min(starts, eligible)
    assert count <= max(0, wip - occupied)


@pytest.mark.parametrize(
    "body",
    [
        "Sounds good",
        "/artificer reply d q",
        "/artificer reply other q\nanswer",
        "/artificer reply d other\nanswer",
        "prefix /artificer reply d q\nanswer",
        "/artificer reply d q\n  ",
    ],
)
def test_nonreply(body: str) -> None:
    assert reply_payload(body, "d", "q") is None


@settings(derandomize=True)
@given(st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_preserves_payload(payload: str) -> None:
    assert reply_payload("/artificer reply d q\n" + payload, "d", "q") == payload
