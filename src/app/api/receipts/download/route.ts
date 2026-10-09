import { NextRequest, NextResponse } from "next/server";
import { buildReceiptPdf } from "@/lib/receipts";
import { captureError } from "@/lib/monitoring/capture-error";

// GET /api/receipts/download?ref=<payment reference>
// Public, like the payment-status page that links to it: the reference is a
// server-generated random value (not a sequential id), so only someone who
// made the payment - or an admin looking at the dashboard - has it.
export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get("ref");
    if (!ref) return NextResponse.json({ error: "Missing ref" }, { status: 400 });
    const built = await buildReceiptPdf(ref);
    if (!built) return NextResponse.json({ error: "No confirmed payment found for that reference" }, { status: 404 });
    return new NextResponse(Buffer.from(built.pdfBytes), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${built.receiptNumber}.pdf"`, "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    captureError(err, { context: "receipt-pdf-download" });
    return NextResponse.json({ error: "Could not generate receipt" }, { status: 500 });
  }
}
