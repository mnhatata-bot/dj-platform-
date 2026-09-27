import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const includesAll = (contents, labels, context) => {
  for (const label of labels)
    assert.ok(contents.includes(label), `${context} is missing ${label}`);
};

test("flexible catalogue exposes every supported sale/service dimension", () => {
  const editor = source("modules/providers/ui/editor.tsx");
  const catalogue = source("modules/providers/ui/catalog-manager.tsx");
  includesAll(editor, ["SERVICE", "PRODUCT", "RENTAL", "EXPERIENCE"], "listing kinds");
  includesAll(
    catalogue,
    ["TEXT", "NUMBER", "BOOLEAN", "SELECT", "MULTISELECT", "DATE", "DURATION"],
    "custom attributes",
  );
  includesAll(
    catalogue,
    ["FIXED", "FROM", "QUOTE", "HOURLY", "DAILY", "PER_PERSON", "PER_UNIT"],
    "pricing models",
  );
  includesAll(catalogue, ["UNLIMITED", "TRACKED", "SCHEDULED"], "inventory modes");
  includesAll(
    catalogue,
    ["Add catalogue", "Add attribute", "Save commerce settings", "Add availability", "Add variant"],
    "catalogue controls",
  );
});
test("provider order buttons cover quote, payment, fulfilment and acceptance", () => {
  const orders = source("modules/providers/ui/orders.tsx");
  includesAll(
    orders,
    [
      "Accept quote",
      "Pay balance",
      "Pay securely",
      "Accept delivery",
      "Cancel",
      "Send quote",
      "Schedule",
      "Start",
      "Mark fulfilled",
    ],
    "provider order workflow",
  );
});

test("ticket, agency, membership and application controls match state machines", () => {
  const wallet = source("modules/ticketing/ui/wallet.tsx");
  includesAll(wallet, ["Transfer", "Request refund", "Cancel ticket"], "ticket wallet");

  const agency = source("modules/agency/ui/agency-os.tsx");
  includesAll(
    agency,
    ["Add to roster", "Create draft offer", "Send", "Negotiate", "Accept", "Decline"],
    "agency desk",
  );
  const artistAgency = source("modules/agency/ui/artist-agency-desk.tsx");
  includesAll(artistAgency, ["Approve offer", "Decline", "Artist sign"], "artist agency desk");

  const workspace = source("app/workspace/page.tsx");
  includesAll(workspace, ["Mark viewed", "Shortlist", "Select artist"], "application pipeline");
  includesAll(workspace, ["Approve", "Reject", "Suspend", "Restore"], "membership queue");
  includesAll(workspace, ["Contacted", "Negotiate", "Confirm", "Complete", "Cancel"], "booking pipeline");
});

test("controlled beta states and limitations remain visible", () => {
  const workspace = source("app/workspace/page.tsx");
  assert.match(workspace, /CONTROLLED BETA/);
  assert.match(workspace, /Access approval required/);
  const domains = source("modules/domains/ui/manager.tsx");
  assert.match(domains, /Automatic purchase is disabled during the controlled beta/);
  for (const path of [
    "app/api/v1/payments/subscriptions/checkout/route.ts",
    "app/api/v1/payments/tickets/checkout/route.ts",
    "app/api/v1/payments/providers/checkout/route.ts",
  ])
    assert.match(source(path), /Payments are disabled during the controlled beta/);
});
