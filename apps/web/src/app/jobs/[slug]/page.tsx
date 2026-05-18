import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { JobDetail } from "@/types";
import { JobClawdLogo } from "@/assets/JobClawdLogo";
import {
  slugToJobUrl,
  slugToReadableParts,
  jobDetailPageUrl,
  generateJobPostingSchema,
  generateBreadcrumbSchema,
  BASE_URL,
} from "@/lib/seo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// Revalidate cached job detail pages every hour (ISR).
// Each page fetch triggers a Playwright scrape — caching keeps this manageable.
export const revalidate = 3600;

// ── Server-side job fetch (public endpoint, no auth) ─────────────────────────

async function fetchJobDetail(jobUrl: string): Promise<JobDetail | null> {
  try {
    const apiUrl =
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/job-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: jobUrl }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<JobDetail>;
  } catch {
    return null;
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const jobUrl = slugToJobUrl(decoded);
  const { title: readableTitle, company: readableCompany } =
    slugToReadableParts(decoded);

  if (!jobUrl) {
    return { title: "Job Listing" };
  }

  const job = await fetchJobDetail(jobUrl);

  const pageTitle = job
    ? `${job.title} at ${job.company}`
    : `${readableTitle} at ${readableCompany}`;
  const rawDescription = job?.description || job?.job_summary || "";
  const description = rawDescription
    ? rawDescription.slice(0, 157) + (rawDescription.length > 157 ? "…" : "")
    : `Apply for ${readableTitle} at ${readableCompany} on JobClawd — AI-powered job search.`;

  const canonicalUrl = `${BASE_URL}/jobs/${slug}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${pageTitle} | JobClawd`,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: "JobClawd",
      images: [
        {
          url: `/jobs/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${pageTitle} | JobClawd`,
      description,
      images: [`/jobs/${slug}/opengraph-image`],
    },
    robots: { index: true, follow: true },
  };
}

// ── Page component ────────────────────────────────────────────────────────────

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const jobUrl = slugToJobUrl(decoded);

  if (!jobUrl) notFound();

  const job = await fetchJobDetail(jobUrl);
  if (!job) notFound();

  const canonicalUrl = `${BASE_URL}/jobs/${slug}`;
  const applyTarget = job.resolved_apply_url || job.apply_url || jobUrl;

  const jobPostingSchema = generateJobPostingSchema({
    title: job.title,
    company: job.company,
    description: job.description,
    pageUrl: canonicalUrl,
    applyUrl: applyTarget,
    skills: job.required_skills,
    requirements: job.requirements,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Jobs", url: `${BASE_URL}/jobs` },
    { name: `${job.title} at ${job.company}`, url: canonicalUrl },
  ]);

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-background">
        {/* Minimal public navbar */}
        <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" aria-label="JobClawd home" className="hover:opacity-80 transition-opacity">
              <JobClawdLogo size={18} className="text-foreground" />
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/login">Get AI match score</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-10">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">/</li>
              <li>
                <Link href="/dashboard/feed" className="hover:text-foreground transition-colors">
                  Jobs
                </Link>
              </li>
              <li aria-hidden="true" className="text-border">/</li>
              <li className="text-foreground truncate max-w-xs" aria-current="page">
                {job.title}
              </li>
            </ol>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* ── Left column ── */}
            <article>
              {/* Job header */}
              <header className="mb-8">
                <div className="flex items-start gap-4">
                  {job.company && (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-lg font-bold text-primary">
                      {job.company.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                      {job.title}
                    </h1>
                    <p className="mt-1 text-lg text-muted-foreground">{job.company}</p>
                  </div>
                </div>

                {/* Meta badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.apply_requires_login && (
                    <Badge variant="secondary">Requires login to apply</Badge>
                  )}
                  {job.required_experience && (
                    <Badge variant="outline">{job.required_experience}</Badge>
                  )}
                </div>
              </header>

              {/* Job summary */}
              {job.job_summary && (
                <section className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
                    Summary
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground">
                    {job.job_summary}
                  </p>
                </section>
              )}

              {/* Requirements */}
              {job.requirements && job.requirements.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Requirements
                  </h2>
                  <ul className="space-y-2">
                    {job.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Nice to haves */}
              {job.nice_to_haves && job.nice_to_haves.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Nice to Have
                  </h2>
                  <ul className="space-y-2">
                    {job.nice_to_haves.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Skills */}
              {job.required_skills && job.required_skills.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Skills
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.map((skill, i) => (
                      <Badge key={i} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Full description */}
              <section>
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  About the Role
                </h2>
                <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {job.description}
                </div>
              </section>
            </article>

            {/* ── Right column — sticky apply card ── */}
            <aside>
              <div className="sticky top-6 space-y-4">
                {/* Apply card */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    Apply for this role
                  </h2>

                  <Button className="w-full" size="lg" asChild>
                    <a
                      href={applyTarget}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apply for ${job.title} at ${job.company}`}
                    >
                      Apply Now →
                    </a>
                  </Button>

                  {job.email_found && job.email && (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      Or email:{" "}
                      <a
                        href={`mailto:${job.email}`}
                        className="text-primary hover:underline"
                        aria-label={`Email ${job.email} to apply`}
                      >
                        {job.email}
                      </a>
                    </p>
                  )}
                </div>

                {/* AI score CTA */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
                  <p className="mb-1 text-sm font-semibold text-foreground">
                    See your AI match score
                  </p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Upload your CV to get an instant compatibility score for this role — free.
                  </p>
                  <Button variant="outline" className="w-full" size="sm" asChild>
                    <Link href="/auth/login" aria-label="Sign up to get AI match score">
                      Get Match Score
                    </Link>
                  </Button>
                </div>

                {/* Source link */}
                <p className="text-center text-xs text-muted-foreground">
                  Original posting:{" "}
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    aria-label="View original job posting"
                  >
                    View source
                  </a>
                </p>
              </div>
            </aside>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-border/60 py-8">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground">
            <p>
              Powered by{" "}
              <Link href="/" className="text-primary hover:underline" aria-label="JobClawd home">
                JobClawd
              </Link>{" "}
              — AI-powered job search across 10+ boards.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
