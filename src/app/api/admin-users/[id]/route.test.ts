import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { PATCH } from "./route";

const db = vi.mocked(prisma, true);
const session = vi.mocked(getServerSession);
const req = (body: unknown) => new NextRequest("http://localhost/api/admin-users/u2", { method: "PATCH", body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: { id } });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/admin-users/[id]", () => {
  it("rejects a plain Admin", async () => {
    session.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } } as any);
    expect((await PATCH(req({ name: "New Name" }), ctx("u2"))).status).toBe(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("lets a Super Admin edit another admin", async () => {
    session.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN" } } as any);
    db.user.findUnique.mockResolvedValueOnce({ id: "u2", email: "a@x.com", status: "ACTIVE", passwordHash: "h" } as any);
    db.user.update.mockResolvedValue({ id: "u2", name: "New Name" } as any);
    const res = await PATCH(req({ name: "New Name", status: "SUSPENDED" }), ctx("u2"));
    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "New Name", status: "SUSPENDED" } }));
  });

  it("blocks suspending your own account", async () => {
    session.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN" } } as any);
    db.user.findUnique.mockResolvedValueOnce({ id: "u1", email: "me@x.com", status: "ACTIVE", passwordHash: "h" } as any);
    expect((await PATCH(req({ status: "SUSPENDED" }), ctx("u1"))).status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("needs the current password to change your own email", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
    session.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN" } } as any);
    db.user.findUnique.mockResolvedValue({ id: "u1", email: "me@x.com", status: "ACTIVE", passwordHash } as any);
    expect((await PATCH(req({ email: "new@x.com", currentPassword: "wrong" }), ctx("u1"))).status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
