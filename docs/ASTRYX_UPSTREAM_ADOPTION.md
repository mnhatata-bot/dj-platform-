# Meta Astryx: source-first upstream adoption

**Status: prepared on an isolated integration branch, NOT installed, tested, merged, deployed or certified.**
Cross-project tracker: https://github.com/mnhatata-bot/soundcode/issues/600

## Upstream, not an invented design system
- Original source: https://github.com/meta/astryx
- Source commit inspected (2026-11-10): `591efd2250734cfe69e21aee6e1bd8aec371afd7`.
- MIT-licensed original; retain notices: https://github.com/meta/astryx/blob/main/LICENSE
- Official documentation: https://astryx.atmeta.com
- Official usage: https://github.com/meta/astryx/blob/main/packages/core/README.md
- Current upstream source packages inspected: core 0.7.12, CLI 0.7.12.
- Use direct upstream published packages, exact-version npm lockfile and the official CLI. Do not clone components into a proprietary fork; optional official `swizzle` only when justified.

## This project's adoption route
`dj-platform-`: Cuelance web DJ marketplace (NOT the standalone SoundCode DJ native performance app). Candidates are dashboards, EPK forms, tables, filters and mobile/Arabic navigation. Preserve existing role switcher, audience interactions and EN/AR localisation.

## Opt-in installation
Run from the repository root of this isolated integration branch:

```bash
bash scripts/install-astryx-upstream.sh
```

This invokes **Meta's actual packages and its actual CLI**. It regenerates `package-lock.json` via npm, so check in that lockfile together with dependency changes. It does not itself apply CSS, replace components, deploy or certify the app. Keep the existing AGENTS.md and review the CLI's edits after `init`.

Official Next.js integration: import `@astryxdesign/core/reset.css`, `@astryxdesign/core/astryx.css`, and `@astryxdesign/theme-neutral/theme.css` in this exact order (only after a cascade/isolation review); add the official `Theme` and `LinkProvider` pattern from the upstream README. Keep existing providers mounted, preserve EN/AR dir, and do not insert the reset globally until verified not to damage pre-existing UI.

## Acceptance gates
1. Inventory every existing screen/control and capture baseline screenshots.
2. Install genuine upstream packages/CLI; record exact release, license, and npm lockfile.
3. Pick a single low-risk UI surface and integrate official components into the existing application, not a separate copy of the app.
4. Verify keyboard, interactions, EN/AR/RTL, mobile/tablet, AA accessibility, visual screenshot diffs, responsive widths and security.
5. Run existing unit, typecheck, production build and E2E tests; document resulting evidence and failures.
6. Only after all app migrations are coherent, invoke the consolidated final PMO GitHub Actions checkpoint and release/UAT gates.

**Non-goals:** creating a new design-system implementation; replacing core DSP or production workflows; merging into main before certification; starting intermediate CI on an auto-triggering pull request.
