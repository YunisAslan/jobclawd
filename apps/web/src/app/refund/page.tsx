import Link from "next/link";
import { JobClawdLogo } from "@/assets/JobClawdLogo";
import { Button } from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import LandingFooter from "@/components/layout/LandingFooter";

export const metadata = {
  title: "Refund Policy — JobClawd",
  description: "How refunds and cancellations work for JobClawd credit purchases.",
};

const LAST_UPDATED = "June 12, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <JobClawdLogo size={20} className="text-foreground opacity-90" />
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Refund Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-10 max-w-3xl">
          <Section title="1. Overview">
            <p>
              JobClawd (&quot;we&quot;, &quot;us&quot;) sells digital credits that unlock AI-powered features such as
              CV match scoring, improvement suggestions, and fresh job searches. Because credits are a
              digital product that is consumed instantly when used, this policy explains when a purchase
              is eligible for a refund and how to request one.
            </p>
          </Section>

          <Section title="2. Payment Processor">
            <p>
              Payments for JobClawd credits are processed by our authorized reseller and merchant of
              record, Lemon Squeezy. When you make a purchase, Lemon Squeezy handles the transaction,
              billing, and any applicable taxes on our behalf. Refunds approved under this policy are
              issued through the same payment method used at checkout.
            </p>
          </Section>

          <Section title="3. Eligibility for a Refund">
            <p>You may request a full refund of a credit purchase if all of the following apply:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The request is made within <strong className="text-foreground">30 days</strong> of the purchase date.</li>
              <li>
                The credits from that purchase are <strong className="text-foreground">unused</strong> — none
                of the credits in the purchased pack have been spent on an AI feature.
              </li>
              <li>The purchase was not made fraudulently or in violation of our Terms of Service.</li>
            </ul>
          </Section>

          <Section title="4. Non-Refundable Situations">
            <p>Refunds are generally not available when:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                The credits have already been used, in whole or in part. Once a credit is spent on an AI
                feature, that value has been delivered and cannot be returned.
              </li>
              <li>More than 30 days have passed since the purchase.</li>
              <li>
                The free starter credits granted on sign-up are involved — these are provided at no cost
                and carry no monetary value.
              </li>
            </ul>
            <p>
              These limitations do not affect any statutory rights you may have under applicable consumer
              protection law. Where such law grants you a broader right to a refund, that law prevails.
            </p>
          </Section>

          <Section title="5. How to Request a Refund">
            <p>
              To request a refund, email{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>{" "}
              from the address associated with your account and include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your account email.</li>
              <li>The order or receipt number from your purchase confirmation.</li>
              <li>The reason for the refund request.</li>
            </ul>
            <p>
              We review every request and aim to respond within 3 business days.
            </p>
          </Section>

          <Section title="6. Processing Time">
            <p>
              Once a refund is approved, it is issued to your original payment method through Lemon
              Squeezy. Depending on your bank or card provider, it may take 5–10 business days for the
              funds to appear on your statement.
            </p>
          </Section>

          <Section title="7. Cancellations">
            <p>
              JobClawd credits are sold as one-time purchases, not subscriptions. There are no recurring
              charges and nothing to cancel after a purchase. If a future plan introduces recurring
              billing, you will be able to cancel it at any time from your account, and cancellation will
              stop all future charges while leaving access active until the end of the paid period.
            </p>
          </Section>

          <Section title="8. Disputes and Chargebacks">
            <p>
              If you believe you were charged in error or do not recognize a charge, please contact us at{" "}
              <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
                support@jobclawd.com
              </a>{" "}
              before opening a dispute with your bank or card provider. Most issues can be resolved
              quickly and directly.
            </p>
            <p>
              Where a charge is eligible for a refund under this policy, we will process it promptly.
              Because payments are handled by our merchant of record, Lemon Squeezy, formal payment
              disputes and chargebacks are managed through their systems in line with the relevant card
              network rules.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Refund Policy from time to time. The &quot;Last updated&quot; date at the top of
              this page reflects the most recent revision. Continued use of the Platform after changes
              constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>If you have questions about this Refund Policy, please contact us at:</p>
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
