// app/layout.tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OFI Pro - Forex Market Intelligence",
  description: "Trade forex with order flow clarity.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${manrope.className} bg-slate-950 text-slate-200`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="ofi-theme">
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
