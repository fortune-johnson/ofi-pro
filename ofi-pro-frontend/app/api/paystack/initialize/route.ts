import { NextRequest, NextResponse } from "next/server";

import { normalizePlan } from "@/lib/plans";

const PLAN_AMOUNT: Record<string, number> = {
  pro: 2000,
  institutional: 3500,
};

function getSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY ?? "sk_test_58c7e2505744f2d73484810b2554cd9862bfb99a";
}

function createReference(plan: string, uid: string) {
  const sanitizedUid = uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "user";
  return `ofi_${plan}_${sanitizedUid}_${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    plan?: string;
    uid?: string;
  };

  const email = body.email?.trim();
  const plan = normalizePlan(body.plan);
  const uid = body.uid?.trim();

  if (!email || !uid || plan === "free") {
    return NextResponse.json({ error: "email, uid, and a paid plan are required" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const reference = createReference(plan, uid);

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: PLAN_AMOUNT[plan] * 100,
      reference,
      callback_url: `${origin}/pricing`,
      metadata: {
        uid,
        plan,
        email,
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.status) {
    return NextResponse.json(
      { error: payload.message ?? "Failed to initialize Paystack checkout" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authorization_url: payload.data.authorization_url,
    reference: payload.data.reference,
  });
}
