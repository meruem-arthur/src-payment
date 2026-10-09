import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
export type SessionUser = { id: string; name: string; email: string; role: "SUPER_ADMIN" | "ADMIN" };
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? session.user as SessionUser : null;
}
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new Error("Not authenticated"), { status: 401 });
  return user;
}
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "SUPER_ADMIN") throw Object.assign(new Error("Super Admin access required"), { status: 403 });
  return user;
}
export async function requireAdmin(): Promise<SessionUser> { return requireAuth(); }
