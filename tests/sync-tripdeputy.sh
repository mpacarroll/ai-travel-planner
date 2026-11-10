#!/usr/bin/env bash
# Refresh the pinned copy of TripDeputy's trip model from a local checkout.
# Usage: bash tests/sync-tripdeputy.sh ../trip-deputy
set -euo pipefail
src="${1:?path to a trip-deputy checkout}"
here="$(cd "$(dirname "$0")" && pwd)"
for f in trip share saved costs; do cp "$src/src/lib/$f.js" "$here/tripdeputy/$f.js"; done
sha="$(git -C "$src" rev-parse --short HEAD)"
sed -i.bak "s/at commit \`[0-9a-f]*\`/at commit \`$sha\`/" "$here/tripdeputy/README.md" && rm -f "$here/tripdeputy/README.md.bak"
echo "Pinned TripDeputy $sha. Run: node --test tests/"
