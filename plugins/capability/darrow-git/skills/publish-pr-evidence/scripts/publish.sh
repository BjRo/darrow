#!/usr/bin/env bash
set -euo pipefail

stage=arguments
expected=''
body_file=''
attachment_count=0
attachment_paths=()
attachment_kinds=()
attachment_texts=()

emit_refusal() {
  printf '%s\n' "outcome: refused" "stage: $stage" "effects: none" "uncertainty: none" "error: $*"
  exit 4
}

canonical_file() {
  local path=$1 dir base
  dir=${path%/*}; base=${path##*/}
  [[ "$dir" != "$path" ]] || dir=.
  dir=$(cd "$dir" 2>/dev/null && pwd -P) || return 1
  printf '%s/%s\n' "$dir" "$base"
}

media_matches_extension() {
  local path=$1 ext=$2 size=$3 sig prefix suffix width height
  case "$ext" in
    png)
      [[ "$size" -ge 45 ]] || return 1
      sig=$(od -An -tx1 -N24 "$path" | tr -d '[:space:]')
      suffix=$(tail -c 12 "$path" | od -An -tx1 | tr -d '[:space:]')
      width=${sig:32:8}; height=${sig:40:8}
      [[ "$sig" == 89504e470d0a1a0a0000000d49484452* && "$width" != 00000000 && "$height" != 00000000 && "$suffix" == 0000000049454e44ae426082 ]]
      ;;
    jpg|jpeg)
      [[ "$size" -ge 12 ]] || return 1
      sig=$(od -An -tx1 -N3 "$path" | tr -d '[:space:]')
      prefix=$(od -An -tx1 -N65536 "$path" | tr -d '[:space:]')
      suffix=$(tail -c 2 "$path" | od -An -tx1 | tr -d '[:space:]')
      [[ "$sig" == ffd8ff && ( "$prefix" == *ffc0* || "$prefix" == *ffc1* || "$prefix" == *ffc2* ) && "$suffix" == ffd9 ]]
      ;;
    gif)
      [[ "$size" -ge 14 ]] || return 1
      sig=$(od -An -tx1 -N10 "$path" | tr -d '[:space:]')
      suffix=$(tail -c 1 "$path" | od -An -tx1 | tr -d '[:space:]')
      [[ ( "$sig" == 474946383761* || "$sig" == 474946383961* ) && "$sig" != 47494638376100000000 && "$sig" != 47494638396100000000 && "$suffix" == 3b ]]
      ;;
    webp)
      [[ "$size" -ge 20 ]] || return 1
      sig=$(od -An -tx1 -N16 "$path" | tr -d '[:space:]')
      [[ "$sig" == 52494646????????5745425056503820* || "$sig" == 52494646????????574542505650384c* || "$sig" == 52494646????????5745425056503858* ]]
      ;;
    svg)
      [[ "$size" -ge 12 ]] || return 1
      prefix=$(dd if="$path" bs=4096 count=1 2>/dev/null)
      grep -q '<svg\([[:space:]>]\)' <<< "$prefix" && grep -q '</svg[[:space:]]*>' "$path"
      ;;
    mp4|mov)
      [[ "$size" -ge 20 ]] || return 1
      sig=$(od -An -tx1 -j4 -N4 "$path" | tr -d '[:space:]')
      prefix=$(od -An -tx1 -N65536 "$path" | tr -d '[:space:]')
      [[ "$sig" == 66747970 && ( "$prefix" == *6d6f6f76* || "$prefix" == *6d646174* ) ]]
      ;;
    webm)
      [[ "$size" -ge 8 ]] || return 1
      sig=$(od -An -tx1 -N4 "$path" | tr -d '[:space:]')
      prefix=$(od -An -tx1 -N4096 "$path" | tr -d '[:space:]')
      [[ "$sig" == 1a45dfa3 && "$prefix" == *18538067* ]]
      ;;
    *) return 1 ;;
  esac
}

