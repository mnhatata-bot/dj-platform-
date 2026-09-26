import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { adminDatabase } from "@/lib/server-admin";
import { paypal } from "@/modules/payments/infrastructure/paypal";
export const runtime="nodejs";
const Input=z.object({ticketTypeId:z.string().uuid(),buyerEmail:z.string().email(),idempotencyKey:z.string().uuid(),returnPath:z.string().regex(/^\/[A-Za-z0-9/_?&=.-]*$/)});
export async function POST(request:Request){try{
 if(!paypal.configured())return Response.json({error:"Payment checkout is not configured yet."},{status:503});
 const input=Input.parse(await request.json());const {db}=await authenticate(request);
 const {data,error}=await db.rpc("begin_paid_ticket_checkout",{p_ticket_type:input.ticketTypeId,p_buyer_email:input.buyerEmail,p_idempotency:input.idempotencyKey});
 if(error)throw error;const checkout=Array.isArray(data)?data[0]:data;if(!checkout)throw new Error("CHECKOUT_NOT_CREATED");
 if(checkout.status==="PROVIDER_PENDING"&&checkout.provider_order_id)throw new Error("CHECKOUT_ALREADY_OPEN");
 const origin=new URL(request.url).origin;const hosted=await paypal.createCheckout({internalId:checkout.id,amount:Number(checkout.amount).toFixed(2),currency:checkout.currency,description:"Cuelance event ticket",returnUrl:new URL(input.returnPath,origin).toString(),cancelUrl:new URL(input.returnPath+(input.returnPath.includes("?")?"&":"?")+"payment=cancelled",origin).toString()});
 const {error:updateError}=await adminDatabase().from("payment_checkouts").update({provider_order_id:hosted.orderId,status:"PROVIDER_PENDING",updated_at:new Date().toISOString()}).eq("id",checkout.id).eq("user_id",checkout.user_id);
 if(updateError)throw updateError;
 return Response.json({checkoutId:checkout.id,approvalUrl:hosted.approvalUrl,expiresAt:new Date(Date.now()+15*60_000).toISOString()});
 }catch(error){return apiError(error)}}
