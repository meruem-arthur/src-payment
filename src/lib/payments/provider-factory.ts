import type { PaymentProvider } from "./provider.interface";
import { PaystackProvider } from "./paystack.provider";
const providers: Record<string, PaymentProvider> = { PAYSTACK: new PaystackProvider() };
export function getPaymentProvider(providerName: "PAYSTACK"): PaymentProvider {
  const provider = providers[providerName];
  if (!provider) throw new Error(`Payment provider "${providerName}" is not implemented`);
  return provider;
}
