"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);
      startTransition(() => router.push("/dashboard"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      await signInWithGoogle();
      startTransition(() => router.push("/dashboard"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto flex max-w-7xl justify-center px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl border border-white/10 bg-white/[0.04]">
          <CardHeader>
            <Badge className="w-fit border border-white/10 bg-white/5 text-slate-300">Member Login</Badge>
            <CardTitle className="pt-4 text-3xl text-white">Welcome back to OFI Pro</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in with email/password or Google to unlock your dashboard, saved subscription plan, and gated workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Email</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
                  <Mail className="size-4 text-emerald-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Password</span>
                <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
                  <Lock className="size-4 text-emerald-300" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 w-full rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                )}
              >
                Login
                <ArrowRight className="ml-2 size-4" />
              </button>
            </form>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleGoogleLogin()}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 w-full rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              )}
            >
              Continue with Google
            </button>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 text-sm leading-6 text-slate-400">
              No account yet?{" "}
              <Link href="/signup" className="font-medium text-emerald-300 hover:text-emerald-200">
                Create one here.
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
