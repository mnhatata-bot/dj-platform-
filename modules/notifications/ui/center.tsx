"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ModuleHeading, Status } from "@/modules/ui/guided";

type Notification = { id:string;title:string;body:string;kind:string;read_at:string|null;created_at:string };
export default function NotificationCenter(){
 const [items,setItems]=useState<Notification[]>([]);const [error,setError]=useState("");
 async function load(){const r=await supabase.from("user_notifications").select("id,title,body,kind,read_at,created_at").order("created_at",{ascending:false}).limit(100);if(r.error)setError(r.error.message);else setItems(r.data||[])}
 useEffect(()=>{void load()},[]);
 async function read(id:string){const r=await supabase.from("user_notifications").update({read_at:new Date().toISOString()}).eq("id",id);if(r.error)setError(r.error.message);else setItems(x=>x.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n))}
 return <section className="card"><ModuleHeading title="Notifications" help="Order, ticket, booking and operational updates appear here. Email delivery is separately controlled by the platform."/><Status text={error} error/>{!items.length&&<p>No notifications yet.</p>}{items.map(n=><article className={`inquiry-row ${n.read_at?"":"unread"}`} key={n.id}><div className="card-title"><div><b>{n.title}</b><small>{new Date(n.created_at).toLocaleString()} · {n.kind.replaceAll("."," ")}</small></div>{!n.read_at&&<button className="button small" onClick={()=>read(n.id)}>Mark read</button>}</div><p>{n.body}</p></article>)}</section>
}
