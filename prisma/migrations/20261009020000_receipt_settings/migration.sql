-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "presidentName" TEXT,
    "presidentSignature" TEXT,
    "treasurerName" TEXT,
    "treasurerSignature" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);