cmd=${1-}
[[ "$cmd" == publish ]] || { echo 'usage: publish.sh publish --expected-head <full-id> --body-file <path> [--image <path> --alt <text> | --video <path> --explanation <text>]...' >&2; exit 64; }
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-head|--body-file)
      [[ $# -ge 2 && -n "$2" ]] || emit_refusal "$1 needs a value"
      if [[ "$1" == --expected-head ]]; then expected=$2; else body_file=$2; fi
      shift 2
      ;;
    --image|--video)
      kind=${1#--}
      [[ $# -ge 4 && -n "$2" ]] || emit_refusal "$1 needs a path and presentation text"
      path=$2
      if [[ "$kind" == image && "$3" == --alt ]]; then text_value=$4
      elif [[ "$kind" == video && "$3" == --explanation ]]; then text_value=$4
      else emit_refusal "$1 must be followed by $([[ "$kind" == image ]] && echo --alt || echo --explanation)"
      fi
      [[ "$text_value" =~ [^[:space:]] ]] || emit_refusal "$kind presentation text must be meaningful"
      [[ "$text_value" != *$'\n'* && "$text_value" != *$'\r'* && "$text_value" != *$'\t'* ]] || emit_refusal "$kind presentation text must be one line"
      attachment_paths+=("$path"); attachment_kinds+=("$kind"); attachment_texts+=("$text_value")
      attachment_count=$((attachment_count + 1)); shift 4
      ;;
    *) emit_refusal "unknown argument: $1" ;;
  esac
done
[[ "$expected" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]] || emit_refusal '--expected-head requires a full commit ID'
[[ -n "$body_file" ]] || emit_refusal '--body-file is required'
[[ "$attachment_count" -le 50 ]] || emit_refusal 'at most 50 attachments are supported'
[[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" == true ]] || emit_refusal 'not inside a git work tree'
top=$(git rev-parse --show-toplevel)
head_before=$(git rev-parse HEAD)
[[ "$head_before" == "$expected" ]] || emit_refusal 'local HEAD differs from expected head'
branch=$(git symbolic-ref -q --short HEAD) || emit_refusal 'a feature branch is required'
repo_row=$(gh repo view --json nameWithOwner,url --jq '[.nameWithOwner,.url] | @tsv' 2>/dev/null) || emit_refusal 'cannot identify the repository'
IFS=$'\t' read -r repo repo_web extra <<< "$repo_row"
[[ "$repo" =~ ^[^/[:space:]]+/[^/[:space:]]+$ && "$repo_web" == https://github.com/* && -z "${extra-}" ]] || emit_refusal 'active repository is not on a supported GitHub attachment host'

stage=pr-preflight
rows=$(gh pr list --repo "$repo" --head "$branch" --state open --limit 2 --json number,url,headRefOid,isCrossRepository --jq '.[] | [.number,.url,.headRefOid,.isCrossRepository] | @tsv' 2>/dev/null) || emit_refusal 'cannot observe open pull requests'
count=$(awk 'NF {n++} END {print n+0}' <<< "$rows")
[[ "$count" -eq 1 ]] || emit_refusal 'exactly one open PR is required'
IFS=$'\t' read -r pr_number pr_url observed_head cross extra <<< "$rows"
[[ "$pr_number" =~ ^[0-9]+$ && "$pr_url" == https://* && "$cross" == false && -z "${extra-}" ]] || emit_refusal 'malformed or cross-repository PR identity'
[[ "$observed_head" == "$expected" ]] || emit_refusal 'current PR head differs from expected head'

stage=cli-preflight
help=$(gh pr comment --help 2>&1) || emit_refusal 'cannot inspect gh pr comment support'
grep -q -- '--attach' <<< "$help" || emit_refusal 'installed gh lacks pr comment --attach; install a supported GitHub CLI before retrying'
advertised=$(printf '%s\n' "$help" | tr '[:upper:]' '[:lower:]' | awk '
  /--attach/ {active=1}
  active {
    if ($0 !~ /--attach/ && $0 ~ /^[[:space:]]+--[a-z0-9-]+/) active=0
    if (!active) next
    line=$0
    while (match(line, /(maximum|max|up to)[^0-9]*[0-9]+/)) {
      v=substr(line,RSTART,RLENGTH); sub(/^[^0-9]*/, "", v)
      if (minimum == "" || v+0 < minimum+0) minimum=v
      line=substr(line,RSTART+RLENGTH)
    }
    if ($0 ~ /^[[:space:]]*$/) active=0
  }
  END {if (minimum != "") print minimum}')
if [[ -n "$advertised" && "$advertised" -lt 50 ]]; then emit_refusal "installed gh advertises a stricter attachment limit: $advertised"; fi
gh api meta >/dev/null 2>&1 || emit_refusal 'active GitHub host does not confirm attachment publication support'

stage=attachment-preflight
body_file=$(canonical_file "$body_file") || emit_refusal 'body file path cannot be resolved'
[[ -f "$body_file" && -r "$body_file" && -s "$body_file" ]] || emit_refusal 'body file must be readable and non-empty'
grep -q 'darrow-evidence-attachment-' "$body_file" && emit_refusal 'body file contains reserved attachment reference text'
grep -q 'github\.com/user-attachments/assets/' "$body_file" && emit_refusal 'body file contains an attachment URL that prevents deterministic reconciliation'
canonical_paths=(); snapshot_paths=(); attachment_hashes=(); attachment_ids=(); manifest=''; seen=''
snapshot_parent=${TMPDIR:-/tmp}; case "$snapshot_parent" in /) snapshot_template=/darrow-pr-evidence-files.XXXXXX ;; */) snapshot_template=${snapshot_parent}darrow-pr-evidence-files.XXXXXX ;; *) snapshot_template=$snapshot_parent/darrow-pr-evidence-files.XXXXXX ;; esac
snapshot_dir=$(mktemp -d "$snapshot_template") || emit_refusal 'cannot create attachment snapshot directory'
snapshot_dir=$(cd "$snapshot_dir" && pwd -P) || emit_refusal 'cannot resolve attachment snapshot directory'
case "$snapshot_dir" in "$top"/*) emit_refusal 'attachment snapshot location is inside the repository' ;; esac
i=0
while [[ "$i" -lt "$attachment_count" ]]; do
  p=$(canonical_file "${attachment_paths[$i]}") || emit_refusal "attachment path cannot be resolved: ${attachment_paths[$i]}"
  [[ -f "$p" && -r "$p" && -s "$p" ]] || emit_refusal "attachment must be a readable non-empty regular file: $p"
  case "$p" in "$top"/*) emit_refusal "evidence attachment must remain outside the repository: $p" ;; esac
  size=$(wc -c < "$p" | tr -d ' ')
  lower=$(printf '%s' "${p##*.}" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    png|jpg|jpeg|gif|webp|svg) actual=image; limit=10485760 ;;
    mp4|mov|webm) actual=video; limit=104857600 ;;
    *) emit_refusal "unsupported attachment type: $p" ;;
  esac
  [[ "$actual" == "${attachment_kinds[$i]}" ]] || emit_refusal "attachment kind does not match file type: $p"
  [[ "$size" -le "$limit" ]] || emit_refusal "attachment exceeds supported size: $p"
  media_matches_extension "$p" "$lower" "$size" || emit_refusal "attachment content does not match its supported type: $p"
  content=$(git hash-object "$p") || emit_refusal "cannot hash attachment: $p"
  case "$seen" in *"|$content|"*) emit_refusal "duplicate attachment content: $p" ;; esac
  seen="$seen|$content|"
  canonical_paths+=("$p")
  attachment_hashes+=("$content")
  presentation_hash=$(printf '%s' "${attachment_texts[$i]}" | git hash-object --stdin)
  aid="$((i+1)):$actual:$content:$size:$presentation_hash"
  attachment_ids+=("$aid")
  manifest="$manifest"$'\n'"attachment-$((i+1))=$aid"
  mkdir "$snapshot_dir/$((i+1))" || emit_refusal 'cannot create attachment snapshot slot'
  snap="$snapshot_dir/darrow-evidence-attachment-$((i+1)).$lower"
  cp "$p" "$snap" || emit_refusal "cannot snapshot attachment: $p"
  [[ "$(git hash-object "$snap")" == "$content" ]] || emit_refusal "attachment changed while snapshotting: $p"
  snapshot_paths+=("$snap")
  i=$((i + 1))
done

body_snapshot="$snapshot_dir/body"
cp "$body_file" "$body_snapshot" || emit_refusal 'cannot snapshot body file'
body_hash=$(git hash-object "$body_snapshot")
[[ "$body_hash" == "$(git hash-object "$body_file")" ]] || emit_refusal 'body file changed while snapshotting'
candidate="$repo#$pr_number@$expected"
identity_input="repository=$repo
pr=$pr_number
head=$expected
body=$body_hash
attachment-count=$attachment_count$manifest"
identity=$(printf '%s' "$identity_input" | git hash-object --stdin)
marker="<!-- darrow-pr-evidence:v1 candidate=$candidate identity=$identity -->"
candidate_marker="darrow-pr-evidence:v1 candidate=$candidate"
temp_parent=${TMPDIR:-/tmp}; case "$temp_parent" in /) template=/darrow-pr-evidence.XXXXXX ;; */) template=${temp_parent}darrow-pr-evidence.XXXXXX ;; *) template=$temp_parent/darrow-pr-evidence.XXXXXX ;; esac
prepared=$(mktemp "$template") || emit_refusal 'cannot create prepared body'
prepared=$(canonical_file "$prepared") || emit_refusal 'cannot resolve prepared body path'
case "$prepared" in "$top"/*) emit_refusal 'temporary body location is inside the repository' ;; esac
{
  printf '%s\n\n' "$marker"; cat "$body_snapshot"
  if [[ "$attachment_count" -gt 0 ]]; then
    printf '\n\n### Attached evidence\n'
    i=0
    while [[ "$i" -lt "$attachment_count" ]]; do
      if [[ "${attachment_kinds[$i]}" == image ]]; then
        printf -- '- Image %s alt text: %s\n' "$((i+1))" "${attachment_texts[$i]}"
        printf -- '![%s; content identity %s](%s)\n' "${attachment_texts[$i]}" "${attachment_hashes[$i]}" "${snapshot_paths[$i]##*/}"
      else
        printf -- '- Video %s explanation: %s; content identity %s\n' "$((i+1))" "${attachment_texts[$i]}" "${attachment_hashes[$i]}"
        printf -- '![](%s)\n' "${snapshot_paths[$i]##*/}"
      fi
      i=$((i + 1))
    done
  fi
  printf '\n<!-- darrow-pr-evidence-manifest\n%s\n-->' "$identity_input"
} > "$prepared"
prepared_escaped=$(awk '{gsub(/\\/, "\\\\"); gsub(/\r/, "\\r"); gsub(/\t/, "\\t"); if (NR>1) printf "\\n"; printf "%s",$0}' "$prepared")
expected_normalized=$(printf '%s\n' "$prepared_escaped" | awk '{s=$0; while (match(s,/darrow-evidence-attachment-[0-9]+\.(png|jpg|jpeg|gif|webp|svg|mp4|mov|webm)/)) {printf "%s__DARROW_ATTACHMENT_URL__",substr(s,1,RSTART-1); s=substr(s,RSTART+RLENGTH)} print s}')
prepared_hash=$(git hash-object "$prepared")
head_snapshot=$(git rev-parse HEAD); index_snapshot=$(git write-tree)

observe_comments() {
  gh api "repos/$repo/issues/$pr_number/comments" --paginate --jq '.[] | [.id,.html_url,.body] | @tsv'
}
classify() {
  local data=$1 line body matches=0 complete=0 related=0 url='' links link_count normalized unique_seen link duplicate
  observed_attachment_ids=''
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    body=${line#*$'\t'}; body=${body#*$'\t'}
    if [[ "$body" == *"$candidate_marker"* ]]; then
      related=$((related + 1)); url=$(printf '%s' "$line" | awk -F '\t' '{print $2}')
      if [[ "$body" == *"$marker"* ]]; then
        matches=$((matches + 1))
        links=$(awk '{s=$0; while (match(s,/https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9._?=&%\/-]+/)) {print substr(s,RSTART,RLENGTH); s=substr(s,RSTART+RLENGTH)}}' <<< "$body")
        link_count=$(awk 'NF {n++} END {print n+0}' <<< "$links")
        normalized=$(printf '%s\n' "$body" | awk '{s=$0; while (match(s,/https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9._?=&%\/-]+/)) {printf "%s__DARROW_ATTACHMENT_URL__",substr(s,1,RSTART-1); s=substr(s,RSTART+RLENGTH)} print s}')
        unique_seen='|'; duplicate=false
        while IFS= read -r link; do
          [[ -n "$link" ]] || continue
          case "$unique_seen" in *"|$link|"*) duplicate=true ;; *) unique_seen="$unique_seen$link|" ;; esac
        done <<< "$links"
        if [[ "$normalized" == "$expected_normalized" && "$link_count" -eq "$attachment_count" && "$duplicate" == false ]]; then
          complete=$((complete + 1)); observed_attachment_ids=$links
        fi
      fi
    fi
  done <<< "$data"
  if [[ "$complete" -eq 1 && "$matches" -eq 1 && "$related" -eq 1 ]]; then class=complete; comment_url=$url
  elif [[ "$related" -gt 1 || "$matches" -eq 0 && "$related" -eq 1 ]]; then class=ambiguous; comment_url=$url
  elif [[ "$matches" -eq 1 ]]; then class=partial; comment_url=$url
  else class=none; comment_url=''; fi
}

stage=reconciliation
comments=$(observe_comments 2>/dev/null) || emit_refusal 'cannot reconcile top-level PR comments'
classify "$comments"
emit_result() {
  local result=$1 effects=$2 uncertainty=$3 files_preserved=true
  i=0
  while [[ "$i" -lt "$attachment_count" ]]; do
    [[ -f "${canonical_paths[$i]}" ]] || files_preserved=false
    i=$((i + 1))
  done
  printf '%s\n' "outcome: $result" "stage: $stage" "repository: $repo" "pr-url: $pr_url" "expected-head: $expected" "observed-head: $observed_head" "identity: $identity" "comment-url: ${comment_url:-unknown}" "attachment-count: $attachment_count"
  i=0; while [[ "$i" -lt "$attachment_count" ]]; do printf 'attachment-%s: %s\n' "$((i+1))" "${attachment_ids[$i]}"; i=$((i+1)); done
  i=0; while IFS= read -r observed_id; do [[ -n "$observed_id" ]] && { i=$((i+1)); printf 'observed-attachment-%s: %s\n' "$i" "$observed_id"; }; done <<< "${observed_attachment_ids-}"
  printf '%s\n' "prepared-body: $prepared" "attachment-snapshot: $snapshot_dir" "effects: $effects" "uncertainty: $uncertainty" "head-preserved: $([[ "$(git rev-parse HEAD)" == "$head_snapshot" ]] && echo true || echo false)" "index-preserved: $([[ "$(git write-tree)" == "$index_snapshot" ]] && echo true || echo false)" "files-preserved: $files_preserved"
}
if [[ "$class" == complete ]]; then emit_result existing none none; exit 0
elif [[ "$class" == partial ]]; then emit_result partial none 'one incomplete candidate-bound comment exists'; exit 5
elif [[ "$class" == ambiguous ]]; then emit_result ambiguous none 'conflicting candidate-bound comments exist'; exit 5; fi

stage=publication
[[ "$(git rev-parse HEAD)" == "$expected" ]] || { observed_head=$(git rev-parse HEAD); emit_result refused none 'local head changed before publication'; exit 4; }
[[ "$(git hash-object "$prepared")" == "$prepared_hash" ]] || { emit_result refused none 'prepared body changed before publication'; exit 4; }
i=0
while [[ "$i" -lt "$attachment_count" ]]; do
  [[ "$(git hash-object "${snapshot_paths[$i]}" 2>/dev/null || true)" == "${attachment_hashes[$i]}" ]] || { emit_result refused none 'attachment snapshot changed before publication'; exit 4; }
  i=$((i + 1))
done
args=(pr comment "$pr_url" --body-file "$prepared")
i=0
while [[ "$i" -lt "$attachment_count" ]]; do
  attach_arg=${snapshot_paths[$i]##*/}
  if [[ "${attachment_kinds[$i]}" == image ]]; then attach_arg="$attach_arg#${attachment_texts[$i]}"; fi
  args+=(--attach "$attach_arg")
  i=$((i+1))
done
set +e
comment_stdout="$snapshot_dir/comment-command.stdout"
comment_stderr="$snapshot_dir/comment-command.stderr"
(cd "$snapshot_dir" && DARROW_EVIDENCE_REPOSITORY=$top gh "${args[@]}") >"$comment_stdout" 2>"$comment_stderr"
comment_rc=$?
set -e
stage=post-publication
rows=$(gh pr list --repo "$repo" --head "$branch" --state open --limit 2 --json number,url,headRefOid,isCrossRepository --jq '.[] | [.number,.url,.headRefOid,.isCrossRepository] | @tsv' 2>/dev/null || true)
post_count=$(awk 'NF {n++} END {print n+0}' <<< "$rows")
IFS=$'\t' read -r post_number post_url observed_head post_cross post_extra <<< "$rows"
comments=$(observe_comments 2>/dev/null || true); classify "$comments"
post_ref=$(git symbolic-ref -q HEAD || true)
post_local=$(git rev-parse HEAD 2>/dev/null || true)
if [[ "$post_count" -ne 1 || "$post_number" != "$pr_number" || "$post_url" != "$pr_url" || "$post_cross" != false || -n "${post_extra-}" || "$observed_head" != "$expected" || "$post_ref" != "refs/heads/$branch" || "$post_local" != "$expected" ]]; then emit_result partial 'one gh pr comment invocation attempted' 'candidate head or PR identity changed'; exit 5
elif [[ "$class" == complete ]]; then emit_result published 'one gh pr comment invocation completed' none; exit 0
elif [[ "$class" == partial ]]; then emit_result partial 'one gh pr comment invocation attempted' 'incomplete candidate-bound comment observed'; exit 5
else emit_result ambiguous 'one gh pr comment invocation attempted' "publication result unclassifiable (command exit $comment_rc)"; exit 5; fi
