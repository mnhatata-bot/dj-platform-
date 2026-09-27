# Cuelance workflows and acceptance contract

This is the controlled-beta test contract. Every visible action must lead to the process and state described here. A release may be called complete only when automated checks pass and the staging-only browser journeys have evidence.

## Result vocabulary

- `PASS`: exercised successfully with evidence.
- `FAIL`: reproducible product defect; fix and rerun.
- `BLOCKED_EXTERNAL`: requires a configured staging account, provider credential, DNS, email, camera or processor that is not available locally.
- `ACCEPTED_BETA_LIMITATION`: deliberately disabled for the controlled beta and clearly explained in the UI.

## Roles and boundaries

| Role | Allowed scope | Never allowed |
|---|---|---|
| Guest | Public discovery, published EPK/provider/event/CMS pages, submit a booking inquiry | Draft/private data, workspaces, admin data, credentials |
| Beta member | Own artist profile, EPK, applications, bookings, wallet, messages, media and notifications | Another member's private records |
| Provider/vendor | Own public page, flexible catalogues, listings, inquiries, quotes, orders and fulfilment | Customer actions or another provider's inventory |
| Organization member | Organization records allowed by OWNER/ADMIN/MANAGER/EDITOR/FINANCE/SCANNER role | Capabilities outside the assigned role |
| Agency member | Roster, calendar, offers, contracts and deal files allowed by agency role | Signing as the artist or accessing another agency |
| Artist represented by agency | Own connected offers, approval, contracts and representation calendar | Agency-only commercial transitions |
| Scanner | Validate tickets for assigned events | Edit events, prices, inventory or ticket ownership |
| Platform admin | Allowlisted command resources and audited actions | Editing protected identity/ownership fields or exposing ticket tokens |
| Service role | Verified payment completion and durable job/outbox workers | Browser/client use |

## Public, access and shell controls

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| PUB-01 | Explore events | Read only PUBLIC events in PUBLISHED/LIVE/ENDED state | Cards link to `/events/{slug}`; drafts/private events never render |
| PUB-02 | Explore opportunities | Read only PUBLISHED opportunities | Public card appears without private applications |
| PUB-03 | Explore communities | Read only PUBLIC ACTIVE communities | Private/inactive communities remain hidden |
| PUB-04 | Provider marketplace | Load PUBLISHED provider pages and ACTIVE offerings | Product, service, rental and sale listings link to provider page |
| PUB-05 | Language selector | Change English/Arabic locale | Copy changes and document direction becomes LTR/RTL |
| PUB-06 | Retry/refresh | Repeat failed public query | Loading clears and usable error/retry state appears |
| AUTH-01 | Create account | Supabase signup with email/password | Verification notice appears; no beta workspace access yet |
| AUTH-02 | Resend verification email | Request another verification message | Neutral success response; rate-limit errors remain usable |
| AUTH-03 | Sign in | Validate credentials and session | ACTIVE beta user enters workspace; unapproved user sees beta gate |
| AUTH-04 | Switch login/signup | Change auth mode without navigation | Correct required fields and labels render |
| AUTH-05 | Sign out | Revoke local session and clear workspace state | Return to access screen |
| AUTH-06 | Controlled-beta gate | Call `beta_access_status()` after auth | ACTIVE continues; INVITED/REVOKED/missing is denied |
| SHELL-01 | Logo / Overview | Set active workspace tab to overview | Overview loads without full page refresh |
| SHELL-02 | Sidebar item | Switch to permitted module | Active state, heading and module content match |
| SHELL-03 | Role switcher | Select a role represented by current memberships | Navigation changes; it never grants database permissions |
| SHELL-04 | Help | Open in-product guide | Relevant guide content is readable |
| SHELL-05 | Continue setup | Route to next missing prerequisite | Artist → EPK → organization → event flow is respected |
| SHELL-06 | Notifications | Read/update own notification rows | Unread count and read state are owner-scoped |

