"""Local, transactional rollout indexing and immutable delivery envelopes."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any

from .config import Config
from .lifecycle import file_identity, register_rollout, terminal_records
from .rollout import attribution_snapshot, parse_rollout, trace_document
from .sidecar import (_load_state, load_provisional_attribution_snapshots,
                      discard_provisional_attribution_snapshots)

PARSER_VERSION = 2


def _redact_state(value, config):
    if isinstance(value, str):
        for credential in (config.public_key, config.secret_key):
            if credential:
                value = value.replace(credential, "[REDACTED]")
        return value
    if isinstance(value, list):
        return [_redact_state(item, config) for item in value]
    if isinstance(value, dict):
        return {key: _redact_state(item, config) for key, item in value.items()}
    return value


def _private_cursor(cursor, config):
    result = _redact_state(cursor, config)
    # JSONL tail bytes are parser input, not base64 credentials. Redact the
    # decoded bytes as well, keeping the committed source offset unchanged.
    tail = base64.b64decode(cursor["tail"])
    for credential in (config.public_key, config.secret_key):
        if credential:
            tail = tail.replace(credential.encode(), b"[REDACTED]")
    result["tail"] = base64.b64encode(tail).decode()
    return result


def database_path(rollout: Path) -> Path:
    return Path(f"{rollout.resolve()}.darrow-langfuse.sqlite3")


@contextmanager
def database(rollout: Path):
    path = database_path(rollout)
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    os.close(descriptor)
    connection = sqlite3.connect(path, timeout=30, isolation_level=None)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA synchronous=FULL")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS envelopes (
                turn_id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL,
                document TEXT NOT NULL, expected_count INTEGER NOT NULL,
                state TEXT NOT NULL CHECK(state IN ('pending','acknowledged','uncertain')),
                reason TEXT, capture_pid INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS legacy (turn_id TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS snapshots (turn_id TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS indexed_turns (turn_id TEXT PRIMARY KEY, trace TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS turn_starts (turn_id TEXT PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS captured_turns (
                turn_id TEXT PRIMARY KEY, turn TEXT, session TEXT NOT NULL,
                source_end INTEGER NOT NULL, finalized INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS receipts (
                turn_id TEXT PRIMARY KEY, kind TEXT NOT NULL, capture_content INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS envelopes_state ON envelopes(state);
            CREATE INDEX IF NOT EXISTS captured_turns_pending ON captured_turns(finalized);
        """)
        yield connection
    finally:
        connection.close()


