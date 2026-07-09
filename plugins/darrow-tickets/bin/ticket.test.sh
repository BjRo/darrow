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

TEMP_REPOS=""
cleanup_repos() {
  cd /
  local r
  for r in $TEMP_REPOS; do rm -rf "$r"; done
}
trap cleanup_repos EXIT

# NOT a cmd substitution: cd must affect the caller, never the src repo.
fresh_repo() {
  REPO=$(mktemp -d)
  TEMP_REPOS="$TEMP_REPOS $REPO"
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

# Env/file-driven gh mock. Issues live as files: $MOCK/issue-<id>-{state,title,body,labels}
# plus native relations: issue-<id>-parent (number) and issue-<id>-blockedby
# (one number per line). Database ids are 10000+number. Calls append to
# $MOCK/calls; mutation payloads are snapshotted (body files are temp files
# the CLI deletes).
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
if [ "$1" = "api" ]; then
  shift
  method=GET; endpoint=""; f_issue=""; f_sub=""
  while [ $# -gt 0 ]; do
    case "$1" in
      -X) method=$2; shift 2 ;;
      --jq) shift 2 ;;
      -F)
        case "$2" in
          issue_id=*) f_issue=${2#issue_id=} ;;
          sub_issue_id=*) f_sub=${2#sub_issue_id=} ;;
        esac
        shift 2 ;;
      *) endpoint=$1; shift ;;
    esac
  done
  n=${endpoint##*/issues/}; n=${n%%/*}
  suffix=${endpoint#*/issues/"$n"}
  case "$method $suffix" in
    "GET ")  # database id lookup
      if [ ! -f "$d/issue-$n-state" ]; then
        echo "gh: Not Found (HTTP 404)" >&2
        exit 1
      fi
      echo $((10000 + n))
      ;;
    "GET /parent")
      if [ -f "$d/parent-fail" ]; then
        echo "gh: connect: network is down" >&2
        exit 1
      fi
      if [ -f "$d/issue-$n-parent" ]; then
        cat "$d/issue-$n-parent"
      else
        echo "gh: No parent issue found (HTTP 404)" >&2
        exit 1
      fi
      ;;
    "GET /dependencies/blocked_by")
      if [ -f "$d/dep-get-fail" ]; then
        echo "gh: connect: network is down" >&2
        exit 1
      fi
      cat "$d/issue-$n-blockedby" 2>/dev/null || :
      ;;
    "POST /dependencies/blocked_by")
      if [ -f "$d/dep-post-fail" ]; then
        echo "gh: Validation Failed (HTTP 422)" >&2
        exit 1
      fi
      echo $((f_issue - 10000)) >> "$d/issue-$n-blockedby"
      ;;
    "DELETE /dependencies/blocked_by/"*)
      dep=$(( ${suffix##*/} - 10000 ))
      grep -vx -- "$dep" "$d/issue-$n-blockedby" > "$d/issue-$n-blockedby.new" 2>/dev/null || :
      mv "$d/issue-$n-blockedby.new" "$d/issue-$n-blockedby"
      ;;
    "POST /sub_issues")
      echo "$n" > "$d/issue-$((f_sub - 10000))-parent"
      ;;
    "DELETE /sub_issue")
      rm -f "$d/issue-$((f_sub - 10000))-parent"
      ;;
    *)
      echo "mock gh: unsupported api call: $method $endpoint" >&2
      exit 1
      ;;
  esac
  exit 0
