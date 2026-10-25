#!/usr/bin/env bash
# Builds and uploads the current manifest version to the stores.
#   ./scripts/publish.sh firefox   addons.mozilla.org (listed), via web-ext sign
#   ./scripts/publish.sh chrome    Chrome Web Store, uploads and submits for review
#   ./scripts/publish.sh all       both
# Credentials come from .env (see .env.example). Bump "version" in manifest.json first:
# both stores reject a version that was already uploaded.
set -euo pipefail
cd "$(dirname "$0")/.."

target=${1:-}
case "$target" in
  firefox | chrome | all) ;;
  *)
    echo "usage: $0 firefox|chrome|all" >&2
    exit 1
    ;;
esac

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

require() {
  local missing=()
  for name in "$@"; do [[ -n "${!name:-}" ]] || missing+=("$name"); done
  if ((${#missing[@]})); then
    echo "Missing in .env: ${missing[*]}" >&2
    exit 1
  fi
}

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
echo "Publishing v$version ($target)"

./scripts/build.sh
npx -y web-ext@8 lint --source-dir dist/firefox

publish_firefox() {
  require AMO_JWT_ISSUER AMO_JWT_SECRET
  npx -y web-ext@8 sign \
    --source-dir dist/firefox \
    --artifacts-dir web-ext-artifacts \
    --channel listed \
    --api-key "$AMO_JWT_ISSUER" \
    --api-secret "$AMO_JWT_SECRET"
}

publish_chrome() {
  require CWS_EXTENSION_ID CWS_CLIENT_ID CWS_CLIENT_SECRET CWS_REFRESH_TOKEN
  # No sub-command = upload, then submit for review/publish.
  npx -y chrome-webstore-upload-cli@3 \
    --source "dist/mark-as-watched-chrome-$version.zip" \
    --extension-id "$CWS_EXTENSION_ID" \
    --client-id "$CWS_CLIENT_ID" \
    --client-secret "$CWS_CLIENT_SECRET" \
    --refresh-token "$CWS_REFRESH_TOKEN"
}

[[ "$target" == firefox || "$target" == all ]] && publish_firefox
[[ "$target" == chrome || "$target" == all ]] && publish_chrome
echo "Done: v$version"
