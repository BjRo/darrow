from __future__ import annotations

import json
import tempfile
from pathlib import Path

from hypothesis import event, given, note, settings
from hypothesis import strategies as st

from darrow_adaptive_goal.common import PLUGIN, read_text
from darrow_adaptive_goal.fixtures.state import checksum
from darrow_adaptive_goal.placement import json_records, observed, relation
from darrow_adaptive_goal.routes import EFFORT_ORDER, FIELDS, SAFE_VALUE, parse_document


@settings(max_examples=50, derandomize=True)
@given(st.from_regex(r"[A-Za-z0-9][A-Za-z0-9._-]{0,30}", fullmatch=True))
def test_route_json_round_trip(model: str) -> None:
    values = ("codex", "routine", "codex", "openai", model, "high", "none", "none")
    row = dict(zip(FIELDS, values, strict=True))
    forward = json.dumps({"routes": [row]}, ensure_ascii=True)
    reverse = json.dumps(
        {
            "reviewers": [False, {"future": 1}],
            "routes": [dict(reversed(list(row.items())))],
        }
    )
    assert parse_document(forward) == parse_document(reverse)
    assert parse_document(forward)[0].tuple == ("codex", "openai", model, "high")


@settings(max_examples=50, derandomize=True)
@given(st.binary(max_size=512))
def test_checksum_matches_posix_polynomial(data: bytes) -> None:
    # Independent bit-string polynomial division oracle, including encoded length.
    suffix = len(data).to_bytes((len(data).bit_length() + 7) // 8, "little")
    message = int.from_bytes(data + suffix, "big") << 32
    polynomial = (1 << 32) | 0x04C11DB7
    while message.bit_length() >= polynomial.bit_length():
        message ^= polynomial << (message.bit_length() - polynomial.bit_length())
    assert checksum(data) == f"{message ^ 0xFFFFFFFF} {len(data)}"


ROUTES = parse_document(read_text(PLUGIN / "config/routes.json", "routes"))
CODEX_MODELS = ("gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra", "future-model")
codex_routes = st.tuples(
    st.just("codex"),
    st.just("openai"),
    st.sampled_from(CODEX_MODELS),
    st.sampled_from(EFFORT_ORDER),
)
MIRROR = {"same": "same", "lower": "higher", "higher": "lower", "unknown": "unknown"}


@settings(max_examples=200, derandomize=True)
@given(codex_routes, codex_routes)
def test_relation_is_same_only_for_equal_routes_and_mirrors(
    main: tuple[str, str, str, str], selected: tuple[str, str, str, str]
) -> None:
    forward = relation(main, selected, ROUTES)
    assert (forward == "same") == (main == selected)
    assert relation(selected, main, ROUTES) == MIRROR[forward]


@settings(max_examples=100, derandomize=True)
@given(st.binary(max_size=512))
def test_session_parser_never_raises_and_yields_only_objects(data: bytes) -> None:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "session.jsonl"
        path.write_bytes(data)
        assert all(isinstance(item, dict) for item in json_records(path))


json_values = st.recursive(
    st.none() | st.booleans() | st.integers() | st.text(max_size=12),
    lambda inner: (
        st.lists(inner, max_size=3)
        | st.dictionaries(st.text(max_size=8), inner, max_size=3)
    ),
    max_leaves=8,
)
route_models = st.sampled_from([*CODEX_MODELS, "claude-opus-5-5", "none"])
route_model_values = route_models | json_values
route_effort_values = st.sampled_from(EFFORT_ORDER) | json_values
route_fields = st.fixed_dictionaries(
    {},
    optional={
        "type": st.sampled_from(["turn_context", "assistant", "user"]) | json_values,
        "payload": st.fixed_dictionaries(
            {}, optional={"model": route_model_values, "effort": route_effort_values}
        )
        | json_values,
        "message": st.fixed_dictionaries({}, optional={"model": route_model_values})
        | json_values,
    },
)


@settings(max_examples=100, derandomize=True)
@given(
    st.sampled_from(["codex", "claude"]),
    st.lists(route_fields, max_size=4),
    st.sampled_from(["", "low", "unknown", "high"]),
)
def test_observed_route_is_unknown_or_safe(
    host: str, items: list[dict[str, object]], effort: str
) -> None:
    note(f"host={host}")
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        if host == "codex":
            path = root / "sessions/2026/rollout-x-thread.jsonl"
            env = {"CODEX_HOME": directory, "CODEX_THREAD_ID": "thread"}
        else:
            path = root / "projects/repo/session.jsonl"
            env = {
                "CLAUDE_CONFIG_DIR": directory,
                "CLAUDE_CODE_SESSION_ID": "session",
                "CLAUDE_EFFORT": effort,
            }
        path.parent.mkdir(parents=True)
        path.write_text("".join(json.dumps(item) + "\n" for item in items))
        route = observed(host, env)
    event("observed" if route else "unknown")
    assert route is None or (
        SAFE_VALUE.fullmatch(route[2]) is not None
        and route[2] != "none"
        and route[3] in EFFORT_ORDER
    )
