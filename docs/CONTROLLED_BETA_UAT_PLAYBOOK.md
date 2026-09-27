# Cuelance controlled-beta UAT playbook

Use separate browser profiles or private tabs so each persona keeps an independent session. Do not reuse the platform-admin account for ordinary scenarios. Payments remain disabled unless the sandbox provider and database flag are deliberately enabled.

## Test accounts

Provision these from **Admin → Settings → UAT account suite**. Passwords are generated uniquely and displayed only when an account is created or explicitly reset.

| Persona | Login | Assigned platform role | Primary workspace |
|---|---|---|---|
| Fan/customer | `uat.fan@cuelance.com` | USER | Fan / My Cuelance |
| Artist/DJ | `uat.artist@cuelance.com` | DJ | Artist |
| Promoter | `uat.promoter@cuelance.com` | PROMOTER | Promoter |
| Venue operator | `uat.venue@cuelance.com` | ORGANIZATION_ADMIN | Venue |
| Community manager | `uat.community@cuelance.com` | COMMUNITY_MANAGER | Community |
| Provider/vendor | `uat.provider@cuelance.com` | USER | Vendor |
| Agency manager | `uat.agency@cuelance.com` | ORGANIZATION_ADMIN | Agency |
| Event scanner | `uat.scanner@cuelance.com` | EVENT_STAFF | Event professional |
| Platform support | `uat.support@cuelance.com` | PLATFORM_SUPPORT | Support boundaries |
| Platform administrator | `uat.admin@cuelance.com` | PLATFORM_ADMIN | Cuelance Command |

## Feedback method

For every scenario record:

- Result: PASS, FAIL, BLOCKED or CONFUSING.
- Exact account and scenario ID.
- Device/browser and English or Arabic.
- The button pressed and the expected result.
- What actually happened, including the visible error.
- Screenshot or short screen recording.
- Severity: S1 security/data loss, S2 workflow blocked, S3 confusing/incorrect, S4 cosmetic.
- Suggested wording or behavior, if obvious.

Never include passwords, QR credential tokens or private customer data in feedback screenshots.

## UAT-01 — Beta access and account isolation

1. Sign in as each persona and confirm the controlled-beta gate opens the workspace.
2. Select the persona’s primary workspace from the workspace switcher.
3. Open **Notifications**, **Messages**, **Media** and **My Cuelance** where available.
4. Confirm records belonging to another UAT account do not appear.
5. Sign out and confirm the protected workspace cannot be recovered with the Back button.

Expected: each user sees only their own or explicitly shared records; only `uat.admin` sees **Admin**.

## UAT-02 — Artist profile, EPK and opportunity

Accounts: artist, promoter.

1. Artist: **Artist → Save profile** with stage name, Riyadh, Tech House and bilingual bio.
2. Artist: **Media → Upload**, then attach the owned image to the EPK.
3. Artist: **EPK → Create/Save → Choose template → Publish → Open live EPK**.
4. Promoter: **Promoter → Create organization**, then **Publish opportunity**.
5. Artist: **Marketplace → Apply**.
6. Promoter: open the application and press **View → Shortlist → Select**.
7. Both accounts: open **Messages**, send one message each and refresh.

Expected: public EPK shows only published content; duplicate application is refused; selecting fills the opportunity; the conversation is visible only to its participants.

## UAT-03 — Direct booking pipeline

Accounts: fan, artist.

1. Fan: open the artist’s public EPK and press **Booking inquiry**.
2. Submit date, city, budget and brief.
3. Artist: **Bookings → Contact → Negotiate → Confirm**.
4. Fan: confirm the booking and its status are visible, but artist-only actions are absent.
5. Artist: press **Complete**.

Expected: every transition follows the allowed order and both participants see the same history.

## UAT-04 — Flexible provider catalogue and order

Accounts: provider, promoter.

