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
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
command -v claude >/dev/null || { echo "eval: needs the claude CLI" >&2; exit 1; }
exec claude plugin eval . --trust-plugin --scaffold --allow-tools Write Edit Bash --no-publish "$@"
