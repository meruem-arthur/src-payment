import type { EmailProvider } from "./provider.interface";
import { MockEmailProvider } from "./mock.provider";
import { BrevoEmailProvider } from "./brevo.provider";

export type EmailProviderName = "MOCK" | "BREVO";

/** The provider is chosen in Admin > Email settings (stored in the database). */
export function getEmailProvider(name: EmailProviderName): EmailProvider {
  if (name === "BREVO") return new BrevoEmailProvider();
  return new MockEmailProvider();
}
