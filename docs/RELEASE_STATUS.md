# Current release: provider pages, marketplace and event/ticket visuals — 25 September 2026

This section supersedes older deployment-blocker notes below for the changes listed here. It does not certify full BRD/SRS completion.

Implemented: eight provider page categories (artist, promoter, venue, community, agency, production, vendor, event professional); public `/p/[slug]` pages; marketplace search/category filtering; image uploads; persisted offerings and customer inquiries; provider replies; customer inquiry history; public event pages; event artwork editing; complimentary ticket reservation using the existing transactional service; redesigned QR passes and printing; active organization selection; admin visibility for new records; localized English/Arabic guidance and responsive layouts.

Added after the initial release: promoter application pipeline with VIEWED, SHORTLISTED, SELECTED and DECLINED transitions; artist withdrawal; automatic opportunity fulfillment; community membership approval, rejection, suspension and restoration; server-enforced transition rules and manager-only queues.

Added booking operations: artist Kanban for NEW, CONTACTED, NEGOTIATING, CONFIRMED, COMPLETED, DECLINED and CANCELLED enquiries; immutable status history; public-form normalization and throttling; requester identity enforcement.

Added the complete structured EPK content editor: guided fields for all twelve core sections, section-specific facts and HTTPS links, public/private visibility, a detailed technical and hospitality rider, and consistent rendering in the live EPK and generated PDF. Existing attached media is retained.

Added provider-neutral plans and entitlement enforcement: normalized plan/subscription/override records, account and organization ownership boundaries, expiry fallback, administrator-only assignment with audit records, plan-aware AI quotas, usage snapshots and a guided Plan & access interface. Payment checkout remains intentionally disconnected until a provider is approved.

Added the provider-neutral payment foundation and PayPal readiness: internal checkout, verified-event and refund ledgers; owner-scoped RLS; idempotent subscription checkout creation; server-side PayPal Orders v2 hosted checkout; authenticated return capture; PayPal webhook signature verification; amount/currency matching; and server-only subscription activation. Checkout remains disabled automatically until server credentials and the webhook ID are configured. No deployment was made, in line with the single final deployment plan.

Database migrations applied to the connected Supabase project: provider_pages_and_offerings, event_visibility_and_staff_boundaries, provider_admin_visibility_and_rpc_grants. All new tables use RLS and explicit grants. Customers cannot change inquiry identity or provider replies. Scanner membership cannot edit events. Anonymous access to authenticated operational/admin RPCs was revoked.

Validation: TypeScript and production build passed. PostgreSQL tests cover provider ownership, draft/public visibility, private event access, scanner edit denial, inquiry identity protection, and the pre-existing module rules. A live transactional save was executed and rolled back; grants were checked. Public browser/deployment acceptance is recorded after deployment. No full authenticated browser regression or physical camera test has been completed for this release.

Outstanding requirements (not approved deferrals): full original BRD/SRS compliance, selecting/configuring the production payment merchant, paid ticket order/issuance/refund/transfer/reconciliation lifecycle, advanced provider commerce/order fulfillment, agency roster/calendar/deal-room workflows, thumbnail/transcoding and durable background jobs, custom-domain verification/provisioning, complete notification/email delivery, complete multi-device accessibility/RTL and automated end-to-end acceptance. The legacy Vendor OS catalog and new individual provider offerings are separate records; automatic migration/synchronization between them is not implemented. Provider inquiries are requests, not completed bookings or paid orders. Existing uploaded event photos are retained; missing photos use branded artwork until owners upload their own.

## Historical release notes

# Cuelance guided modules — release status

This change belongs only to `mnhatata-bot/dj-platform-`. It does not modify SoundCode.

## Implemented in source

