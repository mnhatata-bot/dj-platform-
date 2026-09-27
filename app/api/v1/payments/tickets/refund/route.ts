import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { adminDatabase } from "@/lib/server-admin";
import { paypal } from "@/modules/payments/infrastructure/paypal";
export const runtime="nodejs";
const Input=z.object({ticketId:z.string().uuid(),reason:z.string().trim().min(3).max(500)});
export async function POST(request:Request){try{
 const {db}=await authenticate(request);
 if(!paypal.configured())return Response.json({error:"Refund provider is not configured."},{status:503});
 const input=Input.parse(await request.json());
 const {data,error}=await db.rpc("request_ticket_refund",{p_ticket:input.ticketId,p_reason:input.reason});
 if(error)throw error;const refund=Array.isArray(data)?data[0]:data;if(!refund)throw new Error("REFUND_NOT_CREATED");
 const admin=adminDatabase();const {data:checkout,error:checkoutError}=await admin.from("payment_checkouts").select("provider_capture_id").eq("id",refund.checkout_id).single();
 if(checkoutError||!checkout?.provider_capture_id)throw new Error("PAYMENT_CAPTURE_NOT_FOUND");
 const providerRefund=await paypal.refund(checkout.provider_capture_id,Number(refund.amount).toFixed(2),refund.currency,refund.id);
 if(!providerRefund.id||!['COMPLETED','PENDING'].includes(providerRefund.status))throw new Error("PAYMENT_REFUND_FAILED");
 const {error:recordError}=await admin.from("payment_refunds").update({provider_refund_id:providerRefund.id}).eq("id",refund.id);if(recordError)throw recordError;
 if(providerRefund.status==="COMPLETED"){
  const {error:completeError}=await admin.rpc("complete_ticket_refund",{p_refund:refund.id,p_provider_refund:providerRefund.id,p_payload:providerRefund});if(completeError)throw completeError;
 }
 return Response.json({refundId:refund.id,status:providerRefund.status});
 }catch(error){return apiError(error)}}