fi
case "$1 $2" in
  "repo view")
    if [ -f "$d/repo-view-fail" ]; then
      echo "GraphQL: Could not resolve to a Repository" >&2
      exit 1
    fi
    if [ -f "$d/issues-disabled" ]; then echo false; else echo true; fi
    ;;
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
        printf '%s\n%s\n' "$state" "$title"
        ;;
      body)
        cat "$d/issue-$id-body" 2>/dev/null || :
        ;;
      labels)
        cat "$d/issue-$id-labels" 2>/dev/null || :
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
    cat "$d/list" 2>/dev/null || :
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
    # Apply the creation like the real backend would: relation calls that
    # follow look the new issue up by number.
    printf 'open' > "$d/issue-99-state"
    cp "$bf" "$d/issue-99-body"
    if [ -f "$d/created-title" ]; then cp "$d/created-title" "$d/issue-99-title"; fi
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
: > "$MOCK/issues-disabled"
OUT=$(bash "$SCRIPT" inspect 2>&1); RC=$?
check "issues disabled exits 3" 3 "$RC"
check_contains "names the disabled feature" "issues are disabled" "$OUT"
rm "$MOCK/issues-disabled"
: > "$MOCK/repo-view-fail"
OUT=$(bash "$SCRIPT" inspect 2>&1); RC=$?
check "unresolvable repo exits 3" 3 "$RC"
check_contains "names the resolution failure" "cannot resolve a GitHub repository" "$OUT"
rm "$MOCK/repo-view-fail"

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
check_not_contains "no marker in stored body" "Depends-on" "$(cat "$MOCK/created-body")"
grep -qF -- "api -X POST repos/{owner}/{repo}/issues/99/dependencies/blocked_by -F issue_id=10003" "$MOCK/calls"
check "dependency recorded natively" 0 "$?"
grep -qF -- "api -X POST repos/{owner}/{repo}/issues/7/sub_issues -F sub_issue_id=10099" "$MOCK/calls"
check "parent recorded natively on the parent side" 0 "$?"
check "dependency state applied" "3" "$(cat "$MOCK/issue-99-blockedby")"
check "parent state applied" "7" "$(cat "$MOCK/issue-99-parent")"
OUT=$(bash "$SCRIPT" create --title "t2" --type bug --body-file body.md --parent 7 2>&1); RC=$?
check "create with only a parent exits 0" 0 "$RC"
check_contains "parent confirmed" "parent: #7 recorded" "$OUT"
check_not_contains "no dependency lines invented" "depends-on" "$OUT"
rm -f "$MOCK/created-body"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --depends-on 42 2>&1); RC=$?
check "missing relation target exits 4" 4 "$RC"
check_contains "names the missing target" "#42 not found" "$OUT"
[[ -f "$MOCK/created-body" ]]; check "nothing created on missing target" 1 "$?"
: > "$MOCK/dep-post-fail"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --depends-on 3 2>&1); RC=$?
check "relation failure after creation exits 4" 4 "$RC"
check_contains "creation still reported on relation failure" "created: #99" "$OUT"
rm "$MOCK/dep-post-fail"

