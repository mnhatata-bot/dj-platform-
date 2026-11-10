#!/usr/bin/env bash
# Install Meta's published Astryx packages; this does not replace or fork Astryx.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f package.json || ! -f package-lock.json ]]; then
  echo 'Expected an npm React project with package.json and package-lock.json.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Working tree must be clean to isolate Astryx package/CLI changes.' >&2
  exit 1
fi
node - <<'NODE'
const p=require('./package.json');
const v=p.dependencies?.react || p.devDependencies?.react || '';
if (!/^\^?19(?:\.|$)/.test(v)) {
  console.error(`Refusing to install: React 19 is required; package.json declares ${v || 'none'}.`);
  process.exit(1);
}
NODE

# Official Meta packages; lockfile records the resolved StyleX version.
npm install --save-exact @astryxdesign/core@0.7.12 @astryxdesign/theme-neutral@0.7.12 @stylexjs/stylex
npm install --save-dev --save-exact @astryxdesign/cli@0.7.12

# Official CLI adds its agent-facing component index; review its file diff.
npx --no-install @astryxdesign/cli init
npx --no-install @astryxdesign/cli component --list

printf '\nAstryx upstream dependencies installed locally.\n'
printf 'Next: review git diff, add scoped CSS imports and Theme provider per upstream README,\n'
printf 'then run project tests/build and visual/RTL/accessibility regression checks.\n'
git status --short
