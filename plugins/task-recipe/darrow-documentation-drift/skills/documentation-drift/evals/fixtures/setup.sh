#!/usr/bin/env bash
set -eu
fixtures=$1
scenario=$2
mkdir -p .fixture-state .fixture-bin
cp "$fixtures/gh" .fixture-bin/gh
cp "$fixtures/review-draft" .fixture-bin/review-draft
chmod +x .fixture-bin/gh .fixture-bin/review-draft
printf '%s\n' '/.fixture-state/' '/.fixture-bin/' >>.git/info/exclude
cat >drift-scope.md <<'EOF'
Check guide.md and quickstart.md against source.json. The accepted ADR in
history.md describes the old release and must remain historical. Restrict the
check to these files.
EOF
if test "$scenario" = equivalent; then
  cat >.fixture-state/existing.json <<'EOF'
[{"number":101,"html_url":"https://github.com/fixture/manual/issues/101","title":"Align connection instructions with shipped settings","body":"The guide.md statement that the CLI uses the legacy endpoint is false. source.json sets endpoint=current. Correct guide.md and quickstart.md to use the current endpoint. Acceptance: both instructions match the shipped endpoint.","state":"open"}]
EOF
fi
case "$scenario" in
  equivalent|uncertain|unavailable) touch ".fixture-state/$scenario" ;;
esac
if test "$scenario" = no-findings; then
  printf '%s\n' 'Connect to the current endpoint.' >guide.md
  printf '%s\n' 'Use the current endpoint.' >quickstart.md
fi
if test "$scenario" = partial; then
  cat >drift-scope.md <<'EOF'
Check guide.md and quickstart.md against source.json; also check missing.md
against unavailable.json. Keep the check within these files.
EOF
fi
if test "$scenario" = high-risk; then
  printf '%s\n' '{"offlineDefault":false,"offlineAvailableOn":"every plan"}' >source.json
  printf '%s\n' 'A paid plan is required to use offline mode. Offline mode is disabled by default.' >guide.md
  printf '%s\n' 'Upgrade to a paid plan before using offline mode.' >quickstart.md
fi
if test "$scenario" = independent; then
  printf '%s\n' '{"endpoint":"current","timeoutSeconds":30}' >source.json
fi
if test "$scenario" = rejected-review; then
  cat >drift-scope.md <<'EOF'
Check guide.md and quickstart.md against source.json and security-evidence.md.
The diagnostic snapshot contests the token encryption guarantee. Verify the
endpoint instructions separately. Preserve history.md as accepted historical
context. Restrict the check to these documents and sources.
EOF
fi
