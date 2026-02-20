"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function GoogleCallbackInner() {
  const params = useSearchParams();
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      login(token);
      router.replace("/dashboard");
    } else {
      router.replace(`/auth/login?error=${error ?? "google_failed"}`);
    }
  }, [params, login, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="size-10 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="size-10 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <GoogleCallbackInner />
    </Suspense>
  );
}
