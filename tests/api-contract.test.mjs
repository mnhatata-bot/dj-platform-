import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("protected payment routes authenticate before parsing or provider checks", () => {
  for (const path of [
    "app/api/v1/payments/subscriptions/checkout/route.ts",
    "app/api/v1/payments/tickets/checkout/route.ts",
    "app/api/v1/payments/tickets/refund/route.ts",
    "app/api/v1/payments/providers/checkout/route.ts",
    "app/api/v1/payments/paypal/capture/route.ts",
  ]) {
    const route = source(path);
    const authentication = route.indexOf("await authenticate(request)");
    const parsing = route.indexOf("await request.json()");
    assert.ok(authentication >= 0, `${path} must authenticate`);
    assert.ok(parsing > authentication, `${path} must authenticate before parsing`);
    const availability = route.indexOf("paymentCheckoutAvailable(");
    if (availability >= 0)
      assert.ok(
        availability > authentication,
        `${path} must authenticate before checking payment availability`,
      );
    const configured = route.indexOf("paypal.configured()");
    if (configured >= 0)
      assert.ok(
        configured > authentication,
        `${path} must authenticate before checking provider configuration`,
      );
  }
});
test("cron handlers require a constant-time bearer-secret comparison", () => {
  for (const path of [
    "app/api/v1/jobs/notifications/route.ts",
    "app/api/v1/jobs/domains/route.ts",
    "app/api/v1/jobs/media/route.ts",
  ]) {
    const route = source(path);
    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /timingSafeEqual\(a, b\)/);
    assert.match(route, /if \(!expected \|\| !supplied\) return false/);
    assert.ok(
      route.indexOf("if (!authorized(request))") < route.indexOf("adminDatabase()"),
      `${path} must authorize before opening the admin database`,
    );
  }
});

test("webhooks verify signatures and media completion verifies ownership and bytes", () => {
  const webhook = source("app/api/v1/payments/paypal/webhook/route.ts");
  assert.ok(webhook.indexOf("verifyWebhook(request,payload)") >= 0);
  assert.ok(
    webhook.indexOf("verifyWebhook(request,payload)") <
      webhook.indexOf("adminDatabase()"),
  );

  const media = source("app/api/v1/media/complete/route.ts");
  assert.match(media, /input\.key\.startsWith\(user\.id \+ "\/"\)/);
  assert.match(media, /fileTypeFromBuffer\(buffer\)/);
  assert.match(media, /file\.size > 26214400/);
  assert.match(media, /createHash\("sha256"\)/);
});

test("server secrets are never read from NEXT_PUBLIC variables", () => {
  const admin = source("lib/server-admin.ts");
  const paypal = source("modules/payments/infrastructure/paypal.ts");
  const notification = source("modules/notifications/infrastructure/email.ts");
  for (const [name, contents] of [
    ["server admin", admin],
    ["PayPal", paypal],
    ["email", notification],
  ])
    assert.doesNotMatch(
      contents,
      /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|TOKEN|PASSWORD|PRIVATE)/,
      `${name} must not expose server secrets`,
    );
});
