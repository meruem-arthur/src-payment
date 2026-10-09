import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
export const metadata: Metadata = { title: "Student Payment Portal", description: "Secure student payment portal", icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.png?v=2", type: "image/png", sizes: "256x256" }], shortcut: "/favicon.ico", apple: "/apple-touch-icon.png?v=2" } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body className="min-h-screen bg-[#0d0a14] text-slate-100 antialiased"><Providers>{children}</Providers></body></html>; }
