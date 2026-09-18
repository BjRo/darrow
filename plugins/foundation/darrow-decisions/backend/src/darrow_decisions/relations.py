"""Validate reciprocal relationships and detect cycles without recursion."""

from collections.abc import Iterator

from .errors import Diagnostics
from .model import EFFECTIVE, IDENTIFIER, Record, relation_ids


def lifecycle_errors(record: Record) -> list[str]:
    result = []
    if record.supersedes and record.status not in EFFECTIVE:
        result.append(
            "Supersedes is allowed only on an Accepted, Deprecated, or Superseded replacement"
        )
    if record.superseded_by and record.status != "Superseded":
        result.append("Superseded by requires status Superseded")
    if not record.superseded_by and record.status == "Superseded":
        result.append("status Superseded requires Superseded by")
    return result


def target_error(
    target: str, source: str, kind: str, seen: set[str], records: dict[str, Record]
) -> str:
    if not IDENTIFIER.fullmatch(target):
        return f"invalid {kind} identifier"
    if target in seen:
        return f"duplicate {kind} target: {target}"
    seen.add(target)
    if target == source:
        return f"an ADR cannot relate to itself through {kind}"
    if target not in records:
        return f"{kind} target does not exist: {target}"
    return ""


def reciprocal_errors(record: Record, target: Record, kind: str) -> list[str]:
    result = []
    if kind == "Supersedes":
        if target.status != "Superseded":
            result.append(f"{target.identifier} must have status Superseded")
        inverse = target.superseded_by
        inverse_name = "Superseded by"
    else:
        if target.status not in EFFECTIVE:
            result.append(
                f"replacement {target.identifier} must have status Accepted, Deprecated, or Superseded"
            )
        inverse = target.supersedes
        inverse_name = "Supersedes"
    if record.identifier not in relation_ids(inverse):
        result.append(
            f"{target.identifier} does not reciprocate {inverse_name} {record.identifier}"
        )
    return result


def validate_targets(
    record: Record, kind: str, records: dict[str, Record], errors: Diagnostics
) -> list[str]:
    value = record.supersedes if kind == "Supersedes" else record.superseded_by
    targets = relation_ids(value)
    if len(targets) > 50:
        errors.add(f"{record.path}: {kind} has more than 50 targets")
    seen: set[str] = set()
    edges = []
    for target in targets:
        error = target_error(target, record.identifier, kind, seen, records)
        if error:
            errors.add(f"{record.path}: {error}")
            continue
        edges.append(target)
        for problem in reciprocal_errors(record, records[target], kind):
            errors.add(f"{record.path}: {problem}")
    return edges


def visit(
    start: str, edges: dict[str, list[str]], state: dict[str, int]
) -> tuple[str, str] | None:
    state[start] = 1
    stack: list[tuple[str, Iterator[str]]] = [(start, iter(edges[start]))]
    while stack:
        source, children = stack[-1]
        target = next(children, None)
        if target is None:
            state[source] = 2
            stack.pop()
        elif state.get(target) == 1:
            return source, target
        elif not state.get(target):
            state[target] = 1
            stack.append((target, iter(edges[target])))
    return None


def validate_relations(inventory: list[Record], errors: Diagnostics) -> None:
    records: dict[str, Record] = {}
    for record in inventory:
        if not record.identifier:
            continue
        if record.identifier in records:
            errors.add(f"duplicate ADR identifier: {record.identifier}")
        else:
            records[record.identifier] = record
    validate_graph(records, errors)


def validate_graph(records: dict[str, Record], errors: Diagnostics) -> None:
    edges = {}
    for identifier, record in records.items():
        for problem in lifecycle_errors(record):
            errors.add(f"{record.path}: {problem}")
        edges[identifier] = validate_targets(record, "Supersedes", records, errors)
        validate_targets(record, "Superseded by", records, errors)
    state: dict[str, int] = {}
    for identifier in records:
        cycle = None if state.get(identifier) else visit(identifier, edges, state)
        if cycle:
            source, target = cycle
            errors.add(
                f"{records[source].path}: supersession relationship cycle detected at edge {source} -> {target}"
            )
            break
