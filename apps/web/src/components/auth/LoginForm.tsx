"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { BarChart3, FileText, Mail, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Icons } from "@/components/Icons";
import { authService } from "@/services/auth.service";
import { extractApiError } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/endpoints";
import { platformStatsService, type PlatformStats } from "@/services/platform-stats.service";

const FEATURES = [
  {
    icon: <BarChart3 className="size-3.5 text-primary" />,
    title: "Multi-platform job search",
    desc: "Search 10+ job platforms simultaneously from one workflow",
  },
  {
    icon: <FileText className="size-3.5 text-primary" />,
    title: "CV matching workspace",
    desc: "Upload your CV once — every vacancy is scored against it with ATS keyword analysis",
  },
  {
    icon: <Sparkles className="size-3.5 text-primary" />,
    title: "Actionable CV suggestions",
    desc: "Get ATS-optimized edits that increase your chances of landing an interview",
  },
];

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Please try again.",
  google_no_email: "Could not retrieve your email from Google.",
};

function LoginForm() {
  const params = useSearchParams();
  const oauthError = params.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    platformStatsService.getStats().then(setStats).catch(() => {});
  }, []);

  const sendMutation = useMutation({
    mutationFn: (addr: string) => authService.sendMagicLink(addr),
    onSuccess: () => setSent(true),
    onError: (err: unknown) => {
      setError(extractApiError(err, "Could not send email. Please try again."));
    },
  });

  function handleEmailSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    sendMutation.mutate(email.trim());
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="w-1/2 hidden lg:flex shrink-0 bg-sidebar border-r border-sidebar-border flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-[480px] h-[480px] bg-primary/12 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-primary/6 rounded-full blur-[80px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #8B93A7 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10">
          <Image
            src={logo}
            alt="JobClawd"
            width={72}
            height={72}
            className="rounded-2xl mb-10 brightness-0 invert"
          />
          <h2 className="text-[2.1rem] font-bold text-white dark:text-foreground leading-tight mb-4">
            Apply smarter.
            <br />
            Get hired faster.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-12 max-w-68">
            JobClawd searches 10+ job platforms at once, scores every role against your CV, and
            generates ATS-optimized edits that increase your chances of getting invited to interview.
          </p>
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="size-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white dark:text-foreground text-sm font-medium leading-none mb-1">
                    {f.title}
                  </p>
                  <p className="text-muted-foreground text-xs leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-sidebar-border pt-7 grid grid-cols-4 gap-3">
          {[
            { label: "CV analyses",   value: stats?.total_analyses },
            { label: "Suggestions",   value: stats?.suggestions_applied },
            { label: "CVs compared",  value: stats?.cvs_compared },
            { label: "Jobs searched", value: stats?.searched_jobs },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white dark:text-foreground font-bold text-lg leading-none mb-1">
                {s.value != null ? `${s.value}+` : "—"}
              </p>
              <p className="text-muted-foreground text-[11px] leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="w-1/2 flex-1 flex flex-col justify-center bg-card px-[clamp(2rem,8vw,5.5rem)] py-12">
        <Link href="/" className="flex items-center gap-2.5 mb-12 w-fit">
          <Image
            src={logo}
            alt="JobClawd"
            width={34}
            height={34}
            className="dark:brightness-0 dark:invert shrink-0"
          />
          <span className="font-bold text-lg tracking-tight text-foreground">
            Job<span className="text-primary">Clawd</span>
          </span>
        </Link>

        {sent ? (
          <div className="max-w-sm">
            <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Mail className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h1>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              We sent a temporary sign-in link to
            </p>
            <div className="rounded-xl border border-border bg-muted px-4 py-3 mb-6">
              <p className="font-semibold text-foreground text-sm break-all">{email}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              The link expires in 15 minutes. Check your spam folder if you do not see it.
            </p>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground p-0 h-auto text-sm font-normal"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Not you? Start over →
            </Button>
          </div>
        ) : (
          <div className="max-w-sm">
            <h1 className="text-[2rem] font-bold text-foreground mb-2 leading-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm mb-9">Sign in to continue to JobClawd.</p>

            {oauthError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 mb-6">
                <p className="text-destructive text-sm">
                  {GOOGLE_ERROR_MESSAGES[oauthError] ?? "Sign-in failed. Please try again."}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full h-11 gap-2.5 font-medium border-border hover:bg-accent mb-6"
              onClick={() => {
                window.location.href = `${API_BASE_URL}/api/auth/google`;
              }}
            >
              <Icons.google className="w-4.5 h-4.5" />
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or sign in with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-input">Email</Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                  className="h-11 bg-background border-border"
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={sendMutation.isPending}
                className="w-full h-11 font-medium disabled:opacity-60"
              >
                {sendMutation.isPending ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginForm;
