#!/usr/bin/env bash
# Sourced by pr.sh for the explicit publication and read-only verification paths.
publication_command=$1
shift
publication_fail() {
  if [[ "$publication_push" == completed ]]; then
    echo 'note: push completed; publication verification is incomplete' >&2
  fi
  if [[ "${publication_create:-none}" == completed ]]; then
    echo 'note: PR creation completed; do not create another PR' >&2
  elif [[ "${publication_create:-none}" == uncertain ]]; then
    echo 'note: PR creation command had an uncertain effect; do not create another PR without fresh observation' >&2
  fi
  printf '%s\n' "push: ${publication_push:-none}" \
    "pr-create: ${publication_create:-none}" \
    "initial-url: ${publication_initial_url:-unknown}" \
    "observed-url: ${publication_url:-unknown}" >&2
  echo "error: $*" >&2
  exit 4
}

publication_observe() {
  local rows count state cross extra remote_line remote_ref
  rows=$(gh pr list --repo "$publication_origin" --head "$publication_branch" \
    --state open --limit 2 \
    --json number,url,state,headRefName,headRefOid,baseRefName,isDraft,isCrossRepository \
    --jq '.[] | [.number,.url,.state,.headRefName,.headRefOid,.baseRefName,.isDraft,.isCrossRepository] | @tsv') ||
    publication_fail 'cannot observe the open PR'
  count=$(awk 'NF {n++} END {print n+0}' <<< "$rows")
  [[ "$count" == 1 ]] || publication_fail 'exactly one open PR is required'
  IFS=$'\t' read -r publication_number publication_url state publication_head publication_pr_commit publication_pr_base publication_pr_draft cross extra <<< "$rows"
  [[ "$publication_number" =~ ^[0-9]+$ && "$publication_url" == https://* && -z "$extra" ]] ||
    publication_fail 'malformed PR identity evidence'
  [[ "$state" == OPEN && "$cross" == false && "$publication_head" == "$publication_branch" ]] ||
    publication_fail 'PR is not open on the expected same-repository branch'
  [[ "$publication_pr_base" == "$publication_base" && "$publication_pr_draft" == "$publication_draft" ]] ||
    publication_fail 'PR base or draft state does not match the requested shape'
  remote_line=$(git ls-remote --exit-code origin "refs/heads/$publication_branch") ||
    publication_fail 'cannot observe the remote branch'
  IFS=$'\t' read -r publication_remote_commit remote_ref extra <<< "$remote_line"
  [[ "$remote_line" != *$'\n'* && "$remote_ref" == "refs/heads/$publication_branch" && -z "$extra" ]] ||
    publication_fail 'ambiguous remote branch evidence'
  [[ "$publication_remote_commit" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]] ||
    publication_fail 'malformed remote commit evidence'
  [[ "$publication_pr_commit" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]] ||
    publication_fail 'malformed forge commit evidence'
}

publication_observe_converged() {
  local attempt=1
  publication_observe
  local pinned_url=$publication_url pinned_number=$publication_number
  while [[ "$publication_pr_commit" != "$publication_remote_commit" ]]; do
    [[ "$publication_remote_commit" == "$publication_expected" ]] ||
      publication_fail 'forge and remote branch commits do not agree'
    [[ "$attempt" -lt 5 ]] || publication_fail 'forge and remote branch commits do not agree after bounded propagation observation'
    sleep 1
    [[ "$(git rev-parse HEAD)" == "$publication_expected" && "$(git symbolic-ref -q HEAD)" == "refs/heads/$publication_branch" ]] ||
      publication_fail 'local publication target changed'
    publication_observe
    [[ "$publication_url" == "$pinned_url" && "$publication_number" == "$pinned_number" ]] ||
      publication_fail 'PR identity changed during publication'
    [[ "$publication_remote_commit" == "$publication_expected" ]] ||
      publication_fail 'remote branch moved during publication observation'
    attempt=$((attempt + 1))
  done
}

publication_push=${publication_initial_push:-none}
publication_create=${publication_initial_create:-none}
publication_expected=''
publication_base=''
publication_draft=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-head|--base)
      [[ $# -ge 2 && -n "$2" ]] || publication_fail "$1 needs a value"
      if [[ "$1" == --expected-head ]]; then publication_expected=$2; else publication_base=$2; fi
      shift 2
      ;;
    --draft) publication_draft=true; shift ;;
    *) publication_fail "unknown argument: $1" ;;
  esac
done
[[ "$publication_expected" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]] ||
  publication_fail '--expected-head requires the intended full commit ID'
if in_progress; then publication_fail 'Git operation in progress'; fi
publication_ref=$(git symbolic-ref -q HEAD) || publication_fail 'a feature branch is required'
publication_branch=${publication_ref#refs/heads/}
[[ "$(git rev-parse HEAD)" == "$publication_expected" ]] || publication_fail 'local HEAD differs from the intended commit'
publication_origin=$(git remote get-url origin) || publication_fail 'origin is required'
# An explicit refspec cannot constrain multiple push URLs. Refuse a different
# push endpoint rather than claiming forge evidence for some other repository.
[[ "$(git remote get-url --all origin)" == "$publication_origin" &&
   "$(git remote get-url --push --all origin)" == "$publication_origin" ]] ||
  publication_fail 'origin must have one identical fetch and push endpoint'
publication_remote_head=$(git ls-remote --symref origin HEAD) || publication_fail 'repository default branch is unverified'
publication_default_ref=$(awk '$1 == "ref:" && $3 == "HEAD" {print $2}' <<< "$publication_remote_head")
[[ "$publication_default_ref" == refs/heads/* && "$publication_default_ref" != *$'\n'* ]] ||
  publication_fail 'repository default branch is unverified'
publication_default=${publication_default_ref#refs/heads/}
[[ "$publication_branch" != "$publication_default" ]] || publication_fail 'the default branch cannot be published as a PR'
[[ -n "$publication_base" ]] || publication_base=$publication_default
[[ "$publication_base" != "$publication_branch" ]] || publication_fail 'base equals the current branch'
command -v gh >/dev/null || publication_fail 'gh is required'
publication_repository=$(gh repo view "$publication_origin" --json nameWithOwner --jq '.nameWithOwner') ||
  publication_fail 'cannot identify the origin repository'
[[ "$publication_repository" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]] || publication_fail 'malformed origin repository identity'
publication_observe_converged
if [[ "$publication_create" == completed && -n "${publication_initial_url:-}" && "$publication_url" != "$publication_initial_url" ]]; then
  publication_fail 'created PR URL differs from the observed canonical PR'
fi
publication_original_url=$publication_url
publication_original_number=$publication_number

if [[ "$publication_command" == publish-existing && "$publication_remote_commit" != "$publication_expected" ]]; then
  # Recheck the local target, then push a pinned commit rather than a moving ref.
  [[ "$(git rev-parse HEAD)" == "$publication_expected" && "$(git symbolic-ref -q HEAD)" == "refs/heads/$publication_branch" ]] ||
    publication_fail 'local publication target changed'
  if ! git -c push.followTags=false -c remote.origin.mirror=false push origin \
    "$publication_expected:refs/heads/$publication_branch"; then
    publication_fail 'non-force push failed; observe the remote before retrying'
  fi
  publication_push=completed
  publication_observe_converged
  [[ "$publication_url" == "$publication_original_url" && "$publication_number" == "$publication_original_number" ]] ||
    publication_fail 'PR identity changed during publication'
fi

[[ "$publication_remote_commit" == "$publication_expected" && "$publication_pr_commit" == "$publication_expected" ]] ||
  publication_fail 'the intended commit is not the published PR head'
[[ "$(git rev-parse HEAD)" == "$publication_expected" && "$(git symbolic-ref -q HEAD)" == "refs/heads/$publication_branch" ]] ||
  publication_fail 'local publication target changed'
if [[ "$publication_create" == uncertain ]]; then publication_create=observed-after-uncertain-command; fi
printf '%s\n' 'publication: verified' "url: $publication_url" \
  "repository: $publication_repository" "head: $publication_branch" \
  "base: $publication_base" "draft: $publication_draft" \
  "intended-commit: $publication_expected" "remote-commit: $publication_remote_commit" \
  "pr-commit: $publication_pr_commit" "push: $publication_push" \
  "pr-create: $publication_create"
echo '## working tree (excluded from publication)'
git status --porcelain --untracked-files=all
