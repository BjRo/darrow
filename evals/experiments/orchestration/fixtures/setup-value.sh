#!/usr/bin/env bash
set -euo pipefail
fixtures=$1
mkdir -p .fixture-state .git/fixture-bin
printf '/.fixture-state/\n' >>.git/info/exclude
cp "$fixtures/value-forge.ts" .git/fixture-bin/value-forge.ts
cp "$fixtures/task.json" .git/fixture-bin/task.json
printf '{"pr":null}\n' >.fixture-state/forge.json
: >.fixture-state/ci.jsonl
git switch -C main
git rev-parse HEAD >.git/shallow
base=$(git branch --show-current)
git init -q --bare .fixture-state/remote.git
git --git-dir=.fixture-state/remote.git config receive.shallowUpdate true
git --git-dir=.fixture-state/remote.git symbolic-ref HEAD "refs/heads/$base"
cat >.git/fixture-bin/ssh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
for argument in "$@"; do
  case "$argument" in
    *git-upload-pack*) exec git-upload-pack "$repo/.fixture-state/remote.git" ;;
    *git-receive-pack*) exec git-receive-pack "$repo/.fixture-state/remote.git" ;;
  esac
done
exit 64
SH
chmod +x .git/fixture-bin/ssh
git config core.sshCommand "$PWD/.git/fixture-bin/ssh"
git remote add origin ssh://git@fixture.invalid/benchmark/repo.git
git push -qu origin "$base"
git remote set-head origin "$base"
for command in gh fixture-ci; do
  case "$command" in gh) operation=gh ;; fixture-ci) operation=ci ;; esac
  # Defer expansion to the generated wrapper.
  # shellcheck disable=SC2016
  printf '#!/usr/bin/env bash\nset -eu\nrepo=$(git rev-parse --show-toplevel)\nexec bun "$repo/.git/fixture-bin/value-forge.ts" %s "$@"\n' "$operation" >".git/fixture-bin/$command"
  chmod +x ".git/fixture-bin/$command"
done
