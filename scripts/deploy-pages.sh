#!/bin/zsh
# Publish the built site by syncing site/ into docs/ and pushing main.
# GitHub Pages serves main:/docs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build
npm run check
git checkout -- data/meta.json 2>/dev/null || true

rm -rf docs/assets
cp -R site/. docs/
touch docs/.nojekyll
git add docs
if ! git diff --cached --quiet; then
  git commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
fi
git push origin main
echo "deployed: https://ryankiinovo.github.io/weread-brief/"
