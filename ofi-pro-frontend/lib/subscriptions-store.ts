import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { normalizePlan, type SubscriptionPlan, type SubscriptionRecord } from "@/lib/plans";

type SubscriptionStore = Record<string, SubscriptionRecord>;

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "subscriptions.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "{}", "utf8");
  }
}

async function readStore(): Promise<SubscriptionStore> {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw) as SubscriptionStore;
}

async function writeStore(store: SubscriptionStore) {
  await ensureStore();
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function makeDefaultRecord(uid: string, email: string): SubscriptionRecord {
  return {
    uid,
    email,
    plan: "free",
    status: "active",
    updatedAt: new Date().toISOString(),
  };
}

export async function getSubscriptionRecord(uid: string, email = "") {
  const store = await readStore();
  return store[uid] ?? makeDefaultRecord(uid, email);
}

export async function upsertSubscriptionRecord(input: {
  uid: string;
  email: string;
  plan?: SubscriptionPlan;
  status?: SubscriptionRecord["status"];
  paystackReference?: string;
}) {
  const store = await readStore();
  const current = store[input.uid] ?? makeDefaultRecord(input.uid, input.email);

  const next: SubscriptionRecord = {
    ...current,
    email: input.email || current.email,
    plan: normalizePlan(input.plan ?? current.plan),
    status: input.status ?? current.status,
    paystackReference: input.paystackReference ?? current.paystackReference,
    updatedAt: new Date().toISOString(),
  };

  store[input.uid] = next;
  await writeStore(store);
  return next;
}
