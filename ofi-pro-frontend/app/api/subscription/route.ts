import { NextRequest, NextResponse } from "next/server";

import { getSubscriptionRecord } from "@/lib/subscriptions-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  const email = request.nextUrl.searchParams.get("email") ?? "";

  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  const subscription = await getSubscriptionRecord(uid, email);
  return NextResponse.json(subscription, {
    headers: { "Cache-Control": "no-store" },
  });
}
