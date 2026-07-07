#!/usr/bin/env bash
# Deterministic tests for the ticket CLI. Covers the script-enforced
# invariants so model evals only need to cover judgment. gh is mocked
# (records calls and payloads under .git/mock-gh/); state is env/file-driven
# per scenario. Run: bash ticket.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/ticket"
BASE_PATH=$PATH
FAILURES=0

check() {
  local desc=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok: $desc"
  else
    echo "  FAIL: $desc (expected $expected, got $actual)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_contains() {
  local desc=$1 needle=$2 haystack=$3
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  ok: $desc"
  else
    echo "  FAIL: $desc (missing: $needle)"
    echo "---- got ----"
    printf '%s\n' "$haystack" | awk 'NR<=20'
    echo "-------------"
    FAILURES=$((FAILURES + 1))
  fi
}

check_not_contains() {
  local desc=$1 needle=$2 haystack=$3
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "  ok: $desc"
  else
    echo "  FAIL: $desc (unexpectedly contains: $needle)"
    FAILURES=$((FAILURES + 1))
  fi
}

# NOT a cmd substitution: cd must affect the caller, never the src repo.
fresh_repo() {
  REPO=$(mktemp -d)
  cd "$REPO" || exit 70
  [[ "$PWD" == "$REPO" ]] || { echo "abort: not in temp repo" >&2; exit 70; }
  export PATH="$REPO/.git/fixture-bin:$BASE_PATH"
  git init -qb main
  git config user.email t@t.local
  git config user.name t
  echo base > base.txt
  git add base.txt
  git commit -qm "chore: init"
  git remote add origin "$REPO/.git/remote.git" 2>/dev/null || true
  MOCK="$REPO/.git/mock-gh"
  mkdir -p "$MOCK"
  printf 'bug\nenhancement\ndocumentation\n' > "$MOCK/labels"
}

# Env/file-driven gh mock. Issues live as files: $MOCK/issue-<id>-{state,title,body,labels}.
# Calls append to $MOCK/calls; mutation payloads are snapshotted (body files
# are temp files the CLI deletes).
mock_gh() {
  mkdir -p "$REPO/.git/fixture-bin"
  cat > "$REPO/.git/fixture-bin/gh" <<'EOF'
#!/bin/sh
d="$(git rev-parse --git-dir)/mock-gh"
echo "$*" >> "$d/calls"
find_flag() { # $1=flag; echoes the value following it from remaining args
  want=$1; shift
  prev=""
  for a in "$@"; do
    if [ "$prev" = "$want" ]; then printf '%s' "$a"; return 0; fi
    prev=$a
  done
  return 1
}
case "$1 $2" in
  "label list")
    cat "$d/labels"
    ;;
  "issue view")
    id=$3
    if [ ! -f "$d/issue-$id-state" ]; then
      echo "GraphQL: Could not resolve to an Issue with the number of $id." >&2
      exit 1
    fi
    state=$(cat "$d/issue-$id-state")
    title=$(cat "$d/issue-$id-title")
    json=$(find_flag --json "$@")
    case "$json" in
      state,title)
        printf '%s\t%s\n' "$state" "$title"
        ;;
      body)
        cat "$d/issue-$id-body" 2>/dev/null
        ;;
      labels)
        cat "$d/issue-$id-labels" 2>/dev/null
        ;;
      number,state,title,url,labels)
        printf '#%s %s — %s\n' "$id" "$state" "$title"
        printf 'https://github.test/o/r/issues/%s\n' "$id"
        if [ -s "$d/issue-$id-labels" ]; then
          printf 'labels: %s\n' "$(paste -sd, "$d/issue-$id-labels" | sed 's/,/, /g')"
        else
          printf 'labels: (none)\n'
        fi
        ;;
      *)
        echo "mock gh: unsupported --json set: $json" >&2
        exit 1
        ;;
    esac
    ;;
  "issue list")
    cat "$d/list" 2>/dev/null
    ;;
  "issue create")
    bf=$(find_flag --body-file "$@")
    cp "$bf" "$d/created-body"
    shift 2
    : > "$d/created-labels"
    prev=""
    for a in "$@"; do
      if [ "$prev" = "--label" ]; then echo "$a" >> "$d/created-labels"; fi
      if [ "$prev" = "--title" ]; then printf '%s' "$a" > "$d/created-title"; fi
      prev=$a
    done
    echo "https://github.test/o/r/issues/99"
    ;;
  "issue edit")
    id=$3
    # Apply the edit like the real backend would: later reads see it.
    if bf=$(find_flag --body-file "$@"); then
      cp "$bf" "$d/edited-body-$id"
      cp "$bf" "$d/issue-$id-body"
    fi
    exit 0
    ;;
  "issue comment")
    id=$3
    bf=$(find_flag --body-file "$@") && cp "$bf" "$d/comment-body-$id"
    echo "https://github.test/o/r/issues/$id#issuecomment-1"
    ;;
  "issue close"|"issue reopen")
    exit 0
    ;;
  *)
    echo "mock gh: unsupported: $*" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "$REPO/.git/fixture-bin/gh"
}

