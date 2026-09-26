import { z } from "zod";
import { authenticate, apiError } from "@/lib/server-auth";
import { paypal } from "@/modules/payments/infrastructure/paypal";
import { adminDatabase } from "@/lib/server-admin";
export const runtime="nodejs";
const Input=z.object({plan:z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),organizationId:z.string().uuid().nullable().optional(),idempotencyKey:z.string().uuid(),returnPath:z.string().regex(/^\/[A-Za-z0-9/_?&=.-]*$/).default("/workspace?payment=success")});
export async function POST(request:Request){try{
 if(!paypal.configured())return Response.json({error:"Payment checkout is not configured yet."},{status:503});
 const input=Input.parse(await request.json());const {db}=await authenticate(request);
 const {data,error}=await db.rpc("begin_subscription_checkout",{p_plan:input.plan,p_organization:input.organizationId||null,p_idempotency:input.idempotencyKey});
 if(error)throw error;const checkout=Array.isArray(data)?data[0]:data;if(!checkout)throw new Error("CHECKOUT_NOT_CREATED");
 const origin=new URL(request.url).origin;const hosted=await paypal.createCheckout({internalId:checkout.id,amount:Number(checkout.amount).toFixed(2),currency:checkout.currency,description:`Cuelance ${checkout.plan_code}`,returnUrl:new URL(input.returnPath,origin).toString(),cancelUrl:new URL("/workspace?payment=cancelled",origin).toString()});
 const {error:updateError}=await adminDatabase().from("payment_checkouts").update({provider_order_id:hosted.orderId,status:"PROVIDER_PENDING",updated_at:new Date().toISOString()}).eq("id",checkout.id).eq("user_id",checkout.user_id);
 if(updateError)throw updateError;
 return Response.json({checkoutId:checkout.id,approvalUrl:hosted.approvalUrl});
 }catch(error){return apiError(error)}}
