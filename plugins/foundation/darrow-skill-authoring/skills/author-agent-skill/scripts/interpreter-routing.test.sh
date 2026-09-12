#!/usr/bin/env bash
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
ROOT=$(mktemp -d) || exit 1
ROOT=$(cd "$ROOT" && pwd -P) || exit 1
trap 'rm -rf "$ROOT"' EXIT HUP INT TERM

# A selected interpreter must reach the implementation even when PATH offers
# another bash. Keep a log so expected-failure assertions cannot hide a bypass.
mkdir "$ROOT/bin"
PATH_BASH_LOG=$ROOT/path-bash.log
export PATH_BASH_LOG
cat >"$ROOT/bin/bash" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >>"$PATH_BASH_LOG"
exit 97
EOF
chmod +x "$ROOT/bin/bash"

failures=0
for suite in inspect-skill.test.sh verify-shell-tests.test.sh; do
  : >"$PATH_BASH_LOG"
  if (cd / && PATH="$ROOT/bin:$PATH" "$BASH" "$SCRIPT_DIR/$suite") >"$ROOT/output" 2>&1; then
    printf '  ok: %s passes with a conflicting PATH bash\n' "$suite"
  else
    cat "$ROOT/output" >&2
    printf '  FAIL: %s does not preserve the selected interpreter\n' "$suite" >&2
    failures=$((failures + 1))
  fi
  if [ -s "$PATH_BASH_LOG" ]; then
    cat "$PATH_BASH_LOG" >&2
    printf '  FAIL: %s invoked PATH bash\n' "$suite" >&2
    failures=$((failures + 1))
  fi
done

[ "$failures" -eq 0 ] || exit 1
printf '%s\n' 'all interpreter-routing tests passed'
