"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ModuleHeading, Status } from "@/modules/ui/guided";

type Organization = { id: string; name: string } | null;
type Domain = { id: string; domain: string; target_type: string; target_id: string; registrar: string; status: string; certificate_status: string; dns_instructions: { type: string; name: string; value: string; reason?: string | null }[]; last_error: string | null };
type ProviderPage = { id: string; display_name: string; role: string };
type Search = { domain: string; available: boolean | null; price?: number; currency?: string; definitive: boolean; affiliateUrl: string; purchaseEnabled: false };

export default function DomainManager({ organization, epkId }: { organization: Organization; epkId?: string }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pages, setPages] = useState<ProviderPage[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [registrar, setRegistrar] = useState<"EXTERNAL" | "GODADDY">("EXTERNAL");
  const [result, setResult] = useState<Search | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const targets = useMemo(() => [
    ...(epkId ? [{ value: `EPK:${epkId}:personal`, label: "Published artist EPK" }] : []),
    ...pages.map((page) => ({ value: `PROVIDER_PAGE:${page.id}:personal`, label: `${page.display_name} (${page.role})` })),
    ...(organization ? [{ value: `ORGANIZATION:${organization.id}:${organization.id}`, label: `${organization.name} organization` }] : []),
  ], [epkId, pages, organization]);

  async function load() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const [domainResult, pageResult] = await Promise.all([
      supabase.from("custom_domains").select("id,domain,target_type,target_id,registrar,status,certificate_status,dns_instructions,last_error").order("created_at", { ascending: false }),
      supabase.from("provider_pages").select("id,display_name,role").eq("owner_user_id", user.user.id).order("display_name"),
    ]);
    if (domainResult.error || pageResult.error) setError(domainResult.error?.message || pageResult.error?.message || "Could not load domains");
    else { setDomains((domainResult.data || []) as Domain[]); setPages((pageResult.data || []) as ProviderPage[]); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!target && targets[0]) setTarget(targets[0].value); }, [target, targets]);

  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setResult(null);
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/v1/domains/search?domain=${encodeURIComponent(name.trim().toLowerCase())}`, { headers: { Authorization: `Bearer ${session.session?.access_token || ""}` } });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Availability check failed"); else setResult(body as Search);
    setBusy(false);
  }
  async function connect() {
    if (!result || !target) return;
    setBusy(true); setError(""); setNotice("");
    const [targetType, targetId, organizationId] = target.split(":");
    const { error: requestError } = await supabase.rpc("request_custom_domain", { p_domain: result.domain, p_target_type: targetType, p_target_id: targetId, p_organization: organizationId === "personal" ? null : organizationId, p_registrar: registrar });
    if (requestError) setError(requestError.message); else { setNotice("Domain connection requested. DNS instructions will appear here after provisioning."); setName(""); setResult(null); await load(); }
    setBusy(false);
  }
  async function verify(id: string) {
    setBusy(true); setError(""); setNotice("");
    const { error: verifyError } = await supabase.rpc("request_domain_verification", { p_domain: id });
    if (verifyError) setError(verifyError.message); else { setNotice("DNS verification queued."); await load(); }
    setBusy(false);
  }
  return <section>
    <ModuleHeading title="Domains" help="Connect a domain to your EPK, provider page or organization. Cuelance provisions hosting and tracks DNS and certificate status." />
    <div className="card"><h2>Find or connect a domain</h2><p>Controlled beta does not buy or renew domains. Search GoDaddy, purchase there if needed, then return to connect the domain you control.</p><Status text={error} error/><Status text={notice}/>
      <form className="module-form" onSubmit={search}><label>Domain name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="yourbrand.com" autoCapitalize="none" /></label><label>Destination<select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Select a destination</option>{targets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Registrar<select value={registrar} onChange={(event) => setRegistrar(event.target.value as "EXTERNAL" | "GODADDY")}><option value="EXTERNAL">Already owned / external</option><option value="GODADDY">GoDaddy</option></select></label><button className="button" disabled={busy || !targets.length}>{busy ? "Checking…" : "Check domain"}</button></form>
      {!targets.length && <p>Create an EPK, public provider page, or organization before connecting a domain.</p>}
      {result && <div className="notice"><b>{result.domain}</b> · {result.available === true ? "Available at GoDaddy" : result.available === false ? "Already registered" : "Confirm availability at GoDaddy"}{result.price != null && ` · ${result.price.toFixed(2)} ${result.currency || ""}`}<div className="row-actions"><a className="button small" href={result.affiliateUrl} target="_blank" rel="noreferrer">Open GoDaddy</a><button className="button small" type="button" disabled={busy || result.available === true} onClick={() => void connect()}>I control this domain — connect it</button></div>{result.available === true && <small>Purchase the domain first. Automatic purchase is disabled during the controlled beta.</small>}</div>}
    </div>
    <section className="card"><h2>Connected domains</h2>{!domains.length && <p>No custom domains requested yet.</p>}{domains.map((domain) => <article className="data-card" key={domain.id}><div className="row-between"><div><h3>{domain.domain}</h3><small>{domain.target_type.replaceAll("_", " ")} · {domain.registrar}</small></div><span className="status-pill">{domain.status}</span></div><p>Certificate: {domain.certificate_status}</p>{domain.dns_instructions?.length > 0 && <div><h4>DNS records</h4>{domain.dns_instructions.map((record, index) => <div className="record-row" key={`${record.type}-${index}`}><code>{record.type}</code> <b>{record.name}</b> → <code>{record.value}</code></div>)}</div>}{domain.last_error && <Status text={domain.last_error} error/>}<button className="button small" disabled={busy} onClick={() => void verify(domain.id)}>Verify DNS</button></article>)}</section>
  </section>;
}