def _get(connection, key, default=None):
    row = connection.execute("SELECT value FROM state WHERE key=?", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def _put(connection, key, value):
    connection.execute("INSERT OR REPLACE INTO state VALUES (?,?)", (key, json.dumps(value)))


def observation_count(trace):
    def children_count(children):
        return sum(1 + children_count(child.get("children", [])) for child in children)
    return 1 + children_count(trace.get("observations", []))


def _read_incremental(path: Path, checkpoint: dict, consume, max_offset=None):
    """Stream appended complete JSONL records; retain only an incomplete line."""
    if not path.is_absolute() or not path.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    with path.open("rb") as handle:
        stat = os.fstat(handle.fileno())
        identity = file_identity(stat)
        reset = (checkpoint.get("version") != PARSER_VERSION
                 or checkpoint.get("identity") != identity
                 or stat.st_size < checkpoint.get("offset", 0))
        if reset:
            checkpoint.clear()
            checkpoint.update(version=PARSER_VERSION, identity=identity, offset=0, tail="", parser={})
        handle.seek(checkpoint["offset"])
        pending = base64.b64decode(checkpoint["tail"], validate=True)
        bytes_read = 0
        while True:
            remaining = 65536 if max_offset is None else max(0, min(65536, max_offset - checkpoint["offset"]))
            chunk = handle.read(remaining)
            if not chunk:
                break
            bytes_read += len(chunk)
            checkpoint["offset"] += len(chunk)
            line_offset = checkpoint["offset"] - len(pending) - len(chunk)
            lines = (pending + chunk).split(b"\n")
            pending = lines.pop()
            for line in lines:
                line_offset += len(line) + 1
                checkpoint["record_offset"] = line_offset
                try:
                    value = json.loads(line)
                except (ValueError, UnicodeDecodeError):
                    continue
                if isinstance(value, dict) and isinstance(value.get("payload"), dict):
                    consume(value, checkpoint, reset)
        checkpoint["tail"] = base64.b64encode(pending).decode("ascii")
        return bytes_read, reset


def delivery_rows(rollout: Path):
    with database(rollout) as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM envelopes ORDER BY rowid")]


def load_capture_snapshots(rollout: Path):
    path = database_path(rollout)
    if not path.exists():
        return {}
    connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    try:
        return {row[0]: json.loads(row[1]) for row in connection.execute("SELECT * FROM snapshots")}
    finally:
        connection.close()


def capture(rollout: Path, config: Config, cwd: str, session_id: str,
            turn_id: str | None, plugin_data: Path | None) -> dict[str, int]:
    if not rollout.is_absolute():
        raise ValueError("transcript_path must name a readable absolute file")
    # Validate installed evidence before opening or modifying the new store.
    legacy = _load_state(rollout)
    canonical = rollout.resolve()
    if canonical != rollout:
        other = _load_state(canonical)
        legacy = {"uploaded_turn_ids": list(set(legacy["uploaded_turn_ids"] + other["uploaded_turn_ids"])),
                  "attribution_snapshots": {**legacy["attribution_snapshots"], **other["attribution_snapshots"]}}
    rollout = canonical
    provisional = (load_provisional_attribution_snapshots(plugin_data, session_id)
                   if plugin_data is not None else {})
    terminal = list(terminal_records(rollout, session_id))
    with database(rollout) as connection:
        connection.execute("BEGIN IMMEDIATE")
        try:
            for identifier in legacy["uploaded_turn_ids"]:
                connection.execute("INSERT OR IGNORE INTO legacy VALUES (?)", (identifier,))
            for identifier, snapshot in legacy["attribution_snapshots"].items():
                connection.execute("INSERT OR IGNORE INTO snapshots VALUES (?,?)",
                                   (identifier, json.dumps(snapshot)))
                connection.execute("INSERT OR IGNORE INTO receipts VALUES (?,?,?)",
                                   (identifier, "legacy", int(config.capture_content)))
            snapshots = {row[0]: json.loads(row[1]) for row in connection.execute("SELECT * FROM snapshots")}
            effective = {**provisional, **snapshots}
            checkpoint = _get(connection, "rollout", {})
            timeline = _get(connection, "attribution", {})
            total_bytes = 0
            rebuilt = False
            promoted = set()

            def subagent_loader(path):
                nonlocal total_bytes
                key = f"subagent:{path}"
                cursor = _get(connection, key, {})
                child_turns = []
                def consume_child(record, state, reset):
                    _, completed = parse_rollout([record], state=state["parser"], finalize=False)
                    child_turns.extend(completed)
                count, reset = _read_incremental(path, cursor, consume_child)
                total_bytes += count
                saved = [] if reset else cursor.get("turns", [])
                saved.extend(child_turns)
                cursor["turns"] = saved
                child_session, active = parse_rollout([], state=cursor["parser"], finalize=True)
                _put(connection, key, _private_cursor(cursor, config))
                return child_session, saved + active

            def index_turn(turn, session):
                identifier = turn.get("turn_id")
                if not isinstance(identifier, str) or not identifier:
                    return
                # Capture is independent of attribution finalization. A later
                # hook must not freeze a predecessor's provisional evidence.
                row = connection.execute("SELECT finalized FROM captured_turns WHERE turn_id=?",
                                         (identifier,)).fetchone()
                if row is not None and row[0]:
                    return
                if row is not None and connection.execute(
                    "SELECT 1 FROM receipts WHERE turn_id=?", (identifier,)
                ).fetchone():
                    return
                if identifier == turn_id or connection.execute(
                    "SELECT 1 FROM receipts WHERE turn_id=? AND kind IN ('Stop','legacy')", (identifier,)
                ).fetchone():
                    turn["completed"] = True
                values = (json.dumps(_redact_state(turn, config)),
                          json.dumps(_redact_state(session, config)), checkpoint.get("record_offset", checkpoint["offset"]), identifier)
                if row is None:
                    connection.execute("INSERT INTO captured_turns (turn,session,source_end,turn_id) VALUES (?,?,?,?)", values)
                else:
                    connection.execute("UPDATE captured_turns SET turn=?,session=?,source_end=? WHERE turn_id=?", values)

            def materialize(identifier, trace):
                snapshot = effective.get(identifier)
                if snapshot is not None:
                    connection.execute("INSERT OR IGNORE INTO snapshots VALUES (?,?)",
                                       (identifier, json.dumps(snapshot)))
                    promoted.add(identifier)
                if connection.execute("SELECT 1 FROM legacy WHERE turn_id=?", (identifier,)).fetchone():
                    return
                identity = hashlib.sha256(f"{session_id}\0{identifier}".encode()).hexdigest()
                trace["metadata"]["darrow.delivery_id"] = identity
                trace["metadata"]["darrow.expected_observation_count"] = observation_count(trace)
                document = json.dumps({"status": "pending", "traces": [trace]}, sort_keys=True, separators=(",", ":"))
                connection.execute("INSERT OR IGNORE INTO envelopes VALUES (?,?,?,?,?,?,?)",
                                   (identifier, identity, document, observation_count(trace), "pending", None, os.getpid()))

            def consume(record, state, reset):
                nonlocal rebuilt
                if reset and not rebuilt:
                    rebuilt = True
                    timeline.clear()
                    connection.execute("DELETE FROM indexed_turns")
                    connection.execute("DELETE FROM turn_starts")
                    connection.execute("DELETE FROM captured_turns")
                if record.get("type") == "event_msg" and record["payload"].get("type") == "task_started":
                    identifier = record["payload"].get("turn_id")
                    if isinstance(identifier, str):
                        try:
                            connection.execute("INSERT INTO turn_starts VALUES (?)", (identifier,))
                        except sqlite3.IntegrityError as error:
                            raise ValueError("hook turn_id does not identify exactly one rollout turn") from error
                session, completed = parse_rollout([record], state=state["parser"], finalize=False)
                if session.get("session_id") not in {None, session_id, _redact_state(session_id, config)}:
                    raise ValueError("rollout thread ID does not match the hook session")
                for turn in completed:
                    index_turn(turn, session)

            def apply_terminal(event):
                for pending in connection.execute("SELECT * FROM captured_turns WHERE finalized=0 AND source_end<=? ORDER BY rowid", (event["offset"],)):
                    identifier = pending["turn_id"]
                    if event["event"] == "Interrupt" and identifier != event["turn_id"]:
                        continue
                    if connection.execute("SELECT 1 FROM receipts WHERE turn_id=?", (identifier,)).fetchone():
                        continue
                    snapshot = event["attribution_snapshots"].get(identifier)
                    if snapshot is not None:
                        snapshots[identifier] = snapshot
                        connection.execute("INSERT OR IGNORE INTO snapshots VALUES (?,?)", (identifier, json.dumps(snapshot)))
                    connection.execute("INSERT INTO receipts VALUES (?,?,?)", (identifier, event["event"], int(event["capture_content"])))
                    turn = json.loads(pending["turn"])
                    turn["completed"] = True
                    if event["event"] == "Interrupt":
                        turn["aborted"] = True
                    connection.execute("UPDATE captured_turns SET turn=? WHERE turn_id=?", (json.dumps(turn), identifier))

            identity = file_identity(rollout.stat())
            boundaries = sorted((event for event in terminal if event["identity"] == identity),
                                key=lambda item: (item["offset"], item["event"] != "Interrupt"))
            reset = False
            for event in [*boundaries, None]:
                limit = event["offset"] if event else None
                # A terminal watermark is a parsing boundary, not merely a
                # filter applied after a resumed turn has changed parser state.
                count, did_reset = _read_incremental(rollout, checkpoint, consume, max_offset=limit)
                total_bytes += count
                reset = reset or did_reset
                session, active = parse_rollout([], state=checkpoint["parser"], finalize=True)
                for turn in active:
                    index_turn(turn, session)
                if event:
                    apply_terminal(event)
            if not session.get("session_id"):
                raise ValueError("rollout is missing a valid Codex thread ID")
            row = connection.execute("SELECT turn,finalized FROM captured_turns WHERE turn_id=?", (turn_id,)).fetchone()
            if turn_id is not None and row is None:
                raise ValueError("hook turn_id does not identify exactly one rollout turn")
            if turn_id is not None and not connection.execute("SELECT 1 FROM receipts WHERE turn_id=?", (turn_id,)).fetchone():
                if turn_id not in snapshots:
                    snapshots[turn_id] = attribution_snapshot(config, cwd)
                    connection.execute("INSERT INTO snapshots VALUES (?,?)", (turn_id, json.dumps(snapshots[turn_id])))
                connection.execute("INSERT INTO receipts VALUES (?,?,?)", (turn_id, "Stop", int(config.capture_content)))
                # A delayed Stop may name a turn already closed in parser state
                # by a later task_started. Its own receipt completes that stored
                # turn even when no task_complete record was ever appended.
                if not row["finalized"]:
                    completed_turn = json.loads(row["turn"])
                    completed_turn["completed"] = True
                    connection.execute("UPDATE captured_turns SET turn=? WHERE turn_id=?",
                                       (json.dumps(completed_turn), turn_id))
            effective = {**provisional, **snapshots}
            for receipt in connection.execute("SELECT turn_id FROM receipts WHERE kind IN ('Interrupt','SessionEnd')"):
                if receipt[0] not in snapshots:
                    effective.pop(receipt[0], None)
            while True:
                row = connection.execute("SELECT * FROM captured_turns WHERE finalized=0 ORDER BY rowid LIMIT 1").fetchone()
                if row is None:
                    break
                identifier = row["turn_id"]
                turn = json.loads(row["turn"])
                receipt = connection.execute("SELECT * FROM receipts WHERE turn_id=?", (identifier,)).fetchone()
                uploaded = connection.execute("SELECT 1 FROM legacy WHERE turn_id=?", (identifier,)).fetchone()
                if receipt is None and not turn.get("aborted") and not uploaded:
                    break
                if not turn.get("completed"):
                    break
                turn_config = replace(config, capture_content=bool(receipt["capture_content"])) if receipt else config
                document = trace_document(
                    rollout, turn_config, cwd, attribution_snapshots=effective,
                    parsed=(json.loads(row["session"]), [turn]), attribution_state=timeline,
                    subagent_loader=subagent_loader,
                )
                trace = document["traces"][0]
                connection.execute("INSERT OR REPLACE INTO indexed_turns VALUES (?,?)", (identifier, json.dumps(trace)))
                materialize(identifier, trace)
                connection.execute("UPDATE captured_turns SET finalized=1,turn=NULL WHERE turn_id=?", (identifier,))
            _put(connection, "rollout", _private_cursor(checkpoint, config))
            _put(connection, "attribution", timeline)
            _put(connection, "session_id", session_id)
            connection.execute("COMMIT")
        except BaseException:
            connection.execute("ROLLBACK")
            raise
        if plugin_data is not None:
            discard_provisional_attribution_snapshots(plugin_data, session_id, promoted)
        register_rollout(rollout, session_id, plugin_data)
        return {"bytes_read": total_bytes, "rebuilt": int(reset)}
