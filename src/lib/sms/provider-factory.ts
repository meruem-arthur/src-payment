import type { SMSProvider } from "./provider.interface";
import { MockSmsProvider } from "./mock.provider";
import { AfricasTalkingSmsProvider } from "./africastalking.provider";
import { ArkeselSmsProvider } from "./arkesel.provider";

export type SmsProviderName = "MOCK" | "ARKESEL" | "AFRICASTALKING";

/** The provider is chosen in Admin > SMS settings (stored in the database). */
export function getSmsProvider(name: SmsProviderName): SMSProvider {
  if (name === "ARKESEL") return new ArkeselSmsProvider();
  if (name === "AFRICASTALKING") return new AfricasTalkingSmsProvider();
  return new MockSmsProvider();
}
