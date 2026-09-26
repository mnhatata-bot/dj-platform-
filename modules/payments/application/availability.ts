import { adminDatabase } from "@/lib/server-admin";
import type { PaymentProvider } from "./provider";

export async function paymentCheckoutAvailable(provider: PaymentProvider) {
  if (!provider.configured()) return false;
  try {
    const { data, error } = await adminDatabase().rpc("feature_enabled", {
      p_key: "payments_enabled",
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
