import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/authorization";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().email().max(254).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    // Optional password reset.
    password: z.string().min(12).max(128).optional(),
    // Required when the Super Admin changes their OWN email or password.
    currentPassword: z.string().max(128).optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined || v.status !== undefined || v.password !== undefined, {
    message: "Nothing to update",
  });

function fail(e: any) {
  const status = e?.status === 401 || e?.status === 403 ? e.status : 500;
  if (status === 500) console.error("Admin user update error", e);
  return NextResponse.json(
    { error: status === 401 ? "Sign in required" : status === 403 ? "Super Admin access required" : "Unable to update this account" },
    { status }
  );
}

// Super Admin only: edit any administrator's name, email, status or password -
// including their own details. Role is deliberately not editable here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireSuperAdmin();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Check the details: name (2+ characters), a valid email, and a password of at least 12 characters if you set one." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const isSelf = target.id === actor.id;
    const emailChanged = parsed.data.email !== undefined && parsed.data.email.toLowerCase() !== target.email;
    const passwordChanged = parsed.data.password !== undefined;

    if (isSelf) {
      if (parsed.data.status !== undefined && parsed.data.status !== target.status) {
        return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
      }
      if (emailChanged || passwordChanged) {
        const limit = checkRateLimit(`self-edit:${actor.id}`, 5, 15 * 60 * 1000);
        if (!limit.allowed) {
          return NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
        }
        const ok = parsed.data.currentPassword ? await bcrypt.compare(parsed.data.currentPassword, target.passwordHash) : false;
        if (!ok) return NextResponse.json({ error: "Enter your current password correctly to change your own email or password." }, { status: 400 });
      }
    }

    const data: { name?: string; email?: string; status?: "ACTIVE" | "SUSPENDED"; passwordHash?: string } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (emailChanged) {
      const email = parsed.data.email!.toLowerCase();
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
      data.email = email;
    }
    if (passwordChanged) data.passwordHash = await bcrypt.hash(parsed.data.password!, 12);

    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    return fail(e);
  }
}
