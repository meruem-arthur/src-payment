import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/provider-factory";
import { decryptPaymentSecrets } from "@/lib/crypto/field-encryption";
import { captureError } from "@/lib/monitoring/capture-error";

const PRODUCTS = {
  DRAWING_BOARD: { label: "Drawing Board", amount: 390 },
  SAFETY_BOOT: { label: "Safety Boot", amount: 300 },
  HELMET: { label: "Helmet", amount: 60 },
  GOGGLES: { label: "Goggles", amount: 45 },
  EARPLUGS: { label: "Earplugs", amount: 15 },
  VEST: { label: "Safety Vest", amount: 50 },
} as const;

type ProductId = keyof typeof PRODUCTS;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json();
    const departmentSlug = clean(input.departmentSlug);
    const fullName = clean(input.fullName);
    const referenceNumber = clean(input.referenceNumber);
    const phone = clean(input.phone);
    const email = clean(input.email);
    const items = Array.isArray(input.items) ? input.items : [];

    if (!departmentSlug || !fullName || !referenceNumber || !phone) {
      return NextResponse.json({ error: "Name, reference number and phone are required." }, { status: 400 });
    }

    const validItems = items.filter((id: unknown): id is ProductId => typeof id === "string" && id in PRODUCTS);
    const uniqueItems = [...new Set(validItems)];
    if (uniqueItems.length === 0 || uniqueItems.length !== items.length) {
      return NextResponse.json({ error: "Please select valid SRC payment items." }, { status: 400 });
    }

    const department = await prisma.department.findUnique({
      where: { slug: departmentSlug },
      include: { paymentConfig: true },
    });
    if (!department || department.status === "ARCHIVED") {
      return NextResponse.json({ error: "SRC payment portal is unavailable." }, { status: 404 });
    }
    if (!department.paymentConfig?.secretKey) {
      return NextResponse.json({ error: "SRC Paystack is not configured yet." }, { status: 400 });
    }
    if (department.paymentConfig.provider !== "PAYSTACK") {
      return NextResponse.json({ error: "SRC cashless portal must use Paystack." }, { status: 400 });
    }
    if (!department.paymentConfig.configValue) {
      return NextResponse.json({ error: "SRC Paystack subaccount is not configured yet." }, { status: 400 });
    }

    // The amount is calculated ONLY on the server from the approved SRC price list.
    const lineItems = uniqueItems.map((id) => ({ id, label: PRODUCTS[id].label, amount: PRODUCTS[id].amount }));
    const amount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // The legacy database has an academic-session relation. SRC does not expose
    // or use sessions; we maintain one internal system session solely to satisfy
    // the existing relational schema while keeping it completely invisible.
    let session = await prisma.academicSession.findFirst({
      where: { name: "SRC-CURRENT" },
      orderBy: { createdAt: "asc" },
    });
    if (!session) {
      session = await prisma.academicSession.create({
        data: {
          name: "SRC-CURRENT",
          startDate: new Date("2026-01-01T00:00:00Z"),
          endDate: new Date("2099-12-31T23:59:59Z"),
          status: "ACTIVE",
        },
      });
    }

    // Keep the one SRC department tied to the internal session if the imported
    // project was created with a different session.
    if (department.academicSessionId !== session.id) {
      await prisma.department.update({
        where: { id: department.id },
        data: { academicSessionId: session.id },
      });
      department.academicSessionId = session.id;
    }

    let student = await prisma.student.findFirst({
      where: {
        departmentId: department.id,
        academicSessionId: session.id,
        referenceNumber,
      },
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          departmentId: department.id,
          academicSessionId: session.id,
          referenceNumber,
          fullName,
          phone,
          email: email || null,
          level: "L100",
          registrationSource: "SELF",
        },
      });
    } else {
      student = await prisma.student.update({
        where: { id: student.id },
        data: { fullName, phone, email: email || null },
      });
    }

    // A student may make one SRC purchase transaction. A successful existing
    // payment is blocked to prevent accidental double collection.
    if (student.paymentStatus === "SUCCESS") {
      return NextResponse.json(
        { error: "A successful SRC payment already exists for this reference number. Please use your receipt or contact SRC if you need a correction." },
        { status: 409 }
      );
    }

    const recentPending = await prisma.payment.findFirst({
      where: {
        studentId: student.id,
        status: "PENDING",
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recentPending) {
      return NextResponse.json({ error: "A payment is already being processed for this reference number. Please wait a few minutes." }, { status: 409 });
    }

    const internalReference = `SRC-${new Date().getFullYear()}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const pendingPayment = await prisma.payment.create({
      data: {
        studentId: student.id,
        departmentId: department.id,
        academicSessionId: session.id,
        provider: department.paymentConfig.provider,
        internalReference,
        amount,
        currency: "GHS",
        paymentType: "CONTINUING",
        items: lineItems,
        status: "PENDING",
      },
    });

    const provider = getPaymentProvider("PAYSTACK");

    const paymentConfig = decryptPaymentSecrets(department.paymentConfig);

    try {
      const result = await provider.initiatePayment(
        {
          amount,
          currency: "GHS",
          email: email || undefined,
          phone,
          internalReference,
          metadata: {
            paymentType: "SRC_PURCHASE",
            studentReference: referenceNumber,
            departmentId: department.id,
            studentId: student.id,
            items: lineItems,
          },
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/d/${department.slug}/payment-status?ref=${encodeURIComponent(internalReference)}`,
        },
        {
          publicKey: paymentConfig.publicKey,
          secretKey: paymentConfig.secretKey,
          webhookSecret: paymentConfig.webhookSecret,
          configValue: paymentConfig.configValue,
          environment: paymentConfig.environment,
        }
      );

      return NextResponse.json({
        authorizationUrl: result.authorizationUrl,
        paymentId: pendingPayment.id,
        reference: internalReference,
      });
    } catch (providerErr) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: "FAILED",
          failureReason: providerErr instanceof Error ? providerErr.message.slice(0, 500) : "Unknown Paystack error",
        },
      });
      throw providerErr;
    }
  } catch (err) {
    captureError(err);
    return NextResponse.json({ error: "Could not initiate payment. Please try again." }, { status: 500 });
  }
}
