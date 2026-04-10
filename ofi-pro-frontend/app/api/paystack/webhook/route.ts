import crypto from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { normalizePlan } from "@/lib/plans";
import { upsertSubscriptionRecord } from "@/lib/subscriptions-store";

function getSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY ?? "sk_test_58c7e2505744f2d73484810b2554cd9862bfb99a";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", getSecretKey()).update(rawBody).digest("hex");

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: {
      reference?: string;
      customer?: { email?: string };
      metadata?: { uid?: string; plan?: string; email?: string };
    };
  };

  if (event.event === "charge.success") {
    const uid = event.data?.metadata?.uid;
    const email = event.data?.customer?.email ?? event.data?.metadata?.email ?? "";
    const plan = normalizePlan(event.data?.metadata?.plan);

    if (uid && email) {
      await upsertSubscriptionRecord({
        uid,
        email,
        plan,
        status: "active",
        paystackReference: event.data?.reference,
      });
    }
  }

  return NextResponse.json({ received: true });
}
