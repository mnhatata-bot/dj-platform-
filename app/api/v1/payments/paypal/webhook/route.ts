import { paypal } from "@/modules/payments/infrastructure/paypal";
import { adminDatabase } from "@/lib/server-admin";
export const runtime="nodejs";
type Webhook={id?:string;event_type?:string;resource?:Record<string,unknown>};
export async function POST(request:Request){
 const payload=await request.json() as Webhook;
 if(!await paypal.verifyWebhook(request,payload))return Response.json({error:"Invalid signature"},{status:401});
 const eventType=payload.event_type||"UNKNOWN";
 if(eventType==="PAYMENT.CAPTURE.REFUNDED"){
  const providerRefundId=typeof payload.resource?.id==="string"?payload.resource.id:undefined;if(!payload.id||!providerRefundId)return Response.json({error:"Incomplete refund event"},{status:400});
  const admin=adminDatabase();const {data:refund,error:refundError}=await admin.from("payment_refunds").select("id").eq("provider_refund_id",providerRefundId).maybeSingle();
  if(refundError||!refund)return Response.json({received:true,processed:false});
  const {error}=await admin.rpc("complete_ticket_refund",{p_refund:refund.id,p_provider_refund:providerRefundId,p_payload:payload});if(error)return Response.json({error:"Refund processing failed"},{status:500});
  await admin.from("payment_events").upsert({provider:"PAYPAL",provider_event_id:payload.id,event_type:eventType,verified:true,payload,processing_status:"PROCESSED",processed_at:new Date().toISOString()},{onConflict:"provider,provider_event_id"});
  return Response.json({received:true,processed:true});
 }
 if(eventType!=="PAYMENT.CAPTURE.COMPLETED")return Response.json({received:true,processed:false});
 const resource=payload.resource||{};const supplementary=resource.supplementary_data as {related_ids?:{order_id?:string}}|undefined;const amount=resource.amount as {value?:string;currency_code?:string}|undefined;
 const eventId=payload.id;const orderId=supplementary?.related_ids?.order_id;const captureId=typeof resource.id==="string"?resource.id:undefined;
 if(!eventId||!orderId||!captureId||!amount?.value||!amount.currency_code)return Response.json({error:"Incomplete event"},{status:400});
 const admin=adminDatabase();const {data:checkout}=await admin.from("payment_checkouts").select("purpose").eq("provider","PAYPAL").eq("provider_order_id",orderId).maybeSingle();const completion=checkout?.purpose==="PROVIDER_ORDER"?await admin.rpc("complete_provider_order_payment",{p_order_id:orderId,p_capture_id:captureId,p_amount:Number(amount.value),p_currency:amount.currency_code,p_payload:payload}):await admin.rpc("complete_verified_payment",{p_provider:"PAYPAL",p_event_id:eventId,p_event_type:eventType,p_order_id:orderId,p_capture_id:captureId,p_amount:Number(amount.value),p_currency:amount.currency_code,p_payload:payload});const error=completion.error;
 if(error)return Response.json({error:"Event processing failed"},{status:500});
 return Response.json({received:true,processed:true});
}
