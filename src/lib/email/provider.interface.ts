export type SendEmailInput = {
  to: string;
  subject: string;
  /** Plain-text body. */
  body: string;
  from: { email: string; name: string };
  attachments?: { filename: string; content: Buffer }[];
};

export type SendEmailResult = { success: boolean; error?: string };

export type EmailCredentials = { apiKey?: string | null };

export interface EmailProvider {
  send(input: SendEmailInput, credentials: EmailCredentials): Promise<SendEmailResult>;
}
