import type { SMSProvider } from "./provider.interface";
import { MockSmsProvider } from "./mock.provider";
import { AfricasTalkingSmsProvider } from "./africastalking.provider";
import { ArkeselSmsProvider } from "./arkesel.provider";

/**
 * SMS_PROVIDER selects the adapter app-wide (all departments share the same
 * provider integration; each department supplies its own apiKey/username
 * on SmsConfiguration, passed in separately at send() time). Falls back to
 * the mock provider - which only logs, never actually sends - if unset.
 */
export function getSmsProvider(): SMSProvider {
  const choice = (process.env.SMS_PROVIDER ?? "").trim().toUpperCase();
  if (choice === "ARKESEL") {
    return new ArkeselSmsProvider();
  }
  if (choice === "AFRICASTALKING") {
    return new AfricasTalkingSmsProvider();
  }
  return new MockSmsProvider();
}
