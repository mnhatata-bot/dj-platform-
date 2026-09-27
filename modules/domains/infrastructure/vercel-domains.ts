type Verification = { type: string; domain: string; value: string; reason?: string };
type VercelDomain = { name: string; verified?: boolean; verification?: Verification[] };

function endpoint(path: string) {
  const url = new URL(path, "https://api.vercel.com");
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  return url;
}

async function request(path: string, init: RequestInit) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token || !process.env.VERCEL_PROJECT_ID) throw new Error("Vercel domains are not configured");
  const response = await fetch(endpoint(path), {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as VercelDomain & { error?: { message?: string } };
  if (!response.ok && response.status !== 409) throw new Error(body.error?.message || `Vercel domain request failed (${response.status})`);
  return body;
}

export const vercelDomains = {
  configured() {
    return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
  },
  add(domain: string) {
    return request(`/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID || "")}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  },
  verify(domain: string) {
    return request(`/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID || "")}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" });
  },
};
