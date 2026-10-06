"""Allocate one diagnostic-only correction for an already bound native reader."""

from __future__ import annotations

from pathlib import Path

from . import reader_inputs, routing
from .common import document, new_record, record_file, require, serialize


def feedback(path: str, agent: str, error: str) -> str:
    require(error.strip(), "reader correction requires the concrete diagnostic", 4)
    packet = reader_inputs.load(path)
    axis = str(packet["axis"])
    run = Path(path).parent
    application = document(record_file(str(run / f"{axis}-route.json")))
    require(
        application.get("format") == "darrow-reviewer-route-application-v3"
        and application.get("axis") == axis
        and application.get("agent_id") == agent
        and application.get("route_bound") == "true"
        and application.get("route_applied_by") == "native-subagent",
        "reader correction must use the same route-bound child",
        4,
    )
    selected = application.get("selected_route")
    host = "claude" if "observed_route" in application else "codex"
    route = routing.load_route(str(run / "reviewer-route.json"), host)
    require(selected == route.as_object(), "reader correction route changed", 4)
    message = (
        "Continue your own assigned review. Correct only the input-read or record-format "
        "failure below; retain independent judgment and any supported findings. "
        "Unavailable review inputs are evidence gaps, not product findings. "
        "Do not change axis, target, route, or authority. This is the only correction round.\n\n"
        "Concrete diagnostic:\n"
        + error
        + "\n\nAuthoritative task:\n"
        + reader_inputs.launch_message(path, packet)
    )
    record = {"agent_id": agent, "input": path, "diagnostic": error, "message": message}
    location = new_record(str(run / f"{axis}-correction.json"), serialize(record))
    return serialize({"agent_id": agent, "message": message, "record": str(location)})
