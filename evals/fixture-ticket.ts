/** Darrow's local ticket capability, shared while the legacy eval runner remains. */
export const TICKETCTL = `#!/bin/bash
set -euo pipefail
git_dir=$(git rev-parse --git-dir)
case "$git_dir" in /*) ;; *) git_dir="$PWD/$git_dir" ;; esac
ticket_id=$(<"$git_dir/fixture-ticket-id")
ticket_title=$(<"$git_dir/fixture-ticket-title")
ticket_body="$git_dir/fixture-ticket.md"
log="$git_dir/fixture-state/ticketctl.log"

usage() {
  echo "usage: ticketctl get <id> --body-file <path> | describe <id> --body-file <path>" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
command=$1
shift
if [[ "$command" == "help" || "$command" == "--help" ]]; then
  echo "get <id> --body-file <path>"
  echo "describe <id> --body-file <path>"
  exit 0
fi
[[ $# -eq 3 && "$2" == "--body-file" ]] || usage
[[ "$1" == "$ticket_id" ]] || { echo "error: ticket not found: $1" >&2; exit 1; }
body_file=$3

case "$command" in
  get)
    cp "$ticket_body" "$body_file"
    printf 'id: %s\nstate: open\ntitle: %s\n' "$ticket_id" "$ticket_title"
    printf 'get %s\n' "$ticket_id" >>"$log"
    ;;
  describe)
    [[ -f "$body_file" ]] || { echo "error: unreadable body file" >&2; exit 1; }
    cp "$body_file" "$ticket_body"
    printf 'describe %s\n' "$ticket_id" >>"$log"
    printf 'updated: %s\n' "$ticket_id"
    ;;
  *) usage ;;
esac
`;
