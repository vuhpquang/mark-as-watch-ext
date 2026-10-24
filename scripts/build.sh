#!/usr/bin/env bash
# Packages the extension into dist/:
#   dist/mark-as-watched-firefox-<v>.zip  Firefox package
#   dist/chrome/                          unpacked Chrome extension ("Load unpacked")
#   dist/mark-as-watched-chrome-<v>.zip   Chrome Web Store package
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
rm -rf dist && mkdir -p dist/chrome

files=(manifest.json src icons)
zip -qr "dist/mark-as-watched-firefox-$version.zip" "${files[@]}"

# Chrome warns about Firefox-only keys, so drop them from its copy.
cp -R src icons dist/chrome/
node -e '
  const m = JSON.parse(require("fs").readFileSync("manifest.json", "utf8"));
  delete m.browser_specific_settings;
  m.minimum_chrome_version = "111"; // content_scripts "world": "MAIN"
  require("fs").writeFileSync("dist/chrome/manifest.json", JSON.stringify(m, null, 2) + "\n");
'
(cd dist/chrome && zip -qr "../mark-as-watched-chrome-$version.zip" .)

echo "Built dist/ (v$version):"
ls -1 dist
