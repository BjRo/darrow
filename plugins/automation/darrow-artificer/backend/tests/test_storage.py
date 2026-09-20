import json
import subprocess
import sys
from pathlib import Path

import pytest

from darrow_artificer.storage import read_object, write_bytes, write_object


def test_atomic_private_files(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "record.json"
    write_object(path, {"value": "before"})
    write_object(path, {"value": "after"})
    assert read_object(path) == {"value": "after"}
    assert path.stat().st_mode & 0o777 == 0o600
    assert not list(path.parent.glob(".pending-*"))
    write_bytes(path, b"[]")
    with pytest.raises(ValueError, match="JSON object"):
        read_object(path)
    write_bytes(path, b"invalid")
    with pytest.raises(json.JSONDecodeError):
        read_object(path)


def test_two_processes_share_admission_lock(tmp_path: Path) -> None:
    source = (
        "import sys,time; from pathlib import Path; "
        "from darrow_artificer.storage import locked,read_object,write_object\n"
        "root=Path(sys.argv[1])\n"
        "with locked(root/'admission.lock'):\n"
        "    occupied=read_object(root/'claims.json')['occupied']\n"
        "    time.sleep(0.15)\n"
        "    if occupied < 1: write_object(root/'claims.json',{'occupied':occupied+1})\n"
    )
    write_object(tmp_path / "claims.json", {"occupied": 0})
    children = [
        subprocess.Popen([sys.executable, "-c", source, str(tmp_path)])
        for _ in range(2)
    ]
    assert [child.wait(timeout=10) for child in children] == [0, 0]
    assert read_object(tmp_path / "claims.json") == {"occupied": 1}
