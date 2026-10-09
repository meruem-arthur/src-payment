-- CreateEnum
CREATE TYPE "EmailProviderType" AS ENUM ('MOCK', 'BREVO');

-- CreateTable
CREATE TABLE "email_configurations" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" "EmailProviderType" NOT NULL DEFAULT 'MOCK',
    "senderName" TEXT NOT NULL DEFAULT 'UMaT SRC',
    "senderEmail" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT 'Payment receipt {receipt} - UMaT SRC',
    "messageTemplate" TEXT NOT NULL DEFAULT E'Dear {name},\n\nYour payment of GHS {amount} for {items} has been received. Thank you.\n\nReference: {reference}\nReceipt number: {receipt}\n\nYour PDF receipt is attached to this email.\n\nUMaT SRC',
    "apiKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_configurations_pkey" PRIMARY KEY ("id")
);