## Artist, EPK, media and AI

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| ART-01 | Create/save artist profile | Insert/update profile owned by signed-in user | Sanitized profile reloads with ownership unchanged |
| ART-02 | Save English/Arabic content | Upsert locale-specific artist translation | Each language remains independently editable |
| ART-03 | Admin verification | Audited `verify_artist` action | Only admin changes VERIFIED/UNVERIFIED |
| EPK-01 | Create EPK | Create DRAFT EPK and default sections | One editable EPK is attached to the artist |
| EPK-02 | Save EPK | Update allowed presentation/content fields | Ownership and artist link cannot change |
| EPK-03 | Section On/Off | Update section enabled flag | Preview and next publication reflect selection |
| EPK-04 | Edit section | Validate rich content/link/media references | Unsafe links or foreign/private media are rejected |
| EPK-05 | Choose template | Save permitted template/theme | Content is preserved while presentation changes |
| EPK-06 | Publish EPK | Lock row and call `publish_epk` | Immutable sanitized publication version is created |
| EPK-07 | Open live EPK | Resolve `/epk/{slug}` through `get_public_epk` | Only PUBLISHED snapshot and PUBLIC enabled sections appear |
| EPK-08 | Download PDF | Auth/public publication lookup and PDF rendering | Download succeeds without draft/private data |
| MED-01 | Upload | Create owner-scoped storage key | Unsupported size/type is refused before registration |
| MED-02 | Complete upload | Authenticate, download, sniff bytes, hash and register PRIVATE asset | Extension matches bytes; duplicate completion is idempotent |
| MED-03 | Preview | Create short signed URL only for accessible asset | Private asset is owner-only; public asset can render publicly |
| MED-04 | Make public/private | Owner updates visibility | Public routes immediately respect new visibility |
| MED-05 | Attach | Bind owned compatible asset to current editor | Foreign/wrong-kind asset is rejected server-side |
| AI-01 | Generate | Authenticate and reserve quota with `begin_ai_request` | Output appears only after provider success |
| AI-02 | Accept draft | Copy generated text into selected language field | Source stays editable; no automatic publish |
| AI-03 | Retry | Start a new allowed request | Daily/per-minute plan quota is enforced transactionally |
| AI-04 | Provider failure | Mark AI request FAILED | Source is preserved and actionable 503 guidance appears |
| AI-05 | AI disabled | Check feature flag | Generation is refused while manual editing remains available |

## Opportunities, bookings, messages and communities

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| OPP-01 | Publish opportunity | Authorized org member creates PUBLISHED listing | Public discovery can read it |
| OPP-02 | Apply | Artist inserts application | Trigger forces SUBMITTED and rejects duplicates/closed listing |
| OPP-03 | View | Manager transitions SUBMITTED → VIEWED | Artist sees updated state |
| OPP-04 | Shortlist | Manager transitions SUBMITTED/VIEWED → SHORTLISTED | History/state remains valid |
| OPP-05 | Select | Manager transitions SHORTLISTED → SELECTED | Opportunity becomes FILLED and other live applications decline |
| OPP-06 | Decline | Manager uses allowed source states | Invalid/repeated transition fails |
| OPP-07 | Withdraw | Artist withdraws own SUBMITTED/VIEWED/SHORTLISTED application | Manager cannot impersonate artist action |
| OPP-08 | Feature off | Restrictive RLS checks marketplace flag | Public and member marketplace writes stop |
| BOOK-01 | Send booking inquiry | Guest/member submits name, email and brief | Trigger trims fields, sets NEW and binds member identity if signed in |
| BOOK-02 | Contact | Artist transitions NEW → CONTACTED | Requester cannot perform artist transition |
| BOOK-03 | Negotiate | Artist transitions CONTACTED → NEGOTIATING | Status history row is added |
| BOOK-04 | Confirm | Artist transitions CONTACTED/NEGOTIATING → CONFIRMED | Both participants can read the booking/history |
| BOOK-05 | Complete/cancel | Artist transitions CONFIRMED → COMPLETED/CANCELLED | Invalid skips are rejected |
| BOOK-06 | Guest rate limit | Count email submissions per hour | Eleventh request is rejected |
| BOOK-07 | Booking visibility | Participant read policy | Unrelated users see no inquiry/history |
| MSG-01 | Open conversation | Resolve authorized application/booking participants | One idempotent conversation per resource |
| MSG-02 | Select thread | Load participant-visible messages | Removed/nonparticipant user sees nothing |
| MSG-03 | Send | Validate participant, body and client UUID | Message is stored once; retry returns same ID |
| MSG-04 | Rate limit | Serialize sender and count recent messages | Excess send is rejected without duplicate |
| COM-01 | Create community | Authorized org role inserts community | Ownership remains with organization |
| COM-02 | Request membership | Member inserts own membership | OPEN becomes ACTIVE; REQUEST becomes PENDING |
| COM-03 | Approve/reject | Manager transitions PENDING → ACTIVE/REJECTED | Non-manager fails |
| COM-04 | Suspend | Manager transitions ACTIVE → SUSPENDED | Member loses active access |
| COM-05 | Restore | Manager transitions SUSPENDED → ACTIVE | Joined timestamp is retained |
| COM-06 | Closed/invite-only | Membership trigger checks mode/status | Public request is rejected |

