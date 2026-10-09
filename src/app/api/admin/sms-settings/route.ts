import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/authorization";
import { encryptSecret } from "@/lib/crypto/field-encryption";
import { captureError } from "@/lib/monitoring/capture-error";

// Super Admin only. The API key is encrypted at rest and never sent back to
// the browser - only whether one is saved.
const schema = z.object({
  provider: z.enum(["MOCK", "ARKESEL", "AFRICASTALKING"]),
  senderId: z.string().trim().max(11, "Sender ID must be 11 characters or fewer").regex(/^[A-Za-z0-9]*$/, "Sender ID can only contain letters and numbers (no spaces)").optional().default(""),
  messageTemplate: z.string().trim().min(1, "Message template is required").max(480, "Message template is too long"),
  username: z.string().trim().max(100).optional().default(""),
  apiKey: z.string().trim().max(500).optional().default(""),
  enabled: z.boolean(),
});

const view = (c: { provider: string; senderId: string; messageTemplate: string; username: string | null; apiKey: string | null; enabled: boolean }) => ({
  provider: c.provider, senderId: c.senderId, messageTemplate: c.messageTemplate, username: c.username ?? "", hasApiKey: Boolean(c.apiKey), enabled: c.enabled,
});
const fail = (e: any) => NextResponse.json({ error: e?.status === 401 ? "Sign in required" : e?.status === 403 ? "Super Admin access required" : "Something went wrong" }, { status: e?.status || 500 });

export async function GET() {
  try {
    await requireSuperAdmin();
    const c = await prisma.smsConfiguration.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    return NextResponse.json({ config: view(c) });
  } catch (e: any) { if (!e?.status) captureError(e); return fail(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireSuperAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid SMS settings" }, { status: 400 });
    const b = parsed.data;
    if (b.enabled && b.provider === "AFRICASTALKING" && !b.username) return NextResponse.json({ error: "Africa's Talking needs a username (use \"sandbox\" for testing)." }, { status: 400 });
    const existing = await prisma.smsConfiguration.findUnique({ where: { id: "singleton" } });
    const hasKey = Boolean(b.apiKey) || Boolean(existing?.apiKey);
    if (b.enabled && b.provider !== "MOCK" && !hasKey) return NextResponse.json({ error: "Enter the SMS API key before turning SMS on." }, { status: 400 });

    // A blank API key means "keep the saved one".
    const data = { provider: b.provider, senderId: b.senderId, messageTemplate: b.messageTemplate, username: b.username || null, enabled: b.enabled, ...(b.apiKey ? { apiKey: encryptSecret(b.apiKey) } : {}) };
    const c = await prisma.smsConfiguration.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    await prisma.auditLog.create({ data: { userId: user.id, action: "SMS_CONFIG_UPDATED", entity: "SmsConfiguration", entityId: c.id, metadata: { provider: c.provider, senderId: c.senderId, enabled: c.enabled, apiKeyChanged: Boolean(b.apiKey) } } }).catch(() => {});
    return NextResponse.json({ saved: true, config: view(c) });
  } catch (e: any) { if (!e?.status) captureError(e); return fail(e); }
}
