import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
export const metadata: Metadata = { title: "Student Payment Portal", description: "Secure student payment portal", icons: { apple: "/apple-touch-icon.png" } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body className="min-h-screen bg-[#0d0a14] text-slate-100 antialiased"><Providers>{children}</Providers></body></html>; }
