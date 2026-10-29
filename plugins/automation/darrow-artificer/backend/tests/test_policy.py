"""Admission arithmetic remains bounded to one ticket per worker."""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_artificer.policy import Limits, allowance


@settings(derandomize=True)
@given(st.integers(0, 100), st.integers(0, 100), st.integers(0, 100))
def test_allowance_bounds(wip: int, occupied: int, eligible: int) -> None:
    count = allowance(Limits(wip), occupied, eligible)
    assert 0 <= count <= min(1, eligible, max(0, wip - occupied))


@pytest.mark.parametrize("value", [-1, 1.5, True, "1", None])
def test_invalid_wip(value: object) -> None:
    with pytest.raises(ValueError, match="WORK_IN_PROGRESS_LIMIT"):
        Limits.from_mapping({"WORK_IN_PROGRESS_LIMIT": value})


def test_settings() -> None:
    assert Limits.from_mapping({}) == Limits(1, 900)
    with pytest.raises(ValueError, match="SCHEDULE_SECONDS"):
        Limits.from_mapping({"SCHEDULE_SECONDS": 0})
