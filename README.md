# Student Payment Portal

A single-system payment portal. Students visit the root URL (`/`) to choose purchasable items and pay. There are no student-facing slugs, department pages, academic sessions, student levels, CSV student imports, or dues-clearance workflows.

## Routes

- `/` — public student checkout (main domain, no slug)
- `/payment-status` — payment-return information
- `/admin/login` — the single administrator sign-in page
- `/admin` — payment dashboard; Super Admin accounts also see system-wide provider settings
- `/api/payments/initiate` — validates checkout selections server-side and initializes a provider transaction
- `/api/payments/status` — payment-status polling; `/api/receipts/download?ref=…` — PDF receipt for a confirmed payment
- `/api/admin/receipt-settings` — Super Admin-only President/Treasurer names and signature images printed on PDF receipts
- `/api/admin/sms-settings` — Super Admin-only SMS provider, API key, sender ID and message template
- `/api/webhooks/paystack` — verifies Paystack signatures and independently verifies successful transactions before issuing a receipt
- `/api/admin/payments` — authenticated payment records and dashboard totals
- `/api/admin/settings` — Super Admin-only global payment-provider configuration
- `/api/admin-users` — Super Admin-only administrator account management

The login credentials determine the user's role (`SUPER_ADMIN` or `ADMIN`). Admins use the same login URL; authorization is enforced server-side.

## Requirements

- Node.js 20+
- PostgreSQL
- Paystack account for hosted checkout (Paystack is the configured and verified provider in this version)

## Configure and run

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`, and the initial Super Admin credentials. Generate keys with `openssl rand -base64 32`.
2. Install dependencies: `npm ci`.
3. Apply database migrations: `npx prisma migrate deploy`.
4. Generate Prisma Client: `npx prisma generate`.
5. Seed the initial administrator and singleton payment configuration: `npm run prisma:seed`.
6. Start locally: `npm run dev`; for production: `npm run build` then `npm start`.
7. Sign in at `/admin/login` (no link on the public page - go to the URL directly). A Super Admin sets the Paystack keys under Payment settings and the SMS provider, API key and sender ID under SMS settings. The President/Treasurer signatories for receipts and the portal QR code are under Receipts & QR (Super Admin only).

Never commit `.env` or real payment-provider secrets. Provider secret and webhook keys are encrypted at rest using `ENCRYPTION_KEY`; do not change that key after saving credentials unless you first decrypt/re-encrypt the stored secrets.

## Database

The project ships a single initial migration (`20261009000000_init`) that creates the whole single-system schema. For a fresh or wiped database run `npx prisma migrate deploy` (or `npx prisma migrate reset --force` to wipe an existing development database first), then `npm run prisma:seed`. Back up production data before running any migration.

## Important operational notes

- Payment amounts and product IDs are validated server-side; never trust a client-submitted amount.
- A payment is not considered successful based on the browser redirect. The webhook validates the signature and verifies the transaction with Paystack before marking it successful.
- Configure Paystack's webhook URL as `https://YOUR_DOMAIN/api/webhooks/paystack`.
- The current checkout catalogue and prices are defined in `src/lib/catalog.ts` (used by both the checkout page and the server); change them there only.
