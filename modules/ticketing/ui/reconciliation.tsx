"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {ModuleHeading,Status} from "@/modules/ui/guided";
type Event={id:string;title:string};
type Summary={orders:number;gross:number;refunded:number;net:number;currency:string;completed:number;pending:number;refunded_orders:number};
export default function TicketReconciliation({events}:{events:Event[]}){
 const [eventId,setEventId]=useState(events[0]?.id||"");const [summary,setSummary]=useState<Summary|null>(null);const [error,setError]=useState("");
 async function load(id=eventId){if(!id)return;const {data,error}=await supabase.rpc("ticket_reconciliation",{p_event:id});if(error)setError(error.message);else{setError("");setSummary(data as Summary)}}
 useEffect(()=>{if(eventId)void load(eventId)},[eventId]);
 const money=(value:number)=>new Intl.NumberFormat("en-SA",{style:"currency",currency:summary?.currency||"SAR"}).format(Number(value||0));
 return <section className="card"><ModuleHeading title="Ticket finance & reconciliation" help="Verified orders, refunds and net sales for the selected event."/><label className="field-label">Event<select value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label><Status text={error} error/>{summary&&<div className="metric-grid"><article><small>Gross</small><strong>{money(summary.gross)}</strong></article><article><small>Refunded</small><strong>{money(summary.refunded)}</strong></article><article><small>Net</small><strong>{money(summary.net)}</strong></article><article><small>Orders</small><strong>{summary.orders}</strong></article><article><small>Completed</small><strong>{summary.completed}</strong></article><article><small>Pending</small><strong>{summary.pending}</strong></article></div>}</section>
}
