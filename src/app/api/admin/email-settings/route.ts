import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/authorization";
import { encryptSecret } from "@/lib/crypto/field-encryption";
import { captureError } from "@/lib/monitoring/capture-error";

// Super Admin only. The API key is encrypted at rest and never sent back to
// the browser - only whether one is saved.
const schema = z.object({
  provider: z.enum(["MOCK", "BREVO"]),
  // Spaces are fine in the display name. Angle brackets / line breaks are not.
  senderName: z.string().trim().min(1, "Sender name is required").max(70, "Sender name is too long").regex(/^[^<>\r\n"]+$/, "Sender name can't contain < > quotes or line breaks"),
  senderEmail: z.string().trim().max(254).refine((v) => v === "" || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v), "Enter a valid sender email address").optional().default(""),
  subject: z.string().trim().min(1, "Subject is required").max(150, "Subject is too long"),
  messageTemplate: z.string().trim().min(1, "Message is required").max(3000, "Message is too long"),
  apiKey: z.string().trim().max(500).optional().default(""),
  enabled: z.boolean(),
});

type Row = { provider: string; senderName: string; senderEmail: string; subject: string; messageTemplate: string; apiKey: string | null; enabled: boolean };
const view = (c: Row) => ({
  provider: c.provider, senderName: c.senderName, senderEmail: c.senderEmail, subject: c.subject, messageTemplate: c.messageTemplate, hasApiKey: Boolean(c.apiKey), enabled: c.enabled,
});
const fail = (e: any) => NextResponse.json({ error: e?.status === 401 ? "Sign in required" : e?.status === 403 ? "Super Admin access required" : "Something went wrong" }, { status: e?.status || 500 });

export async function GET() {
  try {
    await requireSuperAdmin();
    const c = await prisma.emailConfiguration.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    return NextResponse.json({ config: view(c) });
  } catch (e: any) { if (!e?.status) captureError(e); return fail(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireSuperAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email settings" }, { status: 400 });
    const b = parsed.data;
    const existing = await prisma.emailConfiguration.findUnique({ where: { id: "singleton" } });
    if (b.enabled && b.provider === "BREVO") {
      if (!b.senderEmail) return NextResponse.json({ error: "Enter the sender email address before turning email on." }, { status: 400 });
      if (!b.apiKey && !existing?.apiKey) return NextResponse.json({ error: "Enter the Brevo API key before turning email on." }, { status: 400 });
    }

    // A blank API key means "keep the saved one".
    const data = { provider: b.provider, senderName: b.senderName, senderEmail: b.senderEmail, subject: b.subject, messageTemplate: b.messageTemplate, enabled: b.enabled, ...(b.apiKey ? { apiKey: encryptSecret(b.apiKey) } : {}) };
    const c = await prisma.emailConfiguration.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    await prisma.auditLog.create({ data: { userId: user.id, action: "EMAIL_CONFIG_UPDATED", entity: "EmailConfiguration", entityId: c.id, metadata: { provider: c.provider, senderEmail: c.senderEmail, enabled: c.enabled, apiKeyChanged: Boolean(b.apiKey) } } }).catch(() => {});
    return NextResponse.json({ saved: true, config: view(c) });
  } catch (e: any) {
    // encryptSecret throws a plain Error when ENCRYPTION_KEY is missing - say so instead of a vague failure.
    if (!e?.status && /ENCRYPTION_KEY/.test(String(e?.message))) return NextResponse.json({ error: "ENCRYPTION_KEY is not set on the server, so the API key can't be saved safely." }, { status: 500 });
    if (!e?.status) captureError(e);
    return fail(e);
  }
}
