#!/bin/zsh
# Publish site/ to the gh-pages branch. GitHub Pages serves that branch directly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build
npm run check

WT="$(mktemp -d)"
git worktree add --detach "$WT" >/dev/null
cd "$WT"
git checkout --orphan gh-pages >/dev/null 2>&1 || git checkout gh-pages
git rm -rf . >/dev/null 2>&1 || true
cp -R "$ROOT/site/." .
touch .nojekyll
git add -A
git commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
git push -f origin gh-pages
cd "$ROOT"
git worktree remove --force "$WT"
echo "deployed: https://ryankiinovo.github.io/weread-brief/"
