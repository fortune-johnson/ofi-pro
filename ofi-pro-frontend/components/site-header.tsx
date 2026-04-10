"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, CandlestickChart, ChevronDown, Globe2, LogOut, Sparkles, UserRound, Waves } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  transparent?: boolean;
};

const navItems = [
  { label: "Home", href: "/" },
  { label: "Chart", href: "/chart" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

const toolItems = [
  {
    label: "Quick Analysis",
    href: "/analyze?mode=quick",
    description: "Fast directional read for active traders.",
    icon: Sparkles,
  },
  {
    label: "Deep Analysis",
    href: "/analyze?mode=deep",
    description: "Expanded market context and fuller breakdown.",
    icon: BrainCircuit,
  },
  {
    label: "Our Expert Advisor",
    href: "/tools/expert-advisor",
    description: "Liquidity sweep and MSS-based signal framework.",
    icon: Waves,
  },
  {
    label: "Our Quant",
    href: "/tools/quant",
    description: "AI model direction, data, and training structure.",
    icon: BrainCircuit,
  },
  {
    label: "Fundamentals AI",
    href: "/tools/fundamentals",
    description: "Macro context and multi-timeframe market expectations.",
    icon: Globe2,
  },
];

export function SiteHeader({ transparent = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const { user, planLabel, signOut } = useAuth();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-white/10 backdrop-blur-xl",
        transparent ? "bg-slate-950/70" : "bg-slate-950/90"
      )}
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.22)]">
            <CandlestickChart className="size-5 text-violet-300" />
          </div>
          <div>
            <div className="text-lg font-semibold uppercase tracking-[0.18em] text-white">
              OFI Pro
            </div>
            <div className="text-xs text-slate-400">
              Institutional Order Flow
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-2 text-sm transition outline-none",
                pathname.startsWith("/analyze") || pathname.startsWith("/tools")
                  ? "text-white"
                  : "text-slate-300 hover:text-white"
              )}
            >
              <span>Tools</span>
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={14}
              className="w-[22rem] rounded-3xl border border-white/10 bg-slate-950/95 p-2 text-white shadow-[0_30px_80px_rgba(2,6,23,0.7)]"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Trader Tools
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {toolItems.map((item) => (
                  <DropdownMenuItem key={item.label} className="p-0 focus:bg-transparent">
                    <Link
                      href={item.href}
                      className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/[0.05]"
                    >
                      <div className="mt-0.5 flex size-9 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10">
                        <item.icon className="size-4 text-emerald-200" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm transition",
                  active ? "text-white" : "text-slate-300 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Badge className="hidden border border-white/10 bg-white/5 text-slate-200 sm:inline-flex">
                {planLabel}
              </Badge>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "hidden rounded-full px-5 text-slate-200 sm:inline-flex"
                )}
              >
                <UserRound className="mr-2 size-4" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-full border border-white/10 bg-white/5 px-5 font-semibold text-white hover:bg-white/10"
                )}
              >
                <LogOut className="mr-2 size-4" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "hidden rounded-full px-5 text-slate-200 sm:inline-flex"
                )}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-full border border-violet-300/20 bg-violet-500 px-5 font-semibold text-white shadow-[0_10px_40px_rgba(139,92,246,0.28)] hover:bg-violet-400"
                )}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
