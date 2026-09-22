import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const compiled = ts.transpile(
  readFileSync(
    new URL("../modules/checkin/application/credential.ts", import.meta.url),
    "utf8",
  ),
  { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
);
const { parseCredential } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const token = "842c42fe-e8cf-4cdb-a702-8d69b76c0a9c";
test("Wallet QR and manual credential resolve to the same opaque token", () => {
  assert.equal(parseCredential("cuelance:ticket:" + token), token);
  assert.equal(parseCredential(" " + token + " "), token);
});
test("Malformed scans never become validation requests", () => {
  for (const value of [
    "12345",
    "https://example.com/" + token,
    '{"email":"attendee@example.test"}',
    "javascript:alert(1)",
    "cuelance:ticket:",
    "cuelance:ticket:" + token + "?extra=1",
  ])
    assert.throws(() => parseCredential(value));
});
