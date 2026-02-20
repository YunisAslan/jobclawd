"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/auth.service";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const [error, setError]   = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = params.get("token");
    if (!token) {
      setError("Invalid link — no token found.");
      setStatus("error");
      return;
    }

    authService
      .verifyMagicLink(token)
      .then((data) => {
        login(data.access_token);
        router.replace("/dashboard");
      })
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "This link is invalid or has already expired. Please request a new one.";
        setError(msg);
        setStatus("error");
      });
  }, [params, router, login]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-6">
      <Link href="/" className="flex items-center gap-2.5 mb-12">
        <Image src={logo} alt="JobClawd" width={34} height={34} className="dark:brightness-0 dark:invert shrink-0" />
        <span className="font-bold text-lg tracking-tight text-foreground">
          Job<span className="text-primary">Clawd</span>
        </span>
      </Link>

      {status === "verifying" ? (
        <div className="text-center">
          <div className="size-10 border-2 border-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Verifying your link…</p>
        </div>
      ) : (
        <div className="text-center max-w-sm">
          <div className="size-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <CircleAlert className="size-5 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-2">Link expired</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="size-10 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
