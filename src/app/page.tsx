import { prisma } from "@/lib/db";
import { SRC_SLUG } from "@/lib/src-config";
import { SrcPaymentForm } from "@/components/students/src-payment-form";

export const dynamic = "force-dynamic";

export default async function PaymentPage() {
  const department = await prisma.department.findUnique({ where: { slug: SRC_SLUG } });
  const unavailable = !department || department.status === "ARCHIVED";

  return (
    <main className="portal-shell min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="portal-content w-full max-w-2xl space-y-6">
        <div className="text-center space-y-3">
          {department?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={department.logoUrl} alt="UMaT SRC" className="portal-dept-logo mx-auto" />
          ) : null}
          <p className="text-sm font-bold uppercase tracking-widest text-portal-accent">University of Mines and Technology</p>
          <p className="text-sm font-semibold uppercase tracking-widest text-portal-muted">Student Representative Council</p>
          <h1 className="text-3xl font-extrabold text-portal-text">Cashless Payment</h1>
          <p className="mx-auto max-w-lg text-sm text-portal-muted">
            Choose what you are paying for, enter your details and pay securely with Paystack. No student account is required.
          </p>
        </div>

        {unavailable ? (
          <p className="portal-card p-6 text-center text-portal-muted">The SRC payment page is not available right now.</p>
        ) : (
          <SrcPaymentForm />
        )}

        <div className="text-center text-xs text-portal-muted">
          <p>Payments are processed securely by Paystack.</p>
          <p className="mt-1">Keep your receipt/reference after payment.</p>
        </div>
      </div>
    </main>
  );
}
