/** Real service smoke test. Requires explicitly supplied demo credentials; never uses production secrets. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jbnunnejqvvrwxewljdc.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_WwF5eEz4xTwImwW6qKdeWg_Pq2atwU8";
const base = process.env.TEST_APP_URL || "http://127.0.0.1:3002";
const anonymous = createClient(url, key, { auth: { persistSession: false } });
const db = createClient(url, key, { auth: { persistSession: false } });
const checks = [];
function ok(name) {
  checks.push(name);
  console.log("PASS", name);
}
const auth = await db.auth.signInWithPassword({
  email: process.env.TEST_EMAIL,
  password: process.env.TEST_PASSWORD,
});
assert.ifError(auth.error);
const token = auth.data.session.access_token;
ok("Demo account authenticates");
let result = await anonymous.rpc("admin_list", { p_entity: "profiles" });
assert.ok(result.error);
ok("Anonymous administration denied");
result = await anonymous.from("messages").select("*");
assert.ok(!result.data?.length);
ok("Anonymous conversation data denied");
result = await db.rpc("platform_admin");
assert.equal(result.data, true);
ok("Authorized admin recognized");
result = await db.rpc("admin_list", { p_entity: "profiles" });
assert.ifError(result.error);
assert.ok(Array.isArray(result.data.rows));
ok("Admin paginated records load");
result = await db.rpc("admin_action", {
  p_action: "grant_role",
  p_id: auth.data.user.id,
  p_value: "SUPER_ADMIN",
});
assert.ok(result.error);
ok("Self role escalation denied");
result = await db.rpc("open_conversation", {
  p_kind: "booking",
  p_resource: crypto.randomUUID(),
});
assert.ok(result.error);
ok("Unrelated conversation creation denied");
result = await db.rpc("send_message", {
  p_conversation: crypto.randomUUID(),
  p_body: "Not delivered",
  p_client: crypto.randomUUID(),
});
assert.ok(result.error);
ok("Unrelated message denied");
let response = await fetch(base + "/api/v1/ai/write", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Test without authentication" }),
});
assert.equal(response.status, 401);
ok("Unauthenticated AI request denied");
response = await fetch(base + "/api/v1/ai/write", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ text: "x", action: "INVALID" }),
});
assert.equal(response.status, 400);
ok("Invalid AI input rejected before provider use");
response = await fetch(base + "/api/v1/media/complete", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    key: crypto.randomUUID() + "/file.pdf",
    name: "test.pdf",
    alt: "",
  }),
});
assert.equal(response.status, 403);
ok("Cross-owner media registration denied");
const { data: epks, error } = await db
  .from("epks")
  .select("slug")
  .eq("status", "PUBLISHED")
  .limit(1);
assert.ifError(error);
assert.ok(epks.length);
result = await anonymous.rpc("get_public_epk", { p_slug: epks[0].slug });
assert.ifError(result.error);
assert.ok(result.data);
assert.ok(!("user_id" in result.data.dj));
assert.ok(
  result.data.sections.every((s) => s.visibility === "PUBLIC" && s.enabled),
);
ok("Public snapshot excludes private sections and owner ID");
response = await fetch(base + `/api/v1/epks/${epks[0].slug}/pdf`);
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type"), /application\/pdf/);
const pdf = Buffer.from(await response.arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
assert.ok(pdf.length > 2000);
ok("Published EPK generates a real PDF");
response = await fetch(base + "/guide");
assert.equal(response.status, 200);
assert.match(await response.text(), /Cuelance user guide/);
ok("Full guide route renders");
// Publishing test content is opt-in and removed from public view immediately after verification.
if (process.env.TEST_WRITES === "1") {
  const suffix = Date.now().toString(36);
  let pageId;
  const membership = await db
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.data.user.id)
    .eq("role", "OWNER")
    .limit(1);
  const event = await db
    .from("events")
    .select("id")
    .eq("organization_id", membership.data[0].organization_id)
    .in("status", ["PUBLISHED", "LIVE"])
    .eq("approval_required", false)
    .limit(1);
  if (event.data?.length) {
    const eventId = event.data[0].id;
    const type = await db
      .from("ticket_types")
      .insert({
        event_id: eventId,
        name: `Validation capacity ${suffix}`,
        price: 0,
        currency: "SAR",
        capacity: 1,
        status: "ACTIVE",
      })
      .select("id")
      .single();
    assert.ifError(type.error);
    const reservations = await Promise.all(
      [1, 2].map(() =>
        db.rpc("reserve_ticket", {
          p_ticket_type: type.data.id,
          p_buyer_email: auth.data.user.email,
        }),
      ),
    );
    assert.equal(reservations.filter((r) => !r.error).length, 1);
    assert.ok(reservations.some((r) => r.error?.message.includes("sold_out")));
    ok("Concurrent reservations do not oversell capacity one");
    const ticketId = reservations.find((r) => !r.error).data;
    const ticket = await db
      .from("tickets")
      .select("credential_token")
      .eq("id", ticketId)
      .single();
    assert.ifError(ticket.error);
    const scans = await Promise.all(
      [1, 2].map((i) =>
        db.rpc("validate_ticket_checkin", {
          p_event: eventId,
          p_token: ticket.data.credential_token,
          p_device: `validation-${i}`,
        }),
      ),
    );
    assert.deepEqual(scans.map((s) => s.data).sort(), [
      "ALREADY_CHECKED_IN",
      "VALID",
    ]);
    ok("Concurrent scans admit exactly once");
  }
  const page = {
    slug: `validation-${suffix}`,
    title: "Cuelance validation page",
    language: "en",
    status: "DRAFT",
    seo_title: "Validation",
    seo_description: "Temporary automated validation",
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "text",
        heading: "Validation",
        body: "Persisted page content",
        url: "",
        alt: "",
      },
    ],
  };
  try {
    result = await db.rpc("admin_save_page", { p_document: page });
    assert.ifError(result.error);
    pageId = result.data;
    ok("CMS draft persists");
    const hidden = await anonymous
      .from("cms_pages")
      .select("id")
      .eq("id", pageId);
    assert.equal(hidden.data?.length, 0);
    ok("CMS draft hidden from visitors");
    result = await db.rpc("admin_save_page", {
      p_document: { ...page, id: pageId, status: "PUBLISHED" },
    });
    assert.ifError(result.error);
    response = await fetch(base + `/pages/en/${page.slug}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Persisted page content/);
    ok("Published CMS blocks render publicly");
    const revisions = await db
      .from("cms_revisions")
      .select("id")
      .eq("page_id", pageId);
    assert.ifError(revisions.error);
    assert.equal(revisions.data.length, 2);
    ok("CMS save creates revision history");
  } finally {
    if (pageId)
      await db.rpc("admin_save_page", {
        p_document: { ...page, id: pageId, status: "ARCHIVED" },
      });
  }
  // Only use a context whose artist AND organization owner are this demo user.
  const own = await db
    .from("applications")
    .select(
      "id,dj_profiles!inner(user_id),opportunities!inner(organizations!inner(owner_user_id))",
    )
    .eq("dj_profiles.user_id", auth.data.user.id)
    .eq("opportunities.organizations.owner_user_id", auth.data.user.id)
    .limit(1);
  if (own.data?.length) {
    result = await db.rpc("open_conversation", {
      p_kind: "application",
      p_resource: own.data[0].id,
    });
    assert.ifError(result.error);
    const id = result.data;
    const client = crypto.randomUUID();
    const payload = {
      p_conversation: id,
      p_body: "Automated Cuelance workflow validation. No action needed.",
      p_client: client,
    };
    const first = await db.rpc("send_message", payload);
    assert.ifError(first.error);
    const second = await db.rpc("send_message", payload);
    assert.equal(first.data, second.data);
    ok("Authorized message persists once on retry");
  }
  const storageKey = auth.data.user.id + "/" + crypto.randomUUID() + ".png";
  let assetId;
  try {
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    );
    result = await db.storage
      .from("media")
      .upload(storageKey, image, { contentType: "image/png" });
    assert.ifError(result.error);
    ok("Authenticated file upload succeeds");
    const denied = await anonymous.storage.from("media").download(storageKey);
    assert.ok(denied.error);
    ok("Private upload denied to anonymous visitor");
    response = await fetch(base + "/api/v1/media/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        key: storageKey,
        name: "validation.png",
        alt: "Test pixel",
      }),
    });
    assert.equal(response.status, 200);
    assetId = (await response.json()).id;
    ok("Server verifies and persists media metadata");
    response = await fetch(base + `/api/v1/media/${assetId}`, {
      redirect: "manual",
    });
    assert.equal(response.status, 404);
    ok("Private asset route does not disclose storage link");
    result = await db
      .from("media_assets")
      .update({ visibility: "PUBLIC" })
      .eq("id", assetId);
    assert.ifError(result.error);
    response = await fetch(base + `/api/v1/media/${assetId}`, {
      redirect: "manual",
    });
    assert.equal(response.status, 302);
    assert.match(response.headers.get("location"), /token=/);
    ok("Public asset uses an expiring signed URL");
  } finally {
    if (assetId) await db.from("media_assets").delete().eq("id", assetId);
    await db.storage.from("media").remove([storageKey]);
  }
}
await db.auth.signOut();
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
