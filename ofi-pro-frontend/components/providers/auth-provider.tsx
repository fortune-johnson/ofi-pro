"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { auth, googleProvider } from "@/lib/firebase";
import { PLAN_LABELS, type SubscriptionPlan, type SubscriptionRecord } from "@/lib/plans";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  subscription: SubscriptionRecord | null;
  plan: SubscriptionPlan;
  isPaid: boolean;
  planLabel: string;
  refreshSubscription: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSubscription(user: User) {
  const params = new URLSearchParams({
    uid: user.uid,
    email: user.email ?? "",
  });

  const response = await fetch(`/api/subscription?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load subscription");
  }

  return (await response.json()) as SubscriptionRecord;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      startTransition(() => {
        setUser(nextUser);
      });

      if (!nextUser) {
        startTransition(() => {
          setSubscription(null);
          setLoading(false);
        });
        return;
      }

      try {
        const nextSubscription = await fetchSubscription(nextUser);
        startTransition(() => {
          setSubscription(nextSubscription);
        });
      } catch {
        startTransition(() => {
          setSubscription(null);
        });
      } finally {
        startTransition(() => {
          setLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshSubscription() {
    if (!auth.currentUser) return;
    const nextSubscription = await fetchSubscription(auth.currentUser);
    startTransition(() => {
      setSubscription(nextSubscription);
    });
  }

  async function signUp(name: string, email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    await refreshSubscription();
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
    await refreshSubscription();
  }

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider as GoogleAuthProvider);
    await refreshSubscription();
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  const plan = subscription?.plan ?? "free";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        subscription,
        plan,
        isPaid: plan !== "free",
        planLabel: PLAN_LABELS[plan],
        refreshSubscription,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
