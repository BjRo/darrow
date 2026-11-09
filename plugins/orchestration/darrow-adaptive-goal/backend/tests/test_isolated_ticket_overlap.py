from __future__ import annotations

import pytest

from evals.isolated_ticket_batch import Worker
from evals.isolated_ticket_overlap import verify_sequence


@pytest.mark.parametrize("defect", ["none", "same-worker", "overlap", "unlanded"])
def test_overlapping_tickets_wait_for_completion_and_landing(defect: str) -> None:
    workers = [Worker("first", 1, 4, {"a"}), Worker("second", 7, 9, {"b"})]
    events = [{"branch": "integration", "time_ns": 6}]
    if defect == "same-worker":
        workers[1] = workers[1]._replace(identity="first")
    if defect == "overlap":
        workers[1] = workers[1]._replace(accepted=3)
    if defect == "unlanded":
        events[0]["time_ns"] = 8
    if defect == "none":
        verify_sequence(workers, events, "integration")
    else:
        with pytest.raises(AssertionError):
            verify_sequence(workers, events, "integration")
