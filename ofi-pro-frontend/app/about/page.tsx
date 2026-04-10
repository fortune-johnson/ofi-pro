"use client";

import Link from "next/link";
import { ArrowRight, Eye, Layers3, ShieldCheck } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="border border-white/10 bg-white/5 text-slate-300">
            About OFI Pro
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            A cleaner order flow workspace for forex traders.
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            OFI Pro is built to help traders read the market faster, stay focused, and move through analysis with less friction.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: Eye,
              title: "Vision",
              copy: "Give traders a sharper way to read bias, participation, and directional intent.",
            },
            {
              icon: Layers3,
              title: "Workflow",
              copy: "Move from overview to analysis to chart in a layout that stays calm and easy to read.",
            },
            {
              icon: ShieldCheck,
              title: "Standard",
              copy: "Dark, precise, responsive, and designed to feel dependable in live trading conditions.",
            },
          ].map((item) => (
            <Card key={item.title} className="border border-white/10 bg-white/[0.04]">
              <CardHeader>
                <item.icon className="size-5 text-emerald-300" />
                <CardTitle className="pt-4 text-lg text-white">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-7 text-slate-400">
                  {item.copy}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="mt-8 border border-white/10 bg-white/[0.04]">
          <CardContent className="px-6 py-6">
            <div className="max-w-3xl">
              <div className="text-xl font-semibold text-white">What traders can expect</div>
              <div className="mt-3 text-sm leading-7 text-slate-400">
                A focused trading experience with market scanning, detailed analysis, chart access, account-based plans, and a consistent premium interface across the platform.
              </div>
            </div>
            <Link
              href="/analyze"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-6 inline-flex rounded-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
              )}
            >
              Open the Analyzer
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
