#!/bin/bash
# Deploys HEAD to production (rankbid.click) and the sandbox (rankbid-sandbox-mindwhiz.vercel.app).
# Both builds run on this machine and are uploaded with --prebuilt, so Vercel bills no build CPU minutes.
#   scripts/deploy.sh            both
#   scripts/deploy.sh prod       production only
#   scripts/deploy.sh sandbox    sandbox only
set -euo pipefail

TARGET="${1:-both}"
export VERCEL_ORG_ID=team_CJ4qdrlVVbEYaJxKw5jhyYo0
export VERCEL_PROJECT_ID=prj_7z3V6CtwaxTZFakxgDiremQWR4uT
SANDBOX_ALIAS=rankbid-sandbox-mindwhiz.vercel.app
TOKEN="$(cat ~/.vercel-mindwhiz-token)"
unset VERCEL_TOKEN # the shell's token belongs to the old account

REPO="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Build exactly what is committed, not the working tree.
git -C "$REPO" archive HEAD | tar -x -C "$WORK"
cd "$WORK"
# The archive has no node_modules: clone the repo's (APFS copy-on-write, instant). Turbopack rejects a symlink.
cp -cR "$REPO/node_modules" node_modules

# Prints only the deployment URL on stdout; build logs go to stderr.
build_and_deploy() { # $1 = production | preview
  local prod=()
  [ "$1" = production ] && prod=(--prod)
  vercel pull --yes --environment="$1" --token "$TOKEN" >&2
  vercel build "${prod[@]}" --yes --token "$TOKEN" >&2
  vercel deploy --prebuilt "${prod[@]}" --yes --token "$TOKEN" 2>/dev/null | tail -1
}

if [ "$TARGET" != sandbox ]; then
  echo "▸ production"
  build_and_deploy production
fi

if [ "$TARGET" != prod ]; then
  echo "▸ sandbox"
  URL="$(build_and_deploy preview)"
  echo "$URL"
  # `vercel alias set` fails with this project-scoped token, so the alias goes through the API.
  ID="$(curl -sf -H "Authorization: Bearer $TOKEN" "https://api.vercel.com/v13/deployments/${URL#https://}?teamId=$VERCEL_ORG_ID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')"
  curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"alias\":\"$SANDBOX_ALIAS\"}" "https://api.vercel.com/v2/deployments/$ID/aliases?teamId=$VERCEL_ORG_ID" >/dev/null
  echo "aliased https://$SANDBOX_ALIAS"
fi
