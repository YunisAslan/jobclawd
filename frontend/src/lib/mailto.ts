import { UserProfile, JobDetail } from "@/types";

export function buildMailtoUrl(
  profile: UserProfile,
  job: JobDetail,
  selectedCVUrl?: string
): string {
  const to = job.email!;
  const nameFull = `${profile.name} ${profile.surname}`.trim();
  const cvUrl = selectedCVUrl || profile.cvLink || "";

  const subject = `Job application: ${job.title} - ${nameFull}`;

  const lines = [
    "Dear Hiring Manager,",
    "",
    `My name is ${nameFull} and I am interested in the «${job.title}» position at ${job.company}.`,
    "",
    "My experience and skills are detailed in my CV.",
  ];

  if (cvUrl) {
    lines.push("", `CV Link: ${cvUrl}`);
  }

  lines.push(
    "",
    "Contact details:",
    `Phone: ${profile.phone}`,
    `Email: ${profile.email}`,
    "",
    "Best regards,",
    nameFull
  );

  const body = lines.join("\n");
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}
