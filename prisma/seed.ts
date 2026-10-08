import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SRC_ADMIN_EMAIL || "src-admin@umat.local";
  const adminPassword = process.env.SRC_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("Set SRC_ADMIN_PASSWORD before running the seed.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const session = await prisma.academicSession.upsert({
    where: { name: "SRC-CURRENT" },
    update: { status: "ACTIVE" },
    create: {
      name: "SRC-CURRENT",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2099-12-31T23:59:59Z"),
      status: "ACTIVE",
    },
  });

  const department = await prisma.department.upsert({
    where: { slug: "src" },
    update: {
      name: "UMaT Student Representative Council",
      code: "SRC",
      academicSessionId: session.id,
      fresherAmount: 0,
      continuingAmount: 0,
      status: "ACTIVE",
    },
    create: {
      name: "UMaT Student Representative Council",
      code: "SRC",
      slug: "src",
      academicSessionId: session.id,
      fresherAmount: 0,
      continuingAmount: 0,
      paymentConfig: { create: { provider: "PAYSTACK", environment: "LIVE" } },
      smsConfig: { create: { senderId: "UMATSRC", enabled: false } },
      emailConfig: { create: { enabled: false } },
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "DEPARTMENT_ADMIN", departmentId: department.id, status: "ACTIVE" },
    create: {
      name: "SRC Administrator",
      email: adminEmail,
      passwordHash,
      role: "DEPARTMENT_ADMIN",
      departmentId: department.id,
    },
  });

  console.log("SRC payment system seeded.");
  console.log(`Public payment page: /d/src`);
  console.log(`Admin login: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
