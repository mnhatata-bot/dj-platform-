import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminDatabase } from "@/lib/server-admin";
import { apiError, database } from "@/lib/server-auth";

export const runtime = "nodejs";

const RequestBody = z.object({ resetExisting: z.boolean().default(false) });

const suite = [
  { key: "fan", email: "uat.fan@cuelance.com", name: "UAT Fan", role: "USER" },
  { key: "artist", email: "uat.artist@cuelance.com", name: "UAT Artist", role: "DJ" },
  { key: "promoter", email: "uat.promoter@cuelance.com", name: "UAT Promoter", role: "PROMOTER" },
  { key: "venue", email: "uat.venue@cuelance.com", name: "UAT Venue", role: "ORGANIZATION_ADMIN" },
  { key: "community", email: "uat.community@cuelance.com", name: "UAT Community Manager", role: "COMMUNITY_MANAGER" },
  { key: "provider", email: "uat.provider@cuelance.com", name: "UAT Provider", role: "USER" },
  { key: "agency", email: "uat.agency@cuelance.com", name: "UAT Agency", role: "ORGANIZATION_ADMIN" },
  { key: "scanner", email: "uat.scanner@cuelance.com", name: "UAT Scanner", role: "EVENT_STAFF" },
  { key: "support", email: "uat.support@cuelance.com", name: "UAT Support", role: "PLATFORM_SUPPORT" },
  { key: "admin", email: "uat.admin@cuelance.com", name: "UAT Platform Admin", role: "PLATFORM_ADMIN" },
] as const;

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
}

function temporaryPassword() {
  return `Cu!${randomBytes(18).toString("base64url")}`;
}

export async function POST(request: Request) {
  try {
    const token = bearer(request);
    if (!token) throw new Error("UNAUTHORIZED");
    const caller = database(token);
    const { data: identity, error: identityError } = await caller.auth.getUser(token);
    if (identityError || !identity.user) throw new Error("UNAUTHORIZED");
    const { data: allowed, error: permissionError } = await caller.rpc("platform_admin");
    if (permissionError || allowed !== true) throw new Error("FORBIDDEN");

    const parsed = RequestBody.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

    const admin = adminDatabase();
    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existingByEmail = new Map(
      usersPage.users.map((user) => [user.email?.toLowerCase(), user]),
    );
    const credentials: Array<Record<string, string | boolean | null>> = [];

    for (const account of suite) {
      let user = existingByEmail.get(account.email);
      let password: string | null = null;
      let created = false;
      if (!user) {
        password = temporaryPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email: account.email,
          password,
          email_confirm: true,
          user_metadata: { display_name: account.name, uat_account: true },
          app_metadata: { uat_account: true },
        });
        if (error || !data.user) throw error || new Error(`Could not create ${account.key}`);
        user = data.user;
        created = true;
      } else if (parsed.data.resetExisting) {
        password = temporaryPassword();
        const { data, error } = await admin.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
          user_metadata: { ...user.user_metadata, display_name: account.name, uat_account: true },
          app_metadata: { ...user.app_metadata, uat_account: true },
        });
        if (error || !data.user) throw error || new Error(`Could not reset ${account.key}`);
        user = data.user;
      }

      const { error: profileError } = await admin.from("profiles").upsert(
        { id: user.id, display_name: account.name, is_suspended: false },
        { onConflict: "id" },
      );
      if (profileError) throw profileError;
      const { data: access } = await admin
        .from("beta_access")
        .select("id")
        .ilike("email", account.email)
        .maybeSingle();
      const accessDocument = {
          user_id: user.id,
          email: account.email,
          status: "ACTIVE",
          notes: `Controlled-beta UAT account: ${account.key}`,
          invited_by: identity.user.id,
          updated_at: new Date().toISOString(),
        };
      const { error: accessError } = access
        ? await admin.from("beta_access").update(accessDocument).eq("id", access.id)
        : await admin.from("beta_access").insert(accessDocument);
      if (accessError) throw accessError;
      const { error: roleError } = await admin.from("user_roles").upsert(
        { user_id: user.id, role_code: account.role },
        { onConflict: "user_id,role_code" },
      );
      if (roleError) throw roleError;

      credentials.push({
        key: account.key,
        name: account.name,
        email: account.email,
        role: account.role,
        password,
        created,
        reset: !created && password !== null,
      });
    }

    await admin.from("audit_logs").insert({
      actor_id: identity.user.id,
      action: "admin.provision_uat_suite",
      resource_type: "uat_suite",
      resource_id: "controlled-beta-v1",
      metadata: { accounts: suite.map(({ key, email, role }) => ({ key, email, role })), reset_existing: parsed.data.resetExisting },
    });

    return Response.json(
      { credentials, passwordNotice: "Passwords are returned only when an account is created or explicitly reset." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
