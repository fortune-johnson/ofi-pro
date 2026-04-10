import { NextRequest, NextResponse } from "next/server";

import { normalizePlan } from "@/lib/plans";
import { upsertSubscriptionRecord } from "@/lib/subscriptions-store";

function getSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY ?? "sk_test_58c7e2505744f2d73484810b2554cd9862bfb99a";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    reference?: string;
  };

  if (!body.reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${body.reference}`, {
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
    },
  });

  const payload = await response.json();

  if (!response.ok || !payload.status) {
    return NextResponse.json(
      { error: payload.message ?? "Failed to verify Paystack transaction" },
      { status: response.status || 500 }
    );
  }

  const metadata = payload.data?.metadata ?? {};
  const plan = normalizePlan(metadata.plan);
  const uid = metadata.uid;
  const email = payload.data?.customer?.email ?? metadata.email ?? "";

  if (!uid || !email) {
    return NextResponse.json({ error: "Verified payment is missing uid/email metadata" }, { status: 400 });
  }

  const subscription = await upsertSubscriptionRecord({
    uid,
    email,
    plan,
    status: "active",
    paystackReference: payload.data.reference,
  });

  return NextResponse.json(subscription);
}
