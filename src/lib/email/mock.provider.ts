import type { EmailProvider, SendEmailInput, SendEmailResult } from "./provider.interface";

/** Test mode: logs the send (no addresses beyond the recipient) and reports success. Sends nothing. */
export class MockEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const files = input.attachments?.length ? ` attachments=[${input.attachments.map((a) => a.filename).join(", ")}]` : "";
    console.log(`[MockEmail] to=${input.to} subject="${input.subject}"${files}`);
    return { success: true };
  }
}
