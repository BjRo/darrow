"""One cancellable drainer per rollout; network never holds capture transactions."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import sqlite3
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .capture import database, database_path, observation_count
from .config import Config
from .context import delivery_context, require_context
from .export import DeliveryError, export_document


def await_capture(rollout: Path, turn_id: str, timeout: float = 45) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        path = database_path(rollout)
        if path.exists():
            connection = sqlite3.connect(
                f"{path.as_uri()}?mode=ro", uri=True, timeout=1
            )
            try:
                if connection.execute(
                    "SELECT 1 FROM receipts WHERE turn_id=?", (turn_id,)
                ).fetchone():
                    return True
            except sqlite3.OperationalError:
                pass  # Capture may still be creating the schema.
            finally:
                connection.close()
        time.sleep(0.05)
    return False


def drain(
    rollout: Path,
    config: Config,
    *,
    cwd: str,
    exporter: Callable[[dict[str, Any], Config], int] = export_document,
    plugin_data: Path | None = None,
) -> int:
    rollout = rollout.resolve()
    if not database_path(rollout).exists():
        return 0
    session_id = _session_id(rollout, config, cwd)
    if session_id is None:
        return 0
    lock_directory = (plugin_data or rollout.parent) / "langfuse-drain-locks"
    lock_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = (
        lock_directory / f"{hashlib.sha256(session_id.encode()).hexdigest()}.lock"
    )
    with _exclusive_lock(lock_path) as acquired:
        return _Drainer(rollout, config, exporter).run() if acquired else 0


def _session_id(rollout: Path, config: Config, cwd: str) -> str | None:
    with database(rollout) as connection:
        binding = connection.execute(
            "SELECT value FROM state WHERE key='delivery_context'"
        ).fetchone()
        require_context(
            json.loads(binding[0]) if binding else None, delivery_context(config, cwd)
        )
        row = connection.execute(
            "SELECT value FROM state WHERE key='session_id'"
        ).fetchone()
        return str(json.loads(row[0])) if row is not None else None


@contextmanager
def _exclusive_lock(path: Path) -> Iterator[bool]:
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        yield True
    finally:
        os.close(descriptor)


@dataclass(frozen=True)
class _Batch:
    rows: list[sqlite3.Row]
    document: dict[str, Any]
    identities: list[tuple[str]]
    last_order: int


class _Drainer:
    def __init__(
        self,
        rollout: Path,
        config: Config,
        exporter: Callable[[dict[str, Any], Config], int],
    ) -> None:
        self.rollout = rollout
        self.config = config
        self.exporter = exporter
        self.acknowledged = 0
        self.last_order = 0
        self.failure: DeliveryError | None = None

    def run(self) -> int:
        while True:
            batch = self._next_batch()
            if batch is None:
                if self.failure is not None:
                    raise self.failure
                return self.acknowledged
            self.last_order = batch.last_order
            self._attempt(batch)

    def _next_batch(self) -> _Batch | None:
        with database(self.rollout) as connection:
            connection.execute("BEGIN IMMEDIATE")
            rows = self._pending_rows(connection)
            if not rows:
                connection.execute("COMMIT")
                return None
            document = _batch_document(rows)
            _validate_envelopes(document, rows)
            identities = [(str(row["identity"]),) for row in rows]
            connection.executemany(
                "UPDATE envelopes SET state='uncertain', reason='attempt started' WHERE identity=?",
                identities,
            )
            connection.execute("COMMIT")
            return _Batch(rows, document, identities, int(rows[-1]["queue_order"]))

    def _pending_rows(self, connection: sqlite3.Connection) -> list[sqlite3.Row]:
        rows: list[sqlite3.Row] = []
        expected = 0
        query = "SELECT rowid AS queue_order,* FROM envelopes WHERE state='pending' AND rowid>? ORDER BY rowid LIMIT 512"
        for row in connection.execute(query, (self.last_order,)):
            if rows and expected + row["expected_count"] > 512:
                break
            rows.append(row)
            expected += row["expected_count"]
        return rows

    def _attempt(self, batch: _Batch) -> None:
        try:
            count = self.exporter(batch.document, self.config)
            if count != len(batch.rows):
                raise DeliveryError("uncertain", "Langfuse acceptance count mismatch")
        except DeliveryError as error:
            self._record_failure(batch, error)
            self.failure = error
        except BaseException:
            raise  # Cancellation retains the durable uncertain state.
        else:
            self._acknowledge(batch)
            self.acknowledged += len(batch.rows)

    def _record_failure(self, batch: _Batch, error: DeliveryError) -> None:
        values = [(error.outcome, str(error), row["identity"]) for row in batch.rows]
        with database(self.rollout) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.executemany(
                "UPDATE envelopes SET state=?,reason=? WHERE identity=?", values
            )
            connection.execute("COMMIT")

    def _acknowledge(self, batch: _Batch) -> None:
        with database(self.rollout) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.executemany(
                "UPDATE envelopes SET state='acknowledged',reason=NULL WHERE identity=?",
                batch.identities,
            )
            connection.execute("COMMIT")


def _batch_document(rows: list[sqlite3.Row]) -> dict[str, Any]:
    return {
        "status": "pending",
        "traces": [json.loads(row["document"])["traces"][0] for row in rows],
    }


def _validate_envelopes(document: dict[str, Any], rows: list[sqlite3.Row]) -> None:
    traces = document["traces"]
    invalid = any(
        observation_count(trace) != row["expected_count"]
        or trace.get("metadata", {}).get("darrow.delivery_id") != row["identity"]
        for trace, row in zip(traces, rows, strict=True)
    )
    if invalid:
        raise ValueError("Langfuse delivery envelope evidence is invalid")
