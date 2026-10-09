import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIpFromHeaderRecord } from "@/lib/rate-limit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [CredentialsProvider({
    name: "credentials",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials, req) {
      const ip = getClientIpFromHeaderRecord(req?.headers as Record<string, string | string[] | undefined> | undefined);
      if (!checkRateLimit(`login:${ip}`, 5, 10 * 60 * 1000).allowed) throw new Error("Too many login attempts. Please wait a few minutes.");
      if (!credentials?.email || !credentials?.password) return null;
      const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase().trim() } });
      if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, role: user.role } as any;
    },
  })],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.id = (user as any).id; token.role = (user as any).role; } return token; },
    async session({ session, token }) { if (session.user) { (session.user as any).id = token.id; (session.user as any).role = token.role; } return session; },
  },
  secret: process.env.AUTH_SECRET,
};