mock_issue() { # id state title [body]
  printf '%s' "$2" > "$MOCK/issue-$1-state"
  printf '%s' "$3" > "$MOCK/issue-$1-title"
  printf '%s\n' "${4:-body text}" > "$MOCK/issue-$1-body"
}

good_bug_body() {
  cat > "$1" <<'EOF'
## Observed

The list command exits 141 on large repos.

## Expected

Full list output.

## Reproduction

Run `ticket list` in a repo with 300 open tickets.
EOF
}

echo "backend resolution (TM-1)"
fresh_repo; mock_gh
OUT=$(cd /tmp && bash "$SCRIPT" inspect 2>&1); RC=$?
check "outside a work tree exits 3" 3 "$RC"
check_contains "names the missing piece" "not inside a git work tree" "$OUT"

fresh_repo; mock_gh
git remote remove origin
OUT=$(bash "$SCRIPT" inspect 2>&1); RC=$?
check "no origin remote exits 3" 3 "$RC"
check_contains "names the missing remote" "no 'origin' remote" "$OUT"

fresh_repo
OUT=$(PATH="/usr/bin:/bin" bash "$SCRIPT" inspect 2>&1); RC=$?
if command -v gh >/dev/null 2>&1 && [ -x /usr/bin/gh -o -x /bin/gh ]; then
  echo "  skip: real gh on the base PATH"
else
  check "missing gh exits 3" 3 "$RC"
  check_contains "names the missing CLI" "gh CLI not found" "$OUT"
fi

echo "inspect"
fresh_repo; mock_gh
OUT=$(bash "$SCRIPT" inspect 2>&1); RC=$?
check "inspect exits 0" 0 "$RC"
check_contains "names the backend" "## backend: github" "$OUT"
check_contains "lists labels" "enhancement" "$OUT"
check_contains "documents the type mapping" "types: bug, feature, task, chore" "$OUT"

echo "create — input validation"
fresh_repo; mock_gh
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --type bug --body-file body.md 2>&1); RC=$?
check "missing title exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" create --title "t" --type story --body-file body.md 2>&1); RC=$?
check "unknown type exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" create --title "List dies." --type bug --body-file body.md 2>&1); RC=$?
check "trailing period exits 5" 5 "$RC"
OUT=$(bash "$SCRIPT" create --title "$(printf 'a\nb')" --type bug --body-file body.md 2>&1); RC=$?
check "multiline title exits 5" 5 "$RC"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file missing.md 2>&1); RC=$?
check "unreadable body file exits 2" 2 "$RC"

