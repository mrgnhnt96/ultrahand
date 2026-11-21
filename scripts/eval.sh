#!/usr/bin/env bash
# Run the ultrahand eval suite (evals/, see evals/README.md) with the flags it needs.
#
#   scripts/eval.sh                       every case, with and without the plugin
#   scripts/eval.sh --tag smoke           the quick routing and lessons cases
#   scripts/eval.sh --case theme-extract --runs 1 --ablation none
#
# Extra arguments go to `claude plugin eval`. The cases' scaffold scripts are ours, so
# they're trusted; Write, Edit and Bash are granted because the theme and lessons cases
# write files and run the theme scripts. Results go to evals/results/ (git-ignored).
#
# `claude plugin eval` refuses a plugin folder holding a hard-linked file, and cargo fills
# every target/ folder (cli/target, a worktree slot's target/) with them. So the suite
# runs on a copy of the files git would see (tracked and untracked, minus the ignored
# ones) as they are on disk now, uncommitted edits included.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
command -v claude >/dev/null || { echo "eval: needs the claude CLI" >&2; exit 1; }

copy="$(mktemp -d)"
trap 'rm -rf "$copy"' EXIT
plugin="$copy/ultrahand"
mkdir "$plugin"
# A plain cp per file, so nothing in the copy shares an inode with anything else.
git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' file; do
  [ -e "$file" ] || [ -L "$file" ] || continue # deleted but not yet staged
  mkdir -p "$plugin/$(dirname "$file")"
  cp -P "$file" "$plugin/$file"
done

# Results would land in the copy, which goes when this exits: keep them in evals/results/.
output=(--output-dir "$root/evals/results/$(date -u +%Y-%m-%dT%H-%M-%SZ)")
for arg in "$@"; do
  case "$arg" in --output-dir | --output-dir=*) output=() ;; esac
done

claude plugin eval "$plugin" --trust-plugin --scaffold --allow-tools Write Edit Bash --no-publish \
  ${output[@]+"${output[@]}"} "$@"