echo "get"
fresh_repo; mock_gh
mock_issue 12 open "List dies" "Some body."
echo 7 > "$MOCK/issue-12-parent"
echo 3 > "$MOCK/issue-12-blockedby"
OUT=$(bash "$SCRIPT" get 12 2>&1); RC=$?
check "get exits 0" 0 "$RC"
check_contains "meta line" "#12 open — List dies" "$OUT"
check_contains "native dependency reported" "depends-on: #3" "$OUT"
check_contains "native parent reported" "parent: #7" "$OUT"
check_contains "body passes through" "Some body." "$OUT"
mock_issue 13 open "Loner"
OUT=$(bash "$SCRIPT" get 13 2>&1); RC=$?
check "get without relations exits 0" 0 "$RC"
check_contains "absent parent reported" "parent: (none)" "$OUT"
check_contains "absent deps reported" "depends-on: (none)" "$OUT"
: > "$MOCK/parent-fail"
OUT=$(bash "$SCRIPT" get 12 2>&1); RC=$?
check "parent read failure exits 4" 4 "$RC"
check_contains "relays the backend error" "network is down" "$OUT"
rm "$MOCK/parent-fail"
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
mock_issue 12 open "List dies"
mock_issue 3 open "Blocker"
mock_issue 7 open "Umbrella"
echo 3 > "$MOCK/issue-12-blockedby"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 7 2>&1); RC=$?
check "relate add exits 0" 0 "$RC"
check_contains "reports both deps" "depends-on: #3 #7" "$OUT"
grep -qF -- "api -X POST repos/{owner}/{repo}/issues/12/dependencies/blocked_by -F issue_id=10007" "$MOCK/calls"
check "dependency added natively" 0 "$?"
check_contains "confirms the change before the re-read report" "recorded: #12 depends-on #7" "$OUT"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 3 2>&1); RC=$?
check "duplicate dep exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 07 2>&1); RC=$?
check "leading-zero id normalized" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 12 2>&1); RC=$?
check "self-reference exits 2" 2 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 404 2>&1); RC=$?
check "missing target exits 4" 4 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --remove-depends-on 3 2>&1); RC=$?
check "remove dep exits 0" 0 "$RC"
grep -qxF -- "3" "$MOCK/issue-12-blockedby"
check "dependency removed from state" 1 "$?"
check "other dependency survives the removal" "7" "$(cat "$MOCK/issue-12-blockedby")"
grep -qF -- "api -X DELETE repos/{owner}/{repo}/issues/12/dependencies/blocked_by/10003" "$MOCK/calls"
check "removal sent to the right endpoint" 0 "$?"
OUT=$(bash "$SCRIPT" relate 12 --remove-depends-on 5 2>&1); RC=$?
check "removing absent dep exits 9" 9 "$RC"
: > "$MOCK/dep-get-fail"
OUT=$(bash "$SCRIPT" relate 12 --remove-depends-on 7 2>&1); RC=$?
check "failed state read aborts remove, not exit 9" 4 "$RC"
check_not_contains "no false does-not-depend claim" "does not depend" "$OUT"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 3 2>&1); RC=$?
check "failed state read aborts add" 4 "$RC"
grep -qF -- "issue_id=10003" "$MOCK/calls"
check "no mutation after failed read" 1 "$?"
rm "$MOCK/dep-get-fail"
OUT=$(bash "$SCRIPT" relate 12 --parent 7 2>&1); RC=$?
check "set parent exits 0" 0 "$RC"
grep -qF -- "api -X POST repos/{owner}/{repo}/issues/7/sub_issues -F sub_issue_id=10012" "$MOCK/calls"
check "parent set on the parent side" 0 "$?"
check "parent state applied" "7" "$(cat "$MOCK/issue-12-parent")"
mock_issue 14 open "Child"
echo 7 > "$MOCK/issue-14-parent"
OUT=$(bash "$SCRIPT" relate 14 --parent 3 2>&1); RC=$?
check "second parent exits 9" 9 "$RC"
check_contains "names the existing parent" "already has parent #7" "$OUT"
OUT=$(bash "$SCRIPT" relate 14 --remove-parent 2>&1); RC=$?
check "remove parent exits 0" 0 "$RC"
grep -qF -- "api -X DELETE repos/{owner}/{repo}/issues/7/sub_issue -F sub_issue_id=10014" "$MOCK/calls"
check "parent removed on the parent side" 0 "$?"
[[ -f "$MOCK/issue-14-parent" ]]; check "parent state removed" 1 "$?"
OUT=$(bash "$SCRIPT" relate 14 --remove-parent 2>&1); RC=$?
check "removing absent parent exits 9" 9 "$RC"
OUT=$(bash "$SCRIPT" relate 12 --depends-on 3 --parent 7 2>&1); RC=$?
check "two relation ops exit 2" 2 "$RC"

echo "create — marker side door and dedup (TM-2)"
fresh_repo; mock_gh
mock_issue 5 open "Other"
printf '## Observed\n\nx\n\nParent: #5\n\n## Expected\n\ny\n\n## Reproduction\n\nz\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md 2>&1); RC=$?
check "hand-written marker rejected" 2 "$RC"
check_contains "points at the flags" "pass --depends-on/--parent" "$OUT"
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --depends-on 5 --depends-on 5 2>&1); RC=$?
check "duplicate --depends-on exits 2" 2 "$RC"

echo "create — milestone/assignee pass-through (TM-C6)"
fresh_repo; mock_gh
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md --milestone v1 --assignee octocat 2>&1); RC=$?
check "create with milestone exits 0" 0 "$RC"
check_contains "reports the milestone" "milestone: v1" "$OUT"
check_contains "reports the assignee" "assignee: octocat" "$OUT"
grep -q -- "--milestone v1" "$MOCK/calls"; check "milestone sent to gh" 0 "$?"
grep -q -- "--assignee octocat" "$MOCK/calls"; check "assignee sent to gh" 0 "$?"