echo "create — body structure (TM-C3)"
fresh_repo; mock_gh
printf '## Observed\n\nx\n\n## Expected\n\ny\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md 2>&1); RC=$?
check "missing bug section exits 7" 7 "$RC"
check_contains "names the missing section" "## Reproduction" "$OUT"
printf '## Observed\n\nx\n\n## Expected\n\n## Reproduction\n\nz\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md 2>&1); RC=$?
check "empty bug section exits 7" 7 "$RC"
check_contains "names the empty section" "## Expected" "$OUT"
printf '## Motivation\n\nx\n\n## Acceptance criteria\n\n- y\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type feature --body-file body.md 2>&1); RC=$?
check "feature structure accepted" 0 "$RC"
printf '## Outcome\n\nx\n\n## Done criteria\n\n- y\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type chore --body-file body.md 2>&1); RC=$?
check "chore structure accepted" 0 "$RC"

echo "create — attribution (TM-C7)"
fresh_repo; mock_gh
good_bug_body body.md
printf '\nGenerated with Claude Code\n' >> body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md 2>&1); RC=$?
check "attribution in body exits 6" 6 "$RC"
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "Fix generated with Copilot" --type bug --body-file body.md 2>&1); RC=$?
check "attribution in title exits 6" 6 "$RC"
[[ -f "$MOCK/created-body" ]]; check "nothing was created" 1 "$?"

echo "create — labels (TM-C2/C6)"
fresh_repo; mock_gh
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "List dies on large repos" --type bug --body-file body.md 2>&1); RC=$?
check "create exits 0" 0 "$RC"
check_contains "reports id and url" "created: #99 https://github.test/o/r/issues/99" "$OUT"
check_contains "reports the type label" "type: bug (label: bug)" "$OUT"
check "type label sent to gh" "bug" "$(cat "$MOCK/created-labels")"
OUT=$(bash "$SCRIPT" create --title "Add filters" --type feature --body-file /dev/null 2>&1); RC=$?
check "empty body refused before gh" 2 "$RC"
printf '## Motivation\n\nx\n\n## Acceptance criteria\n\n- y\n' > body.md
OUT=$(bash "$SCRIPT" create --title "Add filters" --type feature --body-file body.md 2>&1); RC=$?
check_contains "feature maps to enhancement" "type: feature (label: enhancement)" "$OUT"
OUT=$(bash "$SCRIPT" create --title "Add filters" --type task --body-file body.md 2>&1); RC=$?
check "task body structure enforced" 7 "$RC"
printf '## Outcome\n\nx\n\n## Done criteria\n\n- y\n' > body.md
OUT=$(bash "$SCRIPT" create --title "Add filters" --type task --body-file body.md 2>&1); RC=$?
check "no matching type label still creates" 0 "$RC"
check_contains "reports the unlabeled note" "no existing label matches type task" "$OUT"
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --label nonexistent --body-file body.md 2>&1); RC=$?
check "unknown label exits 8" 8 "$RC"
check_contains "offers the existing labels" "documentation" "$OUT"

echo "create — relations (TM-2/TM-3/TM-C9)"
fresh_repo; mock_gh
good_bug_body body.md
mock_issue 7 open "Umbrella"
mock_issue 3 open "Blocker"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --depends-on 3 --parent 7 2>&1); RC=$?
check "create with relations exits 0" 0 "$RC"
check_contains "reports parent" "parent: #7" "$OUT"
check_contains "reports depends-on" "depends-on: #3" "$OUT"
BODY_SENT=$(cat "$MOCK/created-body")
check_contains "marker in stored body" "Depends-on: #3" "$BODY_SENT"
check_contains "parent marker in stored body" "Parent: #7" "$BODY_SENT"
rm -f "$MOCK/created-body"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --depends-on 42 2>&1); RC=$?
check "missing relation target exits 4" 4 "$RC"
check_contains "names the missing target" "#42 not found" "$OUT"
[[ -f "$MOCK/created-body" ]]; check "nothing created on missing target" 1 "$?"