## Flexible provider/vendor catalogue and commerce

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| PROV-01 | Save provider page | Owner creates/updates role, slug, profile and media | Owner/role immutable; page begins DRAFT |
| PROV-02 | Publish | Validate biography and public owned cover | Page becomes publicly discoverable |
| PROV-03 | Pause | Owner changes PUBLISHED → PAUSED | Page and active offerings disappear publicly |
| PROV-04 | Add/edit listing | Create PRODUCT (goods for sale), SERVICE, RENTAL or EXPERIENCE offering | Listing belongs to one provider and supports DRAFT/ACTIVE |
| PROV-05 | Add catalogue | Create named catalogue per provider | Listings can be grouped flexibly |
| PROV-06 | Add attribute | Define TEXT/NUMBER/BOOLEAN/SELECT/MULTISELECT/DATE/DURATION field | Key unique per provider; options/unit/required rules validate |
| PROV-07 | Set attribute value | Store listing-specific typed value | Type, ownership and required constraints validate |
| PROV-08 | Add variant | Add SKU/title/price delta/stock | Variant belongs to listing; active variants can display publicly |
| PROV-09 | Save commerce settings | Set FIXED/FROM/QUOTE/HOURLY/DAILY/PER_PERSON/PER_UNIT pricing | Min/max, lead time and UNLIMITED/TRACKED/SCHEDULED inventory validate |
| PROV-10 | Add availability | Add start/end/capacity/override | Invalid ranges or foreign listing fail |
| PROV-11 | Contact provider | Create provider inquiry without listing | Only published page accepts it |
| PROV-12 | Submit order request | Create order for active listing with quantity/location/dates | Provider cannot order own listing; stock/range rules apply |
| PROV-13 | Reply/status | Provider updates inquiry reply and NEW/CONTACTED/CLOSED | Requester cannot manage provider state |
| PROV-14 | Provider marketplace | Publicly read pages, offerings, catalog data, attributes, variants, availability | Private provider data and inquiries stay hidden |
| PROV-15 | Upload listing image | Reuse media workflow | Unchanged image does not block trusted stock updates |
| PROV-16 | Admin catalogue view | `admin_list` allowlist includes catalogue resources | Credentials/private secrets are excluded |
| VEN-01 | Create vendor profile | Authorized org member upserts markets/categories/regions | Other organization cannot edit |
| VEN-02 | Add vendor product | RLS-protected direct insert/update/delete | Public only sees ACTIVE product/profile combinations |
| VEN-03 | Create RFQ | Authorized org submits requirements/location/deadline | RFQ and My Cuelance item are created together |
| VEN-04 | Save My Cuelance item | User stores private work item | Only owner can read/write |

## Provider order state machine

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| ORD-01 | Submit order request | Customer creates REQUESTED order/history | Provider and customer can read it |
| ORD-02 | Send quote | Provider sets price, tax, deposit and note | REQUESTED/QUOTE_SENT → QUOTE_SENT only |
| ORD-03 | Accept quote | Customer accepts QUOTE_SENT | State becomes ACCEPTED |
| ORD-04 | Pay securely | Create provider checkout with idempotency key | Exact retry returns same checkout; cross-order reuse fails |
| ORD-05 | Verified deposit | Service role validates amount/currency/capture | State becomes DEPOSIT_PAID; stock is not reduced yet |
| ORD-06 | Pay balance | Create checkout for remaining amount | Verified completion becomes CONFIRMED and decrements tracked stock once |
| ORD-07 | Schedule/start/fulfil | Provider uses CONFIRMED → SCHEDULED → IN_PROGRESS → FULFILLED | Skipped/foreign transitions fail |
| ORD-08 | Accept delivery | Customer uses FULFILLED → COMPLETED | Completion time/history is recorded |
| ORD-09 | Cancel/request cancel/dispute | Correct participant uses allowed source states | State machine rejects invalid actions |
| ORD-10 | Payment switch | Database trigger checks `payments_enabled` | New paid checkout is refused when disabled |

