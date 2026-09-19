from __future__ import annotations

import json

from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_adaptive_delivery.fixtures.state import checksum
from darrow_adaptive_delivery.routes import FIELDS, parse_document


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
