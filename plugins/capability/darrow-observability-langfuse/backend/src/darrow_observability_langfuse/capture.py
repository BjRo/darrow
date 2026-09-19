"""Local, transactional rollout indexing and immutable delivery envelopes."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
from collections.abc import Callable, Iterator
from contextlib import closing, contextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any, cast

from .config import Config
from .context import delivery_context, require_context
from .lifecycle import (
    bind_rollout_context,
    file_identity,
    register_rollout,
    terminal_records,
)
from .rollout import attribution_snapshot, parse_rollout, trace_document
from .sidecar import (
    _load_state,
    discard_provisional_attribution_snapshots,
    load_provisional_attribution_snapshots,
)

PARSER_VERSION = 2


def _redact_state(value: Any, config: Config) -> Any:
    if isinstance(value, str):
        return _redact_string(value, config)
    if isinstance(value, list):
        return [_redact_state(item, config) for item in value]
    if isinstance(value, dict):
        return {key: _redact_state(item, config) for key, item in value.items()}
    return value


def _redact_string(value: str, config: Config) -> str:
    for credential in filter(None, (config.public_key, config.secret_key)):
        value = value.replace(credential, "[REDACTED]")
    return value


def _private_cursor(cursor: dict[str, Any], config: Config) -> dict[str, Any]:
    result = cast("dict[str, Any]", _redact_state(cursor, config))
    # JSONL tail bytes are parser input, not base64 credentials. Redact the
    # decoded bytes as well, keeping the committed source offset unchanged.
    tail = base64.b64decode(cursor["tail"])
    for credential in filter(None, (config.public_key, config.secret_key)):
        tail = tail.replace(credential.encode(), b"[REDACTED]")
    result["tail"] = base64.b64encode(tail).decode()
    return result


def database_path(rollout: Path) -> Path:
    return Path(f"{rollout.resolve()}.darrow-langfuse.sqlite3")


@contextmanager
def database(rollout: Path) -> Iterator[sqlite3.Connection]:
    path = database_path(rollout)
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    os.close(descriptor)
    with closing(sqlite3.connect(path, timeout=30, isolation_level=None)) as connection:
        connection.row_factory = sqlite3.Row
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


def _get(connection: sqlite3.Connection, key: str, default: Any = None) -> Any:
    row = connection.execute("SELECT value FROM state WHERE key=?", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def _put(connection: sqlite3.Connection, key: str, value: Any) -> None:
    connection.execute(
        "INSERT OR REPLACE INTO state VALUES (?,?)", (key, json.dumps(value))
    )


def observation_count(trace: dict[str, Any]) -> int:
    def children_count(children: list[dict[str, Any]]) -> int:
        return sum(1 + children_count(child.get("children", [])) for child in children)

    return 1 + children_count(trace.get("observations", []))


def _read_incremental(
    path: Path,
    checkpoint: dict[str, Any],
    consume: Callable[[dict[str, Any], dict[str, Any], bool], None],
    max_offset: int | None = None,
) -> tuple[int, bool]:
    """Stream appended complete JSONL records; retain only an incomplete line."""
    if not path.is_absolute() or not path.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    with path.open("rb") as handle:
        stat = os.fstat(handle.fileno())
        identity = file_identity(stat)
        reset = _prepare_checkpoint(checkpoint, identity, stat.st_size)
        handle.seek(checkpoint["offset"])
        pending = base64.b64decode(checkpoint["tail"], validate=True)
        bytes_read = 0
        while True:
            remaining = _remaining_bytes(checkpoint["offset"], max_offset)
            chunk = handle.read(remaining)
            if not chunk:
                break
            bytes_read += len(chunk)
            checkpoint["offset"] += len(chunk)
            pending = _consume_lines(pending + chunk, checkpoint, consume, reset)
        checkpoint["tail"] = base64.b64encode(pending).decode("ascii")
        return bytes_read, reset


def _prepare_checkpoint(
    checkpoint: dict[str, Any], identity: list[int], size: int
) -> bool:
    reset = (
        checkpoint.get("version") != PARSER_VERSION
        or checkpoint.get("identity") != identity
        or size < checkpoint.get("offset", 0)
    )
    if reset:
        checkpoint.clear()
        checkpoint.update(
            version=PARSER_VERSION, identity=identity, offset=0, tail="", parser={}
        )
    return reset


def _remaining_bytes(offset: int, max_offset: int | None) -> int:
    return 65536 if max_offset is None else max(0, min(65536, max_offset - offset))


def _consume_lines(
    content: bytes,
    checkpoint: dict[str, Any],
    consume: Callable[[dict[str, Any], dict[str, Any], bool], None],
    reset: bool,
) -> bytes:
    lines = content.split(b"\n")
    pending = lines.pop()
    line_offset = checkpoint["offset"] - len(content)
    for line in lines:
        line_offset += len(line) + 1
        checkpoint["record_offset"] = line_offset
        record = _decode_record(line)
        if record is not None:
            consume(record, checkpoint, reset)
    return pending


def _decode_record(line: bytes) -> dict[str, Any] | None:
    try:
        value = json.loads(line)
    except (ValueError, UnicodeDecodeError):
        return None
    if isinstance(value, dict) and isinstance(value.get("payload"), dict):
        return value
    return None


def delivery_rows(rollout: Path) -> list[dict[str, Any]]:
    with database(rollout) as connection:
        return [
            dict(row)
            for row in connection.execute("SELECT * FROM envelopes ORDER BY rowid")
        ]


def load_capture_snapshots(rollout: Path) -> dict[str, dict[str, Any]]:
    path = database_path(rollout)
    if not path.exists():
        return {}
    with closing(sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)) as connection:
        return cast(
            "dict[str, dict[str, Any]]",
            {
                row[0]: json.loads(row[1])
                for row in connection.execute("SELECT * FROM snapshots")
            },
        )


def capture(
    rollout: Path,
    config: Config,
    cwd: str,
    session_id: str,
    turn_id: str | None,
    plugin_data: Path | None,
) -> dict[str, int]:
    if not rollout.is_absolute() or not rollout.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    canonical = rollout.resolve()
    legacy = _combined_legacy_state(rollout, canonical)
    provisional = (
        load_provisional_attribution_snapshots(plugin_data, session_id)
        if plugin_data is not None
        else {}
    )
    terminal = list(terminal_records(canonical, session_id))
    context = delivery_context(config, cwd)
    for event in terminal:
        require_context(event.get("delivery_context"), context)
    bind_rollout_context(canonical, session_id, context)
    with database(canonical) as connection:
        connection.execute("BEGIN IMMEDIATE")
        try:
            transaction = _CaptureTransaction(
                connection,
                canonical,
                config,
                cwd,
                session_id,
                turn_id,
                legacy,
                provisional,
                terminal,
                context,
            )
            result = transaction.run()
            connection.execute("COMMIT")
        except BaseException:
            connection.execute("ROLLBACK")
            raise
        if plugin_data is not None:
            discard_provisional_attribution_snapshots(
                plugin_data, session_id, transaction.promoted
            )
        register_rollout(canonical, session_id, plugin_data, context)
        return result


def _combined_legacy_state(rollout: Path, canonical: Path) -> dict[str, Any]:
    legacy = _load_state(rollout)
    if canonical == rollout:
        return legacy
    other = _load_state(canonical)
    return {
        "uploaded_turn_ids": list(
            set(legacy["uploaded_turn_ids"] + other["uploaded_turn_ids"])
        ),
        "attribution_snapshots": {
            **legacy["attribution_snapshots"],
            **other["attribution_snapshots"],
        },
    }


class _CaptureTransaction:
    def __init__(
        self,
        connection: sqlite3.Connection,
        rollout: Path,
        config: Config,
        cwd: str,
        session_id: str,
        turn_id: str | None,
        legacy: dict[str, Any],
        provisional: dict[str, dict[str, Any]],
        terminal: list[dict[str, Any]],
        context: dict[str, Any],
    ) -> None:
        self.connection = connection
        self.rollout = rollout
        self.config = config
        self.cwd = cwd
        self.session_id = session_id
        self.turn_id = turn_id
        self.legacy = legacy
        self.provisional = provisional
        self.terminal = terminal
        self.context = context
        self.snapshots: dict[str, dict[str, Any]] = {}
        self.effective: dict[str, dict[str, Any]] = {}
        self.checkpoint: dict[str, Any] = {}
        self.timeline: dict[str, Any] = {}
        self.session: dict[str, Any] = {}
        self.total_bytes = 0
        self.rebuilt = False
        self.reset = False
        self.promoted: set[str] = set()

    def run(self) -> dict[str, int]:
        self._bind_database_context()
        self._import_legacy()
        self._load_saved_state()
        self._parse_boundaries()
        self._validate_session()
        self._record_stop()
        self._refresh_effective_snapshots()
        self._finalize_turns()
        self._save_state()
        return {"bytes_read": self.total_bytes, "rebuilt": int(self.reset)}

    def _bind_database_context(self) -> None:
        saved = _get(self.connection, "delivery_context")
        if saved is None and self._database_has_evidence():
            require_context(None, self.context)
        if saved is not None:
            require_context(saved, self.context)
        else:
            _put(self.connection, "delivery_context", self.context)

    def _database_has_evidence(self) -> bool:
        tables = ("state", "envelopes", "captured_turns", "receipts", "snapshots")
        return any(
            self.connection.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone()
            for table in tables
        )

    def _import_legacy(self) -> None:
        for identifier in self.legacy["uploaded_turn_ids"]:
            self.connection.execute(
                "INSERT OR IGNORE INTO legacy VALUES (?)", (identifier,)
            )
        for identifier, snapshot in self.legacy["attribution_snapshots"].items():
            self.connection.execute(
                "INSERT OR IGNORE INTO snapshots VALUES (?,?)",
                (identifier, json.dumps(snapshot)),
            )
            self.connection.execute(
                "INSERT OR IGNORE INTO receipts VALUES (?,?,?)",
                (identifier, "legacy", int(self.config.capture_content)),
            )

    def _load_saved_state(self) -> None:
        self.snapshots = {
            row[0]: json.loads(row[1])
            for row in self.connection.execute("SELECT * FROM snapshots")
        }
        self.effective = {**self.provisional, **self.snapshots}
        self.checkpoint = _get(self.connection, "rollout", {})
        self.timeline = _get(self.connection, "attribution", {})

    def _subagent_loader(
        self, path: Path
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        key = f"subagent:{path}"
        cursor = _get(self.connection, key, {})
        child_turns: list[dict[str, Any]] = []

        def consume_child(
            record: dict[str, Any], state: dict[str, Any], _reset: bool
        ) -> None:
            _, completed = parse_rollout(
                [record], state=state["parser"], finalize=False
            )
            child_turns.extend(completed)

        count, reset = _read_incremental(path, cursor, consume_child)
        self.total_bytes += count
        saved = [] if reset else cursor.get("turns", [])
        saved.extend(child_turns)
        cursor["turns"] = saved
        child_session, active = parse_rollout([], state=cursor["parser"], finalize=True)
        _put(self.connection, key, _private_cursor(cursor, self.config))
        return child_session, saved + active

    def _index_turn(self, turn: dict[str, Any], session: dict[str, Any]) -> None:
        identifier = turn.get("turn_id")
        if not isinstance(identifier, str) or not identifier:
            return
        row = self.connection.execute(
            "SELECT finalized FROM captured_turns WHERE turn_id=?", (identifier,)
        ).fetchone()
        if self._already_final(row, identifier):
            return
        if identifier == self.turn_id or self._has_final_receipt(identifier):
            turn["completed"] = True
        self._write_captured_turn(row, identifier, turn, session)

    def _already_final(self, row: sqlite3.Row | None, identifier: str) -> bool:
        if row is not None and row[0]:
            return True
        return row is not None and self._has_receipt(identifier)

    def _has_receipt(self, identifier: str) -> bool:
        return bool(
            self.connection.execute(
                "SELECT 1 FROM receipts WHERE turn_id=?", (identifier,)
            ).fetchone()
        )

    def _has_final_receipt(self, identifier: str) -> bool:
        return bool(
            self.connection.execute(
                "SELECT 1 FROM receipts WHERE turn_id=? AND kind IN ('Stop','legacy')",
                (identifier,),
            ).fetchone()
        )

    def _write_captured_turn(
        self,
        row: sqlite3.Row | None,
        identifier: str,
        turn: dict[str, Any],
        session: dict[str, Any],
    ) -> None:
        values = (
            json.dumps(_redact_state(turn, self.config)),
            json.dumps(_redact_state(session, self.config)),
            self.checkpoint.get("record_offset", self.checkpoint["offset"]),
            identifier,
        )
        query = (
            "INSERT INTO captured_turns (turn,session,source_end,turn_id) VALUES (?,?,?,?)"
            if row is None
            else "UPDATE captured_turns SET turn=?,session=?,source_end=? WHERE turn_id=?"
        )
        self.connection.execute(query, values)

    def _materialize(self, identifier: str, trace: dict[str, Any]) -> None:
        self._promote_snapshot(identifier)
        if self.connection.execute(
            "SELECT 1 FROM legacy WHERE turn_id=?", (identifier,)
        ).fetchone():
            return
        identity = hashlib.sha256(
            f"{self.session_id}\0{identifier}".encode()
        ).hexdigest()
        count = observation_count(trace)
        trace["metadata"]["darrow.delivery_id"] = identity
        trace["metadata"]["darrow.expected_observation_count"] = count
        document = json.dumps(
            {"status": "pending", "traces": [trace]},
            sort_keys=True,
            separators=(",", ":"),
        )
        self.connection.execute(
            "INSERT OR IGNORE INTO envelopes VALUES (?,?,?,?,?,?,?)",
            (identifier, identity, document, count, "pending", None, os.getpid()),
        )

    def _promote_snapshot(self, identifier: str) -> None:
        snapshot = self.effective.get(identifier)
        if snapshot is None:
            return
        self.connection.execute(
            "INSERT OR IGNORE INTO snapshots VALUES (?,?)",
            (identifier, json.dumps(snapshot)),
        )
        self.promoted.add(identifier)

    def _consume(
        self, record: dict[str, Any], state: dict[str, Any], reset: bool
    ) -> None:
        if reset and not self.rebuilt:
            self._reset_index()
        self._record_turn_start(record)
        session, completed = parse_rollout(
            [record], state=state["parser"], finalize=False
        )
        self._validate_parsed_session(session)
        for turn in completed:
            self._index_turn(turn, session)

    def _reset_index(self) -> None:
        self.rebuilt = True
        self.timeline.clear()
        for table in ("indexed_turns", "turn_starts", "captured_turns"):
            self.connection.execute(f"DELETE FROM {table}")

    def _record_turn_start(self, record: dict[str, Any]) -> None:
        payload = record["payload"]
        if record.get("type") != "event_msg" or payload.get("type") != "task_started":
            return
        identifier = payload.get("turn_id")
        if not isinstance(identifier, str):
            return
        try:
            self.connection.execute("INSERT INTO turn_starts VALUES (?)", (identifier,))
        except sqlite3.IntegrityError as error:
            raise ValueError(
                "hook turn_id does not identify exactly one rollout turn"
            ) from error

    def _validate_parsed_session(self, session: dict[str, Any]) -> None:
        allowed = {None, self.session_id, _redact_state(self.session_id, self.config)}
        if session.get("session_id") not in allowed:
            raise ValueError("rollout thread ID does not match the hook session")

    def _apply_terminal(self, event: dict[str, Any]) -> None:
        query = "SELECT * FROM captured_turns WHERE finalized=0 AND source_end<=? ORDER BY rowid"
        for pending in self.connection.execute(query, (event["offset"],)):
            self._apply_terminal_row(event, pending)

    def _apply_terminal_row(self, event: dict[str, Any], pending: sqlite3.Row) -> None:
        identifier = pending["turn_id"]
        if event["event"] == "Interrupt" and identifier != event["turn_id"]:
            return
        if self._has_receipt(identifier):
            return
        self._store_terminal_snapshot(event, identifier)
        self.connection.execute(
            "INSERT INTO receipts VALUES (?,?,?)",
            (identifier, event["event"], int(event["capture_content"])),
        )
        turn = json.loads(pending["turn"])
        turn["completed"] = True
        if event["event"] == "Interrupt":
            turn["aborted"] = True
        self.connection.execute(
            "UPDATE captured_turns SET turn=? WHERE turn_id=?",
            (json.dumps(turn), identifier),
        )

    def _store_terminal_snapshot(self, event: dict[str, Any], identifier: str) -> None:
        snapshot = event["attribution_snapshots"].get(identifier)
        if snapshot is None:
            return
        self.snapshots[identifier] = snapshot
        self.connection.execute(
            "INSERT OR IGNORE INTO snapshots VALUES (?,?)",
            (identifier, json.dumps(snapshot)),
        )

    def _parse_boundaries(self) -> None:
        boundaries = self._matching_boundaries()
        for event in [*boundaries, None]:
            limit = event["offset"] if event else None
            count, did_reset = _read_incremental(
                self.rollout, self.checkpoint, self._consume, max_offset=limit
            )
            self.total_bytes += count
            self.reset = self.reset or did_reset
            self.session, active = parse_rollout(
                [], state=self.checkpoint["parser"], finalize=True
            )
            for turn in active:
                self._index_turn(turn, self.session)
            if event is not None:
                self._apply_terminal(event)

    def _matching_boundaries(self) -> list[dict[str, Any]]:
        identity = file_identity(self.rollout.stat())
        return sorted(
            (event for event in self.terminal if event["identity"] == identity),
            key=lambda item: (item["offset"], item["event"] != "Interrupt"),
        )

    def _validate_session(self) -> None:
        if not self.session.get("session_id"):
            raise ValueError("rollout is missing a valid Codex thread ID")

    def _record_stop(self) -> None:
        row = self.connection.execute(
            "SELECT turn,finalized FROM captured_turns WHERE turn_id=?", (self.turn_id,)
        ).fetchone()
        if self.turn_id is not None and row is None:
            raise ValueError("hook turn_id does not identify exactly one rollout turn")
        if self.turn_id is None or self._has_receipt(self.turn_id):
            return
        self._store_stop_snapshot(self.turn_id)
        self.connection.execute(
            "INSERT INTO receipts VALUES (?,?,?)",
            (self.turn_id, "Stop", int(self.config.capture_content)),
        )
        assert row is not None
        if not row["finalized"]:
            self._complete_stored_turn(row, self.turn_id)

    def _store_stop_snapshot(self, identifier: str) -> None:
        if identifier not in self.snapshots:
            self.snapshots[identifier] = attribution_snapshot(self.config, self.cwd)
            self.connection.execute(
                "INSERT INTO snapshots VALUES (?,?)",
                (identifier, json.dumps(self.snapshots[identifier])),
            )

    def _complete_stored_turn(self, row: sqlite3.Row, identifier: str) -> None:
        completed_turn = json.loads(row["turn"])
        completed_turn["completed"] = True
        self.connection.execute(
            "UPDATE captured_turns SET turn=? WHERE turn_id=?",
            (json.dumps(completed_turn), identifier),
        )

    def _refresh_effective_snapshots(self) -> None:
        self.effective = {**self.provisional, **self.snapshots}
        query = "SELECT turn_id FROM receipts WHERE kind IN ('Interrupt','SessionEnd')"
        for receipt in self.connection.execute(query):
            if receipt[0] not in self.snapshots:
                self.effective.pop(receipt[0], None)

    def _finalize_turns(self) -> None:
        while True:
            row = self.connection.execute(
                "SELECT * FROM captured_turns WHERE finalized=0 ORDER BY rowid LIMIT 1"
            ).fetchone()
            if row is None or not self._ready_to_finalize(row):
                return
            self._finalize_row(row)

    def _ready_to_finalize(self, row: sqlite3.Row) -> bool:
        identifier = row["turn_id"]
        turn = json.loads(row["turn"])
        receipt = self._receipt(identifier)
        uploaded = self.connection.execute(
            "SELECT 1 FROM legacy WHERE turn_id=?", (identifier,)
        ).fetchone()
        has_evidence = receipt is not None or turn.get("aborted") or uploaded
        return bool(has_evidence and turn.get("completed"))

    def _receipt(self, identifier: str) -> sqlite3.Row | None:
        row = self.connection.execute(
            "SELECT * FROM receipts WHERE turn_id=?", (identifier,)
        ).fetchone()
        return cast("sqlite3.Row | None", row)

    def _finalize_row(self, row: sqlite3.Row) -> None:
        identifier = str(row["turn_id"])
        turn = json.loads(row["turn"])
        receipt = self._receipt(identifier)
        turn_config = (
            replace(self.config, capture_content=bool(receipt["capture_content"]))
            if receipt
            else self.config
        )
        document = trace_document(
            self.rollout,
            turn_config,
            self.cwd,
            attribution_snapshots=self.effective,
            parsed=(json.loads(row["session"]), [turn]),
            attribution_state=self.timeline,
            subagent_loader=self._subagent_loader,
        )
        trace = document["traces"][0]
        self.connection.execute(
            "INSERT OR REPLACE INTO indexed_turns VALUES (?,?)",
            (identifier, json.dumps(trace)),
        )
        self._materialize(identifier, trace)
        self.connection.execute(
            "UPDATE captured_turns SET finalized=1,turn=NULL WHERE turn_id=?",
            (identifier,),
        )

    def _save_state(self) -> None:
        _put(self.connection, "rollout", _private_cursor(self.checkpoint, self.config))
        _put(self.connection, "attribution", self.timeline)
        _put(self.connection, "session_id", self.session_id)
