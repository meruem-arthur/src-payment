/**
 * Vendor-neutral payment provider abstraction.
 *
 * Nothing outside this `payments/` directory should ever import
 * provider-specific code directly. Route handlers and
 * services depend only on this interface, obtained through
 * `getPaymentProvider()` in provider-factory.ts.
 */

export type InitiatePaymentInput = {
  amount: number; // in major currency unit (e.g. GHS), converted to minor unit inside the provider impl
  currency: string;
  email?: string;
  phone: string;
  internalReference: string; // our own unique reference, always sent as provider metadata
  metadata: {
    studentReference: string;
    studentId: string;
    paymentId?: string;
    items?: { id: string; label: string; amount: number }[];
  };
  callbackUrl: string;
};

export type InitiatePaymentResult = {
  authorizationUrl: string; // URL to redirect / link the student to
  providerReference: string; // provider's own reference for this attempt
};

export type VerifiedTransaction = {
  success: boolean;
  // Finer-grained than `success`, for callers that need to tell "definitely
  // failed" apart from "not finished yet" (the reconcile job must never mark
  // a still-in-progress payment as failed). Optional so existing adapters,
  // webhook payload parsing and test mocks that only know `success` keep
  // working - a missing value means "not success, outcome unknown".
  state?: "SUCCESS" | "FAILED" | "PENDING";
  providerTxId: string;
  internalReference: string; // parsed back out of metadata
  amount: number;
  currency: string;
  paidAt: Date | null;
  raw: unknown;
};

export type ProviderCredentials = {
  publicKey?: string | null;
  secretKey?: string | null;
  webhookSecret?: string | null;
  // Provider-specific "Payment Link / Configuration" value entered on the
  // system settings. Each adapter decides what it means (a Paystack subaccount/split code) - nothing outside
  // the matching *.provider.ts file should try to interpret it.
  configValue?: string | null;
  environment: "TEST" | "LIVE";
};

export interface PaymentProvider {
  readonly name: "PAYSTACK";

  /** Create a hosted payment session / link for a student to pay. */
  initiatePayment(input: InitiatePaymentInput, credentials: ProviderCredentials): Promise<InitiatePaymentResult>;

  /**
   * Verify a transaction directly with the provider's API (defense in depth
   * alongside webhook signature check). The provider verifies using the reference and transaction identifier supplied
   * here, then returns a normalized transaction result.
   */
  verifyTransaction(
    identifiers: { providerTxId: string; internalReference: string },
    credentials: ProviderCredentials
  ): Promise<VerifiedTransaction>;

  /** Validate that an inbound webhook request genuinely originated from the provider. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null, credentials: ProviderCredentials): boolean;

  /** Parse the webhook body into our normalized transaction shape. */
  parseWebhookPayload(rawBody: string): VerifiedTransaction & { providerEventId: string };
}
