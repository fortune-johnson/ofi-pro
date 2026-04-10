import { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type PageShellProps = {
  children: ReactNode;
  transparentHeader?: boolean;
};

export function PageShell({
  children,
  transparentHeader = false,
}: PageShellProps) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_20%),radial-gradient(circle_at_80%_12%,_rgba(16,185,129,0.1),_transparent_22%),radial-gradient(circle_at_12%_28%,_rgba(244,114,182,0.08),_transparent_18%),linear-gradient(180deg,_#04111d_0%,_#071521_38%,_#050b16_100%)] text-white">
      <SiteHeader transparent={transparentHeader} />
      <div className="relative pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(7,21,33,0.55),transparent)]" />
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}
