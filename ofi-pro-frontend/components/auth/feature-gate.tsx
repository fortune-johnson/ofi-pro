"use client";

import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPlan, type SubscriptionPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

type FeatureGateProps = {
  requiredPlan?: SubscriptionPlan;
  featureName: string;
  children: React.ReactNode;
  description: string;
};

export function FeatureGate({
  requiredPlan = "free",
  featureName,
  description,
  children,
}: FeatureGateProps) {
  const { loading, user, plan } = useAuth();

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
        Loading access...
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="border border-white/10 bg-white/[0.04]">
        <CardHeader>
          <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">
            Sign In Required
          </Badge>
          <CardTitle className="pt-4 text-2xl text-white">{featureName}</CardTitle>
          <CardDescription className="text-slate-400">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10"
            )}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
            )}
          >
            Sign Up
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!hasPlan(plan, requiredPlan)) {
    return (
      <Card className="border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.6))]">
        <CardHeader>
          <Badge className="w-fit border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
            Upgrade Required
          </Badge>
          <CardTitle className="flex items-center gap-2 pt-4 text-2xl text-white">
            <LockKeyhole className="size-5 text-emerald-300" />
            {featureName}
          </CardTitle>
          <CardDescription className="text-slate-200/80">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
            Upgrade to unlock richer analysis depth, advanced workflow tooling, and institutional-level surfaces inside OFI Pro.
          </div>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full bg-slate-950 px-5 text-white hover:bg-slate-900"
            )}
          >
            <Sparkles className="mr-2 size-4" />
            View Plans
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
