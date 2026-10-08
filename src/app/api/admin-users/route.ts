import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/authorization";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

function errorResponse(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status: unknown }).status);
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: status === 401 ? "Sign in required" : "Super Admin access required" }, { status });
    }
  }
  console.error("Admin user management error", error);
  return NextResponse.json({ error: "Unable to complete admin user request" }, { status: 500 });
}

// Only the Super Admin can list or create SRC admins. Department Admins
// receive 403 even if they call this endpoint directly.
export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await prisma.user.findMany({
      where: { role: "DEPARTMENT_ADMIN", department: { slug: "src" } },
      select: { id: true, name: true, email: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password of at least 12 characters." }, { status: 400 });

    const department = await prisma.department.findUnique({ where: { slug: "src" }, select: { id: true } });
    if (!department) return NextResponse.json({ error: "SRC department has not been seeded yet." }, { status: 409 });

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email, passwordHash, role: "DEPARTMENT_ADMIN", departmentId: department.id, status: "ACTIVE" },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
