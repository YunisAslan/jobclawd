"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BarChart3, Mail, Send } from "lucide-react";
import { Icons } from "@/components/Icons";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type State = "idle" | "sending" | "sent";

const FEATURES = [
  { icon: <BarChart3 className="size-3.5 text-primary" />, title: "Smart vacancy scoring",  desc: "Every job ranked against your profile in seconds"     },
  { icon: <Mail      className="size-3.5 text-primary" />, title: "HR email extraction",    desc: "Find direct hiring manager contacts automatically"  },
  { icon: <Send      className="size-3.5 text-primary" />, title: "Autopilot applications", desc: "AI-drafted cover letters sent while you sleep"       },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/send-magic-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.detail || "Could not send email. Check your SMTP settings.",
        );
        setState("idle");
        return;
      }

      setState("sent");
    } catch {
      setError("Could not reach the server.");
      setState("idle");
    }
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Visual panel ── */}
      <div className="w-1/2 hidden lg:flex shrink-0 bg-[#0F172A] flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative glows */}
        <div className="absolute top-0 right-0 w-125 h-125 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Large JC badge */}
          <div className="size-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-xl mb-10">
            JC
          </div>

          <h2 className="text-[2rem] font-bold text-white leading-tight mb-4">
            Land your next
            <br />
            job, faster.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-12 max-w-xs">
            JobClawd scans job boards, scores every vacancy against your
            profile, and fires off applications — all on autopilot.
          </p>

          {/* Feature list */}
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="size-7 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white text-sm font-medium leading-none mb-1">
                    {f.title}
                  </p>
                  <p className="text-slate-500 text-xs leading-snug">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 border-t border-white/6 pt-7 grid grid-cols-3 gap-4">
          {[
            { label: "Job boards", value: "3+" },
            { label: "Auto-applied", value: "100s" },
            { label: "Time saved", value: "10h/wk" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white font-bold text-2xl leading-none mb-1">
                {s.value}
              </p>
              <p className="text-slate-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Form panel ── */}
      <div className="w-1/2 flex-1 flex flex-col justify-center bg-white px-[clamp(2rem,8vw,5.5rem)] py-12">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 mb-12 w-fit">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
            JC
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            Job<span className="text-primary">Clawd</span>
          </span>
        </Link>

        {state === "sent" ? (
          /* ── Sent confirmation ── */
          <div className="max-w-sm">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
              <Mail className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Check your inbox
            </h1>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              We sent a temporary sign-in link to
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-6">
              <p className="font-semibold text-slate-900 text-sm break-all">
                {email}
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              The link expires in 15 minutes. Check your spam folder if you do
              not see it.
            </p>
            <Button
              variant="ghost"
              className="text-slate-500 hover:text-slate-900 p-0 h-auto text-sm font-normal"
              onClick={() => {
                setState("idle");
                setEmail("");
              }}
            >
              Not you? Start over →
            </Button>
          </div>
        ) : (
          /* ── Sign-in form ── */
          <div className="max-w-sm">
            <h1 className="text-[2rem] font-bold text-slate-900 mb-2 leading-tight">
              Welcome back
            </h1>
            <p className="text-slate-500 text-sm mb-9">
              Enter your email to receive a secure sign-in link.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  required
                  className="h-11"
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={state === "sending"}
                className="w-full h-11 font-medium disabled:opacity-60"
              >
                {state === "sending" ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>

            {/* OR divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400 tracking-widest uppercase">
                  or
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogle}
              variant="outline"
              className="w-full h-11 gap-3 font-medium"
            >
              <Icons.google className="size-4 shrink-0" />
              Continue with Google
            </Button>

            <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed">
              By continuing, you agree to our{" "}
              <span className="underline underline-offset-2 cursor-default hover:text-slate-600">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="underline underline-offset-2 cursor-default hover:text-slate-600">
                Privacy Policy
              </span>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
