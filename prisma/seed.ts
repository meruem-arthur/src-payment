import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const email = process.env.SRC_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SRC_SUPER_ADMIN_PASSWORD;
  const adminEmail = process.env.SRC_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SRC_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SRC_SUPER_ADMIN_EMAIL and SRC_SUPER_ADMIN_PASSWORD before running the seed.");
  if (password.length < 12) throw new Error("SRC_SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  if (adminPassword && adminPassword.length < 12) throw new Error("SRC_ADMIN_PASSWORD must be at least 12 characters.");
  await prisma.paymentProviderConfiguration.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", provider: "PAYSTACK", environment: "TEST" } });
  await prisma.user.upsert({ where: { email }, update: {}, create: { name: "Super Administrator", email, passwordHash: await bcrypt.hash(password, 12), role: "SUPER_ADMIN" } });
  if (adminEmail && adminPassword) await prisma.user.upsert({ where: { email: adminEmail }, update: {}, create: { name: "Administrator", email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: "ADMIN" } });
  console.log("Payment portal seeded. Student payment URL: /");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
