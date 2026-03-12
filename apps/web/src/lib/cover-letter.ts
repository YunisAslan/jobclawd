import { UserProfile, JobDetail, JobListing } from "@/types";

/**
 * Generates a cover letter tailored to the vacancy and user profile.
 * Uses template-based generation with smart field inclusion.
 */
export function generateCoverLetter(
  profile: UserProfile,
  job: JobListing,
  detail: JobDetail | null,
): string {
  const fullName = `${profile.name} ${profile.surname}`.trim();
  const headline = profile.headline || "";
  const experience = profile.years_of_experience;
  const employer = profile.current_employer;

  const lines: string[] = ["Dear Hiring Manager,", ""];

  // Opening — personalized intro
  let intro = `I am writing to express my interest in the ${job.title} position at ${job.company}.`;
  if (headline) {
    intro = `As a ${headline}, I am writing to express my interest in the ${job.title} position at ${job.company}.`;
  }
  lines.push(intro);
  lines.push("");

  // Middle — experience and relevance
  const middleLines: string[] = [];
  if (experience && experience > 0) {
    middleLines.push(
      `With ${experience} year${experience > 1 ? "s" : ""} of professional experience${employer ? ` and my current role at ${employer}` : ""}, I am confident I can contribute meaningfully to your team.`,
    );
  } else if (employer) {
    middleLines.push(
      `Through my work at ${employer}, I have developed relevant skills that align well with this role.`,
    );
  }

  // Match flags — address concerns proactively
  if (job.match_flags.length > 0) {
    middleLines.push(
      "I am eager to discuss how my background addresses the specific requirements of this position.",
    );
  }

  if (middleLines.length > 0) {
    lines.push(...middleLines, "");
  }

  // Closing
  lines.push(
    "I have attached my CV for your review and would welcome the opportunity to discuss this role further.",
    "",
    "Best regards,",
    fullName,
  );

  return lines.join("\n");
}

/**
 * Generates a default email subject for job applications.
 */
export function generateEmailSubject(_profile: UserProfile, job: JobListing): string {
  return job.title;
}