## Events, tickets, wallet and scanner

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| EVT-01 | Publish event | Authorized org role creates PUBLISHED event | PUBLIC event route becomes visible |
| EVT-02 | Add cover | Attach owned public image | Foreign/private/wrong-kind image fails |
| EVT-03 | Activate ticket type | Manager creates ACTIVE type with capacity/price/window | Nonmember/scanner cannot edit |
| EVT-04 | Issue complimentary ticket | Authenticated buyer reserves zero-price type | Inventory locks; real credential is issued |
| EVT-05 | Buy paid ticket | Create 15-minute hold and hosted checkout | Exact retry is idempotent; sold-out and key reuse fail |
| EVT-06 | Verified capture | Service role checks event/order/amount/currency | Reservation becomes sold and ticket is issued once |
| EVT-07 | Expired checkout | Release expired hold and mark checkout/order EXPIRED | Capacity becomes available again |
| EVT-08 | Reconciliation | OWNER/ADMIN/MANAGER/FINANCE reads gross/refund/net | Other roles are denied |
| WAL-01 | Show QR | Render opaque credential only for ACTIVE/ISSUED ticket | Used/refunded/revoked/cancelled ticket has no usable QR |
| WAL-02 | Print | Print current valid pass | Online validation is still required |
| WAL-03 | Transfer | Owner requests recipient-email-bound transfer | Old pending transfer cancels; token expires in 48 hours |
| WAL-04 | Accept transfer | Signed-in email matches recipient | Holder changes and credential rotates |
| WAL-05 | Cancel complimentary | Holder cancels before event | Ticket/order cancel and inventory restores |
| WAL-06 | Request paid refund | Holder creates idempotent PENDING refund | Ticket/order become REFUND_PENDING |
| WAL-07 | Verified refund | Provider/webhook completes refund | Checkout/order/ticket become REFUNDED and inventory restores once |
| SCAN-01 | Camera scan | Decode credential payload | Controlled beta supports online validation only |
| SCAN-02 | Manual entry | Parse the same opaque credential format | Same backend validation as camera |
| SCAN-03 | Validate entry | Assigned scanner calls validation RPC | VALID check-in writes once |
| SCAN-04 | Duplicate/wrong/revoked | Validate current server state | Already used is amber; invalid/wrong event/revoked is red |
| SCAN-05 | Rate limit | Count scanner attempts per minute | Excess scans fail without admission mutation |

## Agency OS

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| AGY-01 | Add roster artist | OWNER/ADMIN/MANAGER adds connected/manual artist | Artist can read own connected roster row |
| AGY-02 | Edit roster | Authorized role updates commercial data | Cross-agency update fails |
| AGY-03 | Add calendar item | Authorized role adds valid range/kind/status | Artist sees connected calendar; creator/org are enforced |
| AGY-04 | Create offer | Agency creates DRAFT offer for roster artist | History starts with valid ownership |
| AGY-05 | Send/withdraw offer | Agency state transition RPC | Only allowed source/target pair succeeds |
| AGY-06 | Negotiate/accept/decline | Agency transitions SENT/NEGOTIATING | Invalid terminal transition fails |
| AGY-07 | Approve/decline offer | Connected artist responds | Agency cannot sign as artist; unrelated user fails |
| AGY-08 | Deal message | Participant posts bounded message | Only agency/connected artist can read/write |
| AGY-09 | Deal document | Authorized agency member attaches owned media | Foreign media is rejected |
| AGY-10 | Draft contract | Agency creates versioned contract for its offer | Required body/title validate |
| AGY-11 | Send contract | Agency transitions DRAFT → SENT | Artist cannot send |
| AGY-12 | Agency/artist sign | Correct party signs SENT/PARTIALLY_SIGNED | Both signatures produce EXECUTED |
| AGY-13 | Artist agency desk | Load offers/contracts/calendar for connected artist | Other roster/deal data stays hidden |

## Plans, notifications, domains, jobs and administration

