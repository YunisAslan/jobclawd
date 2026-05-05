import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import LandingFooter from "@/components/layout/LandingFooter";

export const metadata = {
  title: "Terms of Service — JobClawd",
  description: "The terms and conditions governing use of the JobClawd platform.",
};

const LAST_UPDATED = "May 5, 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 max-w-3xl">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using JobClawd (&quot;Platform&quot;, &quot;Service&quot;), you agree to be bound by these
              Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Platform.
            </p>
            <p>
              We may update these Terms from time to time. Continued use after changes constitutes
              acceptance of the revised Terms. The &quot;Last updated&quot; date at the top of this page will
              reflect the most recent revision.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              JobClawd is a job search and CV optimization platform that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Aggregates job listings from third-party job boards (LinkedIn, Indeed, jobsearch.az, and others).</li>
              <li>Uses AI to score job vacancies against your CV, identify missing ATS keywords, and provide suggestions designed to increase your chances of getting invited to interview.</li>
              <li>Provides a CV editor with ATS-optimized PDF export — structured so applicant tracking systems can parse it correctly.</li>
              <li>Helps you track saved jobs and applications.</li>
            </ul>
            <p>
              The Service is provided on a credit-based model. Certain features consume credits from
              your account balance.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To use the Platform you must create an account using a valid email address. You are
              responsible for maintaining the confidentiality of your account and for all activities
              that occur under it. You agree to notify us immediately at{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>{" "}
              of any unauthorised use of your account.
            </p>
            <p>
              You must be at least 16 years of age to use the Service.
            </p>
          </Section>

          <Section title="4. Credits and Payments">
            <p>
              JobClawd operates on a credit-based system. New accounts receive a free starting balance
              of credits. Additional credits may be purchased in one-time packs.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Credits are non-refundable once purchased, except as required by applicable law.</li>
              <li>Credits do not expire and carry over indefinitely.</li>
              <li>We reserve the right to adjust credit pricing with reasonable notice.</li>
              <li>In the current demo phase, no real payment is processed.</li>
            </ul>
          </Section>

          <Section title="5. User Content">
            <p>
              You retain ownership of any CV data, documents, or content you upload to the Platform
              (&quot;User Content&quot;). By uploading User Content, you grant JobClawd a limited, non-exclusive
              licence to process and store that content solely for the purpose of providing the Service
              to you.
            </p>
            <p>
              You represent that you have all rights necessary to upload your User Content and that it
              does not infringe any third-party rights or violate any laws.
            </p>
          </Section>

          <Section title="6. Prohibited Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Use the Platform for any unlawful purpose or in violation of these Terms.</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the Platform in an automated manner without permission.</li>
              <li>Use the Platform to transmit spam, malware, or harmful content.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure.</li>
            </ul>
          </Section>

          <Section title="7. Third-Party Job Listings">
            <p>
              Job listings displayed on JobClawd are sourced from third-party platforms. We do not
              guarantee the accuracy, completeness, or availability of these listings. We are not a
              recruitment agency and are not responsible for any employment decisions made based on
              information provided by the Platform.
            </p>
          </Section>

          <Section title="8. AI-Generated Content">
            <p>
              CV suggestions, match scores, ATS keyword analyses, and improvement recommendations are
              generated by AI and are provided for informational purposes only. While our suggestions
              are designed to improve ATS compatibility and interview prospects, we cannot guarantee
              specific outcomes. They do not constitute professional career or legal advice. You are
              solely responsible for decisions you make based on AI-generated content.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
              either express or implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement.
            </p>
            <p>
              We do not warrant that the Platform will be uninterrupted, error-free, or free of
              viruses or other harmful components.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, JobClawd shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising out of or related to
              your use of or inability to use the Platform, even if we have been advised of the
              possibility of such damages.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              We reserve the right to suspend or terminate your account at any time for violation of
              these Terms, with or without notice. You may delete your account at any time from your
              Profile settings.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with applicable law. Any
              disputes arising under these Terms shall be subject to the exclusive jurisdiction of the
              courts of the relevant jurisdiction.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have questions about these Terms, please contact us at:
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
