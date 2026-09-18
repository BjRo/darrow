"""Keep Hatch's editable source paths readable by legacy Windows Python."""

from __future__ import annotations

import csv
import hashlib
import io
from base64 import urlsafe_b64encode
from pathlib import Path
from zipfile import ZipFile

from hatchling.build import build_editable as hatch_build_editable
from hatchling.build import build_sdist as build_sdist
from hatchling.build import build_wheel as build_wheel
from hatchling.build import (
    get_requires_for_build_editable as get_requires_for_build_editable,
)
from hatchling.build import get_requires_for_build_sdist as get_requires_for_build_sdist
from hatchling.build import get_requires_for_build_wheel as get_requires_for_build_wheel
from hatchling.build import (
    prepare_metadata_for_build_editable as prepare_metadata_for_build_editable,
)
from hatchling.build import (
    prepare_metadata_for_build_wheel as prepare_metadata_for_build_wheel,
)


def portable_editable(wheel: Path) -> None:
    with ZipFile(wheel) as archive:
        members = {
            info.filename: (info, archive.read(info)) for info in archive.infolist()
        }
    name = "_editable_impl_darrow_adaptive_delivery.pth"
    info, content = members[name]
    paths = content.decode("utf-8").splitlines()
    members[name] = (info, f"import sys; sys.path.extend({paths!a})\n".encode("ascii"))
    record_name = next(name for name in members if name.endswith(".dist-info/RECORD"))
    record = io.StringIO(newline="")
    writer = csv.writer(record, lineterminator="\n")
    with ZipFile(wheel, "w") as archive:
        for name, (info, data) in members.items():
            if name == record_name:
                continue
            archive.writestr(info, data)
            digest = (
                urlsafe_b64encode(hashlib.sha256(data).digest())
                .rstrip(b"=")
                .decode("ascii")
            )
            writer.writerow((name, "sha256=" + digest, len(data)))
        writer.writerow((record_name, "", ""))
        archive.writestr(members[record_name][0], record.getvalue().encode("utf-8"))


def build_editable(
    wheel_directory: str,
    config_settings: dict[str, object] | None = None,
    metadata_directory: str | None = None,
) -> str:
    name = hatch_build_editable(wheel_directory, config_settings, metadata_directory)
    portable_editable(Path(wheel_directory) / name)
    return name