| ID | Button/control | Process | Expected result |
|---|---|---|---|
| PLAN-01 | View plan | `entitlement_snapshot` merges plan and valid overrides | User/org scope is enforced |
| PLAN-02 | Upgrade | Create subscription checkout | Plan/audience and idempotency intent must match |
| PLAN-03 | Verified subscription | Verified event activates one subscription | Previous active subscription cancels atomically |
| PLAN-04 | Admin set subscription | Audited admin RPC | Nonadmin fails |
| PLAN-05 | Feature entitlement | `entitlement_allowed` gates custom domain/AI/etc. | Expired override/subscription does not grant access |
| NOT-01 | Notification center | Read own notifications | Other users and outbox are inaccessible |
| NOT-02 | Mark read | Owner updates own row | User/ownership cannot change |
| NOT-03 | Domain/order/ticket/agency event | Trigger enqueues in-app notification and optional email | Business mutation succeeds independently of email delivery |
| NOT-04 | Email worker | CRON bearer claims, sends, finishes/retries batch | Service-only RPC, bounded attempts/backoff |
| DOM-01 | Search domain | Authenticated GoDaddy availability lookup | Returns `purchaseEnabled:false` during beta |
| DOM-02 | Request custom domain | Validate entitlement, ownership, target and domain | REQUESTED row and deduplicated provision job are created |
| DOM-03 | Show DNS instructions | Domain worker maps provider verification records | Owner/org can read; unrelated user cannot |
| DOM-04 | Verify | Owner resets verification job | VERIFYING → ACTIVE or DNS_REQUIRED/FAILED |
| DOM-05 | Managed purchase | Deliberately unavailable in controlled beta | UI never claims registration/purchase completed |
| JOB-01 | Cron authorization | Constant-time CRON bearer comparison | Missing/wrong secret returns 401 before admin access |
| JOB-02 | Claim jobs | Service role claims with `FOR UPDATE SKIP LOCKED` | Concurrent worker cannot claim same row |
| JOB-03 | Finish success | Save result and COMPLETED timestamp | Completed job is not reclaimed |
| JOB-04 | Finish failure | Increment attempt and schedule bounded backoff | Exhausted job becomes FAILED |
| JOB-05 | Media processor | External processor returns derivative metadata | Missing configuration is reported, not falsely completed |
| ADM-01 | Search/list resource | `admin_list` checks explicit resource allowlist | Pagination/search bounded; credential tokens removed |
| ADM-02 | Edit entity | `admin_update_entity` checks field allowlist | Ownership/security fields cannot change |
| ADM-03 | Suspend/restore | Audited action updates account state | Cannot suspend self/protected super admin |
| ADM-04 | Verify artist | Audited verification action | Only platform admin |
| ADM-05 | Revoke ticket | ACTIVE/ISSUED → REVOKED | Credential stops validating |
| ADM-06 | Toggle feature/payment | Allowlisted feature action | Payment flag also enforced in database |
| ADM-07 | Grant/revoke role | Super-admin-only audited action | Cannot grant SUPER_ADMIN or edit self |
| ADM-08 | Save CMS page | Validate locale, slug, blocks, size and URLs | Revision and audit rows created |
| ADM-09 | Save settings/templates | Validate allowlisted keys and JSON shape | Public settings policy exposes only safe keys |
| ADM-10 | Beta access INVITED/ACTIVE/REVOKED | Admin manages email/user access | Gate changes on next check |
| ADM-11 | Resolve operational log | Admin adds resolution note/time | Normal user cannot read or resolve logs |

## End-to-end journeys

1. **Artist growth:** sign up → beta approval → artist profile → media → EPK sections/template → publish → live EPK/PDF → apply → message.
2. **Promoter booking:** organization → opportunity → review/shortlist/select → conversation → event → tickets → reconciliation.
3. **Direct booking:** public EPK/provider page → booking inquiry → artist contact/negotiate/confirm/complete → participant history/messages.
4. **Provider commerce:** provider page → flexible catalogue/attributes/variant/availability → customer request → quote → deposit → balance → scheduled → fulfilled → accepted.
5. **Ticket lifecycle:** public event → paid/complimentary ticket → wallet → transfer/cancel/refund → notification → reconciliation.
6. **Admission:** scanner assignment → QR/manual token → valid entry → duplicate/wrong/revoked handling.
7. **Agency deal:** roster → calendar hold → offer → artist approval → contract → dual signature → shared deal record.
8. **Operations:** beta/admin configuration → durable notifications/domains/media jobs → logs → audited resolution.

## Release gates

- All migrations apply in filename order to the isolated PostgreSQL fixture.
- RLS is enabled for every table introduced by these migrations.
- Security-definer functions pin `search_path`; anonymous execution is limited to `feature_enabled` and `get_public_epk`.
- Unit/database/API contract tests, TypeScript and production build pass.
- Public and unauthorized HTTP probes pass against the production build.
- Staging browser evidence covers every role-to-role journey, English/Arabic, mobile/desktop, keyboard and error states.
- PayPal sandbox, email delivery, domain provider, Vercel domain verification, media processor and camera checks are either `PASS` or explicitly `BLOCKED_EXTERNAL`; none may be silently reported as passing.
- Production is changed only once, after the pending report is approved.
