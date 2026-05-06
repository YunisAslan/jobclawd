import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import LandingFooter from "@/components/layout/LandingFooter";

export const metadata = {
  title: "Privacy Policy — JobClawd",
  description: "How JobClawd collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "May 6, 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={logo} alt="JobClawd" width={22} height={22} className="dark:brightness-0 dark:invert opacity-80 shrink-0" />
            <span className="font-bold text-base tracking-tight">
              Job<span className="text-primary">Clawd</span>
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
            <Link href="/">
              <ArrowLeft className="size-3.5" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-14">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 max-w-3xl">
          <Section title="1. Introduction">
            <p>
              Welcome to JobClawd (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We are committed to protecting your
              personal information and your right to privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform at{" "}
              <span className="text-foreground font-medium">jobclawd.com</span>.
            </p>
            <p>
              Please read this policy carefully. If you disagree with its terms, please discontinue use
              of the platform.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Account information</strong> — your email address when you sign up via magic link or Google OAuth.</li>
              <li><strong className="text-foreground">Profile information</strong> — your name, location, and job preferences you optionally provide.</li>
              <li><strong className="text-foreground">CV data</strong> — documents and structured CV data you upload to the platform for AI analysis.</li>
              <li><strong className="text-foreground">Usage data</strong> — job searches, saved vacancies, applications you track, and analytics events within the dashboard.</li>
            </ul>
            <p>
              We do not collect payment card data directly. Any future payment processing will be handled
              by a PCI-compliant third-party provider.
            </p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide, operate, and improve the JobClawd platform.</li>
              <li>Authenticate you securely via JWT-based sessions.</li>
              <li>Run AI match scoring, ATS keyword analysis, and CV optimization against job listings you select to help increase your chances of getting invited to interview.</li>
              <li>Send transactional emails such as magic login links.</li>
              <li>Aggregate anonymised platform statistics (e.g. total analyses run) for the public stats display.</li>
            </ul>
            <p>
              We do <strong className="text-foreground">not</strong> use your CV data to train AI models,
              sell your data to third parties, or share it with employers.
            </p>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Your data is stored in a PostgreSQL database. We apply industry-standard security measures
              including encrypted connections (TLS), secure JWT authentication, and access controls. No
              method of transmission or storage is 100% secure, but we take all reasonable steps to
              protect your data.
            </p>
          </Section>

          <Section title="5. Third-Party Services">
            <p>We use the following third-party services to operate the platform:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">OpenAI</strong> — for AI-powered CV analysis and suggestion generation. Data sent to OpenAI is subject to their privacy policy.</li>
              <li><strong className="text-foreground">Google OAuth</strong> — for optional sign-in with Google.</li>
              <li><strong className="text-foreground">Gmail / SMTP</strong> — for sending magic link emails.</li>
              <li><strong className="text-foreground">Job Platforms</strong> — We display information aggregated from publicly available job listings found on third-party websites. We respect the robots.txt protocols of these platforms where applicable and focus on providing a service that enhances the visibility of these listings for job seekers.</li>
            </ul>
            <p>
              We do not control these third parties and are not responsible for their privacy practices.
            </p>
          </Section>

          <Section title="6. Cookies and Sessions">
            <p>
              We use a single session cookie (<code className="text-foreground bg-muted px-1 py-0.5 rounded text-xs">jc_token</code>) to
              maintain your authenticated session. This cookie is HttpOnly and is not accessible to
              JavaScript. We do not use advertising or tracking cookies.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and all associated data.</li>
              <li>Object to or restrict processing of your data.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>
              .
            </p>
          </Section>

          <Section title="8. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you delete your
              account, we will delete or anonymise your personal data within 30 days, except where
              required to retain it by law.
            </p>
          </Section>

          <Section title="9. Children&apos;s Privacy">
            <p>
              JobClawd is not directed at children under 16. We do not knowingly collect personal
              information from children. If you believe we have collected data from a child, please
              contact us immediately at{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by updating the &quot;Last updated&quot; date at the top of this page. Continued use of
              the platform after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <p>
              <strong className="text-foreground">JobClawd</strong>
              <br />
              Email:{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>
            </p>
          </Section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
