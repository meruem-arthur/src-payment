-- CreateEnum
CREATE TYPE "SmsProviderType" AS ENUM ('MOCK', 'ARKESEL', 'AFRICASTALKING');

-- CreateTable
CREATE TABLE "sms_configurations" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" "SmsProviderType" NOT NULL DEFAULT 'MOCK',
    "senderId" TEXT NOT NULL DEFAULT '',
    "messageTemplate" TEXT NOT NULL DEFAULT E'UMaT SRC: Payment of GHS {amount} confirmed for {name} ({reference}).\nItems: {items}\nReceipt No: {receipt}',
    "apiKey" TEXT,
    "username" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_configurations_pkey" PRIMARY KEY ("id")
);
