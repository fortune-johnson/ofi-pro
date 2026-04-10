"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Check, LockKeyhole, Sparkles } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_PRICES, hasPlan, type SubscriptionPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

const tiers: Array<{
  name: SubscriptionPlan;
  title: string;
  subtitle: string;
  points: string[];
}> = [
  {
    name: "free",
    title: "Free",
    subtitle: "Start exploring OFI Pro",
    points: [
      "Quick analyzer access",
      "Core market verdicts and confidence",
      "Sign in to save your account and upgrade later",
    ],
  },
  {
    name: "pro",
    title: "Pro",
    subtitle: "$20/month",
    points: [
      "Detailed analyzer workflow",
      "Expanded market detail and premium workflow access",
      "Dashboard upgrades and paid feature access",
    ],
  },
  {
    name: "institutional",
    title: "Institutional",
    subtitle: "$35/month",
    points: [
      "Everything in Pro",
      "Backtesting access",
      "Full OFI Pro premium tier coverage",
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user, plan, refreshSubscription } = useAuth();
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextReference = params.get("reference") ?? params.get("trxref") ?? "";
    setReference(nextReference === "{reference}" ? "" : nextReference);
  }, []);

  useEffect(() => {
    if (!reference || !user) return;

    let active = true;

    async function verifyPayment() {
      try {
        const response = await fetch("/api/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Payment verification failed");
        }

        await refreshSubscription();
        if (active) {
          setMessage(`Payment confirmed. Your ${payload.plan} plan is now active.`);
          startTransition(() => router.replace("/pricing"));
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "Payment verification failed");
        }
      }
    }

    void verifyPayment();
    return () => {
      active = false;
    };
  }, [reference, refreshSubscription, router, user]);

  async function handleUpgrade(nextPlan: SubscriptionPlan) {
    if (nextPlan === "free") {
      setMessage("Your free tier is already available.");
      return;
    }

    if (!user?.email) {
      router.push("/signup");
      return;
    }

    setBusyPlan(nextPlan);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid,
          plan: nextPlan,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start checkout");
      }

      window.location.href = payload.authorization_url;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to start checkout");
      setBusyPlan(null);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">Pricing</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Clear pricing for a premium forex intelligence platform.
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Start free, unlock Pro for deeper analysis, and move into Institutional access when you want the full OFI Pro experience.
          </p>
        </div>

        {message ? (
          <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-6 py-4 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-rose-400/20 bg-rose-500/10 px-6 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => {
            const featured = tier.name === "pro";
            const current = hasPlan(plan, tier.name) && tier.name !== "free";

            return (
              <Card
                key={tier.name}
                className={cn(
                  "border bg-white/[0.04]",
                  featured
                    ? "border-emerald-400/20 shadow-[0_30px_100px_rgba(16,185,129,0.12)]"
                    : "border-white/10"
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl text-white">{tier.title}</CardTitle>
                    {featured ? (
                      <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                        <Sparkles className="mr-1 size-3.5" />
                        Recommended
                      </Badge>
                    ) : (
                      <Badge className="border border-white/10 bg-white/5 text-slate-300">
                        {tier.name === "free" ? "Explorer Tier" : "Full Access"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-slate-400">{tier.subtitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-5xl font-semibold text-white">
                    {PLAN_PRICES[tier.name]}
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {tier.name === "free" ? "forever" : "/ month"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {tier.points.map((point) => (
                      <div key={point} className="flex items-start gap-3 text-sm text-slate-300">
                        <Check className="mt-0.5 size-4 text-emerald-300" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>

                  {tier.name === "free" ? (
                    <Link
                      href="/analyze"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "h-12 w-full rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                      )}
                    >
                      Launch Free Analyzer
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={busyPlan === tier.name || current}
                      onClick={() => void handleUpgrade(tier.name)}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "h-12 w-full rounded-full",
                        current
                          ? "bg-white/10 text-white hover:bg-white/10"
                          : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      )}
                    >
                      {current ? "Current Access" : busyPlan === tier.name ? "Redirecting to Paystack..." : `Choose ${tier.title}`}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-10 border border-white/10 bg-white/[0.04]">
          <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white">
                <LockKeyhole className="size-4 text-emerald-300" />
                <span className="font-medium">Secure checkout and plan activation</span>
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Sign in before upgrading so your OFI Pro plan can be linked directly to your account after checkout.
              </div>
            </div>
            {!user ? (
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-full bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
                )}
              >
                Create Account
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
