#!/bin/zsh
# Publish site/ to the gh-pages branch. GitHub Pages serves that branch directly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build
npm run check

REMOTE="$(git remote get-url origin)"
NAME="$(git config user.name || true)"
EMAIL="$(git config user.email || true)"
NAME="${NAME:-Ryankiin}"
EMAIL="${EMAIL:-Ryankiin@users.noreply.github.com}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
git init -q -b gh-pages
git remote add origin "$REMOTE"
cp -R "$ROOT/site/." .
touch .nojekyll
git add -A
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
git push -f origin gh-pages
echo "deployed: https://ryankiinovo.github.io/weread-brief/"