echo "create — fence-masked heading (TM-C3)"
fresh_repo; mock_gh
printf '## Observed\n\nx\n\n## Expected\n\ny\n\n```\n## Reproduction\n\nz\n```\n' > body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --body-file body.md 2>&1); RC=$?
check "heading inside a fence does not count" 7 "$RC"

echo "labels — dash and comma edge cases"
fresh_repo; mock_gh
printf 'bug\n-triage\n' > "$MOCK/labels"
good_bug_body body.md
OUT=$(bash "$SCRIPT" create --title "t" --type bug --label "-triage" --body-file body.md 2>&1); RC=$?
check "leading-dash label accepted when it exists" 0 "$RC"
check_not_contains "no grep option error" "No such file" "$OUT"
OUT=$(bash "$SCRIPT" create --title "t" --type bug --label "a,b" --body-file body.md 2>&1); RC=$?
check "comma label exits 8" 8 "$RC"
mock_issue 12 open "T"
OUT=$(bash "$SCRIPT" label 12 --add "a,b" 2>&1); RC=$?
check "comma label add exits 8" 8 "$RC"

echo "CRLF bodies (web-UI edited tickets)"
fresh_repo; mock_gh
printf 'Body line.\r\nSecond line.\r\n' > "$MOCK/issue-15-body"
printf 'open' > "$MOCK/issue-15-state"
printf 'CRLF ticket' > "$MOCK/issue-15-title"
OUT=$(bash "$SCRIPT" get 15 2>&1); RC=$?
check "get on CRLF body exits 0" 0 "$RC"
check_contains "body text survives" "Body line." "$OUT"
check_not_contains "carriage returns normalized" $'\r' "$OUT"

echo "describe (TM-U3)"
fresh_repo; mock_gh
mock_issue 12 open "List dies" "Old text."
mock_issue 3 open "Blocker"
mock_issue 7 open "Umbrella"
echo 7 > "$MOCK/issue-12-parent"
echo 3 > "$MOCK/issue-12-blockedby"
printf 'New description with the real repro.\n' > d.md
OUT=$(bash "$SCRIPT" describe 12 --body-file d.md 2>&1); RC=$?
check "describe exits 0" 0 "$RC"
check_contains "reports the rewrite" "#12 description replaced" "$OUT"
NEW=$(cat "$MOCK/edited-body-12")
check_contains "new text stored" "real repro" "$NEW"
check_not_contains "old text gone" "Old text" "$NEW"
OUT=$(bash "$SCRIPT" get 12 2>&1)
check_contains "relations survive the rewrite" "parent: #7" "$OUT"
check_contains "dependencies survive the rewrite" "depends-on: #3" "$OUT"
printf 'Rewrite with marker.\n\nParent: #9\n' > d.md
OUT=$(bash "$SCRIPT" describe 12 --body-file d.md 2>&1); RC=$?
check "marker in describe body rejected" 2 "$RC"
printf 'Done.\n\nCo-authored-by: Claude <noreply@anthropic.com>\n' > d.md
OUT=$(bash "$SCRIPT" describe 12 --body-file d.md 2>&1); RC=$?
check "attribution in describe exits 6" 6 "$RC"

echo "list names the backend (TM-1)"
fresh_repo; mock_gh
: > "$MOCK/list"
OUT=$(bash "$SCRIPT" list 2>&1)
check_contains "backend named" "backend: github" "$OUT"

echo "usage"
fresh_repo; mock_gh
OUT=$(bash "$SCRIPT" 2>&1); RC=$?
check "no command exits 64" 64 "$RC"
OUT=$(bash "$SCRIPT" frobnicate 2>&1); RC=$?
check "unknown command exits 64" 64 "$RC"
OUT=$(bash "$SCRIPT" get 2>&1); RC=$?
check "missing id is an input error" 2 "$RC"

echo
if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all tests passed"
