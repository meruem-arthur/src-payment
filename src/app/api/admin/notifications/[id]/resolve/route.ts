import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authorization";
import { captureError } from "@/lib/monitoring/capture-error";

// "Mark fixed": hides a failed send from the list once an admin has dealt with it.
// The log row is kept (resolvedAt / resolvedBy), never deleted.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const done = await prisma.notificationLog.updateMany({ where: { id: params.id, status: "FAILED", resolvedAt: null }, data: { resolvedAt: new Date(), resolvedBy: user.id } });
    if (done.count === 0) return NextResponse.json({ error: "That failure was not found or is already marked fixed." }, { status: 404 });
    return NextResponse.json({ resolved: true });
  } catch (e: any) {
    if (!e?.status) captureError(e);
    return NextResponse.json({ error: e?.status === 401 ? "Sign in required" : "Could not update this entry" }, { status: e?.status || 500 });
  }
}
