import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SRC_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const superAdminPassword = process.env.SRC_SUPER_ADMIN_PASSWORD;
  const adminEmail = process.env.SRC_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SRC_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error("Set SRC_SUPER_ADMIN_EMAIL and SRC_SUPER_ADMIN_PASSWORD before running the seed.");
  }
  if (superAdminPassword.length < 12) throw new Error("SRC_SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  if (adminPassword && adminPassword.length < 12) throw new Error("SRC_ADMIN_PASSWORD must be at least 12 characters.");

  // Kept only as a compatibility record for the existing multi-department schema.
  // The SRC UI does not ask students to select an academic session.
  const session = await prisma.academicSession.upsert({
    where: { name: "SRC-CURRENT" },
    update: { status: "ACTIVE" },
    create: { name: "SRC-CURRENT", startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2099-12-31T23:59:59Z"), status: "ACTIVE" },
  });

  const department = await prisma.department.upsert({
    where: { slug: "src" },
    update: { name: "UMaT Student Representative Council", code: "SRC", academicSessionId: session.id, fresherAmount: 0, continuingAmount: 0, status: "ACTIVE" },
    create: {
      name: "UMaT Student Representative Council", code: "SRC", slug: "src", academicSessionId: session.id,
      fresherAmount: 0, continuingAmount: 0,
      paymentConfig: { create: { provider: "PAYSTACK", environment: "TEST" } },
      smsConfig: { create: { senderId: "UMATSRC", enabled: false } },
      emailConfig: { create: { enabled: false } },
    },
  });

  const superPasswordHash = await bcrypt.hash(superAdminPassword, 12);
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {}, // never reset an existing Super Admin from env vars
    create: { name: "SRC Super Admin", email: superAdminEmail, passwordHash: superPasswordHash, role: "SUPER_ADMIN", departmentId: null },
  });

  // Optional bootstrap admin. The Super Admin can create more admins later
  // from /admins without editing environment variables or redeploying.
  if (adminEmail && adminPassword) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {}, // never reset an existing Admin from env vars
      create: { name: "SRC Administrator", email: adminEmail, passwordHash: adminPasswordHash, role: "DEPARTMENT_ADMIN", departmentId: department.id },
    });
  }

  console.log("SRC payment system seeded.");
  console.log("Public payment page: /d/src");
  console.log(`Super Admin login: ${superAdminEmail}`);
  if (adminEmail && adminPassword) console.log(`Initial Admin login: ${adminEmail}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
