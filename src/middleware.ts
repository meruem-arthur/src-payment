export { default } from "next-auth/middleware";

// Route-level gate: unauthenticated visitors to any admin page are sent to
// /admin/login. The public payment page (/), /payment-status, /verify and the
// login pages are deliberately NOT matched. Fine-grained role checks still
// happen server-side in every API route and page.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/departments/:path*",
    "/students/:path*",
    "/sessions/:path*",
    "/admins/:path*",
    "/settings/:path*",
  ],
};
