"""Gate admission on the selected profile's installed delivery plugins."""

from pathlib import Path

from .installation import Installation
from .launcher import plugin_entries, plugin_name
from .models import Grant
from .storage import read_object, write_object


def require_delivery_plugins(grant: Grant) -> None:
    profile = grant.profile_dir or str(Path.home() / f".{grant.host}")
    entries = plugin_entries(
        grant.executable, grant.host, profile, Path(grant.checkout)
    )
    enabled = {
        plugin_name(entry, grant.host)
        for entry in entries
        if entry.get("enabled") is True
    }
    missing = {"darrow-ticket-to-pr", "darrow-adaptive-goal"} - enabled
    if missing:
        raise ValueError(
            "Missing enabled delivery plugins: " + ", ".join(sorted(missing))
        )


def check(site: Installation) -> bool:
    try:
        require_delivery_plugins(site.grant)
    except Exception as error:
        # Host boundary: unreadable listings cannot authorize any issue claim.
        write_object(
            site.root / "blocker.json",
            {"blocker": f"Required plugins unavailable: {error}"},
        )
        return False
    (site.root / "blocker.json").unlink(missing_ok=True)
    return True


def blocker(site: Installation) -> object:
    path = site.root / "blocker.json"
    return read_object(path)["blocker"] if path.exists() else ""
