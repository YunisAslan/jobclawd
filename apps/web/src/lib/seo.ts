/**
 * SEO utilities: slug encoding for public job pages and JSON-LD schema generators.
 *
 * Slug format: {titleSlug}.{companySlug}.{base64url-encoded-source-url}
 * The '.' separator is safe because base64url uses only [A-Za-z0-9\-_],
 * and slugified text uses only [a-z0-9\-]. We split on the LAST dot to extract
 * the encoded URL, making the scheme robust even if company names once had dots.
 */

export const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://jobclawd.com";

function slugify(text: string, maxLen = 60): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

// ── Slug encoding (Node.js server context only) ──────────────────────────────

export function jobToSlug(
  title: string,
  company: string,
  url: string
): string {
  const titleSlug = slugify(title, 50);
  const companySlug = slugify(company, 30);
  const encodedUrl = Buffer.from(url, "utf-8").toString("base64url");
  return `${titleSlug}.${companySlug}.${encodedUrl}`;
}

export function slugToJobUrl(slug: string): string | null {
  const lastDot = slug.lastIndexOf(".");
  if (lastDot === -1) return null;
  const encodedUrl = slug.slice(lastDot + 1);
  try {
    return Buffer.from(encodedUrl, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

// ── Readable parts (pure string split — safe in any runtime) ─────────────────

export function slugToReadableParts(slug: string): {
  title: string;
  company: string;
} {
  const lastDot = slug.lastIndexOf(".");
  const withoutUrl = lastDot !== -1 ? slug.slice(0, lastDot) : slug;
  const secondLastDot = withoutUrl.lastIndexOf(".");

  const titlePart =
    secondLastDot !== -1 ? withoutUrl.slice(0, secondLastDot) : withoutUrl;
  const companyPart =
    secondLastDot !== -1 ? withoutUrl.slice(secondLastDot + 1) : "";

  const capitalize = (s: string) =>
    s
      .split("-")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ")
      .trim();

  return { title: capitalize(titlePart), company: capitalize(companyPart) };
}

export function jobDetailPageUrl(
  title: string,
  company: string,
  url: string
): string {
  return `${BASE_URL}/jobs/${jobToSlug(title, company, url)}`;
}

// ── JSON-LD schema generators ─────────────────────────────────────────────────

export interface JobPostingSchemaParams {
  title: string;
  company: string;
  description: string;
  pageUrl: string;
  applyUrl?: string | null;
  salary?: string | null;
  location?: string | null;
  workMode?: string | null;
  jobType?: string | null;
  datePosted?: string | null;
  skills?: string[];
  requirements?: string[];
}

export function generateJobPostingSchema(p: JobPostingSchemaParams) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: p.title,
    description: p.description.slice(0, 5000),
    datePosted:
      p.datePosted || new Date().toISOString().split("T")[0],
    hiringOrganization: {
      "@type": "Organization",
      name: p.company,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: p.location || "Remote",
      },
    },
    ...(p.salary && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: { "@type": "QuantitativeValue", description: p.salary },
      },
    }),
    ...(p.workMode && { jobLocationType: p.workMode }),
    ...(p.jobType && { employmentType: p.jobType.toUpperCase() }),
    ...(p.applyUrl && { url: p.applyUrl }),
    ...(p.skills?.length && { skills: p.skills.join(", ") }),
  };
}

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JobClawd",
    url: BASE_URL,
    logo: `${BASE_URL}/icon.svg`,
    description:
      "AI-powered job search platform. Search 10+ job boards simultaneously — AI scores every vacancy against your CV.",
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "JobClawd",
    url: BASE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/dashboard/feed?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateBreadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
