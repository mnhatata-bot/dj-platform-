import Link from "next/link";

export const metadata = { title: "Cuelance controlled-beta UAT" };

const scenarios = [
  ["UAT-01", "Access and isolation", "Sign in as every persona, verify the beta gate, role workspace, private records and sign-out behavior."],
  ["UAT-02", "Artist to promoter", "Artist publishes profile/EPK and applies; promoter views, shortlists and selects; both exchange messages."],
  ["UAT-03", "Direct booking", "Fan submits an inquiry; artist contacts, negotiates, confirms and completes it; both verify the same history."],
  ["UAT-04", "Provider commerce", "Provider publishes product, service, rental and experience listings; promoter requests, receives and accepts a quote."],
  ["UAT-05", "Community membership", "Fan requests membership; manager approves, suspends and restores it without allowing self-approval."],
  ["UAT-06", "Tickets and admission", "Promoter issues a ticket; fan opens Wallet; assigned scanner tests valid, duplicate, manual and revoked entry."],
  ["UAT-07", "Agency deal", "Agency adds artist, sends offer and contract; artist approves and signs; both use the protected deal room."],
  ["UAT-08", "Venue and production", "Venue, promoter, provider and scanner coordinate an event while preserving organization boundaries."],
  ["UAT-09", "Admin boundaries", "Admin manages beta access and audited controls; support and fan accounts verify restricted access."],
  ["UAT-10", "Arabic and mobile", "Repeat key journeys in Arabic on iPhone and desktop; test RTL, rotation, keyboard, errors and retry."],
] as const;

export default function UatPlaybook() {
  return <main className="full-guide">
    <header className="actions"><Link className="button" href="/workspace">Open workspace</Link><Link className="button" href="/guide">User guide</Link></header>
    <p className="eyebrow">CONTROLLED BETA</p><h1>User acceptance testing</h1>
    <p>Use a separate private window or browser profile for each account. Payments, email, domains, media processing and physical camera tests remain blocked until their sandbox configuration is available.</p>
    <section className="card"><h2>Send feedback</h2><p>For each scenario report: result (PASS, FAIL, BLOCKED or CONFUSING), scenario ID, account, device/browser, language, button pressed, expected result, actual result and severity.</p><p><strong>S1</strong> security/data loss · <strong>S2</strong> workflow blocked · <strong>S3</strong> confusing/incorrect · <strong>S4</strong> cosmetic</p><p>Do not include passwords, QR tokens or private customer data in screenshots.</p></section>
    <div className="guide-grid">{scenarios.map(([id,title])=><a className="guide-link" key={id} href={`#${id.toLowerCase()}`}>{id} · {title}</a>)}</div>
    {scenarios.map(([id,title,steps])=><section className="card" id={id.toLowerCase()} key={id} style={{marginBlock:24}}><p className="eyebrow">{id}</p><h2>{title}</h2><p>{steps}</p><p className="guide-example">Record every unexpected button, label, delay, error and missing next step.</p></section>)}
  </main>;
}
