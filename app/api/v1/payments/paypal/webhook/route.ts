import { paypal } from "@/modules/payments/infrastructure/paypal";
import { adminDatabase } from "@/lib/server-admin";
export const runtime="nodejs";
type Webhook={id?:string;event_type?:string;resource?:Record<string,unknown>};
export async function POST(request:Request){
 const payload=await request.json() as Webhook;
 if(!await paypal.verifyWebhook(request,payload))return Response.json({error:"Invalid signature"},{status:401});
 const eventType=payload.event_type||"UNKNOWN";
 if(eventType!=="PAYMENT.CAPTURE.COMPLETED")return Response.json({received:true,processed:false});
 const resource=payload.resource||{};const supplementary=resource.supplementary_data as {related_ids?:{order_id?:string}}|undefined;const amount=resource.amount as {value?:string;currency_code?:string}|undefined;
 const eventId=payload.id;const orderId=supplementary?.related_ids?.order_id;const captureId=typeof resource.id==="string"?resource.id:undefined;
 if(!eventId||!orderId||!captureId||!amount?.value||!amount.currency_code)return Response.json({error:"Incomplete event"},{status:400});
 const {error}=await adminDatabase().rpc("complete_verified_payment",{p_provider:"PAYPAL",p_event_id:eventId,p_event_type:eventType,p_order_id:orderId,p_capture_id:captureId,p_amount:Number(amount.value),p_currency:amount.currency_code,p_payload:payload});
 if(error)return Response.json({error:"Event processing failed"},{status:500});
 return Response.json({received:true,processed:true});
}
