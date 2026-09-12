"""One cancellable drainer per rollout; network never holds capture transactions."""
from __future__ import annotations

import fcntl
import json
import os
import time
import sqlite3
import hashlib
from pathlib import Path

from .capture import database, database_path, observation_count
from .export import DeliveryFailure, export_document
from .context import delivery_context, require_context


def await_capture(rollout: Path, turn_id: str, timeout: float = 45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        path = database_path(rollout)
        if path.exists():
            connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True, timeout=1)
            try:
                if connection.execute("SELECT 1 FROM receipts WHERE turn_id=?", (turn_id,)).fetchone():
                    return True
            except sqlite3.OperationalError:
                pass  # Capture may still be creating the schema.
            finally:
                connection.close()
        time.sleep(0.05)
    return False


def drain(rollout: Path, config, *, cwd, exporter=export_document, plugin_data=None) -> int:
    rollout = rollout.resolve()
    if not database_path(rollout).exists():
        return 0
    with database(rollout) as connection:
        binding = connection.execute("SELECT value FROM state WHERE key='delivery_context'").fetchone()
        require_context(json.loads(binding[0]) if binding else None, delivery_context(config, cwd))
        row = connection.execute("SELECT value FROM state WHERE key='session_id'").fetchone()
        if row is None:
            return 0
        session_id = json.loads(row[0])
    lock_directory = (plugin_data or rollout.parent) / "langfuse-drain-locks"
    lock_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = lock_directory / (hashlib.sha256(session_id.encode()).hexdigest() + ".lock")
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        acknowledged = 0
        last_order = 0
        failure = None
        while True:
            with database(rollout) as connection:
                connection.execute("BEGIN IMMEDIATE")
                rows = []
                expected = 0
                for row in connection.execute("SELECT rowid AS queue_order,* FROM envelopes WHERE state='pending' AND rowid>? ORDER BY rowid LIMIT 512", (last_order,)):
                    if rows and expected + row["expected_count"] > 512:
                        break
                    rows.append(row)
                    expected += row["expected_count"]
                if not rows:
                    connection.execute("COMMIT")
                    if failure is not None:
                        raise failure
                    return acknowledged
                document = {"status": "pending", "traces": [json.loads(row["document"])["traces"][0] for row in rows]}
                if any(observation_count(trace) != row["expected_count"]
                       or trace.get("metadata", {}).get("darrow.delivery_id") != row["identity"]
                       for trace, row in zip(document["traces"], rows)):
                    raise ValueError("Langfuse delivery envelope evidence is invalid")
                last_order = rows[-1]["queue_order"]
                identities = [(row["identity"],) for row in rows]
                connection.executemany("UPDATE envelopes SET state='uncertain', reason='attempt started' WHERE identity=?", identities)
                connection.execute("COMMIT")
            try:
                count = exporter(document, config)
                if count != len(rows):
                    raise DeliveryFailure("uncertain", "Langfuse acceptance count mismatch")
            except DeliveryFailure as error:
                with database(rollout) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    connection.executemany("UPDATE envelopes SET state=?,reason=? WHERE identity=?",
                                           [(error.outcome, str(error), row["identity"]) for row in rows])
                    connection.execute("COMMIT")
                failure = error
            except BaseException:
                # Includes cancellation: the durable pre-attempt state is uncertain.
                raise
            else:
                with database(rollout) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    connection.executemany("UPDATE envelopes SET state='acknowledged',reason=NULL WHERE identity=?", identities)
                    connection.execute("COMMIT")
                acknowledged += len(rows)
    finally:
        os.close(descriptor)
