# UMaT SRC Cashless Payment System

A focused one-department cashless collection portal for the UMaT Student Representative Council.

## What it does

- One public QR destination: `/d/src`
- No student accounts
- Student enters:
  - Full name
  - Student ID / reference number
  - Phone
  - Optional email
- Student selects any combination of:
  - Drawing Board — GHS 390
  - Safety Boot — GHS 300
  - Helmet — GHS 60
  - Goggles — GHS 45
  - Earplugs — GHS 15
  - Safety Vest — GHS 50
- Total is calculated on the server, not trusted from the browser.
- Drawing Board + complete PPE = GHS 860.
- Paystack Checkout handles the payment.
- Paystack webhook + server-side verification confirms payment.
- Successful payments receive a unique receipt and downloadable PDF.
- Receipt includes the purchased items, amount, student details, receipt number and verification QR.
- Admin dashboard retains the payment history.
- Paystack subaccount code is configurable from the admin payment settings.

## Paystack settlement

The SRC portal uses one Paystack subaccount as the settlement destination.

The code sends:

```text
subaccount: ACCT_xxxxx
bearer: "subaccount"
```

No dynamic split logic is used.

For the intended setup, create the SRC subaccount under the approved Paystack integration with a `percentage_charge` of `0`, so the main account does not receive a percentage of the collection. Paystack's transaction fee can be borne by the subaccount through `bearer: "subaccount"`.

Always verify the SRC bank account details before creating/using the subaccount.

## Deployment

### 1. Neon

Create a PostgreSQL database and set:

```env
DATABASE_URL="..."
```

### 2. Vercel environment variables

Set at minimum:

```env
DATABASE_URL="..."
AUTH_SECRET="..."
NEXT_PUBLIC_APP_URL="https://your-domain.com"
ENCRYPTION_KEY="..."
CRON_SECRET="..."
```

If email/SMS/Sentry are not needed for launch, they can remain unset. `SENTRY_DSN` is optional error monitoring. `CRON_SECRET` protects the scheduled payment-reconciliation endpoint; generate a random value with `openssl rand -hex 32`. `ENCRYPTION_KEY` must be a base64-encoded 32-byte key (`openssl rand -base64 32`) before saving Paystack/SMS secrets through the admin UI. SMS provider API credentials and sender ID are configured in the admin's SRC SMS Settings; setting `SMS_PROVIDER` alone does not supply an API key. Email delivery requires `EMAIL_PROVIDER=BREVO`, `EMAIL_API_KEY`, and a verified `EMAIL_FROM_ADDRESS` if receipts should be emailed.

### 3. Deploy

The build command runs:

```bash
prisma migrate deploy && next build
```

The included migration adds the SRC payment line-item JSON field.

### 4. Create the first Super Admin (required)

Set these environment variables before running the seed. Use a unique password of at least 12 characters.

```env
SRC_SUPER_ADMIN_EMAIL="your-super-admin-email"
SRC_SUPER_ADMIN_PASSWORD="a-unique-password-at-least-12-characters"
```

Optionally create the first day-to-day Admin at the same time:

```env
SRC_ADMIN_EMAIL="your-admin-email"
SRC_ADMIN_PASSWORD="another-unique-password-at-least-12-characters"
```

Run `npm run prisma:seed` once against the production Neon database. The seed creates the SRC department, the Super Admin, and the optional initial Admin. Afterward, the Super Admin can create additional Admins at `/admins`; no redeploy or environment change is needed for future Admin accounts. Do not expose a public Super Admin registration route and do not commit real credentials.

Then run:

```bash
npm run prisma:seed
```

This creates the single `src` department and `/d/src` public portal.

### 5. Configure Paystack

Log in to the SRC admin area:

```text
Departments → SRC → Payment Configuration
```

Set:

- Provider: Paystack
- Environment: Live
- Public Key
- Secret Key
- No separate webhook secret is required for Paystack: the webhook signature is HMAC-SHA512 verified with the Paystack Secret Key. (The separate webhook-secret field is used by other providers in the inherited multi-provider engine.)
- Paystack Subaccount Code: `ACCT_...`

The secret values are encrypted before being stored.

### 6. Paystack webhook

Configure Paystack to send events to:

```text
https://your-domain.com/api/webhooks/paystack
```

The webhook is verified using the Paystack Secret Key (the `x-paystack-signature` is an HMAC-SHA512 signature). The URL is where Paystack sends the event; it is not itself a secret. The transaction is then re-verified directly with Paystack before the payment is marked successful.

## Important

Do not put the Paystack secret key in frontend code.

Do not trust an amount supplied by the browser.

Do not mark a payment successful merely because the student returns to the callback URL.

The server calculates the item total, creates the pending payment record, initializes Paystack, verifies the webhook, re-verifies the transaction, and only then issues the receipt.
