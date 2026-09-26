import { paypal } from "@/modules/payments/infrastructure/paypal";
import { paymentCheckoutAvailable } from "@/modules/payments/application/availability";
export const runtime="nodejs";
export async function GET(){const enabled=await paymentCheckoutAvailable(paypal);return Response.json({enabled,provider:enabled?paypal.code:null,beta:true},{headers:{"Cache-Control":"no-store"}})}
