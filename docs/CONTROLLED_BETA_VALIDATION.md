# Controlled beta validation report

Date: 2026-09-27

Source baseline: GitHub `mnhatata-bot/dj-platform-` commit `e4500b848dc528771ce69d7af6252f1ac43ebe95`

Deployment: not performed

## Local release result

| Gate | Result | Evidence |
|---|---|---|
| Complete migration chain | PASS | All 30 SQL files apply in filename order to isolated PostgreSQL/PGlite fixture |
| Database/RLS/state workflows | PASS | Application, membership, booking, messaging, admin, subscription, payment, ticket, provider order, agency, domain, media job and notification assertions |
| Security-definer audit | PASS | Every public definer pins `search_path`; only `feature_enabled` and `get_public_epk` are anonymous |
| RLS audit | PASS | All 44 tables introduced by repository migrations have RLS enabled |
| Checkout concurrency/idempotency | PASS | Exact retries return original checkout; cross-intent/key reuse is rejected; inventory is not duplicated |
| API authorization contracts | PASS | Auth precedes protected payment parsing/config checks; cron uses constant-time bearer comparison; webhook verifies before admin DB |
| UI workflow contracts | PASS | Flexible catalogue types/attributes/pricing/inventory and role/state buttons are present |
| Mobile/RTL/accessibility contracts | PASS | Mobile breakpoints, horizontal overflow handling, RTL document sync, focus-visible, reduced motion and accessible media alternatives |
| Automated tests | PASS | 15/15 Node tests |
| TypeScript | PASS | `tsc --noEmit` |
| Production build | PASS | Next.js compiled and generated 21 routes |
| Local production HTTP smoke | PASS | 17/17 public/manifest/status/unauthorized route checks |
| Git whitespace validation | PASS | `git diff --check` |

## Defects fixed during validation

1. Checkout idempotency keys could be reused for a different plan, ticket type or provider order; near-simultaneous retries could return avoidable errors. Three checkout RPCs now validate purchase intent and re-read after row locks.
2. Protected payment endpoints parsed input or exposed provider availability before authentication. All five routes now authenticate first and consistently return `401` to unsigned callers.
3. Two workflow migrations were absent from the old fixture. The test now loads every migration automatically, preventing selective green results.
4. Clean/new Supabase projects could lose Data API access because several RLS-protected workflow tables relied on historical implicit grants. Explicit least-privilege grants now cover messages/CMS, vendor, opportunity, community and booking workflows.
5. Booking history could appear empty when the parent inquiry had no guaranteed participant-read policy. The missing participant policy is now explicit.
6. Full provider-order payment could fail while decrementing stock because an unchanged listing image was revalidated against the service role's empty `auth.uid()`. The trigger now validates media only on insert or a media-reference change.
7. Tooltip positioning used left-specific CSS. Logical inline positioning now behaves correctly in Arabic RTL.

## External staging checks still pending

These are `BLOCKED_EXTERNAL`, not local failures:

| Check | Required configuration |
|---|---|
| Signed-in role-to-role browser journeys | Staging URL, browser runtime, ACTIVE artist/provider/promoter/agency/scanner/admin accounts |
| Real Supabase migration/advisor/integration run | Staging Supabase URL, publishable key, secret key and test credentials |
| PayPal checkout/capture/webhook/refund | Sandbox client ID, secret, webhook ID and webhook endpoint |
| Notification email delivery/retry | Resend API key and verified sender |
| Domain availability/provision/verification | GoDaddy credentials plus Vercel token/project/team IDs |
| Media thumbnail/transcode worker | Processor URL and shared secret |
| Camera admission on devices | HTTPS staging site, camera permission and two physical browsers/devices |
| Mobile/desktop screenshot and assistive-technology evidence | Browser runtime against staging |

## Controlled-beta limitations accepted by design

- Payments remain disabled unless both the provider is configured and the database `payments_enabled` flag is true.
- Automatic domain purchase is disabled; users may search, buy externally and connect a domain they control.
- Media derivatives require the external processor; uploads remain registered safely if processing is not configured.
- Admission is online-only. Offline scanning is not advertised as supported.

## Deployment decision

Do not deploy yet. First configure a staging environment and run the external checks above. If they pass, review the final migration diff and environment checklist, then perform the single approved production deployment.
