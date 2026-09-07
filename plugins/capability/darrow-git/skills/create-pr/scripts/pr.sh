#!/usr/bin/env bash
# Deterministic git/gh steps for the create-pr skill.
# stdout is read by a model: print only decision-relevant data, never raw
# intermediate git output. Checkable invariants (conventional title, no AI
# attribution, deliberate base, no duplicates, push without rewrite,
# template shape) are enforced here, not in the prompt.
set -euo pipefail

# `head` would SIGPIPE git under pipefail on large output; awk consumes input.
truncate_lines() { awk 'NR<=50'; }

# Unmerged index entries alone miss resolved-but-uncontinued merges,
# rebase stopped at edit/break, and am conflicts — and ls-files is
# cwd-scoped, so check the op state files too.
in_progress() {
  local p
  for p in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    if [[ -e "$(git rev-parse --git-path "$p")" ]]; then
      return 0
    fi
  done
  [[ -n "$(git ls-files -u -- ':/')" ]]
}

current_ref() { git symbolic-ref -q --short HEAD || echo "(detached @ $(git rev-parse --short HEAD))"; }

# Sets DEFAULT_BRANCH and DEFAULT_SRC=tracked|remote|guess (globals, not
# stdout: a command substitution would drop DEFAULT_SRC in a subshell).
# Callers can flag a guess: the local main/master fallback may point at a
# branch the remote never merges.
detect_default_branch() {
  local b
  DEFAULT_SRC=tracked
  b=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$b" ]]; then
    DEFAULT_BRANCH=${b#origin/}
    return
  fi
  # origin/HEAD is only set by clone/set-head; ask the remote directly
  # (resolves offline for path remotes).
  DEFAULT_SRC=remote
  b=$(git ls-remote --symref origin HEAD 2>/dev/null | awk '$1 == "ref:" {sub("refs/heads/", "", $2); print $2; exit}' || true)
  if [[ -n "$b" ]]; then
    DEFAULT_BRANCH=$b
    return
  fi
  DEFAULT_SRC=guess
  for b in main master; do
    if git show-ref -q --verify "refs/heads/$b"; then
      DEFAULT_BRANCH=$b
      return
    fi
  done
  DEFAULT_BRANCH="(none)"
}

# origin/<branch> when the remote-tracking ref exists, else the local branch.
compare_ref() {
  if git rev-parse -q --verify "refs/remotes/origin/$1" >/dev/null; then
    echo "origin/$1"
  else
    echo "$1"
  fi
}

# Sets PR_TEMPLATE to the repo's PR template path, GitHub's lookup order
# (.github/, repo root, docs/). Global, not stdout: callers branch on the
# return code and then need the path.
find_pr_template() {
  PR_TEMPLATE=""
  local top d f
  top=$(git rev-parse --show-toplevel)
  for d in .github "" docs; do
    for f in PULL_REQUEST_TEMPLATE.md pull_request_template.md; do
      if [[ -f "$top/${d:+$d/}$f" ]]; then
        PR_TEMPLATE="$top/${d:+$d/}$f"
        return 0
      fi
    done
  done
  return 1
}

list_pr_template_choices() {
  local top dir
  top=$(git rev-parse --show-toplevel)
  dir="$top/.github/PULL_REQUEST_TEMPLATE"
  if [[ -d "$dir" ]]; then
    find "$dir" -mindepth 1 -maxdepth 1 -type f ! -name '.*' \
      -exec basename -- {} \; | LC_ALL=C sort
  fi
}

valid_pr_template_choice() {
  case "$1" in
    ""|.*|*/*) return 1 ;;
    *) return 0 ;;
  esac
}

pr_template_choice_is_listed() {
  local wanted=$1 choices=$2 choice
  while IFS= read -r choice; do
    if [[ "$choice" == "$wanted" ]]; then
      return 0
    fi
  done <<< "$choices"
  return 1
}

print_pr_template() {
  local top rel tlines
  top=$(git rev-parse --show-toplevel)
  rel=${PR_TEMPLATE#"$top/"}
  if [[ ! -r "$PR_TEMPLATE" ]]; then
    # Not silently skippable: create refuses, so say why up front.
    echo "## note: pr template $rel exists but is not readable — fix its permissions; create will refuse"
    return
  fi
  echo "## pr template ($rel) — the body must follow it: keep headings verbatim, fill every section, follow comment instructions then delete the comments"
  awk 'NR<=100' "$PR_TEMPLATE"
  tlines=$(awk 'END{print NR}' "$PR_TEMPLATE")
  if [[ "$tlines" -gt 100 ]]; then
    # Absolute path: a toplevel-relative one does not resolve from a
    # subdirectory cwd, and create enforces headings past the cut.
    echo "## note: template truncated at 100 lines ($tlines total) — read $PR_TEMPLATE for the rest"
  fi
}

# Template ATX headings outside fenced code blocks, trailing whitespace
# trimmed. Fences: ``` or ~~~ indented up to 3 spaces (CommonMark), matched
# with substr — interval regexes are not portable across awks. A leading
# UTF-8 BOM would hide the first heading.
template_headings() {
  awk '
    NR==1 && index($0, "\357\273\277")==1 { $0 = substr($0, 4) }
    { n=0; while (substr($0, n+1, 1)==" ") n++; c = substr($0, n+1, 3) }
    n<=3 && (c=="```" || c=="~~~") { f=!f; next }
    f { next }
    n<=3 && substr($0, n+1, 1)=="#" {
      m=0; while (substr($0, n+m+1, 1)=="#") m++
      rest = substr($0, n+m+1, 1)
      if (m<=6 && (rest==" " || rest=="\t")) { l=$0; sub(/[[:space:]]+$/, "", l); print l }
    }' "$1"
}

if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]]; then
  echo "error: not inside a git work tree" >&2
  exit 3
fi

cmd=${1:-}
shift || true
case "$cmd" in
  inspect)
    selected_template=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --template)
          if [[ $# -lt 2 ]]; then
            echo "error: --template needs a filename" >&2
            exit 2
          fi
          selected_template=$2
          shift 2
          ;;
        *)
          echo "error: unknown argument: $1" >&2
          exit 2
          ;;
      esac
    done
    if [[ -n "$selected_template" ]] && ! valid_pr_template_choice "$selected_template"; then
      echo "error: --template must be one exact visible filename from .github/PULL_REQUEST_TEMPLATE/" >&2
      exit 2
    fi
    if in_progress; then
      echo "## mode: conflict (merge/rebase/cherry-pick in progress — do not open a PR; inform the user)"
      echo "## unmerged files"
      git diff --name-only --diff-filter=U | truncate_lines
    elif ! git rev-parse -q --verify HEAD >/dev/null 2>&1; then
      echo "## mode: empty (no commits yet — nothing to propose)"
    elif ! git remote get-url origin >/dev/null 2>&1; then
      echo "## mode: no-remote (no 'origin' remote — cannot create a PR; inform the user)"
    else
      cur=$(current_ref)
      detect_default_branch
      def=$DEFAULT_BRANCH
      if [[ "$cur" == "(detached"* ]]; then
        echo "## mode: wrong-branch (detached HEAD — a PR needs a branch; suggest create-branch)"
        echo "## cur: $cur"
      elif [[ "$cur" == "$def" ]]; then
        echo "## mode: wrong-branch (on the default branch — a PR needs a feature branch; suggest create-branch)"
        echo "## cur branch: $cur"
      else
        # Tolerant here (create re-checks hard), but a failed check must not
        # masquerade as "no open PR".
        existing=""
        pr_check_note=""
        if ! command -v gh >/dev/null 2>&1; then
          pr_check_note="## note: gh CLI not found — create will fail until it is installed"
        elif ! existing=$(gh pr list --head "$cur" --state open 2>/dev/null); then
          existing=""
          pr_check_note="## note: could not check for an existing open PR (gh error) — create re-checks"
        fi
        ahead=""
        cmp=""
        if [[ "$def" != "(none)" ]]; then
          cmp=$(compare_ref "$def")
          ahead=$(git rev-list --count "$cmp..HEAD" 2>/dev/null || true)
        fi
        if [[ -n "$existing" ]]; then
          echo "## mode: exists (open PR for this branch — report it; do not create another)"
          printf '%s\n' "$existing" | truncate_lines
        elif [[ "$ahead" == "0" ]]; then
          echo "## mode: no-commits (no commits ahead of $cmp — nothing to propose; report and stop)"
          echo "## cur branch: $cur"
          echo "## base branch (default): $def"
        else
          echo "## mode: ready"
          echo "## cur branch: $cur"
          echo "## base branch (default): $def"
          if [[ "$DEFAULT_SRC" == "guess" ]]; then
            echo "## note: default branch guessed from local branches (origin/HEAD unset, remote unreachable)"
          fi
          if [[ -n "$pr_check_note" ]]; then
            echo "$pr_check_note"
          fi
          if u=$(git rev-parse -q --verify --abbrev-ref '@{u}' 2>/dev/null); then
            echo "## upstream: $u (ahead $(git rev-list --count '@{u}..HEAD'), behind $(git rev-list --count 'HEAD..@{u}'))"
          else
            echo "## upstream: none (create will push with -u)"
          fi
          if [[ -n "$cmp" && -n "$ahead" ]]; then
            echo "## commits to include ($cmp..HEAD)"
            { git log --format='%h %s' "$cmp..HEAD" 2>/dev/null || true; } | truncate_lines
            echo "## diffstat"
            { git diff --stat "$cmp...HEAD" 2>/dev/null || true; } | truncate_lines
          fi
          top=$(git rev-parse --show-toplevel)
          if find_pr_template; then
            if [[ -n "$selected_template" ]]; then
              echo "error: --template is not valid when the repository has the single template $PR_TEMPLATE" >&2
              exit 7
            fi
            print_pr_template
          else
            choices=$(list_pr_template_choices)
            choice_count=$(awk 'NF {n++} END {print n+0}' <<< "$choices")
            if [[ -n "$selected_template" ]]; then
              PR_TEMPLATE="$top/.github/PULL_REQUEST_TEMPLATE/$selected_template"
              if ! pr_template_choice_is_listed "$selected_template" "$choices"; then
                echo "error: selected pr template is not available: $PR_TEMPLATE" >&2
                exit 7
              fi
              print_pr_template
            elif [[ "$choice_count" -eq 1 ]]; then
              PR_TEMPLATE="$top/.github/PULL_REQUEST_TEMPLATE/$choices"
              print_pr_template
            elif [[ "$choice_count" -gt 1 ]]; then
              echo "## note: multiple PR templates in .github/PULL_REQUEST_TEMPLATE/ — ask the user which one to follow"
              printf '%s\n' "$choices" | truncate_lines
            fi
          fi
          echo "## working tree (uncommitted changes will NOT be in the PR)"
          status=$(git status --porcelain)
          if [[ -z "$status" ]]; then
            echo "clean"
          else
            printf '%s\n' "$status" | truncate_lines
          fi
        fi
      fi
    fi
    ;;
  create)
    # create --title <t> -b <body-section>... [--template <filename>]
    #   [--base <branch>] [--draft]
    title=""
    bodies=()
    base=""
    user_base=""
    draft=""
    selected_template=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --title)
          if [[ $# -lt 2 ]]; then
            echo "error: --title needs a value" >&2
            exit 2
          fi
          title=$2
          shift 2
          ;;
        -b)
          if [[ $# -lt 2 ]]; then
            echo "error: -b needs a value" >&2
            exit 2
          fi
          # =~ not ${var//}: pattern substitution is O(n^2) in bash and
          # takes a minute on a 10KB section.
          if ! [[ "$2" =~ [^[:space:]] ]]; then
            echo "error: -b section is empty" >&2
            exit 2
          fi
          bodies+=("$2")
          shift 2
          ;;
        --base)
          if [[ $# -lt 2 ]]; then
            echo "error: --base needs a value" >&2
            exit 2
          fi
          base=$2
          user_base=1
          shift 2
          ;;
        --template)
          if [[ $# -lt 2 ]]; then
            echo "error: --template needs a filename" >&2
            exit 2
          fi
          selected_template=$2
          shift 2
          ;;
        --draft)
          draft=1
          shift
          ;;
        *)
          echo "error: unknown argument: $1" >&2
          exit 2
          ;;
      esac
    done
    if [[ -z "$title" ]]; then
      echo "error: --title required" >&2
      exit 2
    fi
    if [[ ${#bodies[@]} -eq 0 ]]; then
      echo "error: at least one -b body section required" >&2
      exit 2
    fi
    if [[ -n "$selected_template" ]] && ! valid_pr_template_choice "$selected_template"; then
      echo "error: --template must be one exact visible filename from .github/PULL_REQUEST_TEMPLATE/" >&2
      exit 2
    fi
    if in_progress; then
      echo "error: merge/rebase/cherry-pick in progress — resolve it first; do not open a PR" >&2
      exit 8
    fi
    if ! git rev-parse -q --verify HEAD >/dev/null 2>&1; then
      echo "error: repo has no commits yet — nothing to propose" >&2
      exit 3
    fi
    if ! branch=$(git symbolic-ref -q --short HEAD); then
      echo "error: detached HEAD — a PR needs a branch (see create-branch)" >&2
      exit 3
    fi
    if ! git remote get-url origin >/dev/null 2>&1; then
      echo "error: no 'origin' remote — cannot create a PR" >&2
      exit 3
    fi
    if ! command -v gh >/dev/null 2>&1; then
      echo "error: gh CLI not found — cannot create a PR" >&2
      exit 3
    fi
    detect_default_branch
    def=$DEFAULT_BRANCH
    if [[ "$branch" == "$def" ]]; then
      echo "error: on the default branch ($branch) — a PR needs a feature branch (see create-branch)" >&2
      exit 9
    fi
    if [[ -z "$base" ]]; then
      if [[ "$def" == "(none)" ]]; then
        echo "error: cannot determine the default branch — pass --base" >&2
        exit 3
      fi
      base=$def
    fi
    if [[ "$base" == "$branch" ]]; then
      echo "error: base equals the current branch: $branch" >&2
      exit 2
    fi
    # A user-named base must exist on origin: a local-only branch would pass
    # here and then fail on the server after the push already happened.
    if [[ -n "$user_base" ]] && ! git rev-parse -q --verify "refs/remotes/origin/$base" >/dev/null; then
      echo "error: base not found on origin: $base — fetch or push it first" >&2
      exit 2
    fi
    if ! [[ "$title" =~ ^(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)(\([^\)]+\))?\!?:\ [^[:space:]] ]]; then
      echo "error: title not Conventional Commits format: $title" >&2
      exit 5
    fi
    if [[ ${#title} -gt 72 ]]; then
      echo "error: title exceeds 72 chars (${#title})" >&2
      exit 5
    fi
    if [[ "$title" == *. ]]; then
      echo "error: title has trailing period" >&2
      exit 5
    fi
    body=""
    for b in "${bodies[@]}"; do
      if [[ -z "$body" ]]; then
        body=$b
      else
        body="$body"$'\n\n'"$b"
      fi
    done
    top=$(git rev-parse --show-toplevel)
    if find_pr_template; then
      if [[ -n "$selected_template" ]]; then
        echo "error: --template is not valid when the repository has the single template $PR_TEMPLATE" >&2
        exit 7
      fi
    else
      choices=$(list_pr_template_choices)
      choice_count=$(awk 'NF {n++} END {print n+0}' <<< "$choices")
      if [[ -n "$selected_template" ]]; then
        PR_TEMPLATE="$top/.github/PULL_REQUEST_TEMPLATE/$selected_template"
        if ! pr_template_choice_is_listed "$selected_template" "$choices"; then
          echo "error: selected pr template is not available: $PR_TEMPLATE" >&2
          exit 7
        fi
      elif [[ "$choice_count" -eq 1 ]]; then
        PR_TEMPLATE="$top/.github/PULL_REQUEST_TEMPLATE/$choices"
      elif [[ "$choice_count" -gt 1 ]]; then
        echo "error: multiple PR templates require --template <filename>; run inspect and ask the user which one to follow" >&2
        exit 7
      fi
    fi
    # Attribution needs tool context: "generated by openapi-generator" is
    # legitimate prose, "Generated using Claude Code" is not.
    # Herestring, not a pipe: grep -q exits at the first match, and on a
    # >64KB body the writer's SIGPIPE (141) would make pipefail discard
    # the match — silently disabling this check.
    if grep -qiE 'co-authored-by:.*\b(claude|gpt|chatgpt|codex|copilot|cursor|gemini|ai)\b|co[- ]?authored[- ]by +(claude|gpt|chatgpt|codex|copilot|cursor|gemini)\b|(generated|built|written|created|made|assisted)[- ](with|by|using) +\[?(claude|gpt|chatgpt|codex|copilot|cursor|gemini|an? ai\b|ai\b)|🤖' <<< "$title"$'\n'"$body"; then
      echo "error: AI attribution is not allowed in PR titles or bodies" >&2
      exit 6
    fi
    # Template shape is checkable — headings present with content, no
    # leftover instruction comments. Content quality stays with the model.
    # Runs before any push or PR call: a rejected body must mutate nothing.
    if [[ -n "$PR_TEMPLATE" ]]; then
      # An unreadable template must refuse, not skip: chmod 000 would
      # otherwise silently disable GW-P8 enforcement (and awk would die
      # with a raw error under set -e).
      if [[ ! -r "$PR_TEMPLATE" ]]; then
        echo "error: pr template is not readable: $PR_TEMPLATE — fix its permissions" >&2
        exit 3
      fi
      rel=${PR_TEMPLATE#"$(git rev-parse --show-toplevel)/"}
      theads=$(template_headings "$PR_TEMPLATE")
      if [[ -n "$theads" ]]; then
        while IFS= read -r h; do
          # A section ends at the next heading of the same or higher level;
          # deeper sub-headings inside it count as content. Fenced lines
          # never start or end a section but do count as content.
          # Herestring, not a pipe: the early exits would SIGPIPE the writer
          # under pipefail (false "empty" on large bodies). The heading rides
          # in via ENVIRON — awk -v mangles backslashes.
          rc=0
          TPL_H="$h" awk '
            BEGIN {
              h=ENVIRON["TPL_H"]
              hn=0; while (substr(h, hn+1, 1) == " ") hn++
              hl=0; while (substr(h, hn+hl+1, 1) == "#") hl++
            }
            {
              l=$0; sub(/[[:space:]]+$/, "", l)
              n=0; while (substr(l, n+1, 1)==" ") n++
              c = substr(l, n+1, 3)
              isfence = (n<=3 && (c=="```" || c=="~~~"))
              isheading=0; level=0
              if (n<=3 && substr(l, n+1, 1)=="#") {
                while (substr(l, n+level+1, 1)=="#") level++
                rest=substr(l, n+level+1, 1)
                if (level<=6 && (rest==" " || rest=="\t")) isheading=1
              }
            }
            isfence {f=!f}
            !f && !isfence && !insec && l==h {insec=1; seen=1; next}
            insec && !f && !isfence && isheading && level<=hl {exit}
            insec && NF {ok=1; exit}
            END {if (!seen) exit 2; exit ok ? 0 : 1}' <<< "$body" || rc=$?
          if [[ $rc -eq 2 ]]; then
            echo "error: template section missing from the body: $h ($rel)" >&2
            exit 7
          elif [[ $rc -ne 0 ]]; then
            echo "error: template section is empty in the body: $h ($rel)" >&2
            exit 7
          fi
        done <<< "$theads"
      fi
      if awk '
          {n=0; while (substr($0, n+1, 1)==" ") n++; c = substr($0, n+1, 3)}
          n<=3 && (c=="```" || c=="~~~") {f=!f; next}
          !f && index($0, "<!--") {found=1}
          END {exit found ? 0 : 1}' <<< "$body"; then
        echo "error: body still contains template comments (<!-- ... -->) — follow their instructions, then remove them" >&2
        exit 7
      fi
    fi
    cmp=$(compare_ref "$base")
    if ! ahead=$(git rev-list --count "$cmp..HEAD" 2>/dev/null); then
      echo "error: cannot compare against $cmp — fetch origin first" >&2
      exit 3
    fi
    if [[ "$ahead" -eq 0 ]]; then
      echo "error: no commits ahead of $cmp — nothing to propose" >&2
      exit 3
    fi
    # A failed check must abort, not pass as "no duplicates found".
    gh_err=$(mktemp)
    if ! existing=$(gh pr list --head "$branch" --state open 2>"$gh_err"); then
      echo "error: could not check for an existing open PR — fix gh before retrying:" >&2
      truncate_lines <"$gh_err" >&2
      rm -f "$gh_err"
      exit 4
    fi
    rm -f "$gh_err"
    if [[ -n "$existing" ]]; then
      echo "error: an open PR for $branch already exists — report it; do not create another:" >&2
      printf '%s\n' "$existing" | truncate_lines >&2
      exit 9
    fi
    # Explicit refspec: bare `git push` obeys push.default/tracking config
    # and can publish other branches or a differently-named upstream.
    # Never force-push; a refusal (diverged remote branch) surfaces verbatim.
    upstream=$(git rev-parse -q --verify --abbrev-ref '@{u}' 2>/dev/null || true)
    if [[ -n "$upstream" ]]; then
      out=$(git push origin "$branch" 2>&1) || {
        echo "$out" >&2
        exit 4
      }
    else
      out=$(git push -u origin "$branch" 2>&1) || {
        echo "$out" >&2
        exit 4
      }
    fi
    # --head pins the PR head; without it gh resolves the head from
    # tracking config, which may name a different branch or fork.
    args=(--title "$title" --body "$body" --base "$base" --head "$branch")
    if [[ -n "$draft" ]]; then
      args+=(--draft)
    fi
    out=$(gh pr create "${args[@]}" 2>&1) || {
      echo "$out" >&2
      exit 4
    }
    url=$(printf '%s\n' "$out" | awk 'NF {l=$0} END {print l}')
    echo "$url ($branch -> $base${draft:+, draft})"
    if [[ -n "$upstream" && "$upstream" != "origin/$branch" ]]; then
      echo "note: upstream is $upstream; pushed and opened the PR from origin/$branch"
    fi
    ;;
  *)
    echo "usage: pr.sh inspect [--template <filename>] | create --title <t> -b <body-section>... [--template <filename>] [--base <branch>] [--draft]" >&2
    exit 64
    ;;
esac
