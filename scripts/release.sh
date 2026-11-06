#!/usr/bin/env bash
# Cut an ultrahand release. The task board runs this as `tb release cut <version>`,
# from a checkout of main; don't run it by hand there.
#
#   scripts/release.sh 0.2.0      (a leading "v" is fine: v0.2.0)
#
# 1. Checks the checkout: on main, clean, level with origin/main, the tag unused and
#    the version newer than the current one.
# 2. Runs the smoke evals (scripts/eval.sh --tag smoke): skill routing and the lessons
#    loop. Each case must pass 2 of its 3 runs, or the release stops before anything is
#    changed. SKIP_EVALS=1 skips them (say why in the release notes).
# 3. Runs the release-binaries workflow on this commit and waits: cargo test and a build
#    for each target, into a draft release with a checksums.txt. A failure stops the
#    release before anything is changed. A leftover draft is replaced by the next try.
# 4. Sets the version in .claude-plugin/plugin.json and writes the draft's checksums to
#    shared/review/checksums.txt, commits both as "chore(release): v<version>", tags
#    v<version> and pushes both in one atomic push.
# 5. Publishes the draft. On a failure the tag is out and the draft isn't: it reports the
#    command that finishes the release, leaves the installed plugin alone and exits 1.
# 6. Updates the installed plugin on this machine, when the `claude` CLI is here:
#    refreshes the marketplace, updates the plugin (reinstalling if the update doesn't
#    take) and checks the installed version. It comes after the publish so an installed
#    plugin never points at a missing asset. GitHub is fetched over HTTPS for these
#    commands only, so it works without an SSH key. A failure here doesn't undo the
#    release, which is already out; it's reported, and the exit code stays 0.
#
# Environment: RELEASE_REMOTE (default origin), RELEASE_REPO (default mrgnhnt96/ultrahand),
# ULTRAHAND_MARKETPLACE (default mrgnhnt96), SKIP_LOCAL_PLUGIN=1 to leave the installed
# plugin alone, SKIP_EVALS=1 to skip the smoke evals.
set -euo pipefail

remote="${RELEASE_REMOTE:-origin}"
marketplace="${ULTRAHAND_MARKETPLACE:-mrgnhnt96}"
plugin="ultrahand@${marketplace}"
manifest=".claude-plugin/plugin.json"
checksums="shared/review/checksums.txt"
workflow="release-binaries.yml"
target_count=4
export GH_REPO="${RELEASE_REPO:-mrgnhnt96/ultrahand}"

die() { echo "release: $*" >&2; exit 1; }
say() { echo "release: $*"; }

[ $# -eq 1 ] || die "usage: scripts/release.sh <version>, e.g. 0.2.0"
version="${1#v}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] ||
  die "\"$1\" isn't a version like 0.2.0 or 0.2.0-beta.1"
tag="v$version"

cd "$(git rev-parse --show-toplevel)"
command -v node >/dev/null || die "needs node to edit $manifest"
command -v gh >/dev/null || die "needs the gh CLI to build and publish the binaries"
gh auth status >/dev/null 2>&1 || die "gh isn't signed in: run gh auth login"

# 1. Check the checkout.
branch="$(git symbolic-ref --quiet --short HEAD || true)"
[ "$branch" = main ] || die "run it from main (on: ${branch:-a detached HEAD})"
# Untracked files (such as worktrees under .claude/) can't reach the release commit, which
# stages only the manifest and the checksums, so only tracked changes block a release.
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "the checkout has uncommitted changes"
git fetch --quiet --tags "$remote" main
git merge --quiet --ff-only "$remote/main" || die "main has commits that aren't on $remote/main"
git rev-parse --quiet --verify "refs/tags/$tag" >/dev/null && die "tag $tag already exists"

current="$(node -p "require('./$manifest').version")"
node -e '
  const parse = (v) => { const [core, pre] = v.split("-"); return [...core.split(".").map(Number), pre]; };
  const [a, b] = [parse(process.argv[1]), parse(process.argv[2])];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) process.exit(a[i] > b[i] ? 0 : 1);
  process.exit(a[3] === b[3] ? 1 : !a[3] ? 0 : !b[3] ? 1 : a[3] > b[3] ? 0 : 1);
' "$version" "$current" || die "$version isn't newer than the current $current"

# 2. Smoke evals.
if [ "${SKIP_EVALS:-}" = 1 ]; then
  say "SKIP_EVALS=1: skipped the smoke evals"
elif ! command -v claude >/dev/null; then
  die "needs the claude CLI for the smoke evals (or SKIP_EVALS=1)"
