#!/usr/bin/env bash
set -eu

mkdir -p "$HOME/.darrow/reviews"
chmod 700 "$HOME/.darrow/reviews"

backend=$(python3 - "$1" <<'PY'
import json
import sys
from pathlib import Path

backend = Path(sys.argv[1]).resolve(strict=True)
assert backend.name == 'backend' and backend.is_dir()
provider = backend.parent
identities = [json.loads((provider / host / 'plugin.json').read_text())
              for host in ('.claude-plugin', '.codex-plugin')]
assert all(item['name'] == 'darrow-review' for item in identities)
assert identities[0]['version'] == identities[1]['version']
print(backend)
PY
)
destination=.git/eval-checks/review
mkdir -p "$destination"
cp "$backend/pyproject.toml" "$backend/uv.lock" "$destination/"
cp -R "$backend/src" "$destination/"
