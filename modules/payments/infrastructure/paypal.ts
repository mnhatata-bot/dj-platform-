import type { CheckoutRequest, HostedCheckout, PaymentProvider } from "@/modules/payments/application/provider";

type PayPalLink={rel:string;href:string};
type PayPalOrder={id:string;links?:PayPalLink[]};
export type PayPalCapture={id:string;status:string;purchase_units?:Array<{payments?:{captures?:Array<{id:string;status:string;amount:{value:string;currency_code:string}}>} }>};

export class PayPalProvider implements PaymentProvider {
  readonly code="PAYPAL";
  private get base(){return process.env.PAYPAL_ENVIRONMENT==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com"}
  configured(){return Boolean(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET&&process.env.PAYPAL_WEBHOOK_ID)}
  private async token(){
    const id=process.env.PAYPAL_CLIENT_ID;const secret=process.env.PAYPAL_CLIENT_SECRET;
    if(!id||!secret)throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
    const response=await fetch(`${this.base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",cache:"no-store"});
    if(!response.ok)throw new Error("PAYMENT_PROVIDER_AUTH_FAILED");
    return ((await response.json()) as {access_token:string}).access_token;
  }
  async createCheckout(input:CheckoutRequest):Promise<HostedCheckout>{
    const accessToken=await this.token();
    const response=await fetch(`${this.base}/v2/checkout/orders`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json","PayPal-Request-Id":input.internalId},body:JSON.stringify({intent:"CAPTURE",purchase_units:[{reference_id:input.internalId,custom_id:input.internalId,description:input.description,amount:{currency_code:input.currency,value:input.amount}}],payment_source:{paypal:{experience_context:{return_url:input.returnUrl,cancel_url:input.cancelUrl,user_action:"PAY_NOW",shipping_preference:"NO_SHIPPING"}}}}),cache:"no-store"});
    if(!response.ok)throw new Error("PAYMENT_PROVIDER_CREATE_FAILED");
    const order=await response.json() as PayPalOrder;const approvalUrl=order.links?.find(link=>link.rel==="payer-action"||link.rel==="approve")?.href;
    if(!order.id||!approvalUrl)throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");
    return {provider:this.code,orderId:order.id,approvalUrl};
  }
  async capture(orderId:string):Promise<PayPalCapture>{
    const accessToken=await this.token();
    const response=await fetch(`${this.base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json","PayPal-Request-Id":`capture-${orderId}`},body:"{}",cache:"no-store"});
    if(!response.ok)throw new Error("PAYMENT_CAPTURE_FAILED");
    return response.json() as Promise<PayPalCapture>;
  }
  async verifyWebhook(request:Request,payload:unknown){
    const webhookId=process.env.PAYPAL_WEBHOOK_ID;if(!webhookId)return false;
    const accessToken=await this.token();
    const response=await fetch(`${this.base}/v1/notifications/verify-webhook-signature`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({auth_algo:request.headers.get("paypal-auth-algo"),cert_url:request.headers.get("paypal-cert-url"),transmission_id:request.headers.get("paypal-transmission-id"),transmission_sig:request.headers.get("paypal-transmission-sig"),transmission_time:request.headers.get("paypal-transmission-time"),webhook_id:webhookId,webhook_event:payload}),cache:"no-store"});
    if(!response.ok)return false;
    return ((await response.json()) as {verification_status?:string}).verification_status==="SUCCESS";
  }
}

export const paypal=new PayPalProvider();
