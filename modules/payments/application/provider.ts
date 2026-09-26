export type CheckoutRequest = {
  internalId: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
};

export type HostedCheckout = {
  provider: string;
  orderId: string;
  approvalUrl: string;
};

export interface PaymentProvider {
  readonly code: string;
  configured(): boolean;
  createCheckout(request: CheckoutRequest): Promise<HostedCheckout>;
  verifyWebhook(request: Request, payload: unknown): Promise<boolean>;
}
