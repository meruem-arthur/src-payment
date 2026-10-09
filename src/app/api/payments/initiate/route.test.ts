import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: { paymentProviderConfiguration: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/payments/initiate", { method: "POST", body: JSON.stringify(body) }));
const valid = { fullName: "Kwame Mensah", referenceNumber: "UMaT/2026/001", phone: "0244000000", email: "kwame@example.com", items: ["HELMET"] };

describe("POST /api/payments/initiate - required fields", () => {
  it("requires an email address", async () => {
    for (const email of ["", "   ", undefined]) {
      const res = await post({ ...valid, email });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/email/i);
    }
    expect(prisma.paymentProviderConfiguration.findUnique).not.toHaveBeenCalled();
  });
  it("rejects a malformed email", async () => {
    expect((await post({ ...valid, email: "not-an-email" })).status).toBe(400);
  });
  it("accepts a valid email and moves on to the provider check", async () => {
    vi.mocked(prisma.paymentProviderConfiguration.findUnique).mockResolvedValue(null as any);
    const res = await post(valid);
    expect(res.status).toBe(503); // got past validation; provider just isn't configured in this test
  });
});
