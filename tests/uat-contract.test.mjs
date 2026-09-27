import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("UAT provisioner is admin-only and never hard-codes passwords", () => {
  const route = source("app/api/v1/admin/uat/accounts/route.ts");
  assert.match(route, /caller\.rpc\("platform_admin"\)/);
  assert.match(route, /randomBytes\(18\)/);
  assert.match(route, /email_confirm:\s*true/);
  assert.match(route, /Cache-Control.*no-store/s);
  assert.doesNotMatch(route, /password:\s*["'][^"']+["']/);
});

test("UAT suite contains isolated accounts for every beta persona", () => {
  const route = source("app/api/v1/admin/uat/accounts/route.ts");
  for (const persona of ["fan", "artist", "promoter", "venue", "community", "provider", "agency", "scanner", "support", "admin"])
    assert.match(route, new RegExp(`key: ["']${persona}["']`));
  assert.equal((route.match(/@cuelance\.com/g) || []).length, 10);
});

test("UAT playbook covers role-to-role, mobile, RTL and severity feedback", () => {
  const playbook = source("docs/CONTROLLED_BETA_UAT_PLAYBOOK.md");
  for (let id = 1; id <= 10; id += 1)
    assert.match(playbook, new RegExp(`UAT-${String(id).padStart(2, "0")}`));
  for (const requirement of ["Arabic", "RTL", "iPhone Safari", "S1", "S2", "PASS", "FAIL", "BLOCKED", "CONFUSING"])
    assert.match(playbook, new RegExp(requirement));
});

test("existing platform admins can recover from a missing beta-status RPC", () => {
  const workspace = source("app/workspace/page.tsx");
  assert.match(workspace, /if\(error\)\{const admin=await supabase\.rpc\("platform_admin"\)/);
  assert.match(workspace, /if\(admin\.data===true\)status="ACTIVE"/);
});
