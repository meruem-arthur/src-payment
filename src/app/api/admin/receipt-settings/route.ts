import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/authorization";
import { captureError } from "@/lib/monitoring/capture-error";

// Super Admin only: who signs the PDF receipts (President + Treasurer).
// Signatures are uploaded as images and stored as PNG/JPEG data URLs.
// For each signature: omitted = keep what is saved, null = remove it,
// a data URL = replace it.
const MAX_SIGNATURE_CHARS = 400_000; // roughly 300 KB of image
const signature = z.union([z.string().regex(/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/, "Signatures must be PNG or JPEG images").max(MAX_SIGNATURE_CHARS, "Signature image is too large"), z.null()]).optional();
const schema = z.object({
  presidentName: z.string().trim().max(100).optional().default(""),
  treasurerName: z.string().trim().max(100).optional().default(""),
  presidentSignature: signature,
  treasurerSignature: signature,
});

const view = (c: { presidentName: string | null; presidentSignature: string | null; treasurerName: string | null; treasurerSignature: string | null }) => ({
  presidentName: c.presidentName ?? "", presidentSignature: c.presidentSignature, treasurerName: c.treasurerName ?? "", treasurerSignature: c.treasurerSignature,
});
const fail = (e: any) => NextResponse.json({ error: e?.status === 401 ? "Sign in required" : e?.status === 403 ? "Super Admin access required" : "Something went wrong" }, { status: e?.status || 500 });

export async function GET() {
  try {
    await requireSuperAdmin();
    const c = await prisma.receiptSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    return NextResponse.json({ config: view(c) });
  } catch (e: any) { if (!e?.status) captureError(e); return fail(e); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireSuperAdmin();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid receipt settings" }, { status: 400 });
    const b = parsed.data;
    const data = {
      presidentName: b.presidentName || null,
      treasurerName: b.treasurerName || null,
      ...(b.presidentSignature !== undefined ? { presidentSignature: b.presidentSignature } : {}),
      ...(b.treasurerSignature !== undefined ? { treasurerSignature: b.treasurerSignature } : {}),
    };
    const c = await prisma.receiptSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    await prisma.auditLog.create({ data: { userId: user.id, action: "RECEIPT_SETTINGS_UPDATED", entity: "ReceiptSettings", entityId: c.id, metadata: { presidentSignatureChanged: b.presidentSignature !== undefined, treasurerSignatureChanged: b.treasurerSignature !== undefined } } }).catch(() => {});
    return NextResponse.json({ saved: true, config: view(c) });
  } catch (e: any) { if (!e?.status) captureError(e); return fail(e); }
}
