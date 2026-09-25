import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
// Isolated PostgreSQL fixture for the new migrations and permission rules.
// Production concurrency is checked separately by modules-smoke.mjs.
test("New module migrations enforce member/admin boundaries and validation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema private; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
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
 create table public.opportunities(id uuid primary key,organization_id uuid,title text,description text,city text,country text,status text);
 create table public.applications(id uuid primary key,dj_profile_id uuid,opportunity_id uuid);
 create table public.booking_inquiries(id uuid,dj_profile_id uuid,requester_user_id uuid,requester_name text,organization_name text);
 create table public.events(id uuid primary key,organization_id uuid,title text,description text,venue text,address text,city text,country text,status text,visibility text,starts_at timestamptz,approval_required boolean default false);
 create table public.communities(id uuid primary key,name text,description text,visibility text,membership_mode text,status text);
 create table public.community_members(id uuid,community_id uuid,user_id uuid,status text);
 create table public.ticket_types(id uuid primary key,event_id uuid,status text,approval_required boolean default false,sales_start timestamptz,sales_end timestamptz);
 create table public.ticket_orders(id uuid);
 create table public.tickets(id uuid primary key,status text,credential_token uuid);
 create table public.checkins(id uuid,scanner_user_id uuid,checked_in_at timestamptz);
 create table public.feature_flags(key text primary key,enabled boolean,updated_at timestamptz default now());
 create table public.media_assets(id uuid primary key,owner_user_id uuid,storage_key text,visibility text,kind text default 'IMAGE');
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
    for (const file of [
      "20260922000100_guided_platform_modules.sql",
      "20260922000200_public_assets_and_guards.sql",
      "20260922000300_artist_translations.sql",
      "20260922000400_admin_resource_commands.sql",
      "20260922000500_module_configuration_guards.sql",
      "20260922000600_public_media_metadata.sql",
      "20260924000100_vendor_marketplaces_my_cuelance.sql",
      "20260924000200_operational_logging.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "grant select,insert,update,delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon;",
    );
    await db.exec(readFileSync(new URL('../supabase/migrations/20260925113604_provider_pages_and_offerings.sql',import.meta.url),'utf8'));
    await db.exec("alter table public.events enable row level security; alter table public.ticket_types enable row level security;");
    await db.exec(readFileSync(new URL('../supabase/migrations/20260925114743_event_visibility_and_staff_boundaries.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20260925115248_provider_admin_visibility_and_rpc_grants.sql',import.meta.url),'utf8'));
    const admin = "10000000-0000-4000-8000-000000000001",
      a = "10000000-0000-4000-8000-000000000002",
      b = "10000000-0000-4000-8000-000000000003";
    const org = "20000000-0000-4000-8000-000000000001",
      dj = "30000000-0000-4000-8000-000000000001",
      op = "40000000-0000-4000-8000-000000000001",
      application = "50000000-0000-4000-8000-000000000001";
    await db.query("insert into profiles(id) values($1),($2),($3)", [
      admin,
      a,
      b,
    ]);
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
    const act = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const privateEvent='71000000-0000-4000-8000-000000000001';
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
    await db.query(
      "select record_operational_log('ERROR','test.vendor','Fixture failure',$1)",
      [{ resource: "vendor_quote_requests" }],
    );
    assert.equal(
      (await db.query("select count(*)::int as c from operational_logs")).rows[0]
        .c,
      0,
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
    assert.equal(
      (
        await db.query(
          "select (admin_list('vendor_products')->>'total')::int as total",
        )
      ).rows[0].total,
      1,
    );
    assert.ok(rfqId);
    for (let i = 0; i < 3; i++)
      await db.query("select begin_ai_request('GENERATE_BIO')");
    await assert.rejects(
      db.query("select begin_ai_request('GENERATE_BIO')"),
      /allowance reached/,
    );
  } finally {
    await db.close();
  }
});
