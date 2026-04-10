import Link from "next/link";
import { ChevronRight } from "lucide-react";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Analyze", href: "/analyze" },
  { label: "Chart", href: "/chart" },
  { label: "EA", href: "/tools/expert-advisor" },
  { label: "Quant", href: "/tools/quant" },
  { label: "Fundamentals", href: "/tools/fundamentals" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-medium text-slate-100">OFI Pro</div>
          <div className="mt-1 max-w-md leading-6">Institutional-grade forex intelligence built around cleaner analysis, disciplined execution, and trader-ready AI workflows.</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
          <Link href="/analyze" className="flex items-center gap-1 text-cyan-200">
            Launch App
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
