import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminManagementClient } from "@/components/admin/admin-management-client";

export default async function AdminsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "SUPER_ADMIN") redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-admin-text">Admin Management</h1>
        <p className="mt-1 text-sm text-admin-muted">Create SRC admins. Only the Super Admin can manage administrator accounts.</p>
      </div>
      <AdminManagementClient />
    </div>
  );
}
