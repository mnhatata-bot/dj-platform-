import { paypal } from "@/modules/payments/infrastructure/paypal";
export const runtime="nodejs";
export async function GET(){return Response.json({enabled:paypal.configured(),provider:paypal.configured()?paypal.code:null},{headers:{"Cache-Control":"no-store"}})}
