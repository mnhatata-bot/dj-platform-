# PMO DE Premium Motion — Cuelance guest discovery

- **Source:** GSAP, Lenis, upstream React Bits SplitText (not an invented clone).
- **Upstream React Bits revision:** `DavidHDev/react-bits@4e0d091d3b1ea8b7aadef33716a8d99d164ae4ce`, `public/r/SplitText-TS-TW.json`; source blob `c9db7f5f02c21b98773a89baa6de00724bac6d5a`.
- **Reproducible packages:** `gsap@3.13.0`, `@gsap/react@2.1.2`, `lenis@1.3.13`. Pin candidates originate from the upstream React Bits npm-generated package-lock rather than unverified invented versions; do not silently bump.
- **License gate:** GSAP Standard no-charge (https://gsap.com/standard-license), Lenis MIT, React Bits MIT + Commons Clause (https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md). This component is incorporated in a first-party web interface, not distributed as a component library or visual animation builder.
- **Surface:** public `app/guest-explore.tsx` only. Real artist/event/community search, navigation, links and bilingual locale controls remain the existing source.
- **Arabic:** native text heading remains for RTL; the upstream SplitText animation is opt-in for English. Reduced motion completely disables Lenis/GSAP heading entrance while SplitText handles its own reduced-motion fallback.
- **Isolation:** never mount MotionRuntime in logged-in workspace, editor, virtual scroll pane, audio timeline, or native DJ screen.

### Acceptance
- [x] Source files and dependency manifest on isolated GitHub integration branch.
- [x] React Bits source pinned to official upstream revision.
- [ ] Remote `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, public guest screenshot verification, EN/AR and 320–1440px UAT.
- [ ] Product PMO approval and final consolidated release; do not auto-deploy based on a branch source push.
