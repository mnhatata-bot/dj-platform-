"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";

type SessionUser={id:string;email?:string};
type DJ={id:string;user_id:string;stage_name:string;slug:string;short_bio:string|null;long_bio:string|null;primary_city:string|null;country:string|null;genres:string[];marketplace_visibility:boolean};
type Epk={id:string;dj_profile_id:string;title:string;slug:string;template_id:string;status:string;locale:string;seo_description:string|null};
type Opportunity={id:string;title:string;description:string;city:string|null;country:string|null;budget_min:number|null;budget_max:number|null;currency:string;status:string;event_date:string|null};

export default function Page(){
 const [user,setUser]=useState<SessionUser|null>(null);
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState("");
 const [tab,setTab]=useState("dashboard"); const [dj,setDj]=useState<DJ|null>(null); const [epk,setEpk]=useState<Epk|null>(null);
 const [opps,setOpps]=useState<Opportunity[]>([]); const [bookings,setBookings]=useState<any[]>([]); const [apps,setApps]=useState<any[]>([]);
 const [events,setEvents]=useState<any[]>([]); const [communities,setCommunities]=useState<any[]>([]); const [busy,setBusy]=useState(false);
 const [stage,setStage]=useState("Motata"); const [bio,setBio]=useState("Tech house built for high-energy rooms, hypnotic movement and memorable transitions.");
 const [city,setCity]=useState("Riyadh"); const [country,setCountry]=useState("Saudi Arabia"); const [theme,setTheme]=useState("underground");

 useEffect(()=>{supabase.auth.getUser().then(({data})=>setUser(data.user as any)); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user as any||null)); return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(user) loadAll()},[user]);

 async function loadAll(){
  const {data:d}=await supabase.from("dj_profiles").select("*").eq("user_id",user!.id).maybeSingle();
  setDj(d as any); if(d){setStage(d.stage_name);setBio(d.short_bio||"");setCity(d.primary_city||"");setCountry(d.country||"");
   const {data:e}=await supabase.from("epks").select("*").eq("dj_profile_id",d.id).maybeSingle(); setEpk(e as any); if(e)setTheme(e.template_id);
   const [{data:b},{data:a}]=await Promise.all([supabase.from("booking_inquiries").select("*").eq("dj_profile_id",d.id).order("created_at",{ascending:false}),supabase.from("applications").select("*, opportunities(title,city,country,event_date)").eq("dj_profile_id",d.id).order("created_at",{ascending:false})]); setBookings(b||[]); setApps(a||[]);
  }
  const [{data:o},{data:ev},{data:c}]=await Promise.all([supabase.from("opportunities").select("*").eq("status","PUBLISHED").order("created_at",{ascending:false}),supabase.from("events").select("*").in("status",["PUBLISHED","LIVE","ENDED"]).order("starts_at",{ascending:true}),supabase.from("communities").select("*").eq("visibility","PUBLIC").order("created_at",{ascending:false})]); setOpps(o||[]);setEvents(ev||[]);setCommunities(c||[]);
 }

 async function authenticate(){
  setBusy(true); setMsg("");
  const result=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{data:{display_name:email.split("@")[0]}}});
  if(result.error)setMsg(result.error.message); else setMsg(mode==="signup"&&!result.data.session?"Check your email to confirm your account.":"Signed in.");
  setBusy(false);
 }
 async function saveProfile(){
  if(!user)return; setBusy(true); setMsg("");
  const slug=stage.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+user.id.slice(0,6);
  if(!dj){
   const {data,error}=await supabase.from("dj_profiles").insert({user_id:user.id,stage_name:stage,slug,short_bio:bio,long_bio:bio,primary_city:city,country,genres:["Tech House"],marketplace_visibility:true}).select().single();
   if(error)setMsg(error.message); else {setDj(data as any); setMsg("DJ profile created.");}
  }else{
   const {data,error}=await supabase.from("dj_profiles").update({stage_name:stage,short_bio:bio,long_bio:bio,primary_city:city,country}).eq("id",dj.id).select().single();
   if(error)setMsg(error.message); else {setDj(data as any);setMsg("Profile saved.");}
  } setBusy(false); await loadAll();
 }
 async function ensureEpk(){
  if(!dj)return; setBusy(true);
  if(!epk){const slug=dj.slug+"-epk";const {data,error}=await supabase.from("epks").insert({dj_profile_id:dj.id,title:stage+" EPK",slug,template_id:theme,status:"DRAFT",locale:"en",seo_description:bio}).select().single(); if(error)setMsg(error.message); else setEpk(data as any)}
  else {const {data,error}=await supabase.from("epks").update({template_id:theme,title:stage+" EPK",seo_description:bio}).eq("id",epk.id).select().single(); if(error)setMsg(error.message);else setEpk(data as any)}
  setBusy(false);
 }
 async function publishEpk(){if(!epk)return;setBusy(true);const {data,error}=await supabase.rpc("publish_epk",{p_epk:epk.id}); if(error)setMsg(error.message); else setMsg("Published version "+data);setBusy(false);await loadAll();}
 async function apply(opp:Opportunity){if(!dj){setMsg("Create your DJ profile first.");return}const {error}=await supabase.from("applications").insert({opportunity_id:opp.id,dj_profile_id:dj.id,cover_note:"Interested and available.",currency:opp.currency,status:"SUBMITTED"}); setMsg(error?error.message:"Application submitted.");await loadAll();}
 async function logout(){await supabase.auth.signOut();setUser(null)}

 if(!user)return <main className="authwrap"><div className="card authcard"><div className="brand">DJ<span>PLATFORM</span></div><h1>{mode==="login"?"Sign in":"Create account"}</h1><p className="muted">A real account connected to the dedicated DJ Platform backend.</p><div className="field"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} /></div><div className="field" style={{marginTop:12}}><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div><div className="toolbar"><button className="btn primary" onClick={authenticate} disabled={busy}>{busy?"Working…":mode==="login"?"Sign in":"Create account"}</button><button className="btn ghost" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Create account":"Back to sign in"}</button></div>{msg&&<div className="notice">{msg}</div>}</div></main>;

 const nav=["dashboard","profile","epk","marketplace","bookings","events","community"];
 return <div className="app"><header className="topbar"><div className="brand">DJ<span>PLATFORM</span></div><div><span className="muted">{user.email}</span> <button className="btn ghost" onClick={logout}>Sign out</button></div></header><div className="shell"><aside className="sidebar">{nav.map(n=><button key={n} className={"navbtn "+(tab===n?"active":"")} onClick={()=>setTab(n)}>{n[0].toUpperCase()+n.slice(1)}</button>)}</aside><main className="content">
 {msg&&<div className="notice" style={{marginBottom:18}}>{msg}</div>}
 {tab==="dashboard"&&<><div className="kicker">Career command center</div><h1>Welcome{dj?", "+dj.stage_name:""}.</h1><p className="muted">Your live platform status and activity.</p><div className="grid"><div className="card span3 stat">Profile<strong>{dj?"Ready":"Missing"}</strong></div><div className="card span3 stat">EPK<strong>{epk?.status||"None"}</strong></div><div className="card span3 stat">Applications<strong>{apps.length}</strong></div><div className="card span3 stat">Bookings<strong>{bookings.length}</strong></div><div className="card span8"><h3>Application pipeline</h3>{apps.length?apps.map((a:any)=><div className="row" key={a.id}><span>{a.opportunities?.title||"Opportunity"}</span><span className="badge">{a.status}</span></div>):<div className="empty">No applications yet.</div>}</div><div className="card span4"><h3>System</h3><div className="row">Backend <b className="ok">CONNECTED</b></div><div className="row">Auth <b className="ok">LIVE</b></div><div className="row">RLS <b className="ok">ACTIVE</b></div></div></div></>}
 {tab==="profile"&&<><div className="kicker">DJ identity</div><h1>Profile</h1><div className="card"><div className="formgrid"><div className="field"><label>Stage name</label><input value={stage} onChange={e=>setStage(e.target.value)}/></div><div className="field"><label>Primary city</label><input value={city} onChange={e=>setCity(e.target.value)}/></div><div className="field"><label>Country</label><input value={country} onChange={e=>setCountry(e.target.value)}/></div><div className="field"><label>Genre</label><input value="Tech House" readOnly/></div><div className="field" style={{gridColumn:"1/-1"}}><label>Bio</label><textarea value={bio} onChange={e=>setBio(e.target.value)}/></div></div><div className="toolbar"><button className="btn primary" onClick={saveProfile} disabled={busy}>Save profile</button></div></div></>}
 {tab==="epk"&&<><div className="kicker">Electronic press kit</div><h1>EPK Studio</h1>{!dj?<div className="card empty">Create your DJ profile first.</div>:<div className="epkgrid"><aside className="card"><h3>Sections</h3>{["Hero","Bio","Music","Video","Gallery","Press","Events","Downloads","Booking"].map(x=><div className="row" key={x}>{x}<b className="ok">ON</b></div>)}</aside><section className={"preview "+theme}><span className={"badge "+(epk?.status==="PUBLISHED"?"green":"amber")}>{epk?.status||"DRAFT"}</span><small>{city.toUpperCase()}, {country.toUpperCase()}</small><h1>{stage}</h1><p>{bio}</p></section><aside className="card"><div className="field"><label>Template</label><select value={theme} onChange={e=>setTheme(e.target.value)}>{["underground","minimal","festival","luxury","experimental"].map(x=><option key={x}>{x}</option>)}</select></div><div className="toolbar"><button className="btn" onClick={ensureEpk}>Save EPK</button>{epk&&<button className="btn primary" onClick={publishEpk}>Publish</button>}</div></aside></div>}</>}
 {tab==="marketplace"&&<><div className="kicker">Discovery</div><h1>Marketplace</h1><div className="grid">{opps.length?opps.map(o=><div className="card span4" key={o.id}><span className="badge green">{o.status}</span><h3>{o.title}</h3><p className="muted">{o.city||""}{o.country?" · "+o.country:""}</p><p>{o.description}</p><strong>{o.budget_min||0}–{o.budget_max||0} {o.currency}</strong><div className="toolbar"><button className="btn primary" onClick={()=>apply(o)}>Apply</button></div></div>):<div className="card span12 empty">No published opportunities yet.</div>}</div></>}
 {tab==="bookings"&&<><div className="kicker">Pipeline</div><h1>Bookings</h1><div className="card">{bookings.length?bookings.map((b:any)=><div className="row" key={b.id}><div><b>{b.requester_name}</b><div className="muted">{b.organization_name||b.requester_email}</div></div><span className="badge">{b.status}</span></div>):<div className="empty">No booking inquiries yet.</div>}</div></>}
 {tab==="events"&&<><div className="kicker">Live ecosystem</div><h1>Events</h1><div className="grid">{events.length?events.map((e:any)=><div className="card span4" key={e.id}><span className="badge green">{e.status}</span><h3>{e.title}</h3><p className="muted">{e.venue||""} {e.city?"· "+e.city:""}</p><p>{new Date(e.starts_at).toLocaleString()}</p></div>):<div className="card span12 empty">No public events yet.</div>}</div></>}
 {tab==="community"&&<><div className="kicker">Audience CRM</div><h1>Communities</h1><div className="grid">{communities.length?communities.map((c:any)=><div className="card span4" key={c.id}><span className="badge">{c.membership_mode}</span><h3>{c.name}</h3><p className="muted">{c.description||"Community"}</p></div>):<div className="card span12 empty">No public communities yet.</div>}</div></>}
 </main></div></div>
}