1. Provider: **Vendor → Build public storefront → Publish**.
2. Add four listings: PRODUCT, SERVICE, RENTAL and EXPERIENCE.
3. Add TEXT, NUMBER, BOOLEAN, SELECT, MULTISELECT, DATE and DURATION attributes across the listings.
4. Configure FIXED, QUOTE, DAILY and PER_PERSON pricing plus TRACKED and SCHEDULED inventory.
5. Add one variant and one availability window; publish the listings.
6. Promoter: open the marketplace and press **Request order/quote** on the rental.
7. Provider: open the request and press **Quote**.
8. Promoter: **Accept quote**. Leave payment blocked unless PayPal sandbox is enabled.
9. After sandbox payment validation, provider progresses **Schedule → Fulfil** and promoter presses **Accept delivery**.

Expected: typed attributes display correctly, ownership cannot change, unavailable stock cannot be ordered and every party sees only its own action buttons.

## UAT-05 — Community membership

Accounts: community manager, fan.

1. Community manager: create an organization and a REQUEST-based public community.
2. Fan: find it and press **Request membership**.
3. Community manager: press **Approve**.
4. Fan: open **My Cuelance** and confirm active membership.
5. Community manager: **Suspend**, confirm access disappears, then **Restore**.

Expected: PENDING → ACTIVE → SUSPENDED → ACTIVE; the fan cannot self-approve.

## UAT-06 — Event, ticket and admission

Accounts: promoter, fan, scanner.

1. Promoter: create an event and ticket type; assign the scanner account to the event.
2. Fan: acquire a complimentary ticket, then open **Wallet**.
3. Scanner: open **Scanner**, scan the QR, then scan it again.
4. Scanner: test **Manual entry** with the same credential.
5. Promoter/admin: revoke another ticket and ask the scanner to validate it.

Expected: first scan is valid, repeat is duplicate, revoked/wrong-event credentials are rejected, and the scanner cannot edit the event.

## UAT-07 — Agency offer and contract

Accounts: agency, artist.

1. Agency: create an organization, open **Agency OS**, and add the artist to the roster.
2. Add a calendar hold and create an offer.
3. Press **Send offer**.
4. Artist: **My agency deals → Approve**.
5. Agency: create and send a contract, then **Sign as agency**.
6. Artist: **Sign as artist**.
7. Both: add a deal-room message; agency attaches an owned document.

Expected: artist approval is independent from agency transition; both signatures are required for EXECUTED; unrelated accounts see nothing.

## UAT-08 — Venue and production collaboration

Accounts: venue, promoter, provider, scanner.

1. Venue: create its organization and event with venue details.
2. Promoter: create a corresponding opportunity/event plan.
3. Promoter requests sound/lighting rental from the provider.
4. Provider quotes and schedules fulfilment.
5. Scanner confirms only assigned admission access.

Expected: organization boundaries remain intact and production/vendor actions do not grant financial or admin permissions.

## UAT-09 — Platform administration and support boundaries

Accounts: admin, support, fan.

1. Admin: open **Cuelance Command**, search users and inspect logs.
2. Admin: approve/revoke the fan’s beta access, then restore it.
3. Admin: verify an artist and toggle a non-payment feature off/on.
4. Support: confirm support-visible tools work but role grants, protected settings and SUPER_ADMIN actions remain unavailable.
5. Fan: confirm no admin route, record or button is visible.

Expected: every administrative mutation is audited; protected identity/ownership fields cannot be edited.

## UAT-10 — Arabic, mobile and failure recovery

Run UAT-02, UAT-04 and UAT-06 on iPhone Safari and one desktop browser.

1. Switch to Arabic and confirm RTL direction, field alignment and back/next meaning.
2. Rotate the phone and confirm no required action is clipped or horizontally inaccessible.
3. Navigate entirely by keyboard on desktop and confirm visible focus.
4. Submit one invalid form, retry one failed request and test offline/network interruption before a final save.
5. Confirm destructive or irreversible actions require confirmation.

Expected: no data is silently lost, retry does not duplicate records, and the same business state appears after refresh.

## Acceptance rule

Controlled beta is accepted only when UAT-01 through UAT-10 have no open S1/S2 issues. S3 issues require an explicit product decision; S4 issues may enter the post-beta backlog. PayPal, email, domain, media-worker and physical-camera steps remain BLOCKED until their external sandbox credentials or devices are available.
