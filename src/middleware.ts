import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") return NextResponse.next();
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) { const url = new URL("/admin/login", req.url); url.searchParams.set("callbackUrl", req.nextUrl.pathname); return NextResponse.redirect(url); }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*"] };
