import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import logo from "@/assets/logo/jobclawd-logo.svg";

export default function LandingFooter() {
  return (
    <footer className="border-t border-border bg-muted/5">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16">

          {/* Brand column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <Image src={logo} alt="JobClawd" width={22} height={22} className="dark:brightness-0 dark:invert opacity-80 shrink-0" />
              <span className="font-bold text-base tracking-tight">
                Job<span className="text-primary">Clawd</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Search 10+ job platforms, optimize your CV with AI, and send ATS-ready applications that increase your chances of getting to interview.
            </p>
            <a
              href="mailto:support@jobclawd.com"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="size-3.5 shrink-0" />
              support@jobclawd.com
            </a>
          </div>

          {/* Product links */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-5">Product</p>
            <ul className="space-y-3">
              {[
                { label: "Home", href: "/" },
                { label: "How it Works", href: "/#how-it-works" },
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "FAQs", href: "/#faqs" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account links */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-5">Account</p>
            <ul className="space-y-3">
              {[
                { label: "Sign in", href: "/auth/login" },
                { label: "Get Started Free", href: "/auth/login" },
                { label: "Dashboard", href: "/dashboard/feed" },
                { label: "Billing & Credits", href: "/dashboard/billing" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Contact */}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-5">Legal</p>
            <ul className="space-y-3 mb-8">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Contact Us</p>
            <a
              href="mailto:support@jobclawd.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              support@jobclawd.com
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} JobClawd. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            <span className="text-xs text-muted-foreground/50">Built for job seekers.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
