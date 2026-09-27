import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
// Isolated PostgreSQL fixture for the new migrations and permission rules.
// Production concurrency is checked separately by modules-smoke.mjs.
test("New module migrations enforce member/admin boundaries and validation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema private; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
 create table auth.users(id uuid primary key,email text);
 grant usage on schema public,auth,storage to anon,authenticated;
 create table public.profiles(id uuid primary key,display_name text,avatar_url text,locale text default 'en',is_suspended boolean default false);
 create table public.user_roles(user_id uuid,role_code text,primary key(user_id,role_code));
 create table public.organizations(id uuid primary key,owner_user_id uuid,name text,kind text);
 create table public.organization_members(organization_id uuid,user_id uuid,role text,primary key(organization_id,user_id));
 create table public.dj_profiles(id uuid primary key,user_id uuid,stage_name text,short_bio text,long_bio text,primary_city text,country text,verification_status text default 'UNVERIFIED');
 create table public.epks(id uuid primary key,dj_profile_id uuid,slug text,status text);
 create table public.epk_sections(id uuid,epk_id uuid);
 create table public.epk_publications(id uuid,epk_id uuid,document jsonb,version integer,published_at timestamptz);
 alter table public.epk_publications enable row level security;
 create policy epk_publications_read on public.epk_publications for select using(true);
 create table public.opportunities(id uuid primary key,organization_id uuid,title text,description text,city text,country text,status text,updated_at timestamptz default now());
 create table public.applications(id uuid primary key,dj_profile_id uuid,opportunity_id uuid,status text default 'DRAFT',updated_at timestamptz default now());
 create table public.booking_inquiries(id uuid primary key,dj_profile_id uuid,requester_user_id uuid,requester_name text,requester_email text,organization_name text,message text,city text,budget text,status text default 'NEW',created_at timestamptz default now());
 create table public.events(id uuid primary key,organization_id uuid,title text,description text,venue text,address text,city text,country text,status text,visibility text,starts_at timestamptz,approval_required boolean default false);
 create table public.communities(id uuid primary key,organization_id uuid,name text,description text,visibility text,membership_mode text,status text);
 create table public.community_members(id uuid,community_id uuid,user_id uuid,status text,joined_at timestamptz,tier text,tags text[] default '{}',unique(community_id,user_id));
 alter table public.opportunities enable row level security;
 alter table public.applications enable row level security;
 alter table public.booking_inquiries enable row level security;
 alter table public.communities enable row level security;
 alter table public.community_members enable row level security;
 create table public.ticket_types(id uuid primary key,event_id uuid,status text,approval_required boolean default false,sales_start timestamptz,sales_end timestamptz);
 alter table public.events enable row level security;
 alter table public.ticket_types enable row level security;
 create policy events_read on public.events for select to anon,authenticated using(true);
 create policy opportunities_read on public.opportunities for select to anon,authenticated using(true);
 create policy communities_read on public.communities for select to anon,authenticated using(true);
 create table public.ticket_orders(id uuid primary key);
 create table public.tickets(id uuid primary key,status text,credential_token uuid);
 create table public.checkins(id uuid,scanner_user_id uuid,checked_in_at timestamptz);
 create table public.feature_flags(key text primary key,enabled boolean,updated_at timestamptz default now());
 create table public.media_assets(id uuid primary key,owner_user_id uuid,storage_key text,visibility text,kind text default 'IMAGE',mime_type text default 'image/png',file_size bigint default 1,metadata jsonb default '{}'::jsonb,created_at timestamptz default now());
 alter table public.media_assets enable row level security;
 create policy media_read on public.media_assets for select to authenticated using(owner_user_id=auth.uid() or visibility='PUBLIC');
 create table public.cms_pages(id uuid primary key,slug text,language text check(language in ('en','ar')),title text,seo_title text,seo_description text,status text check(status in ('DRAFT','PUBLISHED','ARCHIVED')),blocks jsonb,published_at timestamptz,unique(slug,language));
 create table public.audit_logs(id uuid default gen_random_uuid(),actor_id uuid,action text,resource_type text,resource_id text,metadata jsonb,created_at timestamptz default now());
 create table storage.buckets(id text primary key,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid,bucket_id text,name text);
 create function private.reserve_ticket_impl(uuid,text) returns uuid language sql as $$ select gen_random_uuid() $$;
 create function private.validate_ticket_checkin_impl(uuid,uuid,text) returns text language sql as $$ select 'VALID'::text $$;
 create function private.publish_epk_impl(uuid) returns integer language sql as $$ select 1 $$;
 `);
    await db.exec(
      "grant select,insert,update,delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon;",
    );
    const migrationsUrl = new URL("../supabase/migrations/", import.meta.url);
    const migrationFiles = readdirSync(migrationsUrl)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      const migration = readFileSync(new URL(file, migrationsUrl), "utf8");
      if (migration.trim()) await db.exec(migration);
    }
    const admin = "10000000-0000-4000-8000-000000000001",
      a = "10000000-0000-4000-8000-000000000002",
      b = "10000000-0000-4000-8000-000000000003";
    const org = "20000000-0000-4000-8000-000000000001",
      dj = "30000000-0000-4000-8000-000000000001",
      op = "40000000-0000-4000-8000-000000000001",
      application = "50000000-0000-4000-8000-000000000001";
    const act = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    await db.query("insert into profiles(id) values($1),($2),($3)", [
      admin,
      a,
      b,
    ]);
    await db.query("insert into auth.users(id,email) values($1,'admin@example.com'),($2,'provider@example.com'),($3,'buyer@example.com')",[admin,a,b]);
    await db.query("insert into beta_access(user_id,status) values($1,'ACTIVE'),($2,'ACTIVE')",[a,b]);
    await db.query("update feature_flags set enabled=true where key='payments_enabled'");
    await db.query("insert into user_roles values($1,'SUPER_ADMIN')", [admin]);
    await db.query(
      "insert into organizations values($1,$2,'Fixture organization','PROMOTER')",
      [org, admin],
    );
    await db.query("insert into organization_members values($1,$2,'OWNER')", [
      org,
      admin,
    ]);
    await db.query("insert into organization_members values($1,$2,'MANAGER')", [
      org,
      a,
    ]);
    await db.query(
      "insert into dj_profiles(id,user_id,stage_name) values($1,$2,'Fixture DJ')",
      [dj, a],
    );
    await db.query(
      "insert into opportunities(id,organization_id,title,status) values($1,$2,'Fixture opportunity','PUBLISHED')",
      [op, org],
    );
    await db.query("insert into applications values($1,$2,$3)", [
      application,
      dj,
      op,
    ]);
    assert.equal((await db.query("select status from applications where id=$1",[application])).rows[0].status,"SUBMITTED");
    await act(a);
    await assert.rejects(
      db.query("insert into applications(id,dj_profile_id,opportunity_id) values($1,$2,$3)",[crypto.randomUUID(),dj,op]),
      /Application already submitted/,
    );
    await assert.rejects(db.query("select transition_application($1,'SELECTED')",[application]),/Invalid artist transition/);
    await act(b);
    await assert.rejects(db.query("select transition_application($1,'VIEWED')",[application]),/Permission denied/);
    await act(admin);
    await db.query("select transition_application($1,'VIEWED')",[application]);
    await db.query("select transition_application($1,'SHORTLISTED')",[application]);
    await db.query("select transition_application($1,'SELECTED')",[application]);
    assert.equal((await db.query("select status from opportunities where id=$1",[op])).rows[0].status,"FILLED");

    const community="41000000-0000-4000-8000-000000000001";
    await db.query("insert into communities(id,organization_id,name,visibility,membership_mode,status) values($1,$2,'Fixture community','PUBLIC','REQUEST','ACTIVE')",[community,org]);
    await act(b);
    await db.query("insert into community_members(id,community_id,user_id,status) values($1,$2,$3,'ACTIVE')",[crypto.randomUUID(),community,b]);
    assert.equal((await db.query("select status from community_members where community_id=$1 and user_id=$2",[community,b])).rows[0].status,"PENDING");
    await assert.rejects(db.query("select transition_community_member($1,$2,'ACTIVE')",[community,b]),/Permission denied/);
    await act(a);
    await db.query("select transition_community_member($1,$2,'ACTIVE')",[community,b]);
    await assert.rejects(db.query("select transition_community_member($1,$2,'REJECTED')",[community,b]),/Invalid membership transition/);

    const guestBooking="42000000-0000-4000-8000-000000000001";
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec("set role anon");
    await db.query("insert into booking_inquiries(id,dj_profile_id,requester_name,requester_email,message) values($1,$2,'Guest promoter','guest@example.com','Please perform at our independent festival.')",[guestBooking,dj]);
    await db.exec("reset role");
    assert.equal((await db.query("select requester_user_id,status from booking_inquiries where id=$1",[guestBooking])).rows[0].requester_user_id,null);
    const memberBooking="42000000-0000-4000-8000-000000000002";
    await act(b);
    await db.query("insert into booking_inquiries(id,dj_profile_id,requester_user_id,requester_name,requester_email,message) values($1,$2,$3,'Member promoter','member@example.com','Please share availability and booking terms.')",[memberBooking,dj,a]);
    await db.exec("reset role");
    assert.equal((await db.query("select requester_user_id from booking_inquiries where id=$1",[memberBooking])).rows[0].requester_user_id,b);
    await act(b);
    await assert.rejects(db.query("select transition_booking($1,'CONTACTED')",[memberBooking]),/Permission denied/);
    await act(a);
    await assert.rejects(db.query("select transition_booking($1,'COMPLETED')",[memberBooking]),/Invalid booking transition/);
    for (const status of ["CONTACTED","NEGOTIATING","CONFIRMED","COMPLETED"])
      await db.query("select transition_booking($1,$2)",[memberBooking,status]);
    assert.equal((await db.query("select count(*)::int as count from booking_status_history where booking_id=$1",[memberBooking])).rows[0].count,4);
    await db.exec("reset role");
    await db.query(
      "insert into media_assets(id,owner_user_id,storage_key,visibility) values(gen_random_uuid(),$1,$2,'PUBLIC'),(gen_random_uuid(),$1,$3,'PRIVATE')",
      [a, a + "/public.png", a + "/private.png"],
    );
    await db.exec("set role anon");
    const publicAssets = (
      await db.query("select storage_key from media_assets")
    ).rows;
    assert.equal(publicAssets.length, 1);
    assert.equal(publicAssets[0].storage_key, a + "/public.png");
    await db.exec("reset role");
    await act(admin);await db.query("select admin_manage_beta_access('invited@example.com','ACTIVE','Founding beta cohort')");
    await db.exec("reset role");assert.equal((await db.query("select status from beta_access where email='invited@example.com'")).rows[0].status,"ACTIVE");
    await act(b);assert.equal((await db.query("select beta_access_status() as status")).rows[0].status,"ACTIVE");
    const privateEvent='71000000-0000-4000-8000-000000000001';
    await act(admin);
    await db.query("insert into events(id,organization_id,title,status,visibility) values($1,$2,'Private event','PUBLISHED','PRIVATE')",[privateEvent,org]);
    await act(b);
    assert.equal((await db.query("select * from events where id=$1",[privateEvent])).rows.length,0);
    await db.exec('reset role');
    await db.query("insert into organization_members values($1,$2,'SCANNER')",[org,b]);
    await act(b);
    assert.equal((await db.query("select * from events where id=$1",[privateEvent])).rows.length,1);
    assert.equal((await db.query("update events set title='Scanner edit' where id=$1 returning id",[privateEvent])).rows.length,0);
    await db.exec('reset role');
    await db.query("delete from organization_members where organization_id=$1 and user_id=$2",[org,b]);
    // Provider page publishing, marketplace visibility and cross-owner boundaries.
    await act(a);
    const assetId = (await db.query("select id from media_assets where visibility='PUBLIC' limit 1")).rows[0].id;
    const pageId = (await db.query("insert into provider_pages(owner_user_id,role,slug,display_name,bio,cover_asset_id) values($1,'venue','test-venue','Test Venue','A venue for independent electronic music events.',$2) returning id",[a,assetId])).rows[0].id;
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from provider_pages")).rows.length,0);
    await act(b);
    assert.equal((await db.query("update provider_pages set display_name='Hijacked' where id=$1 returning id",[pageId])).rows.length,0);
    await assert.rejects(db.query("insert into provider_pages(owner_user_id,role,slug,display_name) values($1,'venue','fake-owner','Fake')",[a]),/row-level security/);
    await act(a);
    await db.query("update provider_pages set status='PUBLISHED' where id=$1",[pageId]);
    const offeringId=(await db.query("insert into provider_offerings(provider_id,title,kind,status,image_asset_id) values($1,'Venue rental','RENTAL','ACTIVE',$2) returning id",[pageId,assetId])).rows[0].id;
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from provider_pages")).rows.length,1);
    assert.equal((await db.query("select * from provider_offerings")).rows.length,1);
    await assert.rejects(db.query("select * from provider_inquiries"),/permission denied/);
    await act(b);
    await assert.rejects(db.query("insert into provider_offerings(provider_id,title,kind) values($1,'Foreign listing','SERVICE')",[pageId]),/row-level security/);
    const inquiryId=(await db.query("insert into provider_inquiries(provider_id,offering_id,requester_user_id,message) values($1,$2,$3,'Please share availability for our event.') returning id",[pageId,offeringId,b])).rows[0].id;
    assert.equal((await db.query("update provider_inquiries set status='CLOSED' where id=$1 returning id",[inquiryId])).rows.length,0);
    await act(a);
    await db.query("update provider_inquiries set status='CONTACTED' where id=$1",[inquiryId]);
    await assert.rejects(db.query("update provider_inquiries set requester_user_id=$1 where id=$2",[a,inquiryId]),/permission denied/);
    await db.query("update provider_pages set status='PAUSED' where id=$1",[pageId]);
    await db.exec("reset role; set role anon");
    assert.equal((await db.query("select * from provider_offerings")).rows.length,0);
    await act(a);
    await assert.rejects(db.query("insert into provider_pages(owner_user_id,role,slug,display_name,status) values($1,'agency','no-cover','No Cover','PUBLISHED')",[a]),/cover image/);
    await act(b);
    await assert.rejects(
      db.query("select admin_list('profiles')"),
      /Permission denied/,
    );
    await assert.rejects(
      db.query("select open_conversation('application',$1)", [application]),
      /Permission denied/,
    );
    await act(a);
    const conversation = (
      await db.query("select open_conversation('application',$1) as id", [
        application,
      ])
    ).rows[0].id;
    const client = "60000000-0000-4000-8000-000000000001";
    const first = (
      await db.query("select send_message($1,$2,$3) as id", [
        conversation,
        "A genuine stored message",
        client,
      ])
    ).rows[0].id;
    const retry = (
      await db.query("select send_message($1,$2,$3) as id", [
        conversation,
        "A genuine stored message",
        client,
      ])
    ).rows[0].id;
    assert.equal(first, retry);
    await assert.rejects(
      db.query(
        "update dj_profiles set verification_status='VERIFIED' where id=$1",
        [dj],
      ),
      /Only platform administration/,
    );
    await act(b);
    assert.equal((await db.query("select * from messages")).rows.length, 0);
    await assert.rejects(
      db.query("select send_message($1,$2,$3)", [
        conversation,
        "Blocked",
        crypto.randomUUID(),
      ]),
      /Permission denied/,
    );
    await act(admin);
    assert.equal((await db.query("select * from messages")).rows.length, 1);
    await assert.rejects(
      db.query("select admin_action('grant_role',$1,'SUPER_ADMIN')", [admin]),
      /Role change forbidden/,
    );
    await assert.rejects(
      db.query("select admin_update_entity($1,$2,$3)", [
        "organizations",
        org,
        { owner_user_id: b },
      ]),
      /Field not editable/,
    );
    await db.query("select admin_update_entity($1,$2,$3)", [
      "organizations",
      org,
      { name: "Updated fixture" },
    ]);
    assert.equal(
      (await db.query("select name from organizations where id=$1", [org]))
        .rows[0].name,
      "Updated fixture",
    );
    const page = {
      slug: "fixture-page",
      language: "ar",
      title: "صفحة اختبار",
      status: "DRAFT",
      blocks: [{ type: "text", body: "محتوى" }],
    };
    await assert.rejects(
      db.query("select admin_save_page($1)", [
        { ...page, blocks: [{ type: "cta", url: "javascript:alert(1)" }] },
      ]),
      /Unsafe link/,
    );
    const pid = (await db.query("select admin_save_page($1) as id", [page]))
      .rows[0].id;
    await db.query("select admin_save_page($1)", [
      { ...page, id: pid, status: "PUBLISHED" },
    ]);
    assert.equal(
      (await db.query("select * from cms_revisions")).rows.length,
      2,
    );
    await assert.rejects(
      db.query("select admin_save_setting($1,$2)", [
        "navigation",
        [{ label: "Bad", url: "//evil.test" }],
      ]),
      /Invalid navigation link/,
    );
    await db.query("select admin_action('suspend',$1,'true')", [a]);
    await act(a);
    assert.equal(
      (await db.query("select account_active() as active")).rows[0].active,
      false,
    );
    await assert.rejects(
      db.query("select begin_ai_request('GENERATE_BIO')"),
      /Account unavailable/,
    );
    await assert.rejects(
      db.query("select send_message($1,$2,$3)", [
        conversation,
        "Suspended",
        crypto.randomUUID(),
      ]),
      /Permission denied/,
    );
    await act(admin);
    await db.query("select admin_action('suspend',$1,'false')", [a]);
    await act(a);
    const vendorId = (
      await db.query(
        "select upsert_vendor_profile($1,$2,$3,$4) as id",
        [org, ["B2B", "B2C"], ["Sound", "Lighting"], ["Riyadh"]],
      )
    ).rows[0].id;
    await db.query(
      "insert into vendor_products(vendor_id,name,category,offering_type,price,inventory_quantity,status) values($1,'Fixture sound rental','Sound','B2B_RENTAL',2500,2,'ACTIVE')",
      [vendorId],
    );
    const rfqId = (
      await db.query(
        "select create_vendor_rfq($1,$2,$3) as id",
        [org, "Need sound and lighting for 300 people", "Riyadh"],
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("select count(*)::int as c from my_cuelance_items"))
        .rows[0].c,
      1,
    );
    await act(b);
    assert.equal(
      (await db.query("select count(*)::int as c from vendor_quote_requests"))
        .rows[0].c,
      0,
    );
    const operationalLog=(await db.query(
      "select record_operational_log('ERROR','test.vendor','Fixture failure',$1) as id",
      [{ resource: "vendor_quote_requests" }],
    )).rows[0].id;
    await assert.rejects(
      db.query("select count(*)::int as c from operational_logs"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select upsert_vendor_profile($1,$2,$3,$4)", [
        org,
        ["B2B"],
        ["Food"],
        ["Jeddah"],
      ]),
      /Permission denied/,
    );
    await act(admin);
    assert.equal(
      (
        await db.query(
          "select (admin_list('operational_logs')->>'total')::int as total",
        )
      ).rows[0].total,
      1,
    );
    await act(b);
    await assert.rejects(db.query("select resolve_operational_log($1,'Unauthorized')",[operationalLog]),/Permission denied/);
    await act(admin);
    await db.query("select resolve_operational_log($1,'Reviewed in workflow validation')",[operationalLog]);
    await db.exec("reset role");
    assert.equal((await db.query("select resolved_at is not null as resolved from operational_logs where id=$1",[operationalLog])).rows[0].resolved,true);
    await act(admin);
    assert.equal(
      (
        await db.query(
          "select (admin_list('vendor_products')->>'total')::int as total",
        )
      ).rows[0].total,
      1,
    );
    assert.ok(rfqId);
    const freeAccess=(await db.query("select entitlement_snapshot(null) as access")).rows[0].access;
    assert.equal(freeAccess.plan,"FREE");
    assert.equal(freeAccess.entitlements["ai.daily"],20);
    await assert.rejects(db.query("select entitlement_snapshot($1)",["90000000-0000-4000-8000-000000000001"]),/Organization access denied/);
    await act(b);
    await assert.rejects(db.query("select admin_set_subscription($1,null,'ARTIST_PRO','ACTIVE',null)",[b]),/Permission denied/);
    await act(admin);
    await db.query("select admin_set_subscription($1,null,'ARTIST_PRO','ACTIVE',now()+interval '30 days')",[a]);
    await act(a);
    const proAccess=(await db.query("select entitlement_snapshot(null) as access")).rows[0].access;
    assert.equal(proAccess.plan,"ARTIST_PRO");
    assert.equal(proAccess.entitlements["epk.templates"],5);
    const checkoutKey="a0000000-0000-4000-8000-000000000001";
    const checkout=(await db.query("select (begin_subscription_checkout('ARTIST_PRO',null,$1)).*",[checkoutKey])).rows[0];
    assert.equal(Number(checkout.amount),79);
    assert.equal(checkout.status,"CREATED");
    assert.equal((await db.query("select (begin_subscription_checkout('ARTIST_PRO',null,$1)).id as id",[checkoutKey])).rows[0].id,checkout.id);
    await db.exec("reset role");
    await db.query("insert into plans(code,name,audience,monthly_price,entitlements,sort_order) values('ARTIST_PLUS','Artist Plus','ARTIST',129,'{}',11)");
    await act(a);
    await assert.rejects(
      db.query("select begin_subscription_checkout('ARTIST_PLUS',null,$1)",[checkoutKey]),
      /Idempotency key already used for another checkout/,
    );
    await db.exec("reset role; set role service_role");
    await db.query("update payment_checkouts set provider_order_id='PAYPAL-ORDER-1',status='PROVIDER_PENDING' where id=$1",[checkout.id]);
    await db.query("select complete_verified_payment('PAYPAL','EVENT-1','PAYMENT.CAPTURE.COMPLETED','PAYPAL-ORDER-1','CAPTURE-1',79,'SAR',$1)",[{verified:true}]);
    await db.exec("reset role");
    assert.equal((await db.query("select status from payment_checkouts where id=$1",[checkout.id])).rows[0].status,"COMPLETED");
    assert.equal((await db.query("select count(*)::int as count from subscriptions where user_id=$1 and status='ACTIVE'",[a])).rows[0].count,1);
    await act(a);
    assert.equal((await db.query("select entitlement_allowed('custom_domain',null) as allowed")).rows[0].allowed,true);
    await act(b);
    assert.equal((await db.query("select * from payment_checkouts")).rows.length,0);
    await assert.rejects(db.query("insert into payment_checkouts(user_id,purpose,provider,amount,currency,plan_code) values($1,'SUBSCRIPTION','PAYPAL',1,'SAR','ARTIST_PRO')",[b]),/permission denied/);
    await db.exec("reset role");
    const paidEvent="72000000-0000-4000-8000-000000000001",paidType="73000000-0000-4000-8000-000000000001";
    await db.query("insert into events(id,organization_id,title,status,visibility,starts_at,approval_required) values($1,$2,'Paid fixture','PUBLISHED','PUBLIC',now()+interval '7 days',false)",[paidEvent,org]);
    await db.query("insert into ticket_types(id,event_id,status,price,currency,capacity,quantity_sold,quantity_reserved,approval_required) values($1,$2,'ACTIVE',125,'SAR',1,0,0,false)",[paidType,paidEvent]);
    await act(a);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:"buyer@example.com"})]);
    const ticketCheckoutKey="a0000000-0000-4000-8000-000000000002";
    const paidCheckout=(await db.query("select (begin_paid_ticket_checkout($1,'buyer@example.com',$2)).*",[paidType,ticketCheckoutKey])).rows[0];
    assert.equal(Number(paidCheckout.amount),125);assert.equal((await db.query("select quantity_reserved from ticket_types where id=$1",[paidType])).rows[0].quantity_reserved,1);
    assert.equal((await db.query("select (begin_paid_ticket_checkout($1,'buyer@example.com',$2)).id as id",[paidType,ticketCheckoutKey])).rows[0].id,paidCheckout.id);
    assert.equal((await db.query("select quantity_reserved from ticket_types where id=$1",[paidType])).rows[0].quantity_reserved,1);
    await assert.rejects(
      db.query("select begin_paid_ticket_checkout($1,'buyer@example.com',$2)",[crypto.randomUUID(),ticketCheckoutKey]),
      /Idempotency key already used for another checkout/,
    );
    await db.exec("reset role; set role service_role");
    await db.query("update payment_checkouts set provider_order_id='PAYPAL-TICKET-1',status='PROVIDER_PENDING' where id=$1",[paidCheckout.id]);
    await db.query("select complete_verified_payment('PAYPAL','EVENT-TICKET-1','PAYMENT.CAPTURE.COMPLETED','PAYPAL-TICKET-1','CAPTURE-TICKET-1',125,'SAR',$1)",[{verified:true}]);
    await db.exec("reset role");
    const inventory=(await db.query("select quantity_sold,quantity_reserved from ticket_types where id=$1",[paidType])).rows[0];assert.equal(inventory.quantity_sold,1);assert.equal(inventory.quantity_reserved,0);
    const issued=(await db.query("select id,holder_user_id from tickets where event_id=$1",[paidEvent])).rows[0];assert.equal(issued.holder_user_id,a);
    await act(a);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:"buyer@example.com"})]);
    const transferToken=(await db.query("select request_ticket_transfer($1,'recipient@example.com') as token",[issued.id])).rows[0].token;
    await act(b);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({email:"recipient@example.com"})]);
    await db.query("select accept_ticket_transfer($1)",[transferToken]);
    const transferred=(await db.query("select holder_user_id,status from tickets where id=$1",[issued.id])).rows[0];assert.equal(transferred.holder_user_id,b);assert.equal(transferred.status,"ACTIVE");assert.equal((await db.query("select auth.uid() as id")).rows[0].id,b);
    const refund=(await db.query("select (request_ticket_refund($1,'Schedule conflict')).*",[issued.id])).rows[0];
    await db.exec("reset role; set role service_role");await db.query("select complete_ticket_refund($1,'REFUND-1',$2)",[refund.id,{status:"COMPLETED"}]);await db.exec("reset role");
    assert.equal((await db.query("select status from tickets where id=$1",[issued.id])).rows[0].status,"REFUNDED");
    assert.equal((await db.query("select quantity_sold from ticket_types where id=$1",[paidType])).rows[0].quantity_sold,0);
    const complimentaryOrder=crypto.randomUUID(),complimentaryTicket=crypto.randomUUID();
    await db.query("insert into ticket_orders(id,event_id,ticket_type_id,user_id,buyer_email,amount,currency,status,quantity) values($1,$2,$3,$4,'provider@example.com',0,'SAR','COMPLETED',1)",[complimentaryOrder,paidEvent,paidType,a]);
    await db.query("insert into tickets(id,order_id,ticket_type_id,event_id,holder_user_id,attendee_email,status,credential_token) values($1,$2,$3,$4,$5,'provider@example.com','ACTIVE',$6)",[complimentaryTicket,complimentaryOrder,paidType,paidEvent,a,crypto.randomUUID()]);
    await act(b);
    await assert.rejects(db.query("select cancel_complimentary_ticket($1)",[complimentaryTicket]),/Ticket not cancellable/);
    await act(a);
    await db.query("select cancel_complimentary_ticket($1)",[complimentaryTicket]);
    assert.equal((await db.query("select status from tickets where id=$1",[complimentaryTicket])).rows[0].status,"CANCELLED");
    await act(b);
    await assert.rejects(db.query("select ticket_reconciliation($1)",[paidEvent]),/Permission denied/);
    await act(admin);
    const reconciliation=(await db.query("select ticket_reconciliation($1) as summary",[paidEvent])).rows[0].summary;
    assert.equal(reconciliation.refunded_orders,1);
    await act(a);await db.query("update provider_pages set status='PUBLISHED' where id=$1",[pageId]);await db.query("update provider_offerings set inventory_mode='TRACKED',stock_quantity=5,minimum_quantity=1,maximum_quantity=5 where id=$1",[offeringId]);
    const catalog=(await db.query("insert into provider_catalogs(provider_id,name,status) values($1,'Venue rentals','ACTIVE') returning id",[pageId])).rows[0].id;
    const attribute=(await db.query("insert into provider_attribute_definitions(provider_id,key,label,data_type,unit) values($1,'capacity','Guest capacity','NUMBER','people') returning id",[pageId])).rows[0].id;
    await db.query("insert into provider_offering_attribute_values values($1,$2,$3)",[offeringId,attribute,300]);await db.query("insert into provider_offering_variants(offering_id,sku,title,price_delta,stock_quantity) values($1,'FULL-DAY','Full day',500,2)",[offeringId]);
    await act(b);const providerOrder=(await db.query("select create_provider_order($1,1,'Venue rental for a private electronic event.','Riyadh',now()+interval '10 days',now()+interval '11 days') as id",[offeringId])).rows[0].id;
    await act(a);await db.query("select provider_quote_order($1,2500,375,1000,'Includes setup and venue operations')",[providerOrder]);
    await act(b);await db.query("select customer_order_action($1,'ACCEPT','Approved')",[providerOrder]);
    const commerceCheckout=(await db.query("select (begin_provider_order_checkout($1,$2)).*",[providerOrder,"a0000000-0000-4000-8000-000000000003"])).rows[0];assert.equal(Number(commerceCheckout.amount),1000);
    assert.equal((await db.query("select (begin_provider_order_checkout($1,$2)).id as id",[providerOrder,"a0000000-0000-4000-8000-000000000003"])).rows[0].id,commerceCheckout.id);
    await assert.rejects(
      db.query("select begin_provider_order_checkout($1,$2)",[crypto.randomUUID(),"a0000000-0000-4000-8000-000000000003"]),
      /Idempotency key already used for another checkout/,
    );
    await db.exec("reset role;set role service_role");await db.query("update payment_checkouts set provider_order_id='PAYPAL-PROVIDER-1',status='PROVIDER_PENDING' where id=$1",[commerceCheckout.id]);await db.query("select complete_provider_order_payment('PAYPAL-PROVIDER-1','CAPTURE-PROVIDER-1',1000,'SAR',$1)",[{verified:true}]);await db.exec("reset role");
    assert.equal((await db.query("select status from provider_orders where id=$1",[providerOrder])).rows[0].status,"DEPOSIT_PAID");assert.ok(catalog);
    await db.query("update feature_flags set enabled=false where key='payments_enabled'");
    await act(b);
    await assert.rejects(db.query("select begin_provider_order_checkout($1,$2)",[providerOrder,"a0000000-0000-4000-8000-000000000004"]),/Payments are disabled/);
    await db.exec("reset role");
    await db.query("update feature_flags set enabled=true where key='payments_enabled'");
    await act(b);
    const balanceCheckout=(await db.query("select (begin_provider_order_checkout($1,$2)).*",[providerOrder,"a0000000-0000-4000-8000-000000000005"])).rows[0];
    assert.equal(Number(balanceCheckout.amount),1875);
    await db.exec("reset role;set role service_role");
    await db.query("update payment_checkouts set provider_order_id='PAYPAL-PROVIDER-2',status='PROVIDER_PENDING' where id=$1",[balanceCheckout.id]);
    await db.query("select complete_provider_order_payment('PAYPAL-PROVIDER-2','CAPTURE-PROVIDER-2',1875,'SAR',$1)",[{verified:true}]);
    await db.exec("reset role");
    assert.equal((await db.query("select status from provider_orders where id=$1",[providerOrder])).rows[0].status,"CONFIRMED");
    await act(a);
    await assert.rejects(db.query("select provider_fulfillment_action($1,'FULFILLED','Skipped work')",[providerOrder]),/Invalid fulfilment transition/);
    for (const status of ["SCHEDULED","IN_PROGRESS","FULFILLED"])
      await db.query("select provider_fulfillment_action($1,$2,'Validated transition')",[providerOrder,status]);
    await act(b);
    await db.query("select customer_order_action($1,'ACCEPT_DELIVERY','Delivery accepted')",[providerOrder]);
    assert.equal((await db.query("select status from provider_orders where id=$1",[providerOrder])).rows[0].status,"COMPLETED");
    await db.exec("reset role");
    assert.ok(Number((await db.query("select count(*) as count from user_notifications")).rows[0].count)>=2);assert.ok(Number((await db.query("select count(*) as count from notification_outbox")).rows[0].count)>=2);
    await act(admin);const roster=(await db.query("insert into agency_roster(organization_id,artist_profile_id,stage_name,genres,base_fee) values($1,$2,'Fixture DJ',array['Tech House'],5000) returning id",[org,dj])).rows[0].id;
    await db.query("insert into agency_calendar_items(organization_id,roster_id,kind,title,starts_at,ends_at,status,created_by) values($1,$2,'HOLD','Festival hold',now()+interval '20 days',now()+interval '21 days','TENTATIVE',$3)",[org,roster,admin]);
    const agencyOffer=(await db.query("insert into agency_offers(organization_id,roster_id,title,counterparty_name,event_name,fee,currency,terms,created_by) values($1,$2,'Festival headline','Fixture Promoter','Fixture Festival',9000,'SAR','Ninety minute performance with approved rider.',$3) returning id",[org,roster,admin])).rows[0].id;
    await db.query("select agency_transition_offer($1,'SENT','Ready for artist approval')",[agencyOffer]);await act(a);await db.query("select agency_artist_offer_response($1,true,'Approved')",[agencyOffer]);
    await act(admin);const contract=(await db.query("insert into agency_contracts(organization_id,offer_id,title,body,created_by) values($1,$2,'Performance agreement','Complete performance agreement with payment, cancellation, travel and rider terms.',$3) returning id",[org,agencyOffer,admin])).rows[0].id;
    await db.query("select agency_send_contract($1)",[contract]);await db.query("select agency_sign_contract($1,'AGENCY')",[contract]);await act(a);await db.query("select agency_sign_contract($1,'ARTIST')",[contract]);await db.exec("reset role");assert.equal((await db.query("select status from agency_contracts where id=$1",[contract])).rows[0].status,"EXECUTED");
    await act(a);
    const customDomain=(await db.query("select request_custom_domain('artist-example.com','PROVIDER_PAGE',$1,null,'EXTERNAL') as id",[pageId])).rows[0].id;
    assert.equal((await db.query("select status from custom_domains where id=$1",[customDomain])).rows[0].status,"REQUESTED");
    await act(b);assert.equal((await db.query("select * from custom_domains where id=$1",[customDomain])).rows.length,0);
    await assert.rejects(db.query("select request_domain_verification($1)",[customDomain]),/Domain permission denied/);
    await act(a);await db.query("select request_domain_verification($1)",[customDomain]);
    assert.equal((await db.query("select status from custom_domains where id=$1",[customDomain])).rows[0].status,"VERIFYING");
    const queuedAsset=crypto.randomUUID();await db.exec("reset role");await db.query("insert into media_assets(id,owner_user_id,storage_key,visibility,kind,mime_type) values($1,$2,$3,'PRIVATE','IMAGE','image/png')",[queuedAsset,a,a+'/queued.png']);
    await db.exec("set role service_role");
    const mediaJob=(await db.query("select id,status from claim_platform_jobs(array['IMAGE_THUMBNAIL'],1)")).rows[0];assert.equal(mediaJob.status,"PROCESSING");
    await db.query("select finish_platform_job($1,true,$2,null)",[mediaJob.id,{storageKey:a+'/thumb.webp'}]);
    assert.equal((await db.query("select status from platform_jobs where id=$1",[mediaJob.id])).rows[0].status,"COMPLETED");
    await db.exec("reset role");
    const aiRequests=[];
    for (let i = 0; i < 3; i++)
      aiRequests.push((await db.query("select begin_ai_request('GENERATE_BIO') as id")).rows[0].id);
    await assert.rejects(
      db.query("select begin_ai_request('GENERATE_BIO')"),
      /allowance reached/,
    );
    await act(b);
    await db.query("select finish_ai_request($1,'COMPLETED',10,20)",[aiRequests[0]]);
    await db.exec("reset role");
    assert.equal((await db.query("select status from ai_requests where id=$1",[aiRequests[0]])).rows[0].status,"PENDING");
    await act(a);
    await db.query("select finish_ai_request($1,'COMPLETED',10,20)",[aiRequests[0]]);
    await db.exec("reset role");
    assert.equal((await db.query("select status,input_tokens,output_tokens from ai_requests where id=$1",[aiRequests[0]])).rows[0].status,"COMPLETED");
    await db.exec("reset role");
    const protectedFunctions = [
      "claim_notification_batch(integer)",
      "finish_notification_delivery(uuid,boolean,text)",
      "complete_verified_payment(text,text,text,text,text,numeric,text,jsonb)",
      "complete_ticket_refund(uuid,text,jsonb)",
      "complete_provider_order_payment(text,text,numeric,text,jsonb)",
      "claim_platform_jobs(text[],integer)",
      "finish_platform_job(uuid,boolean,jsonb,text)",
    ];
    for (const signature of protectedFunctions) {
      const privileges = (await db.query(
        "select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as authenticated,has_function_privilege('service_role',$1,'execute') as service",
        [`public.${signature}`],
      )).rows[0];
      assert.equal(privileges.anon,false,`${signature} must reject anon`);
      assert.equal(privileges.authenticated,false,`${signature} must reject authenticated`);
      assert.equal(privileges.service,true,`${signature} must allow service_role`);
    }
    for (const signature of [
      "begin_subscription_checkout(text,uuid,uuid)",
      "begin_paid_ticket_checkout(uuid,text,uuid)",
      "begin_provider_order_checkout(uuid,uuid)",
    ]) {
      const privileges = (await db.query(
        "select has_function_privilege('anon',$1,'execute') as anon,has_function_privilege('authenticated',$1,'execute') as authenticated",
        [`public.${signature}`],
      )).rows[0];
      assert.equal(privileges.anon,false,`${signature} must reject anon`);
      assert.equal(privileges.authenticated,true,`${signature} must allow authenticated users`);
    }
    const migrationTables = [
      "agency_calendar_items","agency_contracts","agency_deal_documents","agency_deal_messages","agency_offer_history","agency_offers","agency_roster",
      "ai_requests","beta_access","booking_status_history","cms_revisions","conversation_members","conversations","custom_domains","domain_dns_records",
      "entitlement_overrides","media_derivatives","messages","my_cuelance_items","notification_outbox","operational_logs","payment_checkouts","payment_events",
      "payment_refunds","plans","platform_jobs","platform_settings","provider_attribute_definitions","provider_catalogs","provider_inquiries",
      "provider_offering_attribute_values","provider_offering_availability","provider_offering_variants","provider_offerings","provider_order_deliverables",
      "provider_order_history","provider_orders","provider_pages","subscriptions","ticket_transfers","user_notifications","vendor_products","vendor_profiles",
      "vendor_quote_requests","vendor_quotes",
    ];
    for (const table of migrationTables) {
      const row=(await db.query("select c.relrowsecurity as enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=$1",[table])).rows[0];
      assert.ok(row,`${table} must exist after all migrations`);
      assert.equal(row.enabled,true,`${table} must have RLS enabled`);
    }
    const unsafeSearchPath=(await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) setting where setting like 'search_path=%') order by p.proname")).rows;
    assert.deepEqual(unsafeSearchPath,[],"Every public security-definer function must pin search_path");
    const anonymousDefiners=(await db.query("select distinct p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'execute') order by p.proname")).rows.map(row=>row.proname);
    assert.deepEqual(anonymousDefiners,["feature_enabled","get_public_epk"]);
  } finally {
    await db.close();
  }
});
