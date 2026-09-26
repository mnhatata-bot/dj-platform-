import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { adminDatabase } from "@/lib/server-admin";
import { paypal } from "@/modules/payments/infrastructure/paypal";
export const runtime="nodejs";
const Input=z.object({providerOrderId:z.string().min(6).max(100)});
export async function POST(request:Request){try{
 const input=Input.parse(await request.json());const {db}=await authenticate(request);
 const {data:checkout,error}=await db.from("payment_checkouts").select("id,status,amount,currency").eq("provider","PAYPAL").eq("provider_order_id",input.providerOrderId).maybeSingle();
 if(error||!checkout)throw new Error("CHECKOUT_NOT_FOUND");
 if(checkout.status==="COMPLETED")return Response.json({completed:true,checkoutId:checkout.id});
 const result=await paypal.capture(input.providerOrderId);const capture=result.purchase_units?.flatMap(unit=>unit.payments?.captures||[]).find(item=>item.status==="COMPLETED");
 if(!capture)throw new Error("PAYMENT_NOT_COMPLETED");
 if(Number(capture.amount.value)!==Number(checkout.amount)||capture.amount.currency_code!==checkout.currency)throw new Error("PAYMENT_AMOUNT_MISMATCH");
 const {error:completeError}=await adminDatabase().rpc("complete_verified_payment",{p_provider:"PAYPAL",p_event_id:`capture:${capture.id}`,p_event_type:"PAYMENT.CAPTURE.COMPLETED",p_order_id:input.providerOrderId,p_capture_id:capture.id,p_amount:Number(capture.amount.value),p_currency:capture.amount.currency_code,p_payload:result});
 if(completeError)throw completeError;
 return Response.json({completed:true,checkoutId:checkout.id});
 }catch(error){return apiError(error)}}
