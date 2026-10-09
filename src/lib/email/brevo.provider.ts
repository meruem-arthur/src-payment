import type { EmailCredentials, EmailProvider, SendEmailInput, SendEmailResult } from "./provider.interface";

/**
 * Brevo (formerly Sendinblue) transactional email over its HTTPS API.
 * A plain web request, so it works on Vercel (unlike SMTP).
 *
 *   POST https://api.brevo.com/v3/smtp/email
 *   Headers: api-key: <key>, Content-Type: application/json
 *   Body:    { sender: {name, email}, to: [{email}], subject, textContent, attachment?: [{name, content(base64)}] }
 *   Success: 201 { messageId }
 *
 * Two things must be true on the Brevo side or sends fail:
 *  1. The sender address (or its whole domain) is verified in Brevo.
 *  2. "Authorised IPs" blocking is off (Security > Authorised IPs). Vercel's
 *     outbound IPs change, so an allowlist makes Brevo reject the call.
 *     That rejection is turned into a readable hint below.
 */
const SEND_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 15_000;

export class BrevoEmailProvider implements EmailProvider {
  async send(input: SendEmailInput, credentials: EmailCredentials): Promise<SendEmailResult> {
    if (!credentials.apiKey) return { success: false, error: "Brevo API key is not saved (Admin > Email settings)" };
    if (!input.from.email) return { success: false, error: "No sender email address is set (Admin > Email settings)" };

    const payload = {
      sender: { name: input.from.name, email: input.from.email },
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.body,
      ...(input.attachments?.length ? { attachment: input.attachments.map((a) => ({ name: a.filename, content: a.content.toString("base64") })) } : {}),
    };

    let res: Response;
    try {
      res = await fetch(SEND_URL, {
        method: "POST",
        headers: { "api-key": credentials.apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      return { success: false, error: `Could not reach Brevo: ${(err as Error).message}` };
    }

    const data = await res.json().catch(() => null);
    if (res.ok) return { success: true };

    const message: string = typeof data?.message === "string" ? data.message : "";
    let detail = message ? `${data?.code ?? "error"}: ${message}` : `HTTP ${res.status}`;
    if (res.status === 401 && /ip address/i.test(message)) {
      detail += " - In Brevo, go to Security > Authorised IPs and deactivate IP blocking (Vercel's IP addresses change).";
    }
    return { success: false, error: `Brevo rejected the email - ${detail}` };
  }
}
