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

If email/SMS/Sentry are not needed tomorrow, they can remain unset.

### 3. Deploy

The build command runs:

```bash
prisma migrate deploy && next build
```

The included migration adds the SRC payment line-item JSON field.

### 4. Create the SRC admin

Set these temporarily when running the seed:

```env
SRC_ADMIN_EMAIL="your-admin-email"
SRC_ADMIN_PASSWORD="your-strong-password"
```

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
- Webhook Secret, if your Paystack setup provides/uses one
- Paystack Subaccount Code: `ACCT_...`

The secret values are encrypted before being stored.

### 6. Paystack webhook

Configure Paystack to send events to:

```text
https://your-domain.com/api/webhooks/paystack
```

The webhook is verified with the Paystack secret and the transaction is re-verified directly with Paystack before the payment is marked successful.

## Important

Do not put the Paystack secret key in frontend code.

Do not trust an amount supplied by the browser.

Do not mark a payment successful merely because the student returns to the callback URL.

The server calculates the item total, creates the pending payment record, initializes Paystack, verifies the webhook, re-verifies the transaction, and only then issues the receipt.
