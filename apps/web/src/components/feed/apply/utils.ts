import { UserProfile } from "@/types";
import { ApplyFormValues, ReadinessField } from "@/components/feed/types";

export function formFromProfile(profile: UserProfile): ApplyFormValues {
  return {
    fullName: `${profile.name} ${profile.surname}`.trim(),
    email: profile.email,
    phone: profile.phone ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    selectedCV: profile.cv_links.length > 0 ? profile.cv_links[0] : null,
  };
}

export function getReadiness(form: ApplyFormValues): ReadinessField[] {
  return [
    { label: "Name", filled: form.fullName.trim().length > 0 },
    { label: "Email", filled: form.email.trim().length > 0 },
    { label: "Phone", filled: form.phone.trim().length > 0 },
    { label: "CV", filled: form.selectedCV !== null },
    { label: "LinkedIn", filled: form.linkedin_url.trim().length > 0 },
    { label: "Portfolio", filled: form.portfolio_url.trim().length > 0 },
  ];
}
