import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("global UI supports keyboard focus, reduced motion, mobile and RTL", () => {
  const css = source("app/globals.css");
  assert.match(css, /a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\[dir="rtl"\]/);
  assert.match(css, /overflow-x: auto/);
});
test("locale changes synchronize document language and direction", () => {
  const localization = source("modules/localization/ui/provider.tsx");
  assert.match(localization, /document\.documentElement\.lang = locale/);
  assert.match(
    localization,
    /document\.documentElement\.dir = locale === "ar" \? "rtl" : "ltr"/,
  );
  assert.match(localization, /lang=\{locale === "en" \? "ar" : "en"\}/);
});

test("heavy camera, QR and workspace modules stay behind dynamic imports", () => {
  const workspace = source("app/workspace/page.tsx");
  for (const moduleName of [
    "CameraScanner",
    "Wallet",
    "Writer",
    "MediaLibrary",
    "Inbox",
    "AdminConsole",
    "AgencyOS",
    "DomainManager",
  ])
    assert.match(
      workspace,
      new RegExp(`const ${moduleName} = dynamic\\(`),
      `${moduleName} must be code-split`,
    );
  assert.match(source("modules/ticketing/ui/wallet.tsx"), /await import\("qrcode"\)/);
  assert.match(source("modules/checkin/ui/scanner.tsx"), /await import\("@zxing\/browser"\)/);
});

test("public visuals, ticket QR and camera expose accessible alternatives", () => {
  const visual = source("modules/providers/ui/visual.tsx");
  assert.match(visual, /<img src=\{src\} alt=\{alt\}/);
  const wallet = source("modules/ticketing/ui/wallet.tsx");
  assert.match(wallet, /className="ticket-qr"[^>]+alt=\{t\("wallet\.title"\)\}/);
  const scanner = source("modules/checkin/ui/scanner.tsx");
  assert.match(scanner, /<video[\s\S]+aria-label=\{t\("scanner\.title"\)\}/);
});