echo "get"
fresh_repo; mock_gh
mock_issue 12 open "List dies" "$(printf 'Some body.\n\nDepends-on: #3\nParent: #7')"
OUT=$(bash "$SCRIPT" get 12 2>&1); RC=$?
check "get exits 0" 0 "$RC"
check_contains "meta line" "#12 open — List dies" "$OUT"
check_contains "relations parsed" "depends-on: #3" "$OUT"
check_contains "parent parsed" "parent: #7" "$OUT"
check_not_contains "markers stripped from body" "Depends-on: #3"$'\n' "${OUT#*## body}"
OUT=$(bash "$SCRIPT" get "#12" 2>&1); RC=$?
check "accepts #-prefixed ids" 0 "$RC"
OUT=$(bash "$SCRIPT" get abc 2>&1); RC=$?
check "non-numeric id exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" get 404 2>&1); RC=$?
check "missing ticket exits 4" 4 "$RC"

echo "list (TM-L2/L3/L4)"
fresh_repo; mock_gh
: > "$MOCK/list"
OUT=$(bash "$SCRIPT" list 2>&1); RC=$?
check "empty list exits 0" 0 "$RC"
check_contains "empty result names filters" "no matches (state=open)" "$OUT"
printf '#1 open  A (bug)\n#2 open  B\n' > "$MOCK/list"
OUT=$(bash "$SCRIPT" list --label bug 2>&1); RC=$?
check_contains "lines pass through" "#1 open  A (bug)" "$OUT"
check_contains "filters echoed with total" "total: 2 (state=open, label=bug)" "$OUT"
printf '#1 open  A\n#2 open  B\n#3 open  C\n' > "$MOCK/list"
OUT=$(bash "$SCRIPT" list --limit 2 2>&1)
check_contains "truncation reported" "total: more than 2" "$OUT"
check_contains "truncation note" "note: list truncated at 2" "$OUT"
check_not_contains "over-limit row dropped" "#3 open" "$OUT"
OUT=$(bash "$SCRIPT" list --type bug 2>&1); RC=$?
check "type filter accepted" 0 "$RC"
check_contains "type echoed in filters" "type=bug" "$OUT"
grep -q -- "--label bug" "$MOCK/calls"; check "type mapped to label for gh" 0 "$?"
OUT=$(bash "$SCRIPT" list --type task 2>&1); RC=$?
check "unmappable type filter exits 8" 8 "$RC"
OUT=$(bash "$SCRIPT" list --state weird 2>&1); RC=$?
check "bad state exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" list --limit 0 2>&1); RC=$?
check "bad limit exits 2" 2 "$RC"

echo "comment (TM-U6)"
fresh_repo; mock_gh
mock_issue 12 open "List dies"
printf 'Root cause: SIGPIPE under pipefail.\n' > c.md
OUT=$(bash "$SCRIPT" comment 12 --body-file c.md 2>&1); RC=$?
check "comment exits 0" 0 "$RC"
check_contains "reports the comment url" "commented on #12" "$OUT"
check_contains "payload delivered" "SIGPIPE" "$(cat "$MOCK/comment-body-12")"
printf 'Fixed.\n\n🤖 Generated with Claude Code\n' > c.md
OUT=$(bash "$SCRIPT" comment 12 --body-file c.md 2>&1); RC=$?
check "attribution in comment exits 6" 6 "$RC"
printf 'Clean note.\n' > c.md
OUT=$(bash "$SCRIPT" comment 404 --body-file c.md 2>&1); RC=$?
check "comment on missing ticket exits 4" 4 "$RC"

echo "close/reopen (TM-U4)"
fresh_repo; mock_gh
mock_issue 12 open "List dies"
mock_issue 13 closed "Old bug"
OUT=$(bash "$SCRIPT" close 12 2>&1); RC=$?
check "close exits 0" 0 "$RC"
check_contains "reports the transition" "#12: open -> closed — List dies" "$OUT"
OUT=$(bash "$SCRIPT" close 13 2>&1); RC=$?
check "closing closed exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" reopen 13 2>&1); RC=$?
check "reopen exits 0" 0 "$RC"
check_contains "reports reopen transition" "#13: closed -> open — Old bug" "$OUT"
OUT=$(bash "$SCRIPT" reopen 12 2>&1); RC=$?
check "reopening open exits 9" 9 "$RC"

