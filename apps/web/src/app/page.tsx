"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const handleGetStarted = () => {
    if (user) {
      router.push("/dashboard/feed");
    } else {
      router.push("/auth/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border bg-card/70 backdrop-blur">
        <div className="flex items-center gap-2.5">
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
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/auth/login" className="hover:border-secondary hover:text-secondary">
              Sign In
            </Link>
          </Button>
          <Button onClick={handleGetStarted} className="px-4">
            Get Started
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center pt-20 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 border border-secondary/25 bg-secondary/10 text-muted-foreground">
          <span className="size-1.5 rounded-full inline-block bg-muted-foreground" />
          AI-powered job search intelligence
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-5 max-w-2xl text-foreground">
          Land your next job, <span className="text-primary">faster.</span>
        </h1>

        <p className="text-lg max-w-xl leading-relaxed mb-10 text-muted-foreground">
          JobClawd searches job boards, scores vacancies against your profile, and helps you focus
          on the roles you are most ready for.
        </p>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Button onClick={handleGetStarted} size="lg" className="px-6">
            Get Started, it&apos;s free
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#how-it-works" className="px-6 hover:border-secondary hover:text-secondary">
              See how it works
            </Link>
          </Button>
        </div>
      </main>

      <section id="how-it-works" className="px-8 py-20 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-foreground">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Set your profile",
              desc: "Tell us your title, experience level, preferred work mode, and paste in your CV link.",
            },
            {
              step: "02",
              title: "Search & score",
              desc: "We scan Jobsearch.az, LinkedIn, and Indeed and rank every vacancy against your profile.",
            },
            {
              step: "03",
              title: "Prioritize & prepare",
              desc: "See how ready you are for each role and choose the best CV before you apply.",
            },
          ].map((item) => (
            <div key={item.step} className="rounded-xl p-6 border border-border bg-card">
              <div className="text-xs font-bold mb-3 tracking-widest text-secondary">
                {item.step}
              </div>
              <h3 className="text-base font-semibold mb-2 text-card-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-8 py-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} JobClawd. All rights reserved.</span>
        <span>Built for job seekers.</span>
      </footer>
    </div>
  );
}