else
  say "running the smoke evals (a few minutes)"
  scripts/eval.sh --tag smoke --ablation none --threshold 0.66 -j 4 --max-cost-usd 6 ||
    die "smoke evals failed: see evals/results/ (nothing was changed)"
fi

# 3. Build the binaries into a draft release.
head="$(git rev-parse HEAD)"
request="$tag-$(date +%s)-$$"
say "building the binaries on $head (several minutes)"
gh workflow run "$workflow" --ref main -f tag="$tag" -f sha="$head" -f request="$request" >/dev/null ||
  die "couldn't start the $workflow workflow (nothing was changed)"
run=""
for _ in $(seq 1 30); do
  run="$(gh run list --workflow "$workflow" --event workflow_dispatch --limit 20 \
    --json databaseId,displayTitle \
    --jq "map(select(.displayTitle | contains(\"$request\"))) | .[0].databaseId // empty" || true)"
  [ -n "$run" ] && break
  sleep 2
done
[ -n "$run" ] || die "the $workflow run for $request never appeared (nothing was changed)"
gh run watch "$run" --exit-status --interval 15 >/dev/null ||
  die "the binary build failed: gh run view $run --log-failed (nothing was changed)"

drafted="$(mktemp -d)"
trap 'rm -rf "$drafted"' EXIT
gh release download "$tag" --pattern checksums.txt --dir "$drafted" ||
  die "couldn't read checksums.txt from the $tag draft (nothing was changed)"
[ "$(grep -cE '^[0-9a-f]{64}  ultrahand-[a-z0-9_-]+$' "$drafted/checksums.txt")" = "$target_count" ] &&
  [ "$(wc -l <"$drafted/checksums.txt")" -eq "$target_count" ] ||
  die "the $tag draft's checksums.txt doesn't list $target_count binaries (nothing was changed)"

# 4. Bump, commit, tag, push.
node -e '
  const fs = require("fs");
  const [file, version] = process.argv.slice(1);
  const text = fs.readFileSync(file, "utf8");
  const next = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (next === text) { console.error(`release: no "version" field in ${file}`); process.exit(1); }
  fs.writeFileSync(file, next);
' "$manifest" "$version"
cp "$drafted/checksums.txt" "$checksums"
git add "$manifest" "$checksums"
git commit --quiet -m "chore(release): $tag"
git tag -a "$tag" -m "ultrahand $tag"
git push --quiet --atomic "$remote" main "$tag"
say "pushed $tag ($current -> $version)"

# 5. Publish the draft.
publish=(gh release edit "$tag" --repo "$GH_REPO" --draft=false --verify-tag)
case "$version" in
  *-*) publish+=(--prerelease --latest=false) ;;
  *) publish+=(--latest) ;;
esac
if ! "${publish[@]}" >/dev/null; then
  echo "release: ERROR: $tag is pushed but its draft isn't published, so plugins on it can't download their binary" >&2
  echo "release: finish it with: ${publish[*]}" >&2
  echo "release: then update the plugin here with: claude plugin update $plugin" >&2
  exit 1
fi
say "published the $tag binaries"

# 6. Update the installed plugin on this machine.
if [ "${SKIP_LOCAL_PLUGIN:-}" = 1 ]; then
  say "SKIP_LOCAL_PLUGIN=1: left the installed plugin alone"
  exit 0
fi
if ! command -v claude >/dev/null; then
  say "no claude CLI here: update the plugin with 'claude plugin update $plugin'"
  exit 0
fi
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf' GIT_CONFIG_VALUE_0='git@github.com:'

installed() { claude plugin list 2>/dev/null | awk -v p="$plugin" '$0 ~ p { f = 1 } f && /Version:/ { print $2; exit }'; }

if ! installed >/dev/null || [ -z "$(installed)" ]; then
  say "$plugin isn't installed here: nothing to update"
  exit 0
fi
claude plugin marketplace update "$marketplace" >/dev/null 2>&1 || say "WARNING: couldn't refresh the $marketplace marketplace"
claude plugin update "$plugin" >/dev/null 2>&1 || true
if [ "$(installed)" != "$version" ]; then
  scope="$(claude plugin list 2>/dev/null | awk -v p="$plugin" '$0 ~ p { f = 1 } f && /Scope:/ { print $2; exit }')"
  scope="${scope:-user}"
  claude plugin uninstall "$plugin" --scope "$scope" >/dev/null 2>&1 &&
    claude plugin install "$plugin" --scope "$scope" >/dev/null 2>&1 || true
fi
now="$(installed || true)"
if [ "$now" = "$version" ]; then
  say "installed $plugin is now $version; restart running sessions (or /reload) to load it"
else
  say "WARNING: installed $plugin is ${now:-missing}, not $version. Update it with: claude plugin update $plugin"
fi