- Camera QR reading with ZXing, explicit camera start/stop, manual fallback, event permissions, online validation and colored results.
- Ticket wallet with actual issued credentials and QR images.
- AI provider interface, Vercel Gateway adapter, ten writing actions, English/Arabic output, editable drafts, explicit acceptance, usage records and request limits. A successful provider generation still needs verification in the deployed environment.
- Private media upload, server content/extension/size checks, SHA-256 metadata, temporary viewing links, explicit public visibility, and attachment to EPK sections.
- Server-generated A4 PDFs from sanitized published EPK snapshots, publication versions, media links and live-profile QR.
- English/Arabic module UI, RTL layout, remembered language, separate Arabic artist biography and stage name, bilingual CMS pages and bilingual guide. Remaining legacy copy and device layout need a browser acceptance pass.
- Resource-scoped conversations, participant authorization, persistent messages, idempotent send, polling and session draft retention.
- CMS page editor with six block types, reordering, preview, SEO fields, draft/publish/archive states, revision history, public rendering and audit records.
- Admin resource search, pagination, CSV export, user suspension/restoration, role controls, artist verification, ticket revocation, configuration and bounded resource editing.
- Accessible touch-operated help controls and step-by-step examples. Full guide: `/guide`; source companion: `docs/CUELANCE_USER_GUIDE.md`.

## Applied to the connected database

1. `20260922000100_guided_platform_modules.sql`
2. `20260922000200_public_assets_and_guards.sql`

## Pending deployment migrations

Apply these in order through the authorized Supabase connection before publishing this frontend:

1. `20260922000300_artist_translations.sql`
2. `20260922000400_admin_resource_commands.sql`
3. `20260922000500_module_configuration_guards.sql`
4. `20260922000600_public_media_metadata.sql`

The pending migration SQL passes the isolated PostgreSQL rule tests. It has not been confirmed applied to the live database.

## Verification

- TypeScript and Next.js production build passed.
- QR parsing tests passed for wallet/manual compatibility and malformed payload rejection.
- Isolated PostgreSQL tests passed: migrations, admin/member boundaries, unrelated-message denial, idempotency, self-role escalation denial, protected field validation, artist verification guard, CMS revision persistence, unsafe-link rejection, suspension and AI request limits.
- Real-service smoke tests observed successful authentication, anonymous admin/message denial, authorized admin reads, invalid AI input rejection, cross-owner media rejection, sanitized EPK publication reads and actual PDF generation.
- Real-service concurrency checks observed exactly one reservation for capacity one and exactly one valid admission for simultaneous scans.
- Real CMS saves, draft privacy, publication rendering and revision creation passed.
- Authenticated upload, private-file denial, content verification and private-route non-disclosure passed. Public asset links failed because anonymous metadata visibility was missing; migration 006 fixes the policy and must be applied and retested before release.
- Physical camera capture, full responsive visual acceptance, Arabic PDF visual inspection, and successful AI provider generation remain unverified.

## Release blocker

GitHub, Supabase management, Vercel and Plugin Management connector calls began returning `HTTP 400: Invalid MCP request metadata`. The new frontend has not been pushed or deployed. This is a connector-session failure, not evidence that the user's credentials are wrong.

Read-only Git access succeeded and the remote main branch was confirmed at `3f12e6c310e0a5015d2f24f2938e8abe8d4199cd`. The Supabase CLI has no management login in this environment. Do not ask the user to paste management credentials into chat.

Do not label this release 100% validated or live until the pending migrations, provider check, browser acceptance and deployment are completed.

## Operating limits

- Payments remain deliberately unavailable pending provider selection.
- Scanner validation requires an internet connection.
- Upload limit is 25 MB per file. Uploaded originals are retained; background thumbnail/transcoding jobs are outside this change.
- AI requests are capped at 3/minute and 20/day per account. Requests that fail at the provider still count against request limits.
- Messaging loads the latest 100 messages and refreshes every five seconds.
- CMS email/notification template configuration does not itself enable email delivery.
- The new admin CMS is implemented; this is not a claim that every administration, finance, subscription and moderation feature in the original 109-section SRS is complete.

## Reproduction

`npm ci`, `npm run typecheck`, `npm test`, and `npm run build` validate source and database rules without cloud credentials.

The real-service smoke suite requires `TEST_EMAIL` and `TEST_PASSWORD` from a dedicated authorized test account. Set `TEST_WRITES=1` only for authorized persistence/concurrency validation. Prefer a staging Supabase URL and publishable key. No password or access token is stored in the repository. The GitHub workflow keeps integration checks behind an explicit staging run and refuses to run without staging configuration.
