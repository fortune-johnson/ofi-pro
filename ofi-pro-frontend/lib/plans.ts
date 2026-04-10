export type SubscriptionPlan = "free" | "pro" | "institutional";
export type SubscriptionStatus = "inactive" | "active" | "past_due";

export type SubscriptionRecord = {
  uid: string;
  email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  paystackReference?: string;
  updatedAt: string;
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  pro: "Pro",
  institutional: "Institutional",
};

export const PLAN_PRICES: Record<SubscriptionPlan, string> = {
  free: "$0",
  pro: "$20",
  institutional: "$35",
};

export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  institutional: 2,
};

export function hasPlan(current: SubscriptionPlan, required: SubscriptionPlan) {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function normalizePlan(value?: string): SubscriptionPlan {
  if (value === "institutional") return "institutional";
  if (value === "pro") return "pro";
  return "free";
}