echo "label (TM-C6/TM-U2)"
fresh_repo; mock_gh
mock_issue 12 open "List dies"
printf 'bug\n' > "$MOCK/issue-12-labels"
OUT=$(bash "$SCRIPT" label 12 --add enhancement 2>&1); RC=$?
check "label add exits 0" 0 "$RC"
check_contains "reports the addition" "#12 labels: +enhancement" "$OUT"
grep -q -- "--add-label enhancement" "$MOCK/calls"; check "add sent to gh" 0 "$?"
OUT=$(bash "$SCRIPT" label 12 --add bug 2>&1); RC=$?
check "duplicate label exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" label 12 --add nonexistent 2>&1); RC=$?
check "unknown label exits 8" 8 "$RC"
OUT=$(bash "$SCRIPT" label 12 --remove documentation 2>&1); RC=$?
check "removing absent label exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" label 12 --remove bug 2>&1); RC=$?
check "label remove exits 0" 0 "$RC"
OUT=$(bash "$SCRIPT" label 12 --add a --remove b 2>&1); RC=$?
check "add and remove together exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" label 12 2>&1); RC=$?
check "no operation exits 2" 2 "$RC"

echo "relate (TM-2/TM-3/TM-U7)"
fresh_repo; mock_gh
mock_issue 12 open "List dies" "$(printf 'Body.\n\nDepends-on: #3')"
mock_issue 3 open "Blocker"
mock_issue 7 open "Umbrella"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 7 2>&1); RC=$?
check "relate add exits 0" 0 "$RC"
check_contains "reports both deps" "depends-on: #3 #7" "$OUT"
check_contains "marker written" "Depends-on: #7" "$(cat "$MOCK/edited-body-12")"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 3 2>&1); RC=$?
check "duplicate dep exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 12 2>&1); RC=$?
check "self-reference exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 404 2>&1); RC=$?
check "missing target exits 4" 4 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --remove-depends-on 3 2>&1); RC=$?
check "remove dep exits 0" 0 "$RC"
check_not_contains "marker removed" "Depends-on: #3" "$(cat "$MOCK/edited-body-12")"
OUT=$(bash "$SCRIPT" relate 12 --remove-depends-on 5 2>&1); RC=$?
check "removing absent dep exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --parent 7 2>&1); RC=$?
check "set parent exits 0" 0 "$RC"
check_contains "parent marker written" "Parent: #7" "$(cat "$MOCK/edited-body-12")"
mock_issue 14 open "Child" "$(printf 'Body.\n\nParent: #7')"
OUT=$(bash "$SCRIPT" relate 14 --parent 3 2>&1); RC=$?
check "second parent exits 9" 9 "$RC"
check_contains "names the existing parent" "already has parent #7" "$OUT"
OUT=$(bash "$SCRIPT" relate 14 --remove-parent 2>&1); RC=$?
check "remove parent exits 0" 0 "$RC"
check_not_contains "parent marker removed" "Parent: #7" "$(cat "$MOCK/edited-body-14")"
OUT=$(bash "$SCRIPT" relate 14 --remove-parent 2>&1); RC=$?
check "removing absent parent exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 3 --parent 7 2>&1); RC=$?
check "two relation ops exit 2" 2 "$RC"

echo "usage"
fresh_repo; mock_gh
OUT=$(bash "$SCRIPT" 2>&1); RC=$?
check "no command exits 64" 64 "$RC"
OUT=$(bash "$SCRIPT" frobnicate 2>&1); RC=$?
check "unknown command exits 64" 64 "$RC"

echo
if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all tests passed"
